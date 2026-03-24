import { createRoot, type VirtualRoot } from '@remix-run/component'
import type { RemixNode } from '@remix-run/component/jsx-runtime'

export function render(node: RemixNode) {
  let container: HTMLDivElement | undefined = document.createElement('div')
  document.body.appendChild(container)
  let root: VirtualRoot | undefined = createRoot(container)
  root.render(node)
  root.flush()

  let ctx = {
    get container() {
      if (!container) throw new Error('Test container has already been cleaned up')
      return container
    },
    get root() {
      if (!root) throw new Error('Test root has already been cleaned up')
      return root
    },
    $: (s: string) => ctx.container.querySelector<HTMLElement>(s),
    $$: (s: string) => ctx.container.querySelectorAll<HTMLElement>(s),
    async act(fn: () => unknown | Promise<unknown>) {
      await fn()
      ctx.root.flush()
    },
    cleanup() {
      ctx.root.dispose()
      ctx.container?.remove()
      container = undefined
      root = undefined
    },
  }

  return ctx
}
