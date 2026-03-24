import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { createRoot } from '../lib/vdom.ts'
import { on } from '../index.ts'
import type { Handle } from '../lib/component.ts'

describe('vdom error handling', () => {
  describe('root event forwarding', () => {
    it('forwards bubbling DOM error events to root listeners', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      let forwarded: unknown

      root.addEventListener('error', (event) => {
        forwarded = (event as ErrorEvent).error
      })

      let expected = new Error('createRoot forwarded error')
      container.dispatchEvent(new ErrorEvent('error', { bubbles: true, error: expected }))

      assert.equal(forwarded, expected)
    })

    it('stops forwarding bubbling DOM error events after dispose', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      let forwarded: unknown

      root.addEventListener('error', (event) => {
        forwarded = (event as ErrorEvent).error
      })

      root.dispose()

      container.dispatchEvent(
        new ErrorEvent('error', { bubbles: true, error: new Error('after dispose') }),
      )

      assert.equal(forwarded, undefined)
    })

    it('dispose is a no-op before first render', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      root.dispose()
      root.flush()

      assert.equal(container.innerHTML, '')
    })
  })

  describe('setup errors', () => {
    it('dispatches error event when setup throws', (t) => {
      let container = document.createElement('div')
      let root = createRoot(container)
      let errorHandler = t.mock()
      root.addEventListener('error', errorHandler)

      let error = new Error('setup error')
      function BadComponent() {
        throw error
        return () => <div>ok</div>
      }

      root.render(<BadComponent />)

      assert.equal(errorHandler.mock.calls.length, 1)
      assert.equal((errorHandler.mock.calls[0]!.arguments[0] as ErrorEvent).error, error)
    })

    it('dispatches error event when nested component setup throws', (t) => {
      let container = document.createElement('div')
      let root = createRoot(container)
      let errorHandler = t.mock()
      root.addEventListener('error', errorHandler)

      let error = new Error('nested setup error')
      function BadChild() {
        throw error
        return () => null
      }

      function Parent() {
        return () => (
          <div>
            <BadChild />
          </div>
        )
      }

      root.render(<Parent />)

      assert.equal(errorHandler.mock.calls.length, 1)
      assert.equal((errorHandler.mock.calls[0]!.arguments[0] as ErrorEvent).error, error)
    })
  })

  describe('render errors', () => {
    it('dispatches error event when render function throws', (t) => {
      let container = document.createElement('div')
      let root = createRoot(container)
      let errorHandler = t.mock()
      root.addEventListener('error', errorHandler)

      let error = new Error('render error')
      function BadComponent() {
        return () => {
          throw error
        }
      }

      root.render(<BadComponent />)

      assert.equal(errorHandler.mock.calls.length, 1)
      assert.equal((errorHandler.mock.calls[0]!.arguments[0] as ErrorEvent).error, error)
    })

    it('dispatches error event when render throws on update', (t) => {
      let shouldThrow = false
      let error = new Error('render update error')
      let update: () => void

      function Component(handle: Handle) {
        update = () => handle.update()
        return () => {
          if (shouldThrow) throw error
          return <div>ok</div>
        }
      }

      let { container, root } = t.render(<Component />)
      let errorHandler = t.mock()
      root.addEventListener('error', errorHandler)
      assert.equal(container.innerHTML, '<div>ok</div>')
      assert.equal(errorHandler.mock.calls.length, 0)

      shouldThrow = true
      update!()
      root.flush()

      assert.equal(errorHandler.mock.calls.length, 1)
      assert.equal((errorHandler.mock.calls[0]!.arguments[0] as ErrorEvent).error, error)
    })
  })

  describe('event handler errors', () => {
    it('runs sync event handlers attached via on() mixin', (t) => {
      let clicks = 0
      let { container } = t.render(
        <button mix={[on('click', () => { clicks++ })]}>Click</button>,
      )

      let button = container.querySelector('button')!
      button.click()

      assert.equal(clicks, 1)
    })

    it('runs async event handlers attached via on() mixin', async (t) => {
      let calls = 0
      let { container } = t.render(
        <button mix={[on('click', async () => { await Promise.resolve(); calls++ })]}>Click</button>,
      )

      let button = container.querySelector('button')!
      button.click()

      await Promise.resolve()
      await Promise.resolve()

      assert.equal(calls, 1)
    })
  })

  describe('queueTask errors', () => {
    it('dispatches error event when sync queueTask throws', (t) => {
      let container = document.createElement('div')
      let root = createRoot(container)
      let errorHandler = t.mock()
      root.addEventListener('error', errorHandler)

      let error = new Error('sync task error')

      function Component(handle: Handle) {
        handle.queueTask(() => {
          throw error
        })
        return () => <div>ok</div>
      }

      root.render(<Component />)
      root.flush()

      assert.equal(errorHandler.mock.calls.length, 1)
      assert.equal((errorHandler.mock.calls[0]!.arguments[0] as ErrorEvent).error, error)
    })

    it('dispatches error event when queueTask from update throws', (t) => {
      let error = new Error('update task error')
      let update: () => void

      function Component(handle: Handle) {
        update = () => {
          handle.queueTask(() => {
            throw error
          })
          handle.update()
        }
        return () => <div>ok</div>
      }

      let { root } = t.render(<Component />)
      let errorHandler = t.mock()
      root.addEventListener('error', errorHandler)
      assert.equal(errorHandler.mock.calls.length, 0)

      update!()
      root.flush()

      assert.equal(errorHandler.mock.calls.length, 1)
      assert.equal((errorHandler.mock.calls[0]!.arguments[0] as ErrorEvent).error, error)
    })
  })

  describe('error does not prevent other work', () => {
    it('continues running tasks after task error', (t) => {
      let container = document.createElement('div')
      let root = createRoot(container)
      let errorHandler = t.mock()
      root.addEventListener('error', errorHandler)

      let taskRan = false

      function Bad(handle: Handle) {
        handle.queueTask(() => {
          throw new Error('bad task')
        })
        return () => <div>bad</div>
      }

      function Good(handle: Handle) {
        handle.queueTask(() => {
          taskRan = true
        })
        return () => <div>good</div>
      }

      root.render(
        <>
          <Bad />
          <Good />
        </>,
      )
      root.flush()

      assert.equal(errorHandler.mock.calls.length, 1)
      assert.equal(taskRan, true)
    })
  })

  describe('DOM state after errors', () => {
    it('leaves DOM empty when initial render throws', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      root.addEventListener('error', () => {})

      function Bad() {
        throw new Error('bad')
        return () => <div>ok</div>
      }

      root.render(<Bad />)

      assert.equal(container.innerHTML, '')
    })

    it('preserves previous DOM when update throws', (t) => {
      let shouldThrow = false
      let update: () => void

      function Component(handle: Handle) {
        update = () => handle.update()
        return () => {
          if (shouldThrow) throw new Error('update error')
          return <div>ok</div>
        }
      }

      let { container, root } = t.render(<Component />)
      root.addEventListener('error', () => {})
      assert.equal(container.innerHTML, '<div>ok</div>')

      shouldThrow = true
      update!()
      root.flush()

      assert.equal(container.innerHTML, '<div>ok</div>')
    })

    it('preserves DOM when event handler runs', (t) => {
      let { container } = t.render(
        <button mix={[on('click', () => {})]}>Click</button>,
      )

      assert.equal(container.innerHTML, '<button>Click</button>')

      let button = container.querySelector('button')!
      button.click()

      assert.equal(container.innerHTML, '<button>Click</button>')
    })
  })

  describe('cascading updates protection', () => {
    it('dispatches error when handle.update() is called during render', async (t) => {
      let renderCount = 0
      let triggerUpdate: () => void

      function InfiniteLoop(handle: Handle) {
        triggerUpdate = () => {
          handle.update()
        }
        return () => {
          renderCount++
          if (renderCount > 1) {
            handle.update()
          }
          return <div>count: {renderCount}</div>
        }
      }

      let { container, root } = t.render(<InfiniteLoop />)
      let errorHandler = t.mock()
      root.addEventListener('error', errorHandler)
      assert.equal(container.innerHTML, '<div>count: 1</div>')
      assert.equal(renderCount, 1)

      triggerUpdate!()
      await new Promise((resolve) => setTimeout(resolve, 10))

      assert.ok(errorHandler.mock.calls.length > 0)
      let error = (errorHandler.mock.calls[0]!.arguments[0] as ErrorEvent).error as Error
      assert.match(error.message, /infinite loop detected/)
      assert.ok(renderCount < 100)
    })

    it('allows legitimate multiple updates within same event loop turn', (t) => {
      let count = 0
      let update: () => void

      function Counter(handle: Handle) {
        update = () => handle.update()
        return () => <div>count: {count}</div>
      }

      let { container, root } = t.render(<Counter />)
      let errorHandler = t.mock()
      root.addEventListener('error', errorHandler)

      count++
      update!()
      root.flush()

      count++
      update!()
      root.flush()

      count++
      update!()
      root.flush()

      assert.equal(container.innerHTML, '<div>count: 3</div>')
      assert.equal(errorHandler.mock.calls.length, 0)
    })
  })
})
