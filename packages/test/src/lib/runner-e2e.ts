import { Worker } from 'node:worker_threads'
import { pathToFileURL } from 'node:url'
import type { TestResults } from './executor.ts'
import type { Reporter } from './reporter.ts'

let workerUrl = new URL('./worker-e2e.ts', import.meta.url)

function runFileInWorker(file: string, open?: boolean): Promise<TestResults> {
  return new Promise((resolve, reject) => {
    let worker = new Worker(workerUrl, {
      workerData: { file: pathToFileURL(file).href, open },
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

export async function runE2ETests(
  files: string[],
  reporter: Reporter,
  concurrency: number,
  options: { open?: boolean } = {},
): Promise<{ passed: number; failed: number; skipped: number; todo: number }> {
  let passed = 0
  let failed = 0
  let skipped = 0
  let todo = 0

  function accumulate(results: TestResults, file: string) {
    reporter.onResult(
      { ...results, tests: results.tests.map((t) => ({ ...t, filePath: file })) },
      'e2e',
    )
    passed += results.passed
    failed += results.failed
    skipped += results.skipped
    todo += results.todo
  }

  let index = 0
  let active = 0
  let effectiveConcurrency = concurrency === 0 ? 1 : concurrency

  await new Promise<void>((resolve) => {
    function dispatch() {
      while (active < effectiveConcurrency && index < files.length) {
        let file = files[index]
        index++
        active++

        runFileInWorker(file, options.open).then(
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

  return { passed, failed, skipped, todo }
}
