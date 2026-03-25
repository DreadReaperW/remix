import { chromium, type Browser } from 'playwright'
import type { TestResults } from './executor.ts'
import type { Reporter } from './reporter.ts'
import { colors } from './utils.ts'
import { generateBrowserCoverageReport } from './coverage.ts'

export interface TestRunOptions {
  baseUrl: string
  console?: boolean
  coverage?: { dir: string }
  devtools?: boolean
  open?: boolean
  reporter: Reporter
}

export async function runBrowserTests(options: TestRunOptions): Promise<{
  results: TestResults
  close: () => Promise<void>
  disconnected: Promise<void>
}> {
  let browser: Browser | undefined

  try {
    browser = await chromium.launch({
      headless: !options.open,
      devtools: options.devtools,
    })

    let page = await browser.newPage()

    if (options.console) {
      page.on('console', (msg) => console.log(`${colors.dim('[browser console]')} ${msg.text()}`))
    }

    if (options.coverage) {
      await page.coverage.startJSCoverage({ resetOnNavigation: false })
    }

    let totalPassed = 0
    let totalFailed = 0
    let testFileUrls = new Set<string>()

    await page.route('**/file-results', async (route) => {
      let results = route.request().postDataJSON() as TestResults
      options.reporter.onResult(results, 'browser')
      totalPassed += results.passed
      totalFailed += results.failed
      for (let test of results.tests) {
        if (test.filePath) testFileUrls.add(test.filePath)
      }
      await route.fulfill({ status: 200 })
    })

    await page.goto(options.baseUrl)
    await page.waitForFunction('window.__testsDone', { timeout: 60000 }).catch(async (reason) => {
      console.log(await page.content())
      throw reason
    })

    if (options.coverage) {
      let coverageEntries = await page.coverage.stopJSCoverage()
      await generateBrowserCoverageReport(
        coverageEntries,
        options.baseUrl,
        process.cwd(),
        options.coverage.dir,
        testFileUrls,
      )
    }

    let allResults: TestResults = {
      passed: totalPassed,
      failed: totalFailed,
      skipped: 0,
      todo: 0,
      tests: [],
    }

    if (!options.open) {
      await page.close()
    }

    let close = async () => {
      await browser?.close()
      browser = undefined
    }

    let disconnected = new Promise<void>((resolve) => browser!.on('disconnected', () => resolve()))

    if (!options.open) {
      await close()
      return { results: allResults, close: async () => {}, disconnected: Promise.resolve() }
    }

    return { results: allResults, close, disconnected }
  } catch (error) {
    await browser?.close()
    throw error
  }
}
