import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { invariant } from '../lib/invariant.ts'
import { hydrate } from './utils.ts'

describe('hydration', () => {
  describe('special case props to HTML attributes', () => {
    it('hydrates className as class attribute', async (t) => {
      let { container, root } = await hydrate(t, <div className="my-class">Hello</div>)

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)
      assert.equal(existingDiv.getAttribute('class'), 'my-class')

      root.render(<div className="my-class">Hello</div>)
      root.flush()

      // Same DOM node should be adopted
      assert.equal(container.querySelector('div'), existingDiv)
      assert.equal(existingDiv.getAttribute('class'), 'my-class')
    })

    it('hydrates htmlFor as for attribute', async (t) => {
      let { container, root } = await hydrate(
        t,
        <div>
          <label htmlFor="my-input">Label</label>
          <input id="my-input" />
        </div>,
      )

      let existingLabel = container.querySelector('label')
      invariant(existingLabel)
      assert.equal(existingLabel.getAttribute('for'), 'my-input')

      root.render(
        <div>
          <label htmlFor="my-input">Label</label>
          <input id="my-input" />
        </div>,
      )
      root.flush()

      assert.equal(container.querySelector('label'), existingLabel)
      assert.equal(existingLabel.getAttribute('for'), 'my-input')
    })

    it('hydrates tabIndex as tabindex attribute', async (t) => {
      let { container, root } = await hydrate(t, <button tabIndex={0}>Click</button>)

      let existingButton = container.querySelector('button')
      invariant(existingButton)

      root.render(<button tabIndex={0}>Click</button>)
      root.flush()

      assert.equal(container.querySelector('button'), existingButton)
      assert.equal(existingButton.getAttribute('tabindex'), '0')
    })

    it('hydrates acceptCharset as accept-charset attribute', async (t) => {
      let { container, root } = await hydrate(t, <form acceptCharset="UTF-8" />)

      let existingForm = container.querySelector('form')
      invariant(existingForm)

      root.render(<form acceptCharset="UTF-8" />)
      root.flush()

      assert.equal(container.querySelector('form'), existingForm)
      assert.equal(existingForm.getAttribute('accept-charset'), 'UTF-8')
    })

    it('hydrates httpEquiv as http-equiv attribute', async (t) => {
      let { container, root } = await hydrate(t, <meta httpEquiv="refresh" content="5" />)

      let existingMeta = container.querySelector('meta')
      invariant(existingMeta)

      root.render(<meta httpEquiv="refresh" content="5" />)
      root.flush()

      assert.equal(document.head.querySelector('meta[http-equiv]'), existingMeta)
      assert.equal(container.querySelector('meta'), null)
      assert.equal(existingMeta.getAttribute('http-equiv'), 'refresh')
    })

    it('hydrates aria-* attributes unchanged', async (t) => {
      let { container, root } = await hydrate(
        t,
        <button aria-label="Close" aria-expanded="false">
          X
        </button>,
      )

      let existingButton = container.querySelector('button')
      invariant(existingButton)

      root.render(
        <button aria-label="Close" aria-expanded="false">
          X
        </button>,
      )
      root.flush()

      assert.equal(container.querySelector('button'), existingButton)
      assert.equal(existingButton.getAttribute('aria-label'), 'Close')
      assert.equal(existingButton.getAttribute('aria-expanded'), 'false')
    })

    it('hydrates data-* attributes unchanged', async (t) => {
      let { container, root } = await hydrate(t, <div data-testid="my-div" data-value="42" />)

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)

      root.render(<div data-testid="my-div" data-value="42" />)
      root.flush()

      assert.equal(container.querySelector('div'), existingDiv)
      assert.equal(existingDiv.getAttribute('data-testid'), 'my-div')
      assert.equal(existingDiv.getAttribute('data-value'), '42')
    })

    it('hydrates SVG xlinkHref as xlink:href', async (t) => {
      let { container, root } = await hydrate(
        t,
        <svg>
          <use xlinkHref="#icon-star" />
        </svg>,
      )

      let existingUse = container.querySelector('use')
      invariant(existingUse)

      root.render(
        <svg>
          <use xlinkHref="#icon-star" />
        </svg>,
      )
      root.flush()

      assert.equal(container.querySelector('use'), existingUse)
      assert.equal(existingUse.getAttributeNS('http://www.w3.org/1999/xlink', 'href'), '#icon-star')
    })

    it('hydrates SVG viewBox with preserved case', async (t) => {
      let { container, root } = await hydrate(t, <svg viewBox="0 0 24 24" />)

      let existingSvg = container.querySelector('svg')
      invariant(existingSvg)

      root.render(<svg viewBox="0 0 24 24" />)
      root.flush()

      assert.equal(container.querySelector('svg'), existingSvg)
      assert.equal(existingSvg.getAttribute('viewBox'), '0 0 24 24')
    })

    it('hydrates SVG preserveAspectRatio with preserved case', async (t) => {
      let { container, root } = await hydrate(t, <svg preserveAspectRatio="xMidYMid meet" />)

      let existingSvg = container.querySelector('svg')
      invariant(existingSvg)

      root.render(<svg preserveAspectRatio="xMidYMid meet" />)
      root.flush()

      assert.equal(container.querySelector('svg'), existingSvg)
      assert.equal(existingSvg.getAttribute('preserveAspectRatio'), 'xMidYMid meet')
    })

    it('hydrates SVG filterUnits with canonical case and semantics', async (t) => {
      let { container, root } = await hydrate(
        t,
        <svg>
          <defs>
            <filter id="f" filterUnits="userSpaceOnUse" />
          </defs>
        </svg>,
      )

      let existingFilter = container.querySelector('#f')
      invariant(existingFilter instanceof SVGFilterElement)

      root.render(
        <svg>
          <defs>
            <filter id="f" filterUnits="userSpaceOnUse" />
          </defs>
        </svg>,
      )
      root.flush()

      assert.equal(container.querySelector('#f'), existingFilter)
      assert.equal(existingFilter.getAttribute('filterUnits'), 'userSpaceOnUse')
      assert.equal(existingFilter.getAttribute('filter-units'), null)
      assert.equal(existingFilter.filterUnits.baseVal, 1)
    })
  })
})
