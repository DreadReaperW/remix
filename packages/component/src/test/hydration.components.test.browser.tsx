import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import type { Handle } from '../lib/component.ts'
import { createRoot } from '../lib/vdom.ts'
import { clientEntry } from '../lib/client-entries.ts'
import { invariant } from '../lib/invariant.ts'
import { on, ref } from '../index.ts'
import { hydrate } from './utils.ts'

describe('hydration', () => {
  describe('component edge cases', () => {
    it('hydrates component that returns null', async (t) => {
      function NullComponent() {
        return () => null
      }

      let { container, root } = await hydrate(
        t,
        <div>
          <NullComponent />
          <span>After</span>
        </div>,
      )

      let existingSpan = container.querySelector('span')
      invariant(existingSpan)

      root.render(
        <div>
          <NullComponent />
          <span>After</span>
        </div>,
      )
      root.flush()

      assert.equal(container.querySelector('span'), existingSpan)
      assert.equal(existingSpan.textContent, 'After')
    })

    it('hydrates component that returns fragment', async (t) => {
      function FragmentComponent() {
        return () => (
          <>
            <span>First</span>
            <span>Second</span>
          </>
        )
      }

      let { container, root } = await hydrate(
        t,
        <div>
          <FragmentComponent />
        </div>,
      )

      let spans = container.querySelectorAll('span')
      assert.equal(spans.length, 2)

      root.render(
        <div>
          <FragmentComponent />
        </div>,
      )
      root.flush()

      let hydratedSpans = container.querySelectorAll('span')
      assert.equal(hydratedSpans[0], spans[0])
      assert.equal(hydratedSpans[1], spans[1])
    })

    it('hydrates nested hydration boundaries', async (t) => {
      let Outer = clientEntry('/outer.js#Outer', function Outer(handle: Handle) {
        return (props: { children: any }) => <div className="outer">{props.children}</div>
      })

      let Inner = clientEntry('/inner.js#Inner', function Inner(handle: Handle) {
        return () => <span className="inner">Inner content</span>
      })

      let { container, root } = await hydrate(
        t,
        <Outer>
          <Inner />
        </Outer>,
      )

      // Should have hydration comment markers
      assert.ok(
        container.innerHTML.includes('<!-- rmx:h:') ||
          document.body.innerHTML.includes('<!-- rmx:h:'),
      )

      let existingOuter = container.querySelector('.outer')
      let existingInner = container.querySelector('.inner')
      invariant(existingOuter && existingInner)

      // For this test, we use createRoot which should handle the comment markers
      root.render(
        <Outer>
          <Inner />
        </Outer>,
      )
      root.flush()

      // Both should be adopted
      assert.equal(container.querySelector('.outer'), existingOuter)
      assert.equal(container.querySelector('.inner'), existingInner)
    })

    it('hydrates component with state preservation', async (t) => {
      function Counter(handle: Handle, setup: number) {
        let count = setup
        return () => (
          <button
            mix={[
              on('click', () => {
                count++
                handle.update()
              }),
            ]}
          >
            Count: {count}
          </button>
        )
      }

      let { container, root } = await hydrate(t, <Counter setup={5} />)

      let existingButton = container.querySelector('button')
      invariant(existingButton)
      assert.equal(existingButton.textContent, 'Count: 5')

      root.render(<Counter setup={5} />)
      root.flush()

      // Button should be adopted
      assert.equal(container.querySelector('button'), existingButton)

      // Clicking should work
      existingButton.click()
      root.flush()

      assert.equal(existingButton.textContent, 'Count: 6')
    })
  })

  describe('additional scenarios', () => {
    it('hydrates context across component boundaries', async (t) => {
      function Provider(handle: Handle<{ value: string }>) {
        handle.context.set({ value: 'from context' })
        return (props: { children: any }) => <div className="provider">{props.children}</div>
      }

      function Consumer(handle: Handle) {
        let ctx = handle.context.get(Provider)
        return () => <span className="consumer">{ctx?.value ?? 'no context'}</span>
      }

      let { container, root } = await hydrate(
        t,
        <Provider>
          <Consumer />
        </Provider>,
      )

      let existingProvider = container.querySelector('.provider')
      let existingConsumer = container.querySelector('.consumer')
      invariant(existingProvider && existingConsumer)
      assert.equal(existingConsumer.textContent, 'from context')

      root.render(
        <Provider>
          <Consumer />
        </Provider>,
      )
      root.flush()

      assert.equal(container.querySelector('.provider'), existingProvider)
      assert.equal(container.querySelector('.consumer'), existingConsumer)
      assert.equal(existingConsumer.textContent, 'from context')
    })

    it('hydrates SVG elements with case-sensitive tags', async (t) => {
      let { container, root } = await hydrate(
        t,
        <svg>
          <defs>
            <linearGradient id="grad1">
              <stop offset="0%" stopColor="red" />
              <stop offset="100%" stopColor="blue" />
            </linearGradient>
          </defs>
          <rect fill="url(#grad1)" width="100" height="100" />
        </svg>,
      )

      let existingSvg = container.querySelector('svg')
      let existingGradient = container.querySelector('linearGradient')
      let existingRect = container.querySelector('rect')
      invariant(existingSvg && existingGradient && existingRect)

      root.render(
        <svg>
          <defs>
            <linearGradient id="grad1">
              <stop offset="0%" stopColor="red" />
              <stop offset="100%" stopColor="blue" />
            </linearGradient>
          </defs>
          <rect fill="url(#grad1)" width="100" height="100" />
        </svg>,
      )
      root.flush()

      assert.equal(container.querySelector('svg'), existingSvg)
      assert.equal(container.querySelector('linearGradient'), existingGradient)
      assert.equal(container.querySelector('rect'), existingRect)
    })

    it('hydrates innerHTML prop', async (t) => {
      let { container, root } = await hydrate(t, <div innerHTML="<span>Raw HTML</span>" />)

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)
      assert.equal(existingDiv.innerHTML, '<span>Raw HTML</span>')

      root.render(<div innerHTML="<span>Raw HTML</span>" />)
      root.flush()

      assert.equal(container.querySelector('div'), existingDiv)
      assert.equal(existingDiv.innerHTML, '<span>Raw HTML</span>')
    })

    it('hydrates style prop as object', async (t) => {
      let { container, root } = await hydrate(
        t,
        <div style={{ color: 'red', backgroundColor: 'blue', padding: '10px' }}>Styled</div>,
      )

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)

      root.render(
        <div style={{ color: 'red', backgroundColor: 'blue', padding: '10px' }}>Styled</div>,
      )
      root.flush()

      assert.equal(container.querySelector('div'), existingDiv)
      assert.equal(existingDiv.style.color, 'red')
      assert.equal(existingDiv.style.backgroundColor, 'blue')
    })

    it('calls ref callback after hydration', async (t) => {
      let connectedNode: HTMLDivElement | null = null

      function WithConnect() {
        return () => (
          <div
            mix={[
              ref((node) => {
                connectedNode = node as HTMLDivElement
              }),
            ]}
          >
            Connected
          </div>
        )
      }

      let { container, root } = await hydrate(t, <WithConnect />)

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)

      root.render(<WithConnect />)
      root.flush()

      assert.equal(connectedNode, existingDiv)
    })

    it('attaches event handlers during hydration', async (t) => {
      let clicked = false

      function Clickable() {
        return () => (
          <button
            mix={[
              on('click', () => {
                clicked = true
              }),
            ]}
          >
            Click me
          </button>
        )
      }

      let { container, root } = await hydrate(t, <Clickable />)

      let existingButton = container.querySelector('button')
      invariant(existingButton)

      root.render(<Clickable />)
      root.flush()

      assert.equal(container.querySelector('button'), existingButton)
      existingButton.click()
      assert.ok(clicked)
    })

    it('hydrates keyed elements', async (t) => {
      let items = [
        { id: 'a', text: 'Item A' },
        { id: 'b', text: 'Item B' },
        { id: 'c', text: 'Item C' },
      ]

      let { container, root } = await hydrate(
        t,
        <ul>
          {items.map((item) => (
            <li key={item.id}>{item.text}</li>
          ))}
        </ul>,
      )

      let existingItems = container.querySelectorAll('li')
      assert.equal(existingItems.length, 3)

      root.render(
        <ul>
          {items.map((item) => (
            <li key={item.id}>{item.text}</li>
          ))}
        </ul>,
      )
      root.flush()

      let hydratedItems = container.querySelectorAll('li')
      assert.equal(hydratedItems[0], existingItems[0])
      assert.equal(hydratedItems[1], existingItems[1])
      assert.equal(hydratedItems[2], existingItems[2])
    })

    it('hydrates deeply nested elements', async (t) => {
      let { container, root } = await hydrate(
        t,
        <div className="level-1">
          <div className="level-2">
            <div className="level-3">
              <div className="level-4">
                <span>Deep content</span>
              </div>
            </div>
          </div>
        </div>,
      )

      let level1 = container.querySelector('.level-1')
      let level2 = container.querySelector('.level-2')
      let level3 = container.querySelector('.level-3')
      let level4 = container.querySelector('.level-4')
      let span = container.querySelector('span')
      invariant(level1 && level2 && level3 && level4 && span)

      root.render(
        <div className="level-1">
          <div className="level-2">
            <div className="level-3">
              <div className="level-4">
                <span>Deep content</span>
              </div>
            </div>
          </div>
        </div>,
      )
      root.flush()

      assert.equal(container.querySelector('.level-1'), level1)
      assert.equal(container.querySelector('.level-2'), level2)
      assert.equal(container.querySelector('.level-3'), level3)
      assert.equal(container.querySelector('.level-4'), level4)
      assert.equal(container.querySelector('span'), span)
    })

    it('hoists head-managed elements during hydration', (t) => {
      let container = document.createElement('div')
      document.body.appendChild(container)
      container.innerHTML =
        '<title>Hydrated title</title>' +
        '<meta name="description" content="Hydrated description" />' +
        '<script type="application/ld+json">{"@type":"Thing","name":"Hydrated"}</script>' +
        '<div id="content">Body content</div>'

      let existingTitle = container.querySelector('title')
      let existingMeta = container.querySelector('meta[name="description"]')
      let existingLdJson = container.querySelector('script[type="application/ld+json"]')
      let existingContent = container.querySelector('#content')
      invariant(existingTitle && existingMeta && existingLdJson && existingContent)

      t.render(
        <>
          <title>Hydrated title</title>
          <meta name="description" content="Hydrated description" />
          <script type="application/ld+json">{'{"@type":"Thing","name":"Hydrated"}'}</script>
          <div id="content">Body content</div>
        </>,
        { container },
      )

      assert.ok(document.head.contains(existingTitle))
      assert.equal(document.head.querySelector('meta[name="description"]'), existingMeta)
      assert.equal(
        document.head.querySelector('script[type="application/ld+json"]'),
        existingLdJson,
      )
      assert.equal(container.querySelector('title'), null)
      assert.equal(container.querySelector('meta[name="description"]'), null)
      assert.equal(container.querySelector('script[type="application/ld+json"]'), null)
      assert.equal(container.querySelector('#content'), existingContent)
    })
  })
})
