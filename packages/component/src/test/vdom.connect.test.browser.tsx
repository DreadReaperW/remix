import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import type { Handle } from '../lib/component.ts'
import { ref } from '../lib/mixins/ref-mixin.tsx'

describe('vnode rendering', () => {
  describe('ref', () => {
    it('connects host node lifecycle to component scope', (t) => {
      let capturedNode: Element | null = null

      function App(handle: Handle) {
        return () => (
          <div
            mix={[
              ref((node: Element, signal: AbortSignal) => {
                capturedNode = node
                signal.addEventListener('abort', () => {
                  capturedNode = null
                })
              }),
            ]}
          >
            Hello, world!
          </div>
        )
      }

      let { root } = t.render(<App />)
      assert.ok(capturedNode instanceof HTMLDivElement)

      root.render(null)
      root.flush()
      assert.equal(capturedNode, null)
    })
  })

  it('calls ref only once', (t) => {
    let capturedUpdate = () => {}
    let refCalls = 0

    function App(handle: Handle) {
      capturedUpdate = () => handle.update()
      return () => (
        <div
          mix={[
            ref(() => {
              refCalls++
            }),
          ]}
        >
          Hello, world!
        </div>
      )
    }

    let { root } = t.render(<App />)
    assert.equal(refCalls, 1)

    capturedUpdate()
    root.flush()
    assert.equal(refCalls, 1)
  })
})
