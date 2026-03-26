import { Worker } from 'node:worker_threads'
import { pathToFileURL } from 'node:url'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import { tsImport } from 'tsx/esm/api'
import { runTests } from './executor.ts'
import type { TestResults } from './executor.ts'
import type { Reporter } from './reporter.ts'
import { generateServerCoverageReport, type CoverageConfig } from './coverage.ts'

let workerUrl = new URL('./worker.ts', import.meta.url)

function runFileInWorker(file: string, extra?: Record<string, unknown>): Promise<TestResults> {
  return new Promise((resolve, reject) => {
    let worker = new Worker(workerUrl, {
      workerData: { file: pathToFileURL(file).href, ...extra },
    })
    let results: TestResults | undefined
    worker.once('message', (msg) => {
      results = msg
    })
    worker.once('error', reject)
    worker.once('exit', (code) => {
      if (code !== 0) reject(new Error(`Worker exited with code ${code}`))
      else if (results) resolve(results)
      else reject(new Error('Worker exited without sending results'))
    })
  })
}

async function runConcurrently(
  files: string[],
  concurrency: number,
  runFile: (file: string) => Promise<TestResults>,
  onResult: (results: TestResults, file: string) => void,
  onError: () => void,
): Promise<void> {
  let index = 0
  let active = 0

  await new Promise<void>((resolve) => {
    function dispatch() {
      while (active < concurrency && index < files.length) {
        let file = files[index]
        index++
        active++

        runFile(file).then(
          (results) => {
            onResult(results, file)
            active--
            if (index < files.length) {
              dispatch()
            } else if (active === 0) {
              resolve()
            }
          },
          (err) => {
            console.error(`Error running ${file}:`, err.message)
            console.error(err)
            onError()
            active--
            if (active === 0 && index >= files.length) resolve()
            else dispatch()
          },
        )
      }

      if (index >= files.length && active === 0) resolve()
    }

    dispatch()
  })
}

function createAccumulator(reporter: Reporter, type: 'server' | 'e2e') {
  let counts = { passed: 0, failed: 0, skipped: 0, todo: 0 }
  function accumulate(results: TestResults, file: string) {
    reporter.onResult(
      { ...results, tests: results.tests.map((t) => ({ ...t, filePath: file })) },
      type,
    )
    counts.passed += results.passed
    counts.failed += results.failed
    counts.skipped += results.skipped
    counts.todo += results.todo
  }
  return { accumulate, counts }
}

async function runFileInProcess(file: string): Promise<TestResults> {
  await tsImport(file, {
    parentURL: import.meta.url,
    tsconfig: new URL('../../tsconfig.json', import.meta.url).pathname,
  })
  return runTests()
}

export async function runServerTests(
  files: string[],
  reporter: Reporter,
  concurrency: number,
  options: { coverage?: CoverageConfig } = {},
): Promise<{ passed: number; failed: number; skipped: number; todo: number; thresholdsPassed: boolean }> {
  let { accumulate, counts } = createAccumulator(reporter, 'server')

  let coverageDataDir: string | undefined
  if (options.coverage) {
    if (concurrency === 0) {
      console.warn('Warning: --coverage is not supported with -c 0, skipping coverage.')
    } else {
      coverageDataDir = path.resolve(options.coverage.dir)
      await fsp.mkdir(coverageDataDir, { recursive: true })
      process.env.NODE_V8_COVERAGE = coverageDataDir
    }
  }

  if (concurrency === 0) {
    for (let file of files) {
      try {
        accumulate(await runFileInProcess(file), file)
      } catch (err: any) {
        console.error(`Error running ${file}:`, err.message)
        counts.failed++
      }
    }
    return { ...counts, thresholdsPassed: true }
  }

  // Run up to `concurrency` workers at a time, streaming results to the
  // reporter as each file finishes rather than waiting for all to complete.
  await runConcurrently(files, concurrency, (file) => runFileInWorker(file), accumulate, () => counts.failed++)

  let thresholdsPassed = true
  if (coverageDataDir && options.coverage) {
    thresholdsPassed = await generateServerCoverageReport(
      coverageDataDir,
      process.cwd(),
      new Set(files),
      options.coverage,
    )
    delete process.env.NODE_V8_COVERAGE
  }

  return { ...counts, thresholdsPassed }
}

export async function runE2ETests(
  files: string[],
  reporter: Reporter,
  concurrency: number,
  options: { open?: boolean } = {},
): Promise<{ passed: number; failed: number; skipped: number; todo: number }> {
  let { accumulate, counts } = createAccumulator(reporter, 'e2e')
  let effectiveConcurrency = concurrency === 0 ? 1 : concurrency
  await runConcurrently(
    files,
    effectiveConcurrency,
    (file) => runFileInWorker(file, { e2e: true, open: options.open }),
    accumulate,
    () => counts.failed++,
  )

  return counts
}
