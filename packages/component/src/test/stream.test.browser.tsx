import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import type { Handle, RemixNode } from '../lib/component.ts'
import { createMixin, css, on } from '../index.ts'

import { renderToStream, renderToString } from '../lib/stream.ts'
import { clientEntry } from '../lib/client-entries.ts'
import { drain, readChunks, withResolvers } from './utils.ts'
import { Frame } from '../lib/component.ts'
import { invariant } from '../lib/invariant.ts'

const rmxDataScriptSelector = 'script[type="application/json"]#rmx-data'

describe('stream', () => {
  function getLatestRmxDataScript(root: ParentNode): HTMLScriptElement {
    let scripts = root.querySelectorAll(rmxDataScriptSelector)
    let script = scripts.item(scripts.length - 1) as HTMLScriptElement | null
    invariant(script)
    return script
  }

  function parseRmxDataFromHtml(html: string): any {
    let shelf = document.createElement('template')
    shelf.innerHTML = html
    let script = getLatestRmxDataScript(shelf.content)
    return JSON.parse(script.textContent || '{}')
  }

  function getSingleEntry(obj: Record<string, any>): [string, any] {
    let entries = Object.entries(obj)
    assert.equal(entries.length, 1)
    return entries[0]!
  }

  function getCommentMarkerId(html: string, prefix: 'rmx:f:' | 'rmx:h:'): string {
    let re = prefix === 'rmx:f:' ? /<!--\s*rmx:f:([^ ]+)\s*-->/ : /<!--\s*rmx:h:([^ ]+)\s*-->/
    let match = html.match(re)
    assert.notEqual(match, null)
    return match![1]!
  }

  describe('basic nodes', () => {
    it('should render to a stream', () => {
      let stream = renderToStream(<div>Hello, world!</div>)
      assert.ok(stream != null)
    })

    it('streams basic HTML', async () => {
      let stream = renderToStream(<div>Hello, world!</div>)
      let html = await drain(stream)
      assert.equal(html, '<div>Hello, world!</div>')
    })

    it('renders string nodes', async () => {
      let stream = renderToStream('Hello, world!')
      let html = await drain(stream)
      assert.equal(html, 'Hello, world!')
    })

    it('escapes text node content', async () => {
      let stream = renderToStream('<img src=x onerror="alert(1)">&</img>')
      let html = await drain(stream)
      assert.equal(html, '&lt;img src=x onerror="alert(1)"&gt;&amp;&lt;/img&gt;')
    })

    it('escapes text children in elements', async () => {
      let stream = renderToStream(<div>{'<script>alert(1)</script>'}</div>)
      let html = await drain(stream)
      assert.equal(html, '<div>&lt;script&gt;alert(1)&lt;/script&gt;</div>')
    })

    it('renders number nodes', async () => {
      let stream = renderToStream(42)
      let html = await drain(stream)
      assert.equal(html, '42')
    })

    it('renders 0', async () => {
      let stream = renderToStream(<span>0</span>)
      let html = await drain(stream)
      assert.equal(html, '<span>0</span>')
    })

    it('renders bigint nodes', async () => {
      let stream = renderToStream(BigInt(9007199254740991))
      let html = await drain(stream)
      assert.equal(html, '9007199254740991')
    })

    it('renders boolean nodes', async () => {
      let stream = renderToStream(true)
      let html = await drain(stream)
      assert.equal(html, '')
    })

    it('renders null nodes', async () => {
      let stream = renderToStream(null)
      let html = await drain(stream)
      assert.equal(html, '')
    })

    it('renders undefined nodes', async () => {
      let stream = renderToStream(undefined)
      let html = await drain(stream)
      assert.equal(html, '')
    })

    it('renders array of nodes', async () => {
      let stream = renderToStream([<div>One</div>, <span>Two</span>])
      let html = await drain(stream)
      assert.equal(html, '<div>One</div><span>Two</span>')
    })

    it('renders mixed array of nodes', async () => {
      let stream = renderToStream([<div>One</div>, 'text', 42, null, undefined])
      let html = await drain(stream)
      assert.equal(html, '<div>One</div>text42')
    })

    it('renders fragments', async () => {
      let stream = renderToStream(
        <>
          <h1>Title</h1>
          <p>Paragraph</p>
          <div>Content</div>
        </>,
      )
      let html = await drain(stream)
      assert.equal(html, '<h1>Title</h1><p>Paragraph</p><div>Content</div>')
    })
  })

  describe('component nodes', () => {
    it('renders component nodes', async () => {
      function Greeting(handle: Handle) {
        return ({ name }: { name: string }) => <div>Hello, {name}!</div>
      }
      let stream = renderToStream(<Greeting name="World" />)
      let html = await drain(stream)
      assert.equal(html, '<div>Hello, World!</div>')
    })

    it('renders 0', async () => {
      function Test(handle: Handle) {
        let n = 0
        return () => <span>{n}</span>
      }
      let stream = renderToStream(<Test />)
      let html = await drain(stream)
      assert.equal(html, '<span>0</span>')
    })

    it('renders stateful component nodes', async () => {
      function Stateful(handle: Handle) {
        return () => <div>Stateful</div>
      }
      let stream = renderToStream(<Stateful />)
      let html = await drain(stream)
      assert.equal(html, '<div>Stateful</div>')
    })

    it('provides and reads context', async () => {
      type ThemeContext = { color: string; size: number }

      function ThemeProvider(handle: Handle<ThemeContext>) {
        handle.context.set({ color: 'blue', size: 16 })
        return ({ children }: { children: any }) => children
      }

      function ThemedText(handle: Handle) {
        let theme = handle.context.get(ThemeProvider)
        return () => <p style={`color: ${theme.color}; font-size: ${theme.size}px`}>Themed!</p>
      }

      function App(handle: Handle) {
        return () => (
          <ThemeProvider>
            <div>
              <ThemedText />
            </div>
          </ThemeProvider>
        )
      }

      let stream = renderToStream(<App />)
      let html = await drain(stream)
      assert.equal(html, '<div><p style="color: blue; font-size: 16px">Themed!</p></div>')
    })

    it('provides and reads nested context', async () => {
      type ThemeContext = { color: string }
      type UserContext = { name: string }

      function ThemeProvider(handle: Handle<ThemeContext>) {
        handle.context.set({ color: 'red' })
        return ({ children }: { children: any }) => children
      }

      function UserProvider(handle: Handle<UserContext>) {
        handle.context.set({ name: 'John' })
        return ({ children }: { children: any }) => children
      }

      function Display(handle: Handle) {
        let theme = handle.context.get(ThemeProvider)
        let user = handle.context.get(UserProvider)
        return () => <p style={`color: ${theme.color}`}>Hello, {user.name}!</p>
      }

      function App(handle: Handle) {
        return () => (
          <ThemeProvider>
            <UserProvider>
              <div>
                <Display />
              </div>
            </UserProvider>
          </ThemeProvider>
        )
      }

      let stream = renderToStream(<App />)
      let html = await drain(stream)
      assert.equal(html, '<div><p style="color: red">Hello, John!</p></div>')
    })

    it('provides context to multiple consumers', async () => {
      type CountContext = { count: number }

      function CountProvider(handle: Handle<CountContext>) {
        handle.context.set({ count: 42 })
        return ({ children }: { children: any }) => children
      }

      function CountDisplay(handle: Handle) {
        let { count } = handle.context.get(CountProvider)
        return () => <span>Count: {count}</span>
      }

      function DoubleDisplay(handle: Handle) {
        let { count } = handle.context.get(CountProvider)
        return () => <span>Double: {count * 2}</span>
      }

      function App(handle: Handle) {
        return () => (
          <CountProvider>
            <div>
              <CountDisplay />
              <br />
              <DoubleDisplay />
            </div>
          </CountProvider>
        )
      }

      let stream = renderToStream(<App />)
      let html = await drain(stream)
      assert.equal(html, '<div><span>Count: 42</span><br /><span>Double: 84</span></div>')
    })
  })

  describe('special props', () => {
    it('renders innerHTML on elements', async () => {
      let htmlContent = '<strong>Bold text</strong> and <em>italic text</em>'
      let stream = renderToStream(
        <div>
          <h1>Title</h1>
          <div innerHTML={htmlContent} />
          <p>After innerHTML</p>
        </div>,
      )
      let html = await drain(stream)
      assert.equal(
        html,
        '<div><h1>Title</h1><div><strong>Bold text</strong> and <em>italic text</em></div><p>After innerHTML</p></div>',
      )
    })

    it('changes className to class', async () => {
      let stream = renderToStream(<div className="test-class">Content</div>)
      let html = await drain(stream)
      assert.equal(html, '<div class="test-class">Content</div>')
    })

    it('changes htmlFor to for', async () => {
      let stream = renderToStream(
        <>
          <label htmlFor="test-input">Label</label>
          <input id="test-input" />
        </>,
      )
      let html = await drain(stream)
      assert.equal(html, '<label for="test-input">Label</label><input id="test-input" />')
    })

    it('changes acceptCharset to accept-charset', async () => {
      let stream = renderToStream(
        <form acceptCharset="UTF-8">
          <input type="submit" />
        </form>,
      )
      let html = await drain(stream)
      assert.equal(html, '<form accept-charset="UTF-8"><input type="submit" /></form>')
    })

    it('changes httpEquiv to http-equiv', async () => {
      let stream = renderToStream(
        <head>
          <meta httpEquiv="Content-Type" content="text/html; charset=utf-8" />
        </head>,
      )
      let html = await drain(stream)
      assert.equal(
        html,
        '<head><meta http-equiv="Content-Type" content="text/html; charset=utf-8" /></head>',
      )
    })

    it('handles namespaced xlinkHref to xlink:href', async () => {
      let stream = renderToStream(
        <svg>
          <use xlinkHref="#icon-star" />
        </svg>,
      )
      let html = await drain(stream)
      assert.equal(html, '<svg><use xlink:href="#icon-star"></use></svg>')
    })

    it("lowercases camelCase attributes that don't need special handling", async () => {
      let stream = renderToStream(
        <input autoComplete="off" autoFocus={true} readOnly={true} tabIndex={-1} maxLength={10} />,
      )
      let html = await drain(stream)
      assert.equal(
        html,
        '<input autocomplete="off" autofocus readonly tabindex="-1" maxlength="10" />',
      )
    })

    it('handles table attributes colSpan and rowSpan', async () => {
      let stream = renderToStream(
        <table>
          <tr>
            <td colSpan={2} rowSpan={3}>
              Cell
            </td>
          </tr>
        </table>,
      )
      let html = await drain(stream)
      assert.equal(html, '<table><tr><td colspan="2" rowspan="3">Cell</td></tr></table>')
    })

    it('filters framework-specific props', async () => {
      let stream = renderToStream(
        <div>
          <button key="btn-1" mix={[on('click', () => {})]} type="button">
            Click me
          </button>
          <ul>
            <li key="item-1">First</li>
            <li key="item-2">Second</li>
          </ul>
        </div>,
      )
      let html = await drain(stream)

      // Framework props should not appear in HTML
      assert.ok(!html.includes('key='))
      assert.ok(!html.includes('mix='))

      // But regular HTML attributes should be preserved
      assert.ok(html.includes('type="button"'))
      assert.ok(html.includes('<li>First</li>'))
      assert.ok(html.includes('<li>Second</li>'))
    })

    it('resolves mixins for host prop composition', async () => {
      let withTitle = createMixin((handle) => (title: string, props: { title?: string }) => (
        <handle.element {...props} title={title} />
      ))
      let appendTitle = createMixin((handle) => (suffix: string, props: { title?: string }) => (
        <handle.element {...props} title={`${props.title ?? ''}${suffix}`} />
      ))

      let stream = renderToStream(<div mix={[withTitle('hello'), appendTitle('-world')]} />)
      let html = await drain(stream)

      assert.equal(html, '<div title="hello-world"></div>')
      assert.ok(!html.includes('mix='))
    })

    it('supports nested mix descriptors via handle.element', async () => {
      let withData = createMixin(
        (handle) => (value: string, props: { ['data-mixed']?: string }) => (
          <handle.element {...props} data-mixed={value} />
        ),
      )
      let withNested = createMixin(
        (handle) => (value: string, props: { ['data-mixed']?: string }) => (
          <handle.element {...props} mix={[withData(value)]} />
        ),
      )

      let stream = renderToStream(<div mix={[withNested('nested')]} />)
      let html = await drain(stream)

      assert.equal(html, '<div data-mixed="nested"></div>')
      assert.ok(!html.includes('mix='))
    })

    it('ignores lifecycle-only mixin side effects during SSR', async () => {
      let updateError: unknown
      let lifecycleOnly = createMixin((handle) => {
        handle.addEventListener('insert', () => {
          throw new Error('should not run in SSR')
        })
        handle.queueTask(() => {
          throw new Error('should not run in SSR')
        })
        try {
          void handle.update()
        } catch (error) {
          updateError = error
        }

        return (props: { title?: string }) => <handle.element {...props} title="ok" />
      })

      let stream = renderToStream(<div mix={[lifecycleOnly()]} />)
      let html = await drain(stream)

      assert.equal(html, '<div title="ok"></div>')
      assert.ok(updateError instanceof Error)
      assert.equal((updateError as Error).message, 'handle.update() is not available during SSR.')
    })

    it('serializes css mixin styles into style tags and class names', async () => {
      let stream = renderToStream(
        <div
          className="base"
          mix={[
            css({ color: 'red' }),
            css({
              backgroundColor: 'black',
            }),
          ]}
        />,
      )
      let html = await drain(stream)

      assert.ok(html.includes('<style data-rmx-styles>'))
      assert.match(html, /class="base rmxc-[a-z0-9]+ rmxc-[a-z0-9]+"/)
      assert.ok(html.includes('.rmxc-'))
    })
  })

  describe('svg', () => {
    it('renders SVG with preserved viewBox and kebab-cased attributes', async () => {
      let stream = renderToStream(
        <svg viewBox="0 0 24 24" fill="none">
          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>,
      )
      let html = await drain(stream)
      assert.equal(
        html,
        '<svg viewBox="0 0 24 24" fill="none"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"></path></svg>',
      )
    })

    it('renders foreignObject subtree as HTML (className -> class)', async () => {
      let stream = renderToStream(
        <svg>
          <foreignObject>
            <div id="x" className="a">
              Hello
            </div>
          </foreignObject>
        </svg>,
      )
      let html = await drain(stream)
      assert.equal(
        html,
        '<svg><foreignObject><div id="x" class="a">Hello</div></foreignObject></svg>',
      )
    })

    it('renders xmlLang and xmlSpace as xml:lang and xml:space', async () => {
      let stream = renderToStream(
        <svg>
          <text xmlLang="en" xmlSpace="preserve">
            Hi
          </text>
        </svg>,
      )
      let html = await drain(stream)
      assert.equal(html, '<svg><text xml:lang="en" xml:space="preserve">Hi</text></svg>')
    })

    it('renders canonical camelCase unit attributes for SVG filters and gradients', async () => {
      let stream = renderToStream(
        <svg>
          <defs>
            <filter id="f" filterUnits="userSpaceOnUse" primitiveUnits="objectBoundingBox">
              <feGaussianBlur stdDeviation="2.5" />
            </filter>
            <linearGradient id="g" gradientUnits="userSpaceOnUse" />
          </defs>
        </svg>,
      )
      let html = await drain(stream)
      assert.ok(html.includes('filterUnits="userSpaceOnUse"'))
      assert.ok(html.includes('primitiveUnits="objectBoundingBox"'))
      assert.ok(html.includes('gradientUnits="userSpaceOnUse"'))
      assert.ok(!html.includes('filter-units='))
      assert.ok(!html.includes('primitive-units='))
      assert.ok(!html.includes('gradient-units='))
      assert.ok(html.includes('stdDeviation="2.5"'))
      assert.ok(!html.includes('std-deviation='))
    })
  })

  describe('styles', () => {
    it('handles css mixin with style objects', async () => {
      let stream = renderToStream(
        <div mix={[css({ color: 'red', fontSize: '16px' })]}>Styled text</div>,
      )
      let html = await drain(stream)

      // Should have a style tag in head
      assert.ok(html.includes('<style data-rmx-styles>'))
      assert.ok(html.includes('.rmxc-'))
      assert.ok(html.includes('color: red'))
      assert.ok(html.includes('font-size: 16px'))

      assert.match(html, /<div class="rmxc-[a-z0-9]+"/)
    })

    it('handles string style prop', async () => {
      let stream = renderToStream(<div style="color: blue; font-weight: bold;">String styled</div>)
      let html = await drain(stream)

      // String styles should be passed through as-is
      assert.equal(html, '<div style="color: blue; font-weight: bold;">String styled</div>')
    })

    it('converts style object to inline string', async () => {
      let stream = renderToStream(
        <div style={{ color: 'green', marginTop: 10, padding: '5px' }}>Object styled</div>,
      )
      let html = await drain(stream)

      // Style objects should be serialized to inline styles
      assert.equal(
        html,
        '<div style="color: green; margin-top: 10px; padding: 5px;">Object styled</div>',
      )
    })

    it('combines css mixin with existing className', async () => {
      let stream = renderToStream(
        <div className="existing-class" mix={[css({ background: 'yellow' })]}>
          Combined classes
        </div>,
      )
      let html = await drain(stream)

      assert.match(html, /<div class="existing-class rmxc-[a-z0-9]+"/)
      assert.ok(html.includes('background: yellow'))
    })

    it('combines css mixin with existing class attribute', async () => {
      let stream = renderToStream(
        <div class="existing-class" mix={[css({ background: 'yellow' })]}>
          Combined classes
        </div>,
      )
      let html = await drain(stream)

      assert.match(html, /<div class="existing-class rmxc-[a-z0-9]+"/)
      assert.ok(html.includes('background: yellow'))
    })

    it('deduplicates styles across multiple elements', async () => {
      let stream = renderToStream(
        <div>
          <span mix={[css({ color: 'red', fontSize: '14px' })]}>First</span>
          <span mix={[css({ color: 'red', fontSize: '14px' })]}>Second</span>
          <span mix={[css({ color: 'blue' })]}>Third</span>
        </div>,
      )
      let html = await drain(stream)

      // Should only have one instance of the red/14px style
      let redStyleMatches = html.match(/color: red/g)
      assert.equal(redStyleMatches?.length, 1)

      // Should have the blue style too
      assert.ok(html.includes('color: blue'))

      // Both red spans should have same className (same css hash)
      let spanMatches = html.match(/<span class="rmxc-[a-z0-9]+">/g)
      assert.equal(spanMatches?.length, 3)
      // First two spans have same style, third has different
      assert.equal(spanMatches?.[0], spanMatches?.[1])
      assert.notEqual(spanMatches?.[0], spanMatches?.[2])
    })

    it('places styles in head when html root exists', async () => {
      let stream = renderToStream(
        <html>
          <body>
            <div mix={[css({ color: 'purple' })]}>Content</div>
          </body>
        </html>,
      )
      let html = await drain(stream)

      // Style should be in the head section
      assert.ok(html.includes('<html><head><style data-rmx-styles>'))
      assert.ok(html.includes('color: purple'))
      assert.ok(html.includes('</style></head><body>'))
    })

    it('places styles in head when no html root', async () => {
      let stream = renderToStream(<div mix={[css({ color: 'orange' })]}>No HTML root</div>)
      let html = await drain(stream)

      // Style should be in a head element
      assert.match(html, /^<head><style data-rmx-styles>/)
      assert.ok(html.includes('color: orange'))
      assert.match(html, /<\/style><\/head><div class="rmxc-[a-z0-9]+">No HTML root<\/div>$/)
    })

    it('handles css mixin in components', async () => {
      function StyledButton(handle: Handle) {
        return ({ label }: { label: string }) => (
          <button mix={[css({ background: 'blue', color: 'white', padding: '10px' })]}>
            {label}
          </button>
        )
      }

      let stream = renderToStream(
        <div>
          <StyledButton label="Click me" />
          <StyledButton label="And me" />
        </div>,
      )
      let html = await drain(stream)

      // Should have the style only once
      let bgMatches = html.match(/background: blue/g)
      assert.equal(bgMatches?.length, 1)

      // Both buttons should have the same generated class
      let buttonMatches = html.match(/<button class="rmxc-[a-z0-9]+"/g)
      assert.equal(buttonMatches?.length, 2)
      assert.equal(buttonMatches?.[0], buttonMatches?.[1])
    })

    it('handles empty css mixin', async () => {
      let stream = renderToStream(<div mix={[css({})]}>Empty css mixin</div>)
      let html = await drain(stream)

      // Should not add any class or styles
      assert.equal(html, '<div>Empty css mixin</div>')
      assert.ok(!html.includes('<style'))
      assert.ok(!html.includes('class='))
    })

    it('handles pseudo selectors in css mixin', async () => {
      let stream = renderToStream(
        <button
          mix={[
            css({
              color: 'black',
              ':hover': {
                color: 'red',
              },
              ':focus': {
                outline: '2px solid blue',
              },
            }),
          ]}
        >
          Hover me
        </button>,
      )
      let html = await drain(stream)

      // Should generate hover and focus styles
      assert.ok(html.includes(':hover'))
      assert.ok(html.includes('color: red'))
      assert.ok(html.includes(':focus'))
      assert.ok(html.includes('outline: 2px solid blue'))
    })

    it('handles media queries in css mixin', async () => {
      let stream = renderToStream(
        <div
          mix={[
            css({
              fontSize: '14px',
              '@media (min-width: 768px)': {
                fontSize: '16px',
              },
            }),
          ]}
        >
          Responsive text
        </div>,
      )
      let html = await drain(stream)

      // Should generate media query
      assert.ok(html.includes('@media (min-width: 768px)'))
      assert.ok(html.includes('font-size: 16px'))
    })

    it('merges styles with existing head content', async () => {
      let stream = renderToStream(
        <html>
          <head>
            <title>Page Title</title>
            <meta charSet="utf-8" />
          </head>
          <body>
            <div mix={[css({ fontWeight: 'bold' })]}>Bold text</div>
          </body>
        </html>,
      )
      let html = await drain(stream)

      // Styles should be injected into existing head, preserving other content
      assert.ok(html.includes('<head>'))
      assert.ok(html.includes('<style data-rmx-styles>'))
      assert.ok(html.includes('font-weight: bold'))
      assert.ok(html.includes('<title>Page Title</title>'))
      assert.ok(html.includes('<meta charset="utf-8" />'))
      assert.ok(html.includes('</head>'))

      // Verify styles are in the head
      let headMatch = html.match(/<head>(.*?)<\/head>/s)
      assert.ok(headMatch)
      let headContent = headMatch![1]
      assert.ok(headContent.includes('<style data-rmx-styles>'))
      assert.ok(headContent.includes('<title>Page Title</title>'))
      assert.ok(headContent.includes('<meta charset="utf-8" />'))
    })
  })

  describe('error handling', () => {
    it('calls onError for errors', async () => {
      let capturedError: unknown

      function BadComponent() {
        throw new Error('Render error!')
        return () => null
      }

      let stream = renderToStream(<BadComponent />, {
        onError: (error) => {
          capturedError = error
        },
      })

      await assert.rejects(() => drain(stream), { message: 'Render error!' })
      assert.equal(capturedError instanceof Error && capturedError.message, 'Render error!')
    })

    it('renderToString throws errors that can be caught with try/catch', async () => {
      function BadComponent() {
        throw new Error('Component error!')
        return () => null
      }

      let caughtError: unknown
      try {
        await renderToString(<BadComponent />)
      } catch (error) {
        caughtError = error
      }

      assert.ok(caughtError instanceof Error)
      assert.equal((caughtError as Error).message, 'Component error!')
    })
  })

  describe('doctype', () => {
    it('handles whitespace before html element', async () => {
      let stream = renderToStream([
        '\n  ',
        <html>
          <body>Content</body>
        </html>,
      ])
      let html = await drain(stream)
      assert.equal(html, '\n  <html><body>Content</body></html>')
    })
  })

  describe('head managed content', () => {
    it('hoists title elements to head', async () => {
      let stream = renderToStream(
        <html>
          <body>
            <title>Page Title</title>
            <div>Content</div>
          </body>
        </html>,
      )
      let html = await drain(stream)
      assert.equal(
        html,
        '<html><head><title>Page Title</title></head><body><div>Content</div></body></html>',
      )
    })

    it('hoists meta elements to head', async () => {
      let stream = renderToStream(
        <div>
          <meta name="description" content="Test page" />
          <h1>Hello</h1>
        </div>,
      )
      let html = await drain(stream)
      assert.equal(
        html,
        '<head><meta name="description" content="Test page" /></head><div><h1>Hello</h1></div>',
      )
    })

    it('hoists link elements to head', async () => {
      let stream = renderToStream(
        <div>
          <link rel="stylesheet" href="/styles.css" />
          <p>Content</p>
        </div>,
      )
      let html = await drain(stream)
      assert.equal(
        html,
        '<head><link rel="stylesheet" href="/styles.css" /></head><div><p>Content</p></div>',
      )
    })

    it('collects multiple head elements', async () => {
      let stream = renderToStream(
        <div>
          <title>My App</title>
          <meta charSet="utf-8" />
          <p>Hello</p>
          <link rel="icon" href="/favicon.ico" />
          <meta name="viewport" content="width=device-width" />
        </div>,
      )
      let html = await drain(stream)
      assert.equal(
        html,
        '<head><title>My App</title><meta charset="utf-8" /><link rel="icon" href="/favicon.ico" /><meta name="viewport" content="width=device-width" /></head><div><p>Hello</p></div>',
      )
    })

    it('hoists head elements from components', async () => {
      function SEO(handle: Handle) {
        return () => (
          <>
            <title>Component Title</title>
            <meta name="description" content="Component Description" />
          </>
        )
      }

      let stream = renderToStream(
        <div>
          <SEO />
          <main>Content</main>
        </div>,
      )
      let html = await drain(stream)
      assert.equal(
        html,
        '<head><title>Component Title</title><meta name="description" content="Component Description" /></head><div><main>Content</main></div>',
      )
    })

    it('merges head elements with existing head tag', async () => {
      let stream = renderToStream(
        <html>
          <head>
            <meta charSet="utf-8" />
          </head>
          <body>
            <title>Body Title</title>
            <link rel="stylesheet" href="/app.css" />
            <div>Content</div>
          </body>
        </html>,
      )
      let html = await drain(stream)
      assert.equal(
        html,
        '<html><head><meta charset="utf-8" /><title>Body Title</title><link rel="stylesheet" href="/app.css" /></head><body><div>Content</div></body></html>',
      )
    })

    it('hoists structured data scripts to head', async () => {
      let structuredData = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: 'Test Product',
      }

      let stream = renderToStream(
        <div>
          <script type="application/ld+json" innerHTML={JSON.stringify(structuredData)} />
          <h1>Product Page</h1>
        </div>,
      )
      let html = await drain(stream)
      assert.equal(
        html,
        '<head><script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Test Product"}</script></head><div><h1>Product Page</h1></div>',
      )
    })

    it('does NOT hoist regular script tags', async () => {
      let stream = renderToStream(
        <div>
          <h1>Page Title</h1>
          <script innerHTML="console.log('Hello World')" />
          <p>Some content</p>
        </div>,
      )
      let html = await drain(stream)
      assert.equal(
        html,
        "<div><h1>Page Title</h1><script>console.log('Hello World')</script><p>Some content</p></div>",
      )
    })

    it('hoists only ld+json scripts when mixed with regular scripts', async () => {
      let stream = renderToStream(
        <div>
          <script type="text/javascript" innerHTML="console.log('Regular script')" />
          <script
            type="application/ld+json"
            innerHTML='{"@context":"https://schema.org","@type":"WebPage"}'
          />
          <script innerHTML="console.log('Another regular script')" />
          <h1>Mixed Scripts Page</h1>
        </div>,
      )
      let html = await drain(stream)
      assert.equal(
        html,
        '<head><script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage"}</script></head><div><script type="text/javascript">console.log(\'Regular script\')</script><script>console.log(\'Another regular script\')</script><h1>Mixed Scripts Page</h1></div>',
      )
    })
  })

  describe('hydration', () => {
    it('renders hydrated component with hydration script', async () => {
      // Create a simple hydrated component
      let Counter = clientEntry('/js/counter.js#Counter', function Counter(handle: Handle) {
        return ({ initialCount }: { initialCount: number }) => <div>Count: {initialCount}</div>
      })

      // Render the component
      let stream = renderToStream(<Counter initialCount={42} />)
      let html = await drain(stream)

      // Verify the output contains both the rendered HTML and markers with ID
      let hydrationId = getCommentMarkerId(html, 'rmx:h:')
      assert.ok(html.includes(`<!-- rmx:h:${hydrationId} -->`))
      assert.ok(html.includes('<div>Count: 42</div>'))
      assert.ok(html.includes('<!-- /rmx:h -->'))

      // Check for aggregated data script at the end
      assert.ok(html.includes('<script type="application/json" id="rmx-data">'))

      // Parse the aggregated data
      let data = parseRmxDataFromHtml(html)

      assert.ok(data.h != null)
      assert.deepEqual(data.h[hydrationId], {
        moduleUrl: '/js/counter.js',
        exportName: 'Counter',
        props: { initialCount: 42 },
      })

      // Ordering: start marker < content < end marker
      let startIdx = html.indexOf(`<!-- rmx:h:${hydrationId} -->`)
      let contentIdx = html.indexOf('<div>Count: 42</div>')
      let endIdx = html.indexOf('<!-- /rmx:h -->')
      assert.ok(startIdx >= 0)
      assert.ok(contentIdx > startIdx)
      assert.ok(endIdx > contentIdx)
    })

    it('escapes rmx-data payloads that contain script end tags', async () => {
      let Counter = clientEntry('/js/counter.js#Counter', function Counter(handle: Handle) {
        return ({ label }: { label: string }) => <div>{label}</div>
      })

      let scriptBreakingLabel = '</script><script>alert("xss")</script>'
      let stream = renderToStream(<Counter label={scriptBreakingLabel} />)
      let html = await drain(stream)
      let shelf = document.createElement('template')
      shelf.innerHTML = html
      let script = getLatestRmxDataScript(shelf.content)

      // Ensure we do not emit a literal closing tag inside rmx-data payload.
      assert.ok(!(script.textContent || '').includes('</script>'))

      // Ensure the data still parses and round-trips to the original value.
      let data = parseRmxDataFromHtml(html)
      let [hydrationId, entry] = getSingleEntry(data.h)
      assert.ok(hydrationId != null)
      assert.equal(entry.props.label, scriptBreakingLabel)
    })

    it('renders multiple hydrated components with unique instance IDs', async () => {
      // Create hydrated components
      let Button = clientEntry('/js/button.js#Button', function Button(handle: Handle) {
        return ({ text }: { text: string }) => <button>{text}</button>
      })

      // Render multiple hydrated components
      let stream = renderToStream(
        <div>
          <Button text="First" />
          <Button text="Second" />
        </div>,
      )
      let html = await drain(stream)

      // Verify both buttons are rendered inside hydration markers with unique IDs
      assert.ok(html.includes('<!-- rmx:h:'))
      assert.ok(html.includes('<button>First</button>'))
      assert.ok(html.includes('<button>Second</button>'))

      let data = parseRmxDataFromHtml(html)
      assert.equal(Object.keys(data.h).length, 2)
      for (let entry of Object.values<any>(data.h)) {
        assert.equal(entry.moduleUrl, '/js/button.js')
        assert.equal(entry.exportName, 'Button')
      }
    })

    it('renders hydrated component with complex props', async () => {
      let Card = clientEntry('/js/card.js#Card', function Card(handle: Handle) {
        return (props: {
          title: string
          count: number
          enabled: boolean
          items: string[]
          nested: { value: number }
        }) => (
          <div>
            <h2>{props.title}</h2>
            <p>Count: {props.count}</p>
            <section>Enabled: {String(props.enabled)}</section>
            <ul>
              {props.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
            <main>Nested value: {props.nested.value}</main>
          </div>
        )
      })

      let stream = renderToStream(
        <Card
          title="Test Card"
          count={10}
          enabled={true}
          items={['one', 'two', 'three']}
          nested={{ value: 99 }}
        />,
      )
      let html = await drain(stream)

      // Verify the rendered output inside hydration markers
      let shelf = document.createElement('template')
      shelf.innerHTML = html
      let content = shelf.content
      invariant(content.firstChild instanceof Comment)
      assert.equal(content.firstChild.data.trim().startsWith('rmx:h:'), true)
      assert.equal(shelf.content.querySelector('h2')?.textContent, 'Test Card')
      assert.equal(shelf.content.querySelector('p')?.textContent, 'Count: 10')
      assert.equal(shelf.content.querySelector('section')?.textContent, 'Enabled: true')
      let items = shelf.content.querySelectorAll('li')
      assert.equal(items.length, 3)
      assert.equal(items[0].textContent, 'one')
      assert.equal(items[1].textContent, 'two')
      assert.equal(items[2].textContent, 'three')
      assert.equal(shelf.content.querySelector('main')?.textContent, 'Nested value: 99')

      // Check aggregated data script
      let script = shelf.content.querySelector(rmxDataScriptSelector)
      invariant(script)
      let data = JSON.parse(script.textContent || '{}')
      let [, entry] = getSingleEntry(data.h)
      assert.deepEqual(entry.props, {
        title: 'Test Card',
        count: 10,
        enabled: true,
        items: ['one', 'two', 'three'],
        nested: { value: 99 },
      })
    })

    it('serializes virtual host elements', async () => {
      let Card = clientEntry('/js/card.js#Card', function Card(handle: Handle) {
        return (props: { children: RemixNode }) => (
          <div>
            <h1>Test Card</h1>
            {props.children}
          </div>
        )
      })

      let stream = renderToStream(
        <Card>
          <p>Hello, world!</p>
        </Card>,
      )
      let html = await drain(stream)
      let shelf = document.createElement('template')
      shelf.innerHTML = html
      let script = shelf.content.querySelector(rmxDataScriptSelector)
      invariant(script)
      let data = JSON.parse(script.textContent || '{}')

      let [, entry] = getSingleEntry(data.h)
      assert.deepEqual(entry.props.children, {
        $rmx: true,
        type: 'p',
        props: {
          children: 'Hello, world!',
        },
      })
    })

    it('serializes virtual component elements', async () => {
      let Card = clientEntry('/js/card.js#Card', function Card(handle: Handle) {
        return (props: { children: RemixNode }) => (
          <div>
            <h1>Test Card</h1>
            {props.children}
          </div>
        )
      })

      function UnwrappedChild(handle: Handle) {
        return () => (
          <p>
            <DeepChild />
          </p>
        )
      }

      function DeepChild(handle: Handle) {
        return () => <span>Hello, world!</span>
      }

      let stream = renderToStream(
        <Card>
          <UnwrappedChild />
        </Card>,
      )
      let html = await drain(stream)
      let shelf = document.createElement('template')
      shelf.innerHTML = html
      let script = shelf.content.querySelector(rmxDataScriptSelector)
      invariant(script)
      let data = JSON.parse(script.textContent || '{}')
      let [, entry] = getSingleEntry(data.h)
      assert.deepEqual(entry, {
        exportName: 'Card',
        moduleUrl: '/js/card.js',
        props: {
          children: {
            $rmx: true,
            props: {
              children: {
                $rmx: true,
                props: {
                  children: 'Hello, world!',
                },
                type: 'span',
              },
            },
            type: 'p',
          },
        },
      })
    })

    it('serializes Frame elements in entry props as frame descriptors', async () => {
      let Card = clientEntry('/js/card.js#Card', function Card(handle: Handle) {
        return (props: { children: RemixNode }) => <div>{props.children}</div>
      })

      let stream = renderToStream(
        <Card>
          <Frame src="/child-frame" fallback={<p>Loading child frame…</p>} />
        </Card>,
        {
          resolveFrame: () => '<p>Loaded child frame</p>',
        },
      )
      let html = await drain(stream)
      let shelf = document.createElement('template')
      shelf.innerHTML = html
      let script = shelf.content.querySelector(rmxDataScriptSelector)
      invariant(script)
      let data = JSON.parse(script.textContent || '{}')
      let [, entry] = getSingleEntry(data.h)

      assert.deepEqual(entry.props.children, {
        $rmxFrame: true,
        props: {
          src: '/child-frame',
          fallback: {
            $rmx: true,
            type: 'p',
            props: {
              children: 'Loading child frame…',
            },
          },
        },
      })
    })

    it('nests hydrated components', async () => {
      let Card = clientEntry('/card.js#Card', function Card(handle: Handle) {
        return ({ children }: { children: RemixNode }) => <div>{children}</div>
      })

      let Button = clientEntry('/button.js#Button', function Button(handle: Handle) {
        return () => <button />
      })

      let stream = renderToStream(
        <Card>
          <Button />
        </Card>,
      )

      let html = await drain(stream)
      let shelf = document.createElement('template')
      shelf.innerHTML = html
      let script = shelf.content.querySelector(rmxDataScriptSelector)
      invariant(script)
      let data = JSON.parse(script.textContent || '{}')
      let entries = Object.values<any>(data.h)
      assert.equal(entries.length, 2)
      assert.equal(
        entries.some((entry) => entry.moduleUrl === '/card.js' && entry.exportName === 'Card'),
        true,
      )
      assert.equal(
        entries.some((entry) => entry.moduleUrl === '/button.js' && entry.exportName === 'Button'),
        true,
      )
    })
  })

  describe('frames', () => {
    it('adds frame scripts for non-blocking frames', async () => {
      // Test non-blocking frame (with fallback)
      let stream = renderToStream(<Frame src="/x" fallback={<div>Loading...</div>} />, {
        resolveFrame: () => '<div>Resolved</div>',
      })
      let result = await drain(stream)

      let frameId = getCommentMarkerId(result, 'rmx:f:')
      // Should render fallback content with frame markers
      assert.ok(result.includes(`<!-- rmx:f:${frameId} -->`))
      assert.ok(result.includes('<div>Loading...</div>'))
      assert.ok(result.includes('<!-- /rmx:f -->'))

      // Should have aggregated frame metadata script
      let data = parseRmxDataFromHtml(result)
      assert.deepEqual(data.f[frameId], {
        status: 'pending',
        src: '/x',
      })
    })

    it('adds frame scripts for blocking frames', async () => {
      let stream = renderToStream(<Frame src="/x" />, {
        resolveFrame: () => '<div>Resolved</div>',
      })
      let result = await drain(stream)

      let frameId = getCommentMarkerId(result, 'rmx:f:')
      // Should have frame markers
      assert.ok(result.includes(`<!-- rmx:f:${frameId} -->`))
      assert.ok(result.includes('<div>Resolved</div>'))
      assert.ok(result.includes('<!-- /rmx:f -->'))

      // Should have aggregated frame metadata script
      let data = parseRmxDataFromHtml(result)
      assert.equal(data.f[frameId].status, 'resolved')
    })

    it('renders blocking frames without fallback', async () => {
      // Test blocking frame (no fallback)
      let stream = renderToStream(<Frame src="/fragments/product" />, {
        resolveFrame: async () => '<div>Product</div>',
      })
      let chunks = readChunks(stream)

      // Get first chunk
      let firstChunk = await chunks.next()
      assert.equal(firstChunk.done, false)
      let content = firstChunk.value!

      // First chunk should contain the resolved frame with markers
      let frameId = getCommentMarkerId(content, 'rmx:f:')
      assert.ok(content.includes(`<!-- rmx:f:${frameId} -->`))
      assert.ok(content.includes('<div>Product</div>'))
      assert.ok(content.includes('<!-- /rmx:f -->'))

      // Should have aggregated frame metadata script with resolved status
      let data = parseRmxDataFromHtml(content)
      assert.equal(data.f[frameId].status, 'resolved')

      // Should be done after first chunk
      let done = await chunks.next()
      assert.equal(done.done, true)
    })

    it('assigns IDs for nested non-blocking frames', async () => {
      let stream = renderToStream(
        <div>
          <Frame
            src="/outer"
            fallback={
              <div>
                Outer loading
                <Frame src="/inner" fallback={<span>Inner loading</span>} />
              </div>
            }
          />
        </div>,
        { resolveFrame: async () => '<div>Resolved</div>' },
      )
      let html = await drain(stream)

      // Check for frame markers
      assert.ok(html.includes('<!-- rmx:f:'))

      // Aggregated data with hierarchical ids and pending statuses
      let data = parseRmxDataFromHtml(html)
      assert.equal(Object.keys(data.f).length, 2)
      for (let entry of Object.values<any>(data.f)) {
        assert.equal(entry.status, 'pending')
      }

      // Fallbacks rendered
      assert.ok(html.includes('Outer loading'))
      assert.ok(html.includes('Inner loading'))
    })

    it('awaits nested blocking frames before first chunk', async () => {
      async function resolveFrame(src: string) {
        if (src === '/outer') {
          return renderToStream(
            <div>
              Outer
              <Frame src="/inner" />
            </div>,
            { resolveFrame },
          )
        }
        if (src === '/inner') {
          return '<div>Inner</div>'
        }
        return '<div></div>'
      }

      let stream = renderToStream(<Frame src="/outer" />, { resolveFrame })

      let chunks = readChunks(stream)
      let first = await chunks.next()
      assert.equal(first.done, false)
      let content = first.value!

      // Both outer and inner should be present in first chunk
      assert.ok(content.includes('Outer'))
      assert.ok(content.includes('<div>Inner</div>'))

      // Both frames resolved in aggregated data
      let shelf = document.createElement('template')
      shelf.innerHTML = content
      let scripts = shelf.content.querySelectorAll(rmxDataScriptSelector)
      let script = scripts.item(scripts.length - 1)
      invariant(script)
      let data = JSON.parse(script.textContent || '{}')
      assert.ok(Object.values<any>(data.f).some((v) => v.status === 'resolved'))

      console.log(content)
      // Stream completes
      let done = await chunks.next()
      assert.equal(done.done, true)
    })

    it('renders nested non-blocking inside blocking with fallback', async () => {
      async function resolveFrame(src: string) {
        if (src === '/outer') {
          return renderToStream(
            <div>
              Outer
              <Frame src="/inner" fallback={<span>Inner loading</span>} />
            </div>,
            { resolveFrame },
          )
        }
        if (src === '/inner') return '<div>Inner</div>'
        return '<div></div>'
      }

      let stream = renderToStream(<Frame src="/outer" />, { resolveFrame })

      let chunks = readChunks(stream)
      let first = await chunks.next()
      assert.equal(first.done, false)
      let content = first.value!

      // Outer resolved, inner fallback pending in first chunk
      assert.ok(content.includes('Outer'))
      assert.ok(content.includes('Inner loading'))

      // Check aggregated data
      let shelf = document.createElement('template')
      shelf.innerHTML = content
      let scripts = shelf.content.querySelectorAll(rmxDataScriptSelector)
      let script = scripts.item(scripts.length - 1)
      invariant(script)
      let data = JSON.parse(script.textContent || '{}')
      assert.ok(Object.values<any>(data.f).some((v) => v.status === 'resolved'))

      // Since the inner frame is non-blocking, it should stream later
      let second = await chunks.next()
      assert.equal(second.done, false)
      assert.ok(second.value!.includes('<template id="f'))

      let done = await chunks.next()
      assert.equal(done.done, true)
    })

    it('streams non-blocking frame content after initial chunk', async () => {
      let [promise, resolve] = withResolvers<string>()

      let stream = renderToStream(
        <div>
          <h1>Page Title</h1>
          <Frame src="/fragments/product" fallback={<div>Loading product...</div>} />
          <p>Footer content</p>
        </div>,
        {
          resolveFrame: async (src) => {
            if (src === '/fragments/product') {
              return promise
            }
            return '<div></div>'
          },
        },
      )

      let chunks = readChunks(stream)

      // First chunk should contain fallback
      let firstChunk = await chunks.next()
      assert.equal(firstChunk.done, false)
      let content = firstChunk.value!

      assert.ok(content.includes('<h1>Page Title</h1>'))
      assert.ok(content.includes('<div>Loading product...</div>'))
      assert.ok(content.includes('<p>Footer content</p>'))

      // Check aggregated data for pending status
      let shelf = document.createElement('template')
      shelf.innerHTML = content
      let script = shelf.content.querySelector(rmxDataScriptSelector)
      invariant(script)
      let data = JSON.parse(script.textContent || '{}')
      assert.ok(Object.values<any>(data.f).some((v) => v.status === 'pending'))

      // Resolve the frame content
      resolve('<div>Async Product Content</div>')

      // Second chunk should contain the resolved content as a template
      let secondChunk = await chunks.next()
      assert.equal(secondChunk.done, false)
      let template = secondChunk.value

      assert.ok(template!.includes('<template id="f'))
      assert.ok(template!.includes('<div>Async Product Content</div>'))
      assert.ok(template!.includes('</template>'))

      // Stream should complete
      let done = await chunks.next()
      assert.equal(done.done, true)
    })

    it('escapes frame template content to prevent template breakouts', async () => {
      let [promise, resolve] = withResolvers<string>()
      let injectedHtml = '</template><script>alert("xss")</script><template><p>safe</p>'

      let stream = renderToStream(<Frame src="/danger" fallback={<div>Loading...</div>} />, {
        resolveFrame: async () => promise,
      })

      let chunks = readChunks(stream)
      let firstChunk = await chunks.next()
      assert.equal(firstChunk.done, false)
      assert.ok(firstChunk.value!.includes('<div>Loading...</div>'))

      resolve(injectedHtml)

      let secondChunk = await chunks.next()
      assert.equal(secondChunk.done, false)
      let templateChunk = secondChunk.value!
      assert.ok(templateChunk.includes('<template id="f'))
      assert.ok(
        templateChunk.includes(
          '<\\/template><script>alert("xss")</script><template><p>safe</p>',
        ),
      )
      assert.ok(!templateChunk.includes('</template><script>alert("xss")</script><template>'))

      let done = await chunks.next()
      assert.equal(done.done, true)
    })

    it('streams multiple non-blocking frames in order of resolution', async () => {
      let [frame1Promise, resolveFrame1] = withResolvers<string>()
      let [frame2Promise, resolveFrame2] = withResolvers<string>()

      let stream = renderToStream(
        <div>
          <Frame src="/frame1" fallback={<div>Loading frame 1...</div>} />
          <Frame src="/frame2" fallback={<div>Loading frame 2...</div>} />
        </div>,
        {
          resolveFrame: async (src) => {
            if (src === '/frame1') return frame1Promise
            if (src === '/frame2') return frame2Promise
            return '<div></div>'
          },
        },
      )

      let chunks = readChunks(stream)

      // First chunk has both fallbacks
      let firstChunk = await chunks.next()
      assert.ok(firstChunk.value!.includes('Loading frame 1...'))
      assert.ok(firstChunk.value!.includes('Loading frame 2...'))

      // Check aggregated data
      let shelf = document.createElement('template')
      shelf.innerHTML = firstChunk.value!
      let script = shelf.content.querySelector(rmxDataScriptSelector)
      invariant(script)
      let data = JSON.parse(script.textContent || '{}')
      assert.equal(Object.keys(data.f).length, 2)

      // Resolve frame 2 first
      resolveFrame2('<div>Second Frame Content</div>')

      // Should stream frame 2's content
      let secondChunk = await chunks.next()
      assert.ok(secondChunk.value!.includes('<template id="f'))
      assert.ok(secondChunk.value!.includes('Second Frame Content'))

      // Resolve frame 1
      resolveFrame1('<div>First Frame Content</div>')

      // Should stream frame 1's content
      let thirdChunk = await chunks.next()
      assert.ok(thirdChunk.value!.includes('<template id="f'))
      assert.ok(thirdChunk.value!.includes('First Frame Content'))

      // Stream completes
      let done = await chunks.next()
      assert.equal(done.done, true)
    })

    it('renders descendant frames returned from resolveFrame', async () => {
      async function resolveFrame(src: string) {
        if (src === '/parent') {
          // Parent frame returns content containing a child frame
          return renderToStream(
            <section>
              <h2>Parent Content</h2>
              <Frame src="/child" fallback={<span>Loading child...</span>} />
              <p>Parent footer</p>
            </section>,
            { resolveFrame },
          )
        }
        if (src === '/child') {
          // Simulate async loading of child
          await new Promise((resolve) => setTimeout(resolve, 10))
          return '<article>Child Content</article>'
        }
        return '<div></div>'
      }

      let stream = renderToStream(
        <div>
          <h1>Page</h1>
          <Frame src="/parent" fallback={<div>Loading parent...</div>} />
        </div>,
        { resolveFrame },
      )

      let chunks = readChunks(stream)

      // First chunk should contain parent fallback
      let firstChunk = await chunks.next()
      assert.equal(firstChunk.done, false)
      let content = firstChunk.value!

      assert.ok(content.includes('<h1>Page</h1>'))
      assert.ok(content.includes('<div>Loading parent...</div>'))

      // Check aggregated data for parent pending
      let shelf = document.createElement('template')
      shelf.innerHTML = content
      let script = shelf.content.querySelector(rmxDataScriptSelector)
      invariant(script)
      let data = JSON.parse(script.textContent || '{}')
      assert.ok(Object.values<any>(data.f).some((v) => v.status === 'pending'))

      // Second chunk should contain parent's resolved content with child frame
      let secondChunk = await chunks.next()
      assert.equal(secondChunk.done, false)
      let parentTemplate = secondChunk.value

      assert.ok(parentTemplate!.includes('<template id="f'))
      assert.ok(parentTemplate!.includes('<section>'))
      assert.ok(parentTemplate!.includes('<h2>Parent Content</h2>'))
      assert.ok(parentTemplate!.includes('<span>Loading child...</span>'))
      assert.ok(parentTemplate!.includes('<p>Parent footer</p>'))
      assert.ok(parentTemplate!.includes('</section>'))
      assert.ok(parentTemplate!.includes('</template>'))

      // Third chunk should contain child's resolved content
      let thirdChunk = await chunks.next()
      assert.equal(thirdChunk.done, false)
      let childTemplate = thirdChunk.value

      // IDs are local within the returned fragment stream, so the child template id may collide.
      assert.ok(childTemplate!.includes('<template id="f'))
      assert.ok(childTemplate!.includes('<article>Child Content</article>'))
      assert.ok(childTemplate!.includes('</template>'))

      // Stream should complete
      let done = await chunks.next()
      assert.equal(done.done, true)
    })

    it('handles blocking descendant frames returned from resolveFrame', async () => {
      async function resolveFrame(src: string) {
        if (src === '/parent') {
          // Parent returns content with a blocking child frame (no fallback)
          return renderToStream(
            <main>
              <h2>Parent Header</h2>
              <Frame src="/child" />
              <p>Parent Footer</p>
            </main>,
            { resolveFrame },
          )
        }
        if (src === '/child') {
          return '<div>Blocking Child Content</div>'
        }
        return '<div></div>'
      }

      let stream = renderToStream(<Frame src="/parent" />, { resolveFrame })

      let chunks = readChunks(stream)

      // First chunk should contain everything resolved (all blocking frames await)
      let firstChunk = await chunks.next()
      assert.equal(firstChunk.done, false)
      let content = firstChunk.value!

      // Parent frame and content
      assert.ok(content.includes('<main>'))
      assert.ok(content.includes('<h2>Parent Header</h2>'))

      // Child frame content (nested within parent)
      assert.ok(content.includes('<div>Blocking Child Content</div>'))

      assert.ok(content.includes('<p>Parent Footer</p>'))
      assert.ok(content.includes('</main>'))

      // Both frames should have resolved status in aggregated data
      let shelf = document.createElement('template')
      shelf.innerHTML = content
      let script = shelf.content.querySelector(rmxDataScriptSelector)
      invariant(script)
      let data = JSON.parse(script.textContent || '{}')
      assert.ok(Object.values<any>(data.f).some((v) => v.status === 'resolved'))

      // Stream should complete
      let done = await chunks.next()
      assert.equal(done.done, true)
    })

    it('handles mixed blocking and non-blocking descendant frames', async () => {
      async function resolveFrame(src: string) {
        if (src === '/parent') {
          // Blocking parent returns content with both blocking and non-blocking children
          return renderToStream(
            <div>
              <Frame src="/blocking-child" />
              <Frame src="/non-blocking-child" fallback={<span>Loading...</span>} />
            </div>,
            { resolveFrame },
          )
        }
        if (src === '/blocking-child') {
          return '<div>Blocking Child</div>'
        }
        if (src === '/non-blocking-child') {
          // Simulate async
          await new Promise((resolve) => setTimeout(resolve, 10))
          return '<div>Non-blocking Child</div>'
        }
        return '<div></div>'
      }

      let stream = renderToStream(<Frame src="/parent" />, { resolveFrame })

      let chunks = readChunks(stream)

      // First chunk has parent and blocking child resolved, non-blocking child fallback
      let firstChunk = await chunks.next()
      let content = firstChunk.value!
      console.log('first:\n', firstChunk.value)
      // Parent frame
      assert.ok(content.includes('<div>'))

      // Blocking child resolved
      assert.ok(content.includes('<div>Blocking Child</div>'))

      // Non-blocking child shows fallback
      assert.ok(content.includes('<span>Loading...</span>'))

      assert.ok(content.includes('</div>'))

      // Check aggregated data
      let shelf = document.createElement('template')
      shelf.innerHTML = content
      let script = shelf.content.querySelector(rmxDataScriptSelector)
      invariant(script)
      let data = JSON.parse(script.textContent || '{}')
      assert.ok(Object.values<any>(data.f).some((v) => v.status === 'resolved'))

      // Second chunk has non-blocking child resolved
      let secondChunk = await chunks.next()
      console.log('\n\nsecond:\n', secondChunk.value)
      // IDs are local within the returned fragment stream.
      assert.ok(secondChunk.value!.includes('<template id="f'))
      assert.ok(secondChunk.value!.includes('<div>Non-blocking Child</div>'))
      assert.ok(secondChunk.value!.includes('</template>'))

      // Stream completes
      let done = await chunks.next()
      assert.equal(done.done, true)
    })

    it('emits comment boundaries around non-blocking frame content', async () => {
      let stream = renderToStream(<Frame src="/x" fallback={<div>Loading...</div>} />, {
        resolveFrame: () => '<div>Resolved</div>',
      })
      let chunks = readChunks(stream)

      // First chunk contains fallback + markers
      let first = await chunks.next()
      assert.equal(first.done, false)
      let content = first.value!

      assert.ok(content.includes('<!-- rmx:f:'))
      assert.ok(content.includes('<div>Loading...</div>'))
      assert.ok(content.includes('<!-- /rmx:f -->'))

      let frameId = getCommentMarkerId(content, 'rmx:f:')
      let startIdx = content.indexOf(`<!-- rmx:f:${frameId} -->`)
      let innerIdx = content.indexOf('<div>Loading...</div>')
      let endIdx = content.indexOf('<!-- /rmx:f -->')

      assert.ok(startIdx >= 0)
      assert.ok(innerIdx > startIdx)
      assert.ok(endIdx > innerIdx)

      // Second chunk should be the template for resolved content (no markers expected here)
      let second = await chunks.next()
      if (!second.done) {
        assert.ok(second.value!.includes('<template id="f'))
      }
    })

    it('emits comment boundaries around blocking frame content', async () => {
      let stream = renderToStream(<Frame src="/product" />, {
        resolveFrame: async () => '<section>Resolved</section>',
      })

      let chunks = readChunks(stream)
      let first = await chunks.next()
      assert.equal(first.done, false)
      let content = first.value!

      assert.ok(content.includes('<!-- rmx:f:'))
      assert.ok(content.includes('<section>Resolved</section>'))
      assert.ok(content.includes('<!-- /rmx:f -->'))

      let frameId = getCommentMarkerId(content, 'rmx:f:')
      let startIdx = content.indexOf(`<!-- rmx:f:${frameId} -->`)
      let innerIdx = content.indexOf('<section>Resolved</section>')
      let endIdx = content.indexOf('<!-- /rmx:f -->')

      assert.ok(startIdx >= 0)
      assert.ok(innerIdx > startIdx)
      assert.ok(endIdx > innerIdx)

      let done = await chunks.next()
      assert.equal(done.done, true)
    })

    it('adds name to json script', async () => {
      let stream = renderToStream(<Frame src="/x" name="test" />, {
        resolveFrame: async () => '<div>Resolved</div>',
      })
      let chunks = readChunks(stream)
      let first = await chunks.next()
      assert.equal(first.done, false)
      let content = first.value!

      // Check aggregated data contains name
      let shelf = document.createElement('template')
      shelf.innerHTML = content
      let script = shelf.content.querySelector(rmxDataScriptSelector)
      invariant(script)
      let data = JSON.parse(script.textContent || '{}')
      let entry = Object.values<any>(data.f)[0]
      assert.equal(entry.name, 'test')
    })

    it('delays streaming non-blocking parent until nested blocking child resolves', async () => {
      let [parentPromise, resolveParent] = withResolvers<ReadableStream<Uint8Array>>()
      let [childPromise, resolveChild] = withResolvers<string>()

      async function resolveFrame(src: string) {
        if (src === '/parent') {
          return parentPromise
        }
        if (src === '/child') {
          return childPromise
        }
        return '<div></div>'
      }

      let stream = renderToStream(<Frame src="/parent" fallback={<div>Loading parent...</div>} />, {
        resolveFrame,
      })

      let chunks = readChunks(stream)

      // First chunk should contain parent fallback with pending status
      let first = await chunks.next()
      assert.equal(first.done, false)
      let firstContent = first.value!
      assert.ok(firstContent.includes('<div>Loading parent...</div>'))

      // Check aggregated data
      let shelf = document.createElement('template')
      shelf.innerHTML = firstContent
      let script = shelf.content.querySelector(rmxDataScriptSelector)
      invariant(script)
      let data = JSON.parse(script.textContent || '{}')
      assert.ok(Object.values<any>(data.f).some((v) => v.status === 'pending'))

      // Resolve parent to content that includes a blocking child frame (no fallback)
      resolveParent(
        renderToStream(
          <section>
            <h2>Parent Content</h2>
            <Frame src="/child" />
            <p>Parent footer</p>
          </section>,
          { resolveFrame },
        ),
      )

      // Expect no new chunk yet because the child is blocking
      let chunkArrived = false
      let nextChunkPromise = chunks.next().then((result) => {
        chunkArrived = true
        return result
      })

      await Promise.resolve()
      assert.equal(chunkArrived, false)

      // Now resolve the blocking child
      resolveChild('<article>Child Content</article>')

      // Next chunk should now contain the parent's template with the child's resolved content
      let second = await nextChunkPromise
      assert.equal(second.done, false)
      let parentTemplate = second.value!
      assert.ok(parentTemplate.includes('<template id="f'))
      assert.ok(parentTemplate.includes('<h2>Parent Content</h2>'))
      assert.ok(parentTemplate.includes('<article>Child Content</article>'))
      assert.ok(parentTemplate.includes('</template>'))

      // Stream should complete
      let done = await chunks.next()
      assert.equal(done.done, true)
    })
  })
})
