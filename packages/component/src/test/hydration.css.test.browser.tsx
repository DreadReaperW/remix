import * as assert from '@remix-run/assert'
import { describe, it, afterEach } from '@remix-run/test'
import { resetStyleState } from '../lib/vdom.ts'
import { invariant } from '../lib/invariant.ts'
import { css } from '../index.ts'
import { hydrate } from './utils.ts'

describe('hydration', () => {
  describe('css mixin hydration', () => {
    afterEach(() => {
      resetStyleState()
    })

    it('hydrates element with css mixin and adopts server style', async (t) => {
      let { container, root } = await hydrate(t, <div mix={[css({ color: 'red' })]}>Hello</div>)

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)
      let originalClass = existingDiv.className
      assert.match(originalClass, /rmxc-/)

      root.render(<div mix={[css({ color: 'red' })]}>Hello</div>)
      root.flush()

      // Element should be adopted (same DOM node)
      assert.equal(container.querySelector('div'), existingDiv)
      assert.equal(existingDiv.className, originalClass)
      // Style should apply
      assert.equal(getComputedStyle(existingDiv).color, 'rgb(255, 0, 0)')
    })

    it('updates css mixin after hydration', async (t) => {
      let { container, root } = await hydrate(t, <div mix={[css({ color: 'red' })]}>Hello</div>)

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)

      root.render(<div mix={[css({ color: 'red' })]}>Hello</div>)
      root.flush()

      assert.equal(getComputedStyle(existingDiv).color, 'rgb(255, 0, 0)')

      // Update to different css mixin
      root.render(<div mix={[css({ color: 'blue' })]}>Hello</div>)
      root.flush()

      assert.equal(getComputedStyle(existingDiv).color, 'rgb(0, 0, 255)')
      assert.match(existingDiv.className, /rmxc-/)
    })

    it('hydrates css mixin combined with className', async (t) => {
      let { container, root } = await hydrate(
        t,
        <div className="my-class" mix={[css({ color: 'green' })]}>
          Hello
        </div>,
      )

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)
      assert.ok(existingDiv.className.includes('my-class'))
      assert.match(existingDiv.className, /rmxc-/)

      root.render(
        <div className="my-class" mix={[css({ color: 'green' })]}>
          Hello
        </div>,
      )
      root.flush()

      assert.equal(container.querySelector('div'), existingDiv)
      assert.ok(existingDiv.className.includes('my-class'))
      assert.match(existingDiv.className, /rmxc-/)
      assert.equal(getComputedStyle(existingDiv).color, 'rgb(0, 128, 0)')
    })

    it('multiple elements with same css mixin share style during hydration', async (t) => {
      let { container, root } = await hydrate(
        t,
        <div>
          <span mix={[css({ color: 'purple' })]}>First</span>
          <span mix={[css({ color: 'purple' })]}>Second</span>
        </div>,
      )

      let spans = container.querySelectorAll('span')
      assert.equal(spans.length, 2)

      let firstClassName = spans[0].className
      let secondClassName = spans[1].className
      assert.equal(firstClassName, secondClassName)
      assert.match(firstClassName, /rmxc-/)

      root.render(
        <div>
          <span mix={[css({ color: 'purple' })]}>First</span>
          <span mix={[css({ color: 'purple' })]}>Second</span>
        </div>,
      )
      root.flush()

      let hydratedSpans = container.querySelectorAll('span')
      assert.equal(hydratedSpans[0], spans[0])
      assert.equal(hydratedSpans[1], spans[1])
      assert.equal(hydratedSpans[0].className, firstClassName)
      assert.equal(hydratedSpans[1].className, firstClassName)
      assert.equal(getComputedStyle(hydratedSpans[0]).color, 'rgb(128, 0, 128)')
      assert.equal(getComputedStyle(hydratedSpans[1]).color, 'rgb(128, 0, 128)')
    })

    it('handles element unmount with css mixin after hydration', async (t) => {
      let { container, root } = await hydrate(
        t,
        <div>
          <span mix={[css({ color: 'orange' })]}>Will unmount</span>
        </div>,
      )

      root.render(
        <div>
          <span mix={[css({ color: 'orange' })]}>Will unmount</span>
        </div>,
      )
      root.flush()

      assert.notEqual(container.querySelector('span'), null)

      root.render(<div />)
      root.flush()

      assert.equal(container.querySelector('span'), null)
    })

    it('adds css mixin during hydration when server had none', async (t) => {
      let { container, root } = await hydrate(t, <div>Hello</div>)

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)
      assert.equal(existingDiv.className, '')

      root.render(<div mix={[css({ color: 'cyan' })]}>Hello</div>)
      root.flush()

      assert.equal(container.querySelector('div'), existingDiv)
      assert.match(existingDiv.className, /rmxc-/)
      assert.equal(getComputedStyle(existingDiv).color, 'rgb(0, 255, 255)')
    })
  })
})
