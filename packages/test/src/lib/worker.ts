import * as http from 'node:http'
import { workerData, parentPort } from 'node:worker_threads'
import { tsImport } from 'tsx/esm/api'
import { chromium } from 'playwright'
import { createRequestListener } from '@remix-run/node-fetch-server'
import { runTests, type TestResults } from './executor.ts'

try {
  await tsImport(workerData.file, import.meta.url)

  if (workerData.e2e) {
    let browser = await chromium.launch({ headless: !workerData.open })
    try {
      let results = await runTests({ browser, createServer })
      parentPort!.postMessage(results)
      if (workerData.open) {
        console.log('\nBrowser is open. Press Ctrl+C to close.')
        await new Promise<void>((resolve) => browser.on('disconnected', () => resolve()))
      }
    } finally {
      await browser.close()
    }
  } else {
    let results = await runTests()
    parentPort!.postMessage(results)
  }
} catch (e) {
  let results: TestResults = {
    passed: 0,
    failed: 1,
    skipped: 0,
    todo: 0,
    tests: [
      {
        name: '',
        suiteName: '',
        status: 'failed',
        duration: 0,
        error: {
          message: e instanceof Error ? e.message : String(e),
          stack: e instanceof Error ? e.stack : undefined,
        },
      },
    ],
  }
  parentPort!.postMessage(results)
}

function createServer(handler: (req: Request) => Promise<Response>): Promise<{
  baseUrl: string
  close(): Promise<void>
}> {
  return new Promise((resolve, reject) => {
    let server = http.createServer(createRequestListener(handler))

    server.listen(0, '127.0.0.1', () => {
      let addr = server.address() as { port: number }
      resolve({
        baseUrl: `http://127.0.0.1:${addr.port}`,
        close: () => new Promise((r, rj) => server.close((e) => (e ? rj(e) : r()))),
      })
    })

    server.on('error', reject)
  })
}
