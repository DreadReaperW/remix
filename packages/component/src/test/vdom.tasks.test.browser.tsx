import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import type { Handle } from '../lib/component.ts'

describe('vnode rendering', () => {
  it('runs update tasks after updates', (t) => {
    let taskRan = false
    let capturedUpdate = () => {}
    function App(handle: Handle) {
      capturedUpdate = () => {
        handle.queueTask(() => {
          taskRan = true
        })
        handle.update()
      }

      return () => <div>Hello, world!</div>
    }

    let { root } = t.render(<App />)
    assert.equal(taskRan, false)

    capturedUpdate()
    assert.equal(taskRan, false)
    root.flush()
    assert.equal(taskRan, true)
  })

  it('handle.update() returns a promise that resolves with a signal', async (t) => {
    let capturedSignal: AbortSignal | undefined
    let capturedUpdate = () => {}
    function App(handle: Handle) {
      capturedUpdate = () => {
        handle.update().then((signal) => {
          capturedSignal = signal
        })
      }

      return () => <div>Hello, world!</div>
    }

    let { root } = t.render(<App />)
    assert.equal(capturedSignal, undefined)

    capturedUpdate()
    assert.equal(capturedSignal, undefined)
    root.flush()
    await Promise.resolve()
    assert.ok(capturedSignal instanceof AbortSignal)
    assert.equal(capturedSignal?.aborted, false)
  })
})
