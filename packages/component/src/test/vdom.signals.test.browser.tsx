import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { invariant } from '../lib/invariant.ts'
import type { Handle } from '../lib/component.ts'

describe('vnode rendering', () => {
  describe('signals', () => {
    it('provides mounted signal on handle.signal', (t) => {
      let capturedSignal: AbortSignal | undefined
      function App(handle: Handle) {
        capturedSignal = handle.signal
        return () => null
      }

      let { root } = t.render(<App />)
      invariant(capturedSignal)
      assert.ok(capturedSignal instanceof AbortSignal)
      assert.equal(capturedSignal.aborted, false)

      root.render(null)
      root.flush()
      assert.equal(capturedSignal.aborted, true)
    })

    it('provides render signal to tasks and aborts on re-render', (t) => {
      let signals: AbortSignal[] = []
      function App(handle: Handle) {
        handle.queueTask((signal) => {
          signals.push(signal)
        })
        return () => null
      }

      let { root } = t.render(<App />)

      assert.equal(signals.length, 1)
      invariant(signals[0])
      assert.ok(signals[0] instanceof AbortSignal)
      assert.equal(signals[0].aborted, false)

      root.render(<App />)
      root.flush()
      assert.equal(signals.length, 1)
      invariant(signals[0])
      assert.equal(signals[0].aborted, true)
    })

    it('aborts handle.update() signal on next update', async (t) => {
      let capturedSignal: AbortSignal | undefined
      let capturedUpdate = () => {}
      function App(handle: Handle) {
        capturedUpdate = () => {
          handle.update().then((signal) => {
            capturedSignal = signal
          })
        }
        return () => null
      }

      let { root } = t.render(<App />)

      capturedUpdate()
      root.flush()
      await Promise.resolve()
      invariant(capturedSignal)
      let firstSignal = capturedSignal
      assert.equal(firstSignal.aborted, false)

      capturedUpdate()
      root.flush()
      assert.equal(firstSignal.aborted, true)
    })

    it('aborts queueTask signal when component is removed', (t) => {
      let capturedSignal: AbortSignal | undefined
      function App(handle: Handle) {
        handle.queueTask((signal) => {
          capturedSignal = signal
        })
        return () => null
      }

      let { root } = t.render(<App />)
      invariant(capturedSignal)
      assert.equal(capturedSignal.aborted, false)

      root.render(null)
      root.flush()
      assert.equal(capturedSignal.aborted, true)
    })

    it('aborts handle.update() signal when component is removed', async (t) => {
      let capturedSignal: AbortSignal | undefined
      let capturedUpdate = () => {}
      function App(handle: Handle) {
        capturedUpdate = () => {
          handle.update().then((signal) => {
            capturedSignal = signal
          })
        }
        return () => null
      }

      let { root } = t.render(<App />)

      capturedUpdate()
      root.flush()
      await Promise.resolve()
      invariant(capturedSignal)
      assert.equal(capturedSignal.aborted, false)

      root.render(null)
      root.flush()
      assert.equal(capturedSignal.aborted, true)
    })
  })
})
