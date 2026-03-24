import type { TestContext } from '@remix-run/test'
import { renderToString } from '../lib/stream.ts'
import { createRoot } from '../lib/vdom.ts'

export type Assert<T extends true> = T

export type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false

export async function hydrate(t: TestContext, node: Parameters<typeof renderToString>[0]) {
  let html = await renderToString(node)
  let container = document.createElement('div')
  document.body.appendChild(container)
  container.innerHTML = html
  // Wait for styles to be applied
  await new Promise((resolve) => requestAnimationFrame(resolve))
  let root = createRoot(container)
  t.after(() => {
    root.dispose()
    container.remove()
  })
  return { container, root }
}

export async function drain(stream: ReadableStream<Uint8Array>): Promise<string> {
  let reader = stream.getReader()
  let decoder = new TextDecoder()
  let html = ''

  while (true) {
    let { done, value } = await reader.read()
    if (done) break
    html += decoder.decode(value)
  }

  return html
}

export function readChunks(stream: ReadableStream<Uint8Array>): AsyncGenerator<string, void, void> {
  let reader = stream.getReader()
  let decoder = new TextDecoder()

  return (async function* () {
    while (true) {
      let { done, value } = await reader.read()
      if (done) break
      yield decoder.decode(value)
    }
  })()
}

export function withResolvers<T = unknown>(): [
  Promise<T>,
  (value: T) => void,
  (error: unknown) => void,
] {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  let promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return [promise, resolve, reject]
}
