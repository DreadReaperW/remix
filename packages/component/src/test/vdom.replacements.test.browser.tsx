import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { invariant } from '../lib/invariant.ts'
import type { Handle } from '../lib/component.ts'

describe('vnode rendering', () => {
  describe('type<-->type updates', () => {
    it('updates a text node', (t) => {
      let { container, root } = t.render('Hello, world!')
      assert.equal(container.innerHTML, 'Hello, world!')
      root.render('Hello, world! 2')
      assert.equal(container.innerHTML, 'Hello, world! 2')
    })

    it('updates an element', (t) => {
      let { container, root } = t.render(<div>Hello, world!</div>)
      assert.equal(container.innerHTML, '<div>Hello, world!</div>')

      let div = container.querySelector('div')
      root.render(<div>Hello, world! 2</div>)
      assert.equal(container.innerHTML, '<div>Hello, world! 2</div>')
      assert.equal(container.querySelector('div'), div)
    })

    it('updates an element with attributes', (t) => {
      let { container, root } = t.render(<input id="hello" value="world" />)
      let input = container.querySelector('input')
      invariant(input)
      assert.equal(input.getAttribute('id'), 'hello')
      assert.equal(input.value, 'world')

      root.render(<input id="hello" value="world 2" />)
      assert.equal(container.querySelector('input'), input)
      assert.equal(input.getAttribute('id'), 'hello')
      assert.equal(input.value, 'world 2')
    })

    it('updates a fragment', (t) => {
      let { container, root } = t.render(
        <>
          <p>Hello</p>
          <p>world!</p>
        </>,
      )
      let pTags = container.querySelectorAll('p')
      invariant(pTags.length === 2)

      assert.equal(container.innerHTML, '<p>Hello</p><p>world!</p>')
      root.render(
        <>
          <p>Goodbye</p>
          <p>Universe</p>
        </>,
      )
      assert.equal(container.innerHTML, '<p>Goodbye</p><p>Universe</p>')
      let newPTags = container.querySelectorAll('p')
      assert.equal(newPTags.length, 2)
      assert.equal(newPTags[0], pTags[0])
      assert.equal(newPTags[1], pTags[1])
    })

    it('updates a component', (t) => {
      let setupCalls = 0
      function App(handle: Handle) {
        let state = ++setupCalls
        return ({ title }: { title: string }) => (
          <div>
            {title} {state}
          </div>
        )
      }

      let { container, root } = t.render(<App title="Hello" />)
      assert.equal(container.innerHTML, '<div>Hello 1</div>')
      root.render(<App title="Goodbye" />)
      assert.equal(container.innerHTML, '<div>Goodbye 1</div>')
    })

    it('updates a component with a fragment', (t) => {
      let setupCalls = 0
      function App(handle: Handle) {
        let state = ++setupCalls
        return ({ title }: { title: string }) => (
          <>
            <span>{title}</span>
            <span>{state}</span>
          </>
        )
      }

      let { container, root } = t.render(<App title="Hello" />)
      assert.equal(container.innerHTML, '<span>Hello</span><span>1</span>')

      root.render(<App title="Goodbye" />)
      assert.equal(container.innerHTML, '<span>Goodbye</span><span>1</span>')
    })
  })

  describe('simple replacement', () => {
    it('replaces element -> text', (t) => {
      let { container, root } = t.render(<div>Hello, world!</div>)
      assert.equal(container.innerHTML, '<div>Hello, world!</div>')
      root.render('Goodbye, element!')
      assert.equal(container.innerHTML, 'Goodbye, element!')
    })

    it('replaces text -> element', (t) => {
      let { container, root } = t.render('Hello, world!')
      assert.equal(container.innerHTML, 'Hello, world!')
      root.render(<div>Goodbye, world!</div>)
      assert.equal(container.innerHTML, '<div>Goodbye, world!</div>')
    })

    it('replaces element -> component', (t) => {
      let { container, root } = t.render(<div>Hello, world!</div>)
      assert.equal(container.innerHTML, '<div>Hello, world!</div>')
      function App() {
        return () => <div>Goodbye, world!</div>
      }
      root.render(<App />)
      assert.equal(container.innerHTML, '<div>Goodbye, world!</div>')
    })

    it('replaces component -> element', (t) => {
      function App() {
        return () => <div>Hello, world!</div>
      }
      let { container, root } = t.render(<App />)
      assert.equal(container.innerHTML, '<div>Hello, world!</div>')
      root.render(<div>Goodbye, world!</div>)
      assert.equal(container.innerHTML, '<div>Goodbye, world!</div>')
    })

    it('replaces element -> element', (t) => {
      let { container, root } = t.render(<div>Hello, world!</div>)
      assert.equal(container.innerHTML, '<div>Hello, world!</div>')
      root.render(<nav>Goodbye, world!</nav>)
      assert.equal(container.innerHTML, '<nav>Goodbye, world!</nav>')
    })

    it('replaces component -> component', (t) => {
      function App() {
        return () => <div>Hello, world!</div>
      }
      let { container, root } = t.render(<App />)
      assert.equal(container.innerHTML, '<div>Hello, world!</div>')
      function App2() {
        return () => <div>Goodbye, world!</div>
      }
      root.render(<App2 />)
      assert.equal(container.innerHTML, '<div>Goodbye, world!</div>')
    })

    it('replaces component -> fragment', (t) => {
      function App() {
        return () => <div>Hello, world!</div>
      }
      let { container, root } = t.render(<App />)
      assert.equal(container.innerHTML, '<div>Hello, world!</div>')
      root.render(
        <>
          <p>Goodbye</p>
          <p>world!</p>
        </>,
      )
      assert.equal(container.innerHTML, '<p>Goodbye</p><p>world!</p>')
    })

    it('replaces fragment -> component', (t) => {
      let { container, root } = t.render(
        <>
          <div>Hello, world!</div>
        </>,
      )
      assert.equal(container.innerHTML, '<div>Hello, world!</div>')
      function App() {
        return () => <div>Goodbye, world!</div>
      }
      root.render(<App />)
      assert.equal(container.innerHTML, '<div>Goodbye, world!</div>')
    })

    it('replaces fragment -> element', (t) => {
      let { container, root } = t.render(
        <>
          <div>Hello, world!</div>
        </>,
      )
      assert.equal(container.innerHTML, '<div>Hello, world!</div>')
      root.render(<div>Goodbye, world!</div>)
      assert.equal(container.innerHTML, '<div>Goodbye, world!</div>')
    })

    it('replaces fragment -> text', (t) => {
      let { container, root } = t.render(
        <>
          <div>Hello, world!</div>
        </>,
      )
      assert.equal(container.innerHTML, '<div>Hello, world!</div>')
      root.render('Goodbye, world!')
      assert.equal(container.innerHTML, 'Goodbye, world!')
    })

    it('replaces text -> component', (t) => {
      let { container, root } = t.render('Hello, world!')
      assert.equal(container.innerHTML, 'Hello, world!')
      function App() {
        return () => <div>Goodbye, world!</div>
      }
      root.render(<App />)
      assert.equal(container.innerHTML, '<div>Goodbye, world!</div>')
    })
  })

  describe('complex replacements', () => {
    it('preserves siblings', (t) => {
      let { container, root } = t.render(
        <div>
          <div>div</div>
          <span>span</span>
          <p>p</p>
        </div>,
      )
      assert.equal(container.innerHTML, '<div><div>div</div><span>span</span><p>p</p></div>')

      let div = container.querySelector('div')
      let p = container.querySelector('p')
      invariant(div && p)
      root.render(
        <div>
          <div>div</div>
          <nav>nav</nav>
          <p>p</p>
        </div>,
      )
      assert.equal(container.innerHTML, '<div><div>div</div><nav>nav</nav><p>p</p></div>')
      assert.equal(container.querySelector('div'), div)
      assert.equal(container.querySelector('p'), p)
    })

    it('replaces null children', (t) => {
      let { container, root } = t.render(
        <div>
          <div>div</div>
          {null}
          <p>p</p>
        </div>,
      )
      assert.equal(container.innerHTML, '<div><div>div</div><p>p</p></div>')
      let div = container.querySelector('div')
      let p = container.querySelector('p')
      invariant(div && p)

      root.render(
        <div>
          <div>div</div>
          <span>span</span>
          <p>p</p>
        </div>,
      )
      assert.equal(container.innerHTML, '<div><div>div</div><span>span</span><p>p</p></div>')
      assert.equal(container.querySelector('div'), div)
      assert.equal(container.querySelector('p'), p)
    })

    it('replaces fragment components', (t) => {
      function Frag() {
        return () => (
          <>
            <span>A</span>
            <span>B</span>
          </>
        )
      }
      let { container, root } = t.render(
        <div>
          <Frag />
          <main>main</main>
        </div>,
      )
      assert.equal(container.innerHTML, '<div><span>A</span><span>B</span><main>main</main></div>')
      let main = container.querySelector('main')
      invariant(main)

      root.render(
        <div>
          <div>one</div>
          <main>main</main>
        </div>,
      )
      assert.equal(container.innerHTML, '<div><div>one</div><main>main</main></div>')
      assert.equal(container.querySelector('main'), main)
    })

    it('replaces components within elements', (t) => {
      function App() {
        return () => <div>Hello, world!</div>
      }
      let { container, root } = t.render(
        <div>
          <App />
        </div>,
      )
      assert.equal(container.innerHTML, '<div><div>Hello, world!</div></div>')

      function App2() {
        return () => <div>Goodbye, world!</div>
      }
      root.render(
        <div>
          <App2 />
        </div>,
      )
      assert.equal(container.innerHTML, '<div><div>Goodbye, world!</div></div>')
    })
  })
})
