import type { render as _render } from './framework-browser.ts'
import { mock, type MockFunction, type MockCall, type MockContext } from './mock.ts'

export type RenderResult = ReturnType<typeof _render>

export interface TestContext {
  mock: {
    fn<T extends (...args: any[]) => any>(impl?: T): MockFunction<T>
    method<T extends object, K extends keyof T>(
      obj: T,
      method: K,
      impl?: T[K] extends (...args: any[]) => any ? T[K] : never,
    ): MockFunction
  }
  render(node: Parameters<typeof _render>[0]): RenderResult
}

export function createTestContext(
  renderImpl?: (node: Parameters<typeof _render>[0]) => RenderResult,
): TestContext & { restore(): void } {
  let tracked: Array<() => void> = []
  let renders: Array<() => void> = []
  return {
    mock: {
      fn: mock.fn,
      method(obj, method, impl) {
        let mockFn = mock.method(obj, method, impl as any)
        if (mockFn.mock.restore) tracked.push(mockFn.mock.restore)
        return mockFn
      },
    },
    render: renderImpl
      ? (node) => {
          let result = renderImpl(node)
          renders.push(result.cleanup)
          return result
        }
      : () => {
          throw new Error('t.render() is not available in server test suites')
        },
    restore() {
      for (let r of tracked) r()
      tracked.length = 0
      for (let r of renders) r()
      renders.length = 0
    },
  }
}

export type { MockFunction, MockCall, MockContext }
