import type { RemixNode } from '@remix-run/component/jsx-runtime'
import type { render } from './framework-browser.ts'
import { mock, type MockFunction, type MockCall, type MockContext } from './mock.ts'
import { createFakeTimers, type FakeTimers } from './fake-timers.ts'

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
  useFakeTimers(): FakeTimers
  render: typeof render
}

export function createTestContext(renderImpl?: typeof render): TestContext & { cleanup(): void } {
  let cleanups: Array<() => void> = []
  return {
    mock: {
      fn: mock.fn,
      method(obj, method, impl) {
        let mockFn = mock.method(obj, method, impl as any)
        if (mockFn.mock.restore) cleanups.push(mockFn.mock.restore)
        return mockFn
      },
    },
    after(fn) {
      cleanups.push(fn)
    },
    useFakeTimers() {
      let timers = createFakeTimers()
      cleanups.push(timers.restore)
      return timers
    },
    render(node) {
      if (!renderImpl) {
        throw new Error('t.render() is not available in server test suites')
      }
      let result = renderImpl(node)
      cleanups.push(result.cleanup)
      return result
    },
    cleanup() {
      for (let a of cleanups) a()
      cleanups.length = 0
    },
  }
}

export type { MockFunction, MockCall, MockContext }
