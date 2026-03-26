import type { render } from './framework-browser.ts'
import type { Browser, Page } from 'playwright'
import { mock, type MockFunction, type MockCall, type MockContext } from './mock.ts'
import { createFakeTimers, type FakeTimers } from './fake-timers.ts'
import type { V8CoverageEntry } from './coverage.ts'

import type { CreateServerFunction } from './e2e-server.ts'

export type { CreateServerFunction }

export interface TestContext {
  mock<T extends (...args: any[]) => any>(impl?: T): MockFunction<T>
  spyOn<T extends object, K extends keyof T>(
    obj: T,
    method: K,
    impl?: T[K] extends (...args: any[]) => any ? T[K] : never,
  ): MockFunction
  after(fn: () => void): void
  useFakeTimers(): FakeTimers
  render: typeof render
  serve(handler: (req: Request) => Promise<Response>): Promise<Page>
}

export function createTestContext(
  renderImpl?: typeof render,
  createServer?: CreateServerFunction,
  browser?: Browser,
  coverage?: boolean,
): TestContext & { cleanup(): Promise<void>; e2eBrowserCoverageEntries: Array<{ entries: V8CoverageEntry[]; baseUrl: string }> } {
  let cleanups: Array<() => void | Promise<void>> = []
  let e2eBrowserCoverageEntries: Array<{ entries: V8CoverageEntry[]; baseUrl: string }> = []
  return {
    e2eBrowserCoverageEntries,
    mock: mock.fn,
    spyOn(obj, method, impl) {
      let mockFn = mock.spyOn(obj, method, impl as any)
      if (mockFn.mock.restore) cleanups.push(mockFn.mock.restore)
      return mockFn
    },
    after(fn) {
      cleanups.push(fn)
    },
    useFakeTimers() {
      let timers = createFakeTimers()
      cleanups.push(timers.restore)
      return timers
    },
    render(node, opts) {
      if (!renderImpl) {
        throw new Error('t.render() is only available in browser test suites')
      }
      let result = renderImpl(node, opts)
      cleanups.push(result.cleanup)
      return result
    },
    async serve(handler) {
      if (!createServer || !browser) {
        throw new Error('t.serve() is only available in E2E test suites')
      }
      let server = await createServer(handler)
      let page = await browser.newPage({ baseURL: server.baseUrl })
      if (coverage) {
        await page.coverage.startJSCoverage({ resetOnNavigation: false })
      }
      cleanups.push(async () => {
        if (coverage) {
          let entries = await page.coverage.stopJSCoverage()
          e2eBrowserCoverageEntries.push({ entries: entries as unknown as V8CoverageEntry[], baseUrl: server.baseUrl })
        }
        await page.close()
        await server.close()
      })
      return page
    },
    async cleanup() {
      for (let fn of cleanups) await fn()
      cleanups.length = 0
    },
  }
}

export type { MockFunction, MockCall, MockContext }
