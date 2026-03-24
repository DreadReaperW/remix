import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

describe('vnode rendering', () => {
  describe('inserts', () => {
    it('renders text', (t) => {
      let { container } = t.render('Hello, world!')
      assert.equal(container.innerHTML, 'Hello, world!')
    })

    it('renders number', (t) => {
      let { container } = t.render(42)
      assert.equal(container.innerHTML, '42')
    })

    it('renders 0', (t) => {
      let { container } = t.render(0)
      assert.equal(container.innerHTML, '0')
    })

    it('renders bigint', (t) => {
      let { container } = t.render(BigInt(9007199254740991))
      assert.equal(container.innerHTML, '9007199254740991')
    })

    it('renders true', (t) => {
      let { container } = t.render(true)
      assert.equal(container.innerHTML, '')
    })

    it('renders false', (t) => {
      let { container } = t.render(false)
      assert.equal(container.innerHTML, '')
    })

    it('renders null', (t) => {
      let { container } = t.render(null)
      assert.equal(container.innerHTML, '')
    })

    it('renders undefined', (t) => {
      let { container } = t.render(undefined)
      assert.equal(container.innerHTML, '')
    })
  })

  describe('removals', () => {
    it('removes a text node', (t) => {
      let { container, root } = t.render(<div>Hello, world!</div>)
      assert.equal(container.innerHTML, '<div>Hello, world!</div>')
      root.render(<div />)
      assert.equal(container.innerHTML, '<div></div>')
    })

    it('removes an element', (t) => {
      let { container, root } = t.render(
        <div>
          <span>Hello, world!</span>
        </div>,
      )
      assert.equal(container.innerHTML, '<div><span>Hello, world!</span></div>')
      root.render(<div />)
      assert.equal(container.innerHTML, '<div></div>')
    })

    it('removes attributes', (t) => {
      let { container, root } = t.render(<input id="hello" value="world" />)
      let input = container.querySelector('input')
      assert.ok(input instanceof HTMLInputElement)
      assert.equal((input as HTMLInputElement).value, 'world')
      assert.equal((input as HTMLInputElement).getAttribute('id'), 'hello')
      root.render(<input />)
      root.flush()
      assert.equal((input as HTMLInputElement).value, '')
      assert.equal((input as HTMLInputElement).hasAttribute('id'), false)
      assert.equal((input as HTMLInputElement).hasAttribute('value'), false)
    })

    it('removes reflected attributes without leaving empty values', (t) => {
      let { container, root } = t.render(
        <div id="hello" className="world">
          content
        </div>,
      )

      let div = container.querySelector('div')
      assert.ok(div instanceof HTMLDivElement)
      assert.equal((div as HTMLDivElement).getAttribute('id'), 'hello')
      assert.equal((div as HTMLDivElement).getAttribute('class'), 'world')

      root.render(<div>content</div>)
      root.flush()

      assert.equal((div as HTMLDivElement).hasAttribute('id'), false)
      assert.equal((div as HTMLDivElement).hasAttribute('class'), false)
    })

    it('removes a fragment', (t) => {
      let { container, root } = t.render(
        <div>
          <>
            <p>Hello</p>
            <p>world!</p>
          </>
        </div>,
      )
      assert.equal(container.innerHTML, '<div><p>Hello</p><p>world!</p></div>')
      root.render(<div />)
      assert.equal(container.innerHTML, '<div></div>')
    })

    it('removes a component', (t) => {
      function App() {
        return () => <div>Hello, world!</div>
      }
      let { container, root } = t.render(
        <div>
          <App />
        </div>,
      )
      assert.equal(container.innerHTML, '<div><div>Hello, world!</div></div>')
      root.render(<div></div>)
      assert.equal(container.innerHTML, '<div></div>')
    })
  })
})
