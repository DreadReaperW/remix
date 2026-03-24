import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { createRoot } from '../lib/vdom.ts'
import { invariant } from '../lib/invariant.ts'

describe('vnode rendering', () => {
  describe('elements', () => {
    it('renders basic elements', (t) => {
      let { container } = t.render(<div>Hello, world!</div>)
      assert.equal(container.innerHTML, '<div>Hello, world!</div>')
    })

    it('renders nested elements', (t) => {
      let { container } = t.render(
        <div>
          Hello, <span>world!</span>
        </div>,
      )
      assert.equal(container.innerHTML, '<div>Hello, <span>world!</span></div>')
    })

    it('renders attributes', (t) => {
      let { container } = t.render(<input id="hello" value="world" />)
      let input = container.querySelector('input')
      invariant(input instanceof HTMLInputElement)
      assert.equal(input.value, 'world')
      assert.equal(container.innerHTML, '<input id="hello">')
    })

    it('renders 0 as a child', (t) => {
      let { container } = t.render(<div>{0}</div>)
      assert.equal(container.innerHTML, '<div>0</div>')
    })

    it('renders style object via DOM properties; hydration leaves string in place', (t) => {
      let { container } = t.render(
        <div
          style={{
            marginTop: 12,
            display: 'block',
            lineHeight: Number.NaN,
            '--size': 10,
          }}
        >
          X
        </div>,
      )
      let div = container.querySelector('div')
      invariant(div instanceof HTMLDivElement)
      assert.equal(div.style.marginTop, '12px')
      assert.equal(div.style.display, 'block')
      assert.ok((div.getAttribute('style') || '').includes('--size: 10'))
      assert.equal(div.style.lineHeight, '')

      let container2 = document.createElement('div')
      container2.innerHTML = '<div style="color: red">X</div>'
      let root2 = createRoot(container2)
      root2.render(<div style={{ color: 'blue' }}>X</div>)
      let div2 = container2.querySelector('div')
      invariant(div2 instanceof HTMLDivElement)
      assert.equal(div2.style.color, 'blue')
    })
  })

  describe('fragments', () => {
    it('inserts fragments', (t) => {
      let { container } = t.render(
        <>
          <p>Hello</p>
          <p>world!</p>
        </>,
      )
      assert.equal(container.innerHTML, '<p>Hello</p><p>world!</p>')
    })

    it('inserts nested fragments', (t) => {
      let { container } = t.render(
        <div>
          <>
            <p>Hello</p>
            <p>world!</p>
          </>
          <p>Goodbye</p>
        </div>,
      )
      assert.equal(container.innerHTML, '<div><p>Hello</p><p>world!</p><p>Goodbye</p></div>')
    })

    it('inserts new nodes in a parent', (t) => {
      let { container, root } = t.render(
        <div>
          <p>Hello</p>
        </div>,
      )
      assert.equal(container.innerHTML, '<div><p>Hello</p></div>')

      let p = container.querySelector('p')
      invariant(p)
      root.render(
        <div>
          <p>Hello</p>
          <p>Goodbye</p>
        </div>,
      )
      assert.equal(container.innerHTML, '<div><p>Hello</p><p>Goodbye</p></div>')
      assert.equal(container.querySelector('p'), p)
    })
  })
})
