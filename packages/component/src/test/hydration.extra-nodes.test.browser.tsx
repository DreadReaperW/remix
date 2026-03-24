import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { invariant } from '../lib/invariant.ts'
import { hydrate } from './utils.ts'

describe('hydration', () => {
  describe('extra DOM nodes (browser extension injection)', () => {
    it('ignores extra nodes at the end of container', async (t) => {
      let { container, root } = await hydrate(
        t,
        <div>
          <span>Our content</span>
        </div>,
      )

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)
      let existingSpan = container.querySelector('span')
      invariant(existingSpan)

      let injected = document.createElement('aside')
      injected.id = 'ext-injected'
      injected.textContent = 'extension content'
      existingDiv.appendChild(injected)

      root.render(
        <div>
          <span>Our content</span>
        </div>,
      )
      root.flush()

      assert.equal(container.querySelector('span'), existingSpan)
      assert.equal(existingDiv.querySelector('#ext-injected'), injected)
    })

    it('skips injected node at start and adopts our content', async (t) => {
      let { container, root } = await hydrate(
        t,
        <div>
          <span>Our content</span>
        </div>,
      )

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)
      let existingSpan = container.querySelector('span')
      invariant(existingSpan)

      let injected = document.createElement('aside')
      injected.id = 'ext-start'
      injected.textContent = 'extension content'
      existingDiv.insertBefore(injected, existingSpan)

      root.render(
        <div>
          <span>Our content</span>
        </div>,
      )
      root.flush()

      assert.equal(container.querySelector('span'), existingSpan)
      assert.equal(existingDiv.querySelector('#ext-start'), injected)
    })

    it('handles injected nodes at both start and end', async (t) => {
      let { container, root } = await hydrate(
        t,
        <div>
          <span>Our content</span>
        </div>,
      )

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)
      let existingSpan = container.querySelector('span')
      invariant(existingSpan)

      let injectedStart = document.createElement('aside')
      injectedStart.id = 'ext-start'
      injectedStart.textContent = 'start extension'
      existingDiv.insertBefore(injectedStart, existingSpan)

      let injectedEnd = document.createElement('aside')
      injectedEnd.id = 'ext-end'
      injectedEnd.textContent = 'end extension'
      existingDiv.appendChild(injectedEnd)

      root.render(
        <div>
          <span>Our content</span>
        </div>,
      )
      root.flush()

      assert.equal(container.querySelector('span'), existingSpan)
      assert.equal(existingDiv.querySelector('#ext-start'), injectedStart)
      assert.equal(existingDiv.querySelector('#ext-end'), injectedEnd)
    })

    it('extra nodes survive through subsequent updates', async (t) => {
      let { container, root } = await hydrate(
        t,
        <div>
          <span>Content 1</span>
        </div>,
      )

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)

      let injected = document.createElement('aside')
      injected.id = 'extension'
      injected.textContent = 'extension content'
      existingDiv.appendChild(injected)

      root.render(
        <div>
          <span>Content 1</span>
        </div>,
      )
      root.flush()

      assert.equal(existingDiv.querySelector('#extension'), injected)

      root.render(
        <div>
          <span>Content 2</span>
        </div>,
      )
      root.flush()

      assert.equal(existingDiv.querySelector('#extension'), injected)
      assert.equal(existingDiv.querySelector('span')?.textContent, 'Content 2')
    })
  })
})
