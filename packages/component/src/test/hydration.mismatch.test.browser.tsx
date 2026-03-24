import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { renderToString } from '../lib/stream.ts'
import { invariant } from '../lib/invariant.ts'

describe('hydration', () => {
  describe('attribute mismatch handling', () => {
    it('adopts element and patches mismatched attributes', async (t) => {
      let container = document.createElement('div')
      container.innerHTML = await renderToString(
        <div className="server-class" data-value="server" />,
      )
      document.body.appendChild(container)

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)

      t.render(<div className="client-class" data-value="client" />, { container })

      assert.equal(container.querySelector('div'), existingDiv)
      assert.equal(existingDiv.getAttribute('class'), 'client-class')
      assert.equal(existingDiv.getAttribute('data-value'), 'client')
    })

    it('adds missing attributes during hydration', async (t) => {
      let container = document.createElement('div')
      container.innerHTML = await renderToString(<div className="existing" />)
      document.body.appendChild(container)

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)

      t.render(<div className="existing" data-new="added" title="hello" />, { container })

      assert.equal(container.querySelector('div'), existingDiv)
      assert.equal(existingDiv.getAttribute('data-new'), 'added')
      assert.equal(existingDiv.getAttribute('title'), 'hello')
    })

    it('leaves extra attributes alone during hydration', async (t) => {
      let container = document.createElement('div')
      container.innerHTML = await renderToString(
        <div className="keep" data-extra="yes" title="extra" />,
      )
      document.body.appendChild(container)

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)
      assert.equal(existingDiv.getAttribute('data-extra'), 'yes')
      assert.equal(existingDiv.getAttribute('title'), 'extra')

      t.render(<div className="keep" />, { container })

      assert.equal(container.querySelector('div'), existingDiv)
      assert.equal(existingDiv.getAttribute('class'), 'keep')
      assert.ok(existingDiv.hasAttribute('data-extra'))
      assert.ok(existingDiv.hasAttribute('title'))
    })

    it('preserves DOM node identity when only attributes differ', async (t) => {
      let container = document.createElement('div')
      container.innerHTML = await renderToString(
        <div id="test" className="old" data-value="old">
          <span>Child</span>
        </div>,
      )
      document.body.appendChild(container)

      let existingDiv = container.querySelector('#test')
      let existingSpan = container.querySelector('span')
      invariant(existingDiv && existingSpan)

      t.render(
        <div id="test" className="new" data-value="new">
          <span>Child</span>
        </div>,
        { container },
      )

      assert.equal(container.querySelector('#test'), existingDiv)
      assert.equal(container.querySelector('span'), existingSpan)
    })
  })

  describe('type mismatch handling', () => {
    it('advances cursor once on type mismatch to find our element', async (t) => {
      let container = document.createElement('div')
      container.innerHTML = await renderToString(
        <div>
          <span>Our content</span>
        </div>,
      )
      document.body.appendChild(container)

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)
      let existingSpan = container.querySelector('span')
      invariant(existingSpan)

      let injected = document.createElement('div')
      injected.className = 'injected'
      existingDiv.insertBefore(injected, existingSpan)

      t.spyOn(console, 'error', () => {})

      t.render(
        <div>
          <span>Our content</span>
        </div>,
        { container },
      )

      assert.equal(container.querySelector('span'), existingSpan)
    })

    it('recreates element if retry also fails', async (t) => {
      let container = document.createElement('div')
      container.innerHTML = await renderToString(
        <div>
          <span>Original</span>
        </div>,
      )
      document.body.appendChild(container)

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)
      let existingSpan = container.querySelector('span')
      invariant(existingSpan)

      existingDiv.innerHTML = '<div>Wrong</div><p>Also wrong</p>'

      t.spyOn(console, 'error', () => {})

      t.render(
        <div>
          <span>Original</span>
        </div>,
        { container },
      )

      let newSpan = container.querySelector('span')
      assert.notEqual(newSpan, existingSpan)
      assert.equal(newSpan?.textContent, 'Original')
    })

    it('leaves skipped nodes in place', async (t) => {
      let container = document.createElement('div')
      container.innerHTML = await renderToString(
        <div>
          <span>Our content</span>
        </div>,
      )
      document.body.appendChild(container)

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)
      let existingSpan = container.querySelector('span')
      invariant(existingSpan)

      let skipped = document.createElement('aside')
      skipped.id = 'skipped'
      skipped.textContent = 'Extension content'
      existingDiv.insertBefore(skipped, existingSpan)

      t.spyOn(console, 'error', () => {})

      t.render(
        <div>
          <span>Our content</span>
        </div>,
        { container },
      )

      assert.equal(existingDiv.querySelector('#skipped'), skipped)
    })
  })
})
