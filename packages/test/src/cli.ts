#!/usr/bin/env node
import * as util from 'node:util'
import * as os from 'node:os'
import * as fsp from 'node:fs/promises'
import type * as http from 'node:http'
import * as path from 'node:path'
import { tsImport } from 'tsx/esm/api'
import { runBrowserTests } from './lib/runner-browser.ts'
import { runServerTests } from './lib/runner.ts'
import { runE2ETests } from './lib/runner-e2e.ts'
import { createReporter } from './lib/reporter.ts'
import { createWatcher } from './lib/watcher.ts'

let { values, positionals } = util.parseArgs({
  args: process.argv.slice(2),
  options: {
    browserConsole: { type: 'boolean', short: 'd' },
    browserDevtools: { type: 'boolean' },
    browserGlob: { type: 'string', default: '**/*.test.browser.{ts,tsx}' },
    e2eGlob: { type: 'string', default: '**/*.test.e2e.{ts,tsx}' },
    browserOpen: { type: 'boolean', short: 'u' },
    browserPort: { type: 'string', short: 'p' },
    concurrency: { type: 'string', short: 'c', default: String(os.availableParallelism()) },
    coverage: { type: 'boolean' },
    coverageDir: { type: 'string', default: '.coverage' },
    coverageInclude: { type: 'string', multiple: true },
    coverageExclude: { type: 'string', multiple: true },
    coverageLines: { type: 'string' },
    coverageBranches: { type: 'string' },
    coverageFunctions: { type: 'string' },
    reporter: { type: 'string', short: 'r', default: process.env.CI === 'true' ? 'dot' : 'spec' },
    watch: { type: 'boolean', short: 'w' },
  },
  allowPositionals: true,
})

const pattern = positionals[0] || '**/*.test?(.browser)?(.e2e).{ts,tsx}'
const defaultBrowserPort = Number(values.browserPort ?? 44101)
const retryBrowserPort = values.browserPort === undefined

let hasExited = false
let latestExitCode = 0
let watcher: ReturnType<typeof createWatcher> | undefined
let running = false
let queued = false
let rerunTimer: NodeJS.Timeout | undefined
let browserServer: http.Server | undefined
let browserPort = defaultBrowserPort

process.on('SIGINT', () => cleanupAndExit(latestExitCode))
process.on('SIGTERM', () => cleanupAndExit(latestExitCode))

try {
  await executeRun()

  if (values.watch) {
    console.log('Watching for changes. Press Ctrl+C to stop.')
  }
} catch {
  cleanupAndExit(1)
}

async function executeRun() {
  if (hasExited) return

  running = true

  try {
    let files = await discoverTests(pattern)

    if (files.length === 0) {
      console.log(`No test files found matching pattern: ${pattern}`)
      return
    }

    let browserSet = new Set(await discoverTests(values.browserGlob!))
    let e2eSet = new Set(await discoverTests(values.e2eGlob!))
    let browserFiles = files.filter((f) => browserSet.has(f))
    let e2eFiles = files.filter((f) => e2eSet.has(f))
    let serverFiles = files.filter((f) => !browserSet.has(f) && !e2eSet.has(f))

    console.log(
      `Found ${files.length} test file(s) (${serverFiles.length} server, ${browserFiles.length} browser, ${e2eFiles.length} e2e)\n`,
    )
    if (values.watch) {
      watcher ??= createWatcher((file) => queueRerun(file))
      watcher.update(files)
    }

    if (browserFiles.length > 0 && !browserServer) {
      let { startServer } = await tsImport('./app/server.tsx', {
        parentURL: import.meta.url,
        tsconfig: new URL('../tsconfig.json', import.meta.url).pathname,
      })
      let result = await startServer(defaultBrowserPort, browserFiles, retryBrowserPort)
      browserServer = result.server
      browserPort = result.port
    }

    let coverageConfig = values.coverage
      ? {
          dir: values.coverageDir!,
          include: values.coverageInclude,
          exclude: values.coverageExclude,
          lines: values.coverageLines !== undefined ? Number(values.coverageLines) : undefined,
          branches:
            values.coverageBranches !== undefined ? Number(values.coverageBranches) : undefined,
          functions:
            values.coverageFunctions !== undefined ? Number(values.coverageFunctions) : undefined,
        }
      : undefined

    let reporter = createReporter(values.reporter!)
    let startTime = performance.now()
    let [serverResult, browserResult, e2eResult] = await Promise.all([
      serverFiles.length > 0
        ? runServerTests(serverFiles, reporter, Number(values.concurrency), {
            coverage: coverageConfig,
          })
        : null,
      browserFiles.length > 0
        ? runBrowserTests({
            baseUrl: `http://localhost:${browserPort}`,
            console: values.browserConsole,
            coverage: coverageConfig,
            devtools: values.browserDevtools,
            open: values.browserOpen,
            reporter,
          })
        : null,
      e2eFiles.length > 0
        ? runE2ETests(e2eFiles, reporter, Number(values.concurrency), { open: values.browserOpen })
        : null,
    ])

    let totalPassed =
      (serverResult?.passed ?? 0) + (browserResult?.results.passed ?? 0) + (e2eResult?.passed ?? 0)
    let totalFailed =
      (serverResult?.failed ?? 0) + (browserResult?.results.failed ?? 0) + (e2eResult?.failed ?? 0)
    let totalSkipped =
      (serverResult?.skipped ?? 0) +
      (browserResult?.results.skipped ?? 0) +
      (e2eResult?.skipped ?? 0)
    let totalTodo =
      (serverResult?.todo ?? 0) + (browserResult?.results.todo ?? 0) + (e2eResult?.todo ?? 0)
    reporter.onSummary(
      totalPassed,
      totalFailed,
      performance.now() - startTime,
      totalSkipped,
      totalTodo,
    )

    if (values.browserOpen && browserResult) {
      console.log('\nBrowser is open. Press Ctrl+C to close.')
      await Promise.race([
        browserResult.disconnected,
        new Promise<void>((resolve) => {
          process.once('SIGINT', resolve)
          process.once('SIGTERM', resolve)
        }),
      ])
      await browserResult.close()
    }

    let thresholdsPassed =
      (serverResult?.thresholdsPassed ?? true) && (browserResult?.thresholdsPassed ?? true)
    latestExitCode = totalFailed > 0 || !thresholdsPassed ? 1 : 0
  } catch (error) {
    console.error('Error running tests:', error)
    latestExitCode = 1
  } finally {
    running = false
    if (queued) {
      queued = false
      queueRerun('queued change')
    } else if (!values.watch) {
      cleanupAndExit(latestExitCode)
    }
  }
}

async function discoverTests(pattern: string): Promise<string[]> {
  let files: string[] = []
  let exclude = ['node_modules/**', '.git/**']

  for await (let file of fsp.glob(pattern, { cwd: process.cwd(), exclude })) {
    files.push(path.resolve(process.cwd(), file))
  }

  return files.sort()
}

function queueRerun(reason: string) {
  if (!values.watch || hasExited) return

  clearTimeout(rerunTimer)

  rerunTimer = setTimeout(() => {
    rerunTimer = undefined
    if (running) {
      queued = true
    } else {
      console.log(`\n↻ Change detected (${reason}), re-running tests...\n`)
      void executeRun()
    }
  }, 100)
}

function cleanupAndExit(code: number) {
  if (hasExited) return
  hasExited = true
  watcher?.close()
  browserServer?.close()
  process.exit(code)
}
