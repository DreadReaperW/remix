import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import type { Handle } from '../lib/component.ts'

describe('vnode rendering', () => {
  describe('conditional rendering and DOM order', () => {
    it('maintains DOM order when component switches element types via self-update', (t) => {
      let showB = false
      let capturedUpdate = () => {}

      function A(handle: Handle) {
        capturedUpdate = () => handle.update()
        return () => (showB ? <span>B</span> : <div>A</div>)
      }

      let { container, root } = t.render(
        <main>
          <A />
          <p>C</p>
        </main>,
      )
      assert.equal(container.innerHTML, '<main><div>A</div><p>C</p></main>')

      showB = true
      capturedUpdate()
      root.flush()
      assert.equal(container.innerHTML, '<main><span>B</span><p>C</p></main>')

      showB = false
      capturedUpdate()
      root.flush()
      assert.equal(container.innerHTML, '<main><div>A</div><p>C</p></main>')
    })

    it('maintains DOM order when component switches from component to element via self-update', (t) => {
      let showB = false
      let capturedUpdate = () => {}

      function B() {
        return () => <span>B</span>
      }

      function A(handle: Handle) {
        capturedUpdate = () => handle.update()
        return () => (showB ? <B /> : <div>A</div>)
      }

      let { container, root } = t.render(
        <main>
          <A />
          <p>C</p>
        </main>,
      )
      assert.equal(container.innerHTML, '<main><div>A</div><p>C</p></main>')

      showB = true
      capturedUpdate()
      root.flush()
      assert.equal(container.innerHTML, '<main><span>B</span><p>C</p></main>')

      showB = false
      capturedUpdate()
      root.flush()
      assert.equal(container.innerHTML, '<main><div>A</div><p>C</p></main>')
    })

    it('updates correctly when replaced component self-updates from component to element', (t) => {
      function Loading() {
        return () => <div>Loading...</div>
      }

      let loaded = false
      let capturedUpdate = () => {}

      function PageB(handle: Handle) {
        capturedUpdate = () => handle.update()
        return () => (loaded ? <div>Loaded!</div> : <Loading />)
      }

      function PageA() {
        return () => <div>Page A</div>
      }

      let Page: typeof PageA | typeof PageB = PageA

      function App(handle: Handle) {
        return () => (
          <main>
            <nav>Nav</nav>
            <Page />
          </main>
        )
      }

      let { container, root } = t.render(<App />)
      assert.equal(container.innerHTML, '<main><nav>Nav</nav><div>Page A</div></main>')

      Page = PageB
      root.render(<App />)
      assert.equal(container.innerHTML, '<main><nav>Nav</nav><div>Loading...</div></main>')

      loaded = true
      capturedUpdate()
      root.flush()
      assert.equal(container.innerHTML, '<main><nav>Nav</nav><div>Loaded!</div></main>')
    })

    it('updates correctly when component switches from element to component via self-update', (t) => {
      function Loading() {
        return () => <span>Loading...</span>
      }

      let showLoading = false
      let capturedUpdate = () => {}

      function A(handle: Handle) {
        capturedUpdate = () => handle.update()
        return () => (showLoading ? <Loading /> : <div>Content</div>)
      }

      let { container, root } = t.render(
        <main>
          <A />
          <p>Footer</p>
        </main>,
      )
      assert.equal(container.innerHTML, '<main><div>Content</div><p>Footer</p></main>')

      showLoading = true
      capturedUpdate()
      root.flush()
      assert.equal(container.innerHTML, '<main><span>Loading...</span><p>Footer</p></main>')

      showLoading = false
      capturedUpdate()
      root.flush()
      assert.equal(container.innerHTML, '<main><div>Content</div><p>Footer</p></main>')
    })

    it('updates correctly with deeply nested component type changes', (t) => {
      function Inner() {
        return () => <span>Inner</span>
      }

      function Middle() {
        return () => <Inner />
      }

      let useNested = true
      let capturedUpdate = () => {}

      function Outer(handle: Handle) {
        capturedUpdate = () => handle.update()
        return () => (useNested ? <Middle /> : <div>Direct</div>)
      }

      let { container, root } = t.render(
        <main>
          <Outer />
          <footer>Footer</footer>
        </main>,
      )
      assert.equal(container.innerHTML, '<main><span>Inner</span><footer>Footer</footer></main>')

      useNested = false
      capturedUpdate()
      root.flush()
      assert.equal(container.innerHTML, '<main><div>Direct</div><footer>Footer</footer></main>')

      useNested = true
      capturedUpdate()
      root.flush()
      assert.equal(container.innerHTML, '<main><span>Inner</span><footer>Footer</footer></main>')
    })

    it('updates correctly when multiple components are replaced and self-update', (t) => {
      function LoadingA() {
        return () => <span>Loading A...</span>
      }

      function LoadingB() {
        return () => <span>Loading B...</span>
      }

      let loadedA = false
      let loadedB = false
      let capturedUpdateA = () => {}
      let capturedUpdateB = () => {}

      function CompA(handle: Handle) {
        capturedUpdateA = () => handle.update()
        return () => (loadedA ? <div>A Done</div> : <LoadingA />)
      }

      function CompB(handle: Handle) {
        capturedUpdateB = () => handle.update()
        return () => (loadedB ? <div>B Done</div> : <LoadingB />)
      }

      let { container, root } = t.render(
        <main>
          <CompA />
          <CompB />
        </main>,
      )
      assert.equal(
        container.innerHTML,
        '<main><span>Loading A...</span><span>Loading B...</span></main>',
      )

      loadedA = true
      capturedUpdateA()
      root.flush()
      assert.equal(container.innerHTML, '<main><div>A Done</div><span>Loading B...</span></main>')

      loadedB = true
      capturedUpdateB()
      root.flush()
      assert.equal(container.innerHTML, '<main><div>A Done</div><div>B Done</div></main>')
    })

    it('maintains DOM order when replaced component self-updates with same element type', (t) => {
      let count = 0
      let capturedUpdate = () => {}

      function PageB(handle: Handle) {
        capturedUpdate = () => handle.update()
        return () => <div>Count: {count}</div>
      }

      function PageA() {
        return () => <div>Page A</div>
      }

      let Page: typeof PageA | typeof PageB = PageA

      function App(handle: Handle) {
        return () => (
          <main>
            <nav>Nav</nav>
            <Page />
            <footer>Footer</footer>
          </main>
        )
      }

      let { container, root } = t.render(<App />)
      assert.equal(
        container.innerHTML,
        '<main><nav>Nav</nav><div>Page A</div><footer>Footer</footer></main>',
      )

      Page = PageB
      root.render(<App />)
      assert.equal(
        container.innerHTML,
        '<main><nav>Nav</nav><div>Count: 0</div><footer>Footer</footer></main>',
      )

      count = 1
      capturedUpdate()
      root.flush()
      assert.equal(
        container.innerHTML,
        '<main><nav>Nav</nav><div>Count: 1</div><footer>Footer</footer></main>',
      )

      count = 2
      capturedUpdate()
      root.flush()
      assert.equal(
        container.innerHTML,
        '<main><nav>Nav</nav><div>Count: 2</div><footer>Footer</footer></main>',
      )
    })

    it('maintains DOM order when fragment component adds children via self-update with siblings', (t) => {
      let items = [0]
      let capturedUpdate = () => {}

      function List(handle: Handle) {
        capturedUpdate = () => handle.update()
        return () => (
          <>
            {items.map((i) => (
              <span>{i}</span>
            ))}
          </>
        )
      }

      let { container, root } = t.render(
        <main>
          <List />
          <footer>Footer</footer>
        </main>,
      )
      assert.equal(container.innerHTML, '<main><span>0</span><footer>Footer</footer></main>')

      items = [0, 1]
      capturedUpdate()
      root.flush()
      assert.equal(
        container.innerHTML,
        '<main><span>0</span><span>1</span><footer>Footer</footer></main>',
      )

      items = [0, 1, 2]
      capturedUpdate()
      root.flush()
      assert.equal(
        container.innerHTML,
        '<main><span>0</span><span>1</span><span>2</span><footer>Footer</footer></main>',
      )
    })
  })
})
