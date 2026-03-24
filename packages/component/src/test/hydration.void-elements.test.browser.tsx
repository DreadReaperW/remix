import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { invariant } from '../lib/invariant.ts'
import { hydrate } from './utils.ts'

describe('hydration', () => {
  describe('self-closing/void elements', () => {
    it('hydrates input element', async (t) => {
      let { container, root } = await hydrate(t, <input type="text" placeholder="Enter text" />)

      let existingInput = container.querySelector('input')
      invariant(existingInput)

      root.render(<input type="text" placeholder="Enter text" />)
      root.flush()

      assert.equal(container.querySelector('input'), existingInput)
      assert.equal(existingInput.placeholder, 'Enter text')
    })

    it('hydrates br element', async (t) => {
      let { container, root } = await hydrate(
        t,
        <div>
          Line 1<br />
          Line 2
        </div>,
      )

      let existingBr = container.querySelector('br')
      invariant(existingBr)

      root.render(
        <div>
          Line 1<br />
          Line 2
        </div>,
      )
      root.flush()

      assert.equal(container.querySelector('br'), existingBr)
    })

    it('hydrates img element', async (t) => {
      let { container, root } = await hydrate(t, <img src="/image.png" alt="Test image" />)

      let existingImg = container.querySelector('img')
      invariant(existingImg)

      root.render(<img src="/image.png" alt="Test image" />)
      root.flush()

      assert.equal(container.querySelector('img'), existingImg)
      assert.equal(existingImg.getAttribute('src'), '/image.png')
      assert.equal(existingImg.getAttribute('alt'), 'Test image')
    })

    it('hydrates hr element', async (t) => {
      let { container, root } = await hydrate(
        t,
        <div>
          <p>Above</p>
          <hr />
          <p>Below</p>
        </div>,
      )

      let existingHr = container.querySelector('hr')
      invariant(existingHr)

      root.render(
        <div>
          <p>Above</p>
          <hr />
          <p>Below</p>
        </div>,
      )
      root.flush()

      assert.equal(container.querySelector('hr'), existingHr)
    })

    it('hydrates meta element', async (t) => {
      let { container, root } = await hydrate(t, <meta name="description" content="Test page" />)

      let existingMeta = container.querySelector('meta')
      invariant(existingMeta)

      root.render(<meta name="description" content="Test page" />)
      root.flush()

      assert.equal(document.head.querySelector('meta[name="description"]'), existingMeta)
      assert.equal(container.querySelector('meta'), null)
      assert.equal(existingMeta.getAttribute('name'), 'description')
      assert.equal(existingMeta.getAttribute('content'), 'Test page')
    })

    it('hydrates link element', async (t) => {
      let { container, root } = await hydrate(
        t,
        <link rel="stylesheet" href="/styles.css" />,
      )

      let existingLink = container.querySelector('link')
      invariant(existingLink)

      root.render(<link rel="stylesheet" href="/styles.css" />)
      root.flush()

      assert.equal(document.head.querySelector('link'), existingLink)
      assert.equal(container.querySelector('link'), null)
      assert.equal(existingLink.getAttribute('rel'), 'stylesheet')
      assert.equal(existingLink.getAttribute('href'), '/styles.css')
    })
  })
})
