import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { invariant } from '../lib/invariant.ts'
import { hydrate } from './utils.ts'

describe('hydration', () => {
  describe('boolean attributes', () => {
    it('hydrates disabled attribute', async (t) => {
      let { container, root } = await hydrate(t, <button disabled>Click</button>)

      let existingButton = container.querySelector('button')
      invariant(existingButton)
      assert.ok(existingButton.disabled)

      root.render(<button disabled>Click</button>)
      root.flush()

      assert.equal(container.querySelector('button'), existingButton)
      assert.ok(existingButton.disabled)
    })

    it('hydrates readonly attribute', async (t) => {
      let { container, root } = await hydrate(t, <input readOnly />)

      let existingInput = container.querySelector('input')
      invariant(existingInput)

      root.render(<input readOnly />)
      root.flush()

      assert.equal(container.querySelector('input'), existingInput)
      assert.ok(existingInput.readOnly)
    })

    it('hydrates required attribute', async (t) => {
      let { container, root } = await hydrate(t, <input required />)

      let existingInput = container.querySelector('input')
      invariant(existingInput)

      root.render(<input required />)
      root.flush()

      assert.equal(container.querySelector('input'), existingInput)
      assert.ok(existingInput.required)
    })

    it('hydrates multiple attribute on select', async (t) => {
      let { container, root } = await hydrate(
        t,
        <select multiple>
          <option>A</option>
          <option>B</option>
        </select>,
      )

      let existingSelect = container.querySelector('select')
      invariant(existingSelect)

      root.render(
        <select multiple>
          <option>A</option>
          <option>B</option>
        </select>,
      )
      root.flush()

      assert.equal(container.querySelector('select'), existingSelect)
      assert.ok(existingSelect.multiple)
    })

    it('hydrates hidden attribute', async (t) => {
      let { container, root } = await hydrate(t, <div hidden>Hidden content</div>)

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)

      root.render(<div hidden>Hidden content</div>)
      root.flush()

      assert.equal(container.querySelector('div'), existingDiv)
      assert.ok(existingDiv.hidden)
    })

    it('hydrates boolean attribute with true value', async (t) => {
      let { container, root } = await hydrate(t, <button disabled={true}>Click</button>)

      let existingButton = container.querySelector('button')
      invariant(existingButton)

      root.render(<button disabled={true}>Click</button>)
      root.flush()

      assert.equal(container.querySelector('button'), existingButton)
      assert.ok(existingButton.disabled)
    })

    it('hydrates boolean attribute with false value', async (t) => {
      let { container, root } = await hydrate(t, <button disabled={false}>Click</button>)

      let existingButton = container.querySelector('button')
      invariant(existingButton)

      root.render(<button disabled={false}>Click</button>)
      root.flush()

      assert.equal(container.querySelector('button'), existingButton)
      assert.equal(existingButton.disabled, false)
    })
  })
})
