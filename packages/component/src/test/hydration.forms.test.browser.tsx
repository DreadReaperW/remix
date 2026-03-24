import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { invariant } from '../lib/invariant.ts'
import { hydrate } from './utils.ts'

describe('hydration', () => {
  describe('form elements', () => {
    it('hydrates input with value attribute', async (t) => {
      let { container, root } = await hydrate(
        t,
        <input type="text" value="server value" readOnly />,
      )

      let existingInput = container.querySelector('input')
      invariant(existingInput)

      root.render(<input type="text" value="server value" readOnly />)
      root.flush()

      assert.equal(container.querySelector('input'), existingInput)
      assert.equal(existingInput.value, 'server value')
    })

    it('hydrates input with defaultValue', async (t) => {
      let { container, root } = await hydrate(t, <input type="text" defaultValue="default" />)

      let existingInput = container.querySelector('input')
      invariant(existingInput)

      root.render(<input type="text" defaultValue="default" />)
      root.flush()

      assert.equal(container.querySelector('input'), existingInput)
      assert.equal(existingInput.value, 'default')
    })

    it('hydrates checkbox with checked attribute', async (t) => {
      let { container, root } = await hydrate(t, <input type="checkbox" checked readOnly />)

      let existingInput = container.querySelector('input')
      invariant(existingInput)

      root.render(<input type="checkbox" checked readOnly />)
      root.flush()

      assert.equal(container.querySelector('input'), existingInput)
      assert.ok(existingInput.checked)
    })

    it('hydrates checkbox with defaultChecked', async (t) => {
      let { container, root } = await hydrate(t, <input type="checkbox" defaultChecked />)

      let existingInput = container.querySelector('input')
      invariant(existingInput)

      root.render(<input type="checkbox" defaultChecked />)
      root.flush()

      assert.equal(container.querySelector('input'), existingInput)
      assert.ok(existingInput.checked)
    })

    it('hydrates radio with checked attribute', async (t) => {
      let { container, root } = await hydrate(
        t,
        <div>
          <input type="radio" name="choice" value="a" checked readOnly />
          <input type="radio" name="choice" value="b" readOnly />
        </div>,
      )

      let inputs = container.querySelectorAll('input')
      assert.ok(inputs[0].checked)
      assert.equal(inputs[1].checked, false)

      root.render(
        <div>
          <input type="radio" name="choice" value="a" checked readOnly />
          <input type="radio" name="choice" value="b" readOnly />
        </div>,
      )
      root.flush()

      let hydratedInputs = container.querySelectorAll('input')
      assert.equal(hydratedInputs[0], inputs[0])
      assert.equal(hydratedInputs[1], inputs[1])
      assert.ok(hydratedInputs[0].checked)
      assert.equal(hydratedInputs[1].checked, false)
    })

    it('hydrates textarea with value', async (t) => {
      let { container, root } = await hydrate(t, <textarea value="textarea content" readOnly />)

      let existingTextarea = container.querySelector('textarea')
      invariant(existingTextarea)

      root.render(<textarea value="textarea content" readOnly />)
      root.flush()

      assert.equal(container.querySelector('textarea'), existingTextarea)
      assert.equal(existingTextarea.value, 'textarea content')
    })

    it('hydrates select with selected option', async (t) => {
      let { container, root } = await hydrate(
        t,
        <select value="b">
          <option value="a">A</option>
          <option value="b">B</option>
          <option value="c">C</option>
        </select>,
      )

      let existingSelect = container.querySelector('select')
      invariant(existingSelect)

      root.render(
        <select value="b">
          <option value="a">A</option>
          <option value="b">B</option>
          <option value="c">C</option>
        </select>,
      )
      root.flush()

      assert.equal(container.querySelector('select'), existingSelect)
      assert.equal(existingSelect.value, 'b')
    })
  })
})
