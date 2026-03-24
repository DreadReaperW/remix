import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { invariant } from '../lib/invariant.ts'
import { on } from '../index.ts'

describe('vnode rendering', () => {
  describe('events integration', () => {
    it('attaches events via on() mixin', (t) => {
      let clicked = false
      let { container } = t.render(
        <button
          mix={[
            on('click', () => {
              clicked = true
            }),
          ]}
        >
          Click me
        </button>,
      )

      assert.equal(container.innerHTML, '<button>Click me</button>')

      let button = container.querySelector('button')
      invariant(button)
      button.click()
      assert.equal(clicked, true)
    })

    it('updates on() mixin listeners across rerenders', (t) => {
      let clickCount = 0
      function App() {
        return () => (
          <button
            mix={[
              on('click', () => {
                clickCount++
              }),
            ]}
          >
            Click me
          </button>
        )
      }

      let { container, root } = t.render(<App />)

      let button = container.querySelector('button')
      invariant(button)
      button.click()
      assert.equal(clickCount, 1)

      root.render(<App />)
      root.flush()

      button.click()
      assert.equal(clickCount, 2)
    })

    it('cleans up mixin listeners when removed', (t) => {
      let clickCount = 0
      let { container, root } = t.render(
        <button
          mix={[
            on('click', () => {
              clickCount++
            }),
          ]}
        >
          Click me
        </button>,
      )

      let button = container.querySelector('button')
      invariant(button)
      button.click()
      assert.equal(clickCount, 1)

      // remove event mixin
      root.render(<button>Click me</button>)
      root.flush()

      button.click()
      assert.equal(clickCount, 1)
    })
  })
})
