import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { invariant } from '../lib/invariant.ts'
import { hydrate } from './utils.ts'

describe('hydration', () => {
  describe('text node handling', () => {
    it('adopts single server text node when client has multiple text children', async (t) => {
      let { container, root } = await hydrate(t, <span>Hello world</span>)

      let existingSpan = container.querySelector('span')
      invariant(existingSpan)
      let originalTextNode = existingSpan.firstChild
      invariant(originalTextNode instanceof Text)

      root.render(
        <span>
          {'Hello '}
          {'world'}
        </span>,
      )
      root.flush()

      assert.equal(container.querySelector('span'), existingSpan)
      assert.equal(existingSpan.textContent, 'Hello world')
    })

    it('subsequent update patches consolidated text content', async (t) => {
      let { container, root } = await hydrate(t, <span>Hello world</span>)

      let existingSpan = container.querySelector('span')
      invariant(existingSpan)

      let name = 'world'
      function render() {
        root.render(
          <span>
            {'Hello '}
            {name}
          </span>,
        )
        root.flush()
      }

      render()
      assert.equal(existingSpan.textContent, 'Hello world')

      name = 'Ryan'
      render()
      assert.equal(existingSpan.textContent, 'Hello Ryan')
    })

    it('handles null children as empty text', async (t) => {
      let { container, root } = await hydrate(t, <div>{null}</div>)

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)

      root.render(<div>{null}</div>)
      root.flush()

      assert.equal(container.querySelector('div'), existingDiv)
      assert.equal(existingDiv.textContent, '')
    })

    it('handles undefined children as empty text', async (t) => {
      let { container, root } = await hydrate(t, <div>{undefined}</div>)

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)

      root.render(<div>{undefined}</div>)
      root.flush()

      assert.equal(container.querySelector('div'), existingDiv)
      assert.equal(existingDiv.textContent, '')
    })

    it('handles false children as empty text', async (t) => {
      let { container, root } = await hydrate(t, <div>{false}</div>)

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)

      root.render(<div>{false}</div>)
      root.flush()

      assert.equal(container.querySelector('div'), existingDiv)
      assert.equal(existingDiv.textContent, '')
    })

    it('handles true children as empty text', async (t) => {
      let { container, root } = await hydrate(t, <div>{true}</div>)

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)

      root.render(<div>{true}</div>)
      root.flush()

      assert.equal(container.querySelector('div'), existingDiv)
      assert.equal(existingDiv.textContent, '')
    })
  })
})
