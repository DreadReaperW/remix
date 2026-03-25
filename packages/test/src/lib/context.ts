import type { render } from './framework-browser.ts'
import type { Browser, Page } from 'playwright'
import { mock, type MockFunction, type MockCall, type MockContext } from './mock.ts'
import { createFakeTimers, type FakeTimers } from './fake-timers.ts'
import type { createE2EServer } from './e2e-server.ts'

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
  createServer?: typeof createE2EServer,
  browser?: Browser,
): TestContext & { cleanup(): void } {
  let cleanups: Array<() => void> = []
  return {
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
      cleanups.push(() => server.close())
      return browser.newPage({ baseURL: server.baseUrl })
    },
    cleanup() {
      for (let a of cleanups) a()
      cleanups.length = 0
    },
  }
}

export type { MockFunction, MockCall, MockContext }
