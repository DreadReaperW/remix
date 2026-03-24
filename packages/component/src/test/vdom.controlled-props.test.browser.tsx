import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import type { Handle } from '../lib/component.ts'
import { on } from '../index.ts'

describe('vdom controlled props', () => {
  it('restores controlled value on native input when no update happens', async (t) => {
    let { container } = t.render(<input value="hello" />)

    let input = container.querySelector('input') as HTMLInputElement
    input.value = 'hello123'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await Promise.resolve()
    await Promise.resolve()
    assert.equal(input.value, 'hello')
  })

  it('restores controlled checked on native change when no update happens', async (t) => {
    let { container } = t.render(<input type="checkbox" checked={true} />)

    let input = container.querySelector('input') as HTMLInputElement
    input.checked = false
    input.dispatchEvent(new Event('change', { bubbles: true }))
    await Promise.resolve()
    await Promise.resolve()
    assert.equal(input.checked, true)
  })

  it('does not clobber controlled value when input event commits a new value', async (t) => {
    function App(handle: Handle) {
      let value = 'hello'
      return () => (
        <input
          value={value}
          mix={[
            on('input', (event) => {
              value = event.currentTarget.value
              handle.update()
            }),
          ]}
        />
      )
    }

    let { container } = t.render(<App />)

    let input = container.querySelector('input') as HTMLInputElement
    input.value = 'helloa'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await Promise.resolve()
    await Promise.resolve()
    assert.equal(input.value, 'helloa')
  })

  it('does not control value/checked when prop value is undefined', async (t) => {
    let { container } = t.render(
      <>
        <input id="text" value={undefined} />
        <input id="check" type="checkbox" checked={undefined} />
      </>,
    )

    let text = container.querySelector('#text') as HTMLInputElement
    text.value = 'user typed'
    text.dispatchEvent(new Event('input', { bubbles: true }))

    let check = container.querySelector('#check') as HTMLInputElement
    check.checked = true
    check.dispatchEvent(new Event('change', { bubbles: true }))

    await Promise.resolve()
    await Promise.resolve()
    assert.equal(text.value, 'user typed')
    assert.equal(check.checked, true)
  })

  it('detaches controlled listeners on dispose', async (t) => {
    let { container, root } = t.render(<input value="hello" />)

    let input = container.querySelector('input') as HTMLInputElement
    root.dispose()
    root.flush()

    input.value = 'post-dispose'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    await Promise.resolve()
    await Promise.resolve()
    assert.equal(input.value, 'post-dispose')
  })
})
