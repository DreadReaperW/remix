import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { invariant } from '../lib/invariant.ts'
import { css } from '../index.ts'

describe('vnode rendering', () => {
  describe('special attributes', () => {
    it.todo('className')
    it.todo('htmlFor')
    it.todo('acceptCharset')
    it.todo('httpEquiv')
    it.todo('xlinkHref')
    it.todo('xmlLang')
    it.todo('xmlSpace')
    it.todo('data-*')
    it.todo('aria-*')
  })

  describe('special props', () => {
    it.todo('style')
    it.todo('value')
    it.todo('defaultValue')
    it.todo('checked')
    it.todo('defaultChecked')
    it.todo('disabled')
  })

  describe('framework props', () => {
    it.todo('does not render key')
    it.todo('does not render on')
    it.todo('does not render mix')
    it.todo('does not render children')
    it.todo('does not render tabIndex')
    it.todo('does not render acceptCharset')
  })

  describe('innerHTML prop', () => {
    it('sets innerHTML on element', (t) => {
      let { container } = t.render(<div innerHTML="<span>Hello</span>" />)
      assert.equal(container.innerHTML, '<div><span>Hello</span></div>')
    })

    it('ignores children when innerHTML is set', (t) => {
      let { container } = t.render(
        <div innerHTML="<span>From innerHTML</span>">
          <p>Ignored child</p>
        </div>,
      )
      assert.equal(container.innerHTML, '<div><span>From innerHTML</span></div>')
    })

    it('updates innerHTML on re-render', (t) => {
      let { container, root } = t.render(<div innerHTML="<span>First</span>" />)
      assert.equal(container.innerHTML, '<div><span>First</span></div>')

      let div = container.querySelector('div')
      invariant(div)

      root.render(<div innerHTML="<span>Second</span>" />)
      assert.equal(container.innerHTML, '<div><span>Second</span></div>')
      assert.equal(container.querySelector('div'), div)
    })

    it('clears innerHTML when removed', (t) => {
      let { container, root } = t.render(<div innerHTML="<span>Hello</span>" />)
      assert.equal(container.innerHTML, '<div><span>Hello</span></div>')

      root.render(<div />)
      assert.equal(container.innerHTML, '<div></div>')
    })

    it('switches from innerHTML to children', (t) => {
      let { container, root } = t.render(<div innerHTML="<span>From innerHTML</span>" />)
      assert.equal(container.innerHTML, '<div><span>From innerHTML</span></div>')

      root.render(
        <div>
          <p>From children</p>
        </div>,
      )
      assert.equal(container.innerHTML, '<div><p>From children</p></div>')
    })

    it('switches from children to innerHTML', (t) => {
      let { container, root } = t.render(
        <div>
          <p>From children</p>
        </div>,
      )
      assert.equal(container.innerHTML, '<div><p>From children</p></div>')

      root.render(<div innerHTML="<span>From innerHTML</span>" />)
      assert.equal(container.innerHTML, '<div><span>From innerHTML</span></div>')
    })

    it('switches from text children to innerHTML without throwing', (t) => {
      let { container, root } = t.render(<div>From text child</div>)
      let renderError: unknown
      root.addEventListener('error', (event) => {
        renderError = (event as ErrorEvent).error
      })

      assert.equal(container.innerHTML, '<div>From text child</div>')

      root.render(<div innerHTML="<span>From innerHTML</span>" />)
      assert.equal(container.innerHTML, '<div><span>From innerHTML</span></div>')
      assert.equal(renderError, undefined)
    })
  })

  describe('css mixin', () => {
    it('adds className-based styles', async (t) => {
      let { container } = t.render(<div mix={[css({ color: 'rgb(255, 0, 0)' })]}>Hello</div>)
      let div = container.querySelector('div')
      invariant(div instanceof HTMLDivElement)
      assert.match(div.className, /rmxc-/)
      assert.equal(getComputedStyle(div).color, 'rgb(255, 0, 0)')
    })

    it('composes with className without overriding it', async (t) => {
      let { container } = t.render(
        <div mix={[css({ color: 'rgb(255, 0, 0)' })]} className="custom-class">
          Hello
        </div>,
      )
      let div = container.querySelector('div')
      invariant(div instanceof HTMLDivElement)
      assert.ok(div.className.includes('custom-class'))
      assert.match(div.className, /rmxc-/)
    })

    it('ignores class when composing css mixin className', async (t) => {
      let { container } = t.render(
        <div mix={[css({ color: 'rgb(0, 255, 0)' })]} class="another-class">
          Hello
        </div>,
      )
      let div = container.querySelector('div')
      invariant(div instanceof HTMLDivElement)
      assert.match(div.className, /rmxc-/)
    })

    it('className updates independently of css mixin output', async (t) => {
      let { container, root } = t.render(
        <div mix={[css({ color: 'rgb(255, 0, 0)' })]} className="first">
          Hello
        </div>,
      )
      let div = container.querySelector('div')
      invariant(div instanceof HTMLDivElement)
      assert.ok(div.className.includes('first'))
      let generated = div.className.split(/\s+/).find((token) => token.startsWith('rmxc-'))
      invariant(generated)

      root.render(
        <div mix={[css({ color: 'rgb(255, 0, 0)' })]} className="second">
          Hello
        </div>,
      )
      assert.ok(div.className.includes('second'))
      assert.ok(div.className.includes(generated))
    })

    it('removes nested selector rules when they become undefined', async (t) => {
      let { container, root } = t.render(
        <div
          mix={[
            css({
              // Base styling for the child comes from the parent.
              '& span': { color: 'rgb(0, 0, 255)' },
              // More-specific nested selector is conditionally removed.
              '& span.special': { color: 'rgb(255, 0, 0)' },
            }),
          ]}
        >
          <span className="special">Test</span>
        </div>,
      )

      let child = container.querySelector('span')
      invariant(child)

      // More-specific nested selector should win.
      assert.equal(getComputedStyle(child).color, 'rgb(255, 0, 0)')

      root.render(
        <div
          mix={[
            css({
              '& span': { color: 'rgb(0, 0, 255)' },
              '& span.special': undefined,
            }),
          ]}
        >
          <span className="special">Test</span>
        </div>,
      )

      // Once the more-specific selector becomes undefined, the child should fall back to the base rule.
      assert.equal(getComputedStyle(child).color, 'rgb(0, 0, 255)')
    })
  })
})
