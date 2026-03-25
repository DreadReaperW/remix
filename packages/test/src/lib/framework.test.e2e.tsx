import * as assert from '@remix-run/assert'
import type { Handle, RemixNode } from '@remix-run/component'
import { renderToString } from '@remix-run/component/server'
import { createRouter } from '@remix-run/fetch-router'
import { route } from '@remix-run/fetch-router/routes'
import { describe, it } from './framework.ts'

describe('e2e', () => {
  it('runs playwright against a fetch-router instance', async (t) => {
    function Layout() {
      return (props: { children: RemixNode }) => (
        <html>
          <head>
            <title>Test</title>
          </head>
          <body>{props.children}</body>
        </html>
      )
    }

    function Counter(handle: Handle, setup?: number) {
      let count = setup ?? 0
      return () => (
        <button
        // mix={[
        //   on('click', () => {
        //     count--
        //     handle.update()
        //   }),
        // ]}
        >
          {count}
        </button>
      )
    }

    let routes = route({ home: '/' })
    let router = createRouter()
    router.get(routes.home, async () => {
      let html = await renderToString(
        <Layout>
          <Counter />
        </Layout>,
      )
      return new Response(html, { headers: { 'Content-Type': 'text/html' } })
    })
    let page = await t.serve(router.fetch)
    await page.goto('/')
    assert.equal(await page.innerHTML('body'), '<button>0</button>')
  })
})
