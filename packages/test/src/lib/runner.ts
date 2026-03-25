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

function runFileInWorker(file: string): Promise<TestResults> {
  return new Promise((resolve, reject) => {
    let worker = new Worker(workerUrl, {
      workerData: { file: pathToFileURL(file).href },
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
  let passed = 0
  let failed = 0
  let skipped = 0
  let todo = 0

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

  function accumulate(results: TestResults, file: string) {
    reporter.onResult(
      { ...results, tests: results.tests.map((t) => ({ ...t, filePath: file })) },
      'server',
    )
    passed += results.passed
    failed += results.failed
    skipped += results.skipped
    todo += results.todo
  }

  if (concurrency === 0) {
    for (let file of files) {
      try {
        accumulate(await runFileInProcess(file), file)
      } catch (err: any) {
        console.error(`Error running ${file}:`, err.message)
        failed++
      }
    }
    return { passed, failed, skipped, todo, thresholdsPassed: true }
  }

  // Run up to `concurrency` workers at a time, streaming results to the
  // reporter as each file finishes rather than waiting for all to complete.
  let index = 0
  let active = 0

  await new Promise<void>((resolve) => {
    function dispatch() {
      while (active < concurrency && index < files.length) {
        let file = files[index]
        index++
        active++

        runFileInWorker(file).then(
          (results) => {
            accumulate(results, file)
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
            failed++
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

  return { passed, failed, skipped, todo, thresholdsPassed }
}
