import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import type { Handle, RemixNode } from '../lib/component.ts'

describe('vnode rendering', () => {
  describe('context', () => {
    it('provides and reads context', (t) => {
      function App(handle: Handle<{ value: string }>) {
        handle.context.set({ value: 'test' })
        return ({ children }: { children: RemixNode }) => <div>{children}</div>
      }

      function Child(handle: Handle) {
        let { value } = handle.context.get(App)
        return () => <main>Child: {value}</main>
      }

      let { container } = t.render(
        <App>
          <Child />
        </App>,
      )
      assert.ok(container.innerHTML.includes('Child: test'))
    })

    it('provides context on updates', (t) => {
      let capturedUpdate = () => {}
      function App(handle: Handle<{ value: string }>) {
        handle.context.set({ value: 'test' })
        capturedUpdate = () => {
          handle.context.set({ value: 'test2' })
          handle.update()
        }
        return ({ children }: { children: RemixNode }) => <div>{children}</div>
      }

      function Child(handle: Handle) {
        return () => {
          let { value } = handle.context.get(App)
          return <main>Child: {value}</main>
        }
      }

      let { container, root } = t.render(
        <App>
          <Child />
        </App>,
      )
      assert.ok(container.innerHTML.includes('Child: test'))

      capturedUpdate()
      root.flush()
      assert.ok(container.innerHTML.includes('Child: test2'))
    })

    it('renders descendants in order of appearance', (t) => {
      let options: string[] = []
      let renderListbox = () => {}

      function Listbox(handle: Handle<{ registerOption: (option: string) => void }>) {
        handle.context.set({
          registerOption: (option: string) => {
            options.push(option)
          },
        })

        renderListbox = handle.update

        return ({ children }: { children: RemixNode }) => {
          options = []
          return <div>{children}</div>
        }
      }

      function Option(handle: Handle) {
        let { registerOption } = handle.context.get(Listbox)
        return ({ value }: { value: string }) => {
          registerOption(value)
          return <div>Option</div>
        }
      }

      function App(handle: Handle) {
        return () => (
          <Listbox>
            <Option value="Option 1" />
            <Option value="Option 2" />
            <Option value="Option 3" />
          </Listbox>
        )
      }

      let { root } = t.render(<App />)
      assert.deepEqual(options, ['Option 1', 'Option 2', 'Option 3'])

      renderListbox()
      root.flush()
      assert.deepEqual(options, ['Option 1', 'Option 2', 'Option 3'])
    })
  })
})
