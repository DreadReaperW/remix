import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { invariant } from '../invariant.ts'
import { on } from './on-mixin.tsx'
import { keysEvents } from './keys-mixin.tsx'

describe('keysEvents mixin', () => {
  it('dispatches keydown:Space events and prevents default', (t) => {
    let calls = 0
    let keydownResult = true
    let { container, root } = t.render(
      <div
        tabIndex={0}
        mix={[
          keysEvents(),
          on(keysEvents.space, () => {
            calls++
          }),
        ]}
      />,
    )

    let div = container.querySelector('div')
    invariant(div)
    keydownResult = div.dispatchEvent(
      new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }),
    )
    root.flush()

    assert.equal(calls, 1)
    assert.equal(keydownResult, false)
  })

  it('dispatches keydown:ArrowUp events', (t) => {
    let calls = 0
    let { container, root } = t.render(
      <div
        mix={[
          keysEvents(),
          on(keysEvents.arrowUp, () => {
            calls++
          }),
        ]}
      />,
    )

    let div = container.querySelector('div')
    invariant(div)
    div.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
    root.flush()

    assert.equal(calls, 1)
  })
})
