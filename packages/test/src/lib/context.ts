import type { RemixNode } from '@remix-run/component/jsx-runtime'
import type { render } from './framework-browser.ts'
import { mock, type MockFunction, type MockCall, type MockContext } from './mock.ts'

export interface TestContext {
  mock: {
    fn<T extends (...args: any[]) => any>(impl?: T): MockFunction<T>
    method<T extends object, K extends keyof T>(
      obj: T,
      method: K,
      impl?: T[K] extends (...args: any[]) => any ? T[K] : never,
    ): MockFunction
  }
  after(fn: () => void): void
  render: typeof render
}

export function createTestContext(renderImpl?: typeof render): TestContext & { cleanup(): void } {
  let tracked: Array<() => void> = []
  let renders: Array<() => void> = []
  let afters: Array<() => void> = []
  return {
    mock: {
      fn: mock.fn,
      method(obj, method, impl) {
        let mockFn = mock.method(obj, method, impl as any)
        if (mockFn.mock.restore) tracked.push(mockFn.mock.restore)
        return mockFn
      },
    },
    after(fn) {
      afters.push(fn)
    },
    render(node) {
      if (!renderImpl) {
        throw new Error('t.render() is not available in server test suites')
      }
      let result = renderImpl(node)
      renders.push(result.cleanup)
      return result
    },
    cleanup() {
      for (let r of tracked) r()
      tracked.length = 0
      for (let r of renders) r()
      renders.length = 0
      for (let a of afters) a()
      afters.length = 0
    },
  }
}

export type { MockFunction, MockCall, MockContext }
