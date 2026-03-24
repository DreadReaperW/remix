import * as assert from '@remix-run/assert'
import { describe, it, afterEach } from '@remix-run/test'
import { invariant } from '../lib/invariant.ts'
import type { Handle } from '../lib/component.ts'

describe('vnode rendering', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    for (let node of Array.from(document.head.childNodes)) {
      document.head.removeChild(node)
    }
  })

  describe('components', () => {
    it.todo('warns when render is called after component is removed')

    it('inserts a component', (t) => {
      function App() {
        return () => <div>Hello, world!</div>
      }
      let { container } = t.render(<App />)
      assert.equal(container.innerHTML, '<div>Hello, world!</div>')
    })

    it('updates a component', (t) => {
      let capturedUpdate = () => {}
      function App(handle: Handle) {
        let count = 1
        capturedUpdate = () => {
          count++
          handle.update()
        }
        return () => <div>{count}</div>
      }

      let { container, root } = t.render(<App />)
      assert.equal(container.innerHTML, '<div>1</div>')
      let div = container.querySelector('div')
      invariant(div instanceof HTMLDivElement)

      capturedUpdate()
      root.flush()
      assert.equal(container.innerHTML, '<div>2</div>')
      assert.equal(container.querySelector('div'), div)

      capturedUpdate()
      root.flush()
      assert.equal(container.innerHTML, '<div>3</div>')
      assert.equal(container.querySelector('div'), div)
    })

    it('updates a component with a fragment', (t) => {
      let capturedUpdate = () => {}
      function App(handle: Handle) {
        let count = 1
        capturedUpdate = () => {
          count++
          handle.update()
        }
        return () => (
          <>
            {Array.from({ length: count }).map((_, i) => (
              <span>{i}</span>
            ))}
          </>
        )
      }

      let { container, root } = t.render(<App />)
      assert.equal(container.innerHTML, '<span>0</span>')
      let span = container.querySelector('span')
      invariant(span)

      capturedUpdate()
      root.flush()
      assert.equal(container.innerHTML, '<span>0</span><span>1</span>')
      let newSpanTags = container.querySelectorAll('span')
      assert.equal(newSpanTags.length, 2)
      assert.equal(newSpanTags[0], span)

      capturedUpdate()
      root.flush()
      assert.equal(container.innerHTML, '<span>0</span><span>1</span><span>2</span>')
    })

    it('hoists head-managed elements on client updates', (t) => {
      let rerender = () => {}

      function App(handle: Handle) {
        let phase = 0
        rerender = () => {
          phase++
          handle.update()
        }

        return () => {
          if (phase === 0) {
            return (
              <>
                <title>Page A</title>
                <meta name="description" content="A" />
                <script type="application/ld+json">{'{"name":"A"}'}</script>
                <script type="text/javascript">window.__regular = "A"</script>
                <div>Phase A</div>
              </>
            )
          }

          if (phase === 1) {
            return (
              <>
                <title>Page B</title>
                <meta name="description" content="B" />
                <script type="application/ld+json">{'{"name":"B"}'}</script>
                <div>Phase B</div>
              </>
            )
          }

          return <div>Phase C</div>
        }
      }

      let { container, root } = t.render(<App />)
      root.flush()

      assert.equal(document.head.querySelector('title')?.textContent, 'Page A')
      assert.equal(
        document.head.querySelector('meta[name="description"]')?.getAttribute('content'),
        'A',
      )
      assert.equal(
        document.head.querySelector('script[type="application/ld+json"]')?.textContent,
        '{"name":"A"}',
      )
      assert.ok(container.querySelector('script[type="text/javascript"]'))
      assert.equal(container.querySelector('title'), null)
      assert.equal(container.querySelector('meta[name="description"]'), null)
      assert.equal(container.querySelector('script[type="application/ld+json"]'), null)

      rerender()
      root.flush()

      assert.equal(document.head.querySelector('title')?.textContent, 'Page B')
      assert.equal(
        document.head.querySelector('meta[name="description"]')?.getAttribute('content'),
        'B',
      )
      assert.equal(document.head.querySelectorAll('meta[name="description"]').length, 1)
      assert.equal(
        document.head.querySelector('script[type="application/ld+json"]')?.textContent,
        '{"name":"B"}',
      )
      assert.equal(container.innerHTML, '<div>Phase B</div>')

      rerender()
      root.flush()

      assert.equal(document.head.querySelector('title'), null)
      assert.equal(document.head.querySelector('meta[name="description"]'), null)
      assert.equal(document.head.querySelector('script[type="application/ld+json"]'), null)
      assert.equal(container.innerHTML, '<div>Phase C</div>')
    })

    it('dispose cleans up explicit head subtree', (t) => {
      let { container, root } = t.render(
        <>
          <head>
            <title>Dispose title</title>
            <meta name="dispose-description" content="dispose" />
            <script type="application/ld+json">{'{"dispose":true}'}</script>
          </head>
          <div>Content</div>
        </>,
      )
      root.flush()

      assert.equal(document.head.querySelector('title')?.textContent, 'Dispose title')
      assert.ok(document.head.querySelector('meta[name="dispose-description"]'))
      assert.equal(
        document.head.querySelector('script[type="application/ld+json"]')?.textContent,
        '{"dispose":true}',
      )

      root.dispose()

      assert.equal(document.head.querySelector('title'), null)
      assert.equal(document.head.querySelector('meta[name="dispose-description"]'), null)
      assert.equal(document.head.querySelector('script[type="application/ld+json"]'), null)
      assert.equal(container.innerHTML, '')
    })
  })
})
