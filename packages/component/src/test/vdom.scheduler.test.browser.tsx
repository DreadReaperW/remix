import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import type { Handle, RemixNode } from '../lib/component.ts'

describe('vnode rendering', () => {
  describe('scheduling', () => {
    it('skips descendant updates if ancestor is scheduled', (t) => {
      let capturedParentUpdate = () => {}
      let appRenderCount = 0
      function Parent(handle: Handle) {
        capturedParentUpdate = () => {
          handle.update()
        }
        return ({ children }: { children: RemixNode }) => {
          appRenderCount++
          return children
        }
      }

      let childRenderCount = 0
      let capturedChildUpdate = () => {}
      function Child(handle: Handle) {
        capturedChildUpdate = () => {
          handle.update()
        }
        return () => {
          childRenderCount++
          return <div>Hello, world!</div>
        }
      }

      let { container, root } = t.render(
        <Parent>
          <Child />
        </Parent>,
      )
      assert.equal(container.innerHTML, '<div>Hello, world!</div>')
      assert.equal(appRenderCount, 1)
      assert.equal(childRenderCount, 1)

      capturedChildUpdate()
      capturedParentUpdate()
      root.flush()

      assert.equal(appRenderCount, 2)
      assert.equal(childRenderCount, 2)

      // swap order
      capturedParentUpdate()
      capturedChildUpdate()
      root.flush()

      assert.equal(appRenderCount, 3)
      assert.equal(childRenderCount, 3)
    })

    it('only runs tasks once', async (t) => {
      let taskCount = 0
      let capturedUpdate = () => {}
      function App(handle: Handle) {
        handle.queueTask(() => {
          taskCount++
        })

        capturedUpdate = () => {
          handle.queueTask(() => {
            taskCount++
          })
          handle.update()
        }
        return () => null
      }

      let { root } = t.render(<App />)
      assert.equal(taskCount, 1)

      capturedUpdate()
      root.flush()
      assert.equal(taskCount, 2)
    })
  })
})
