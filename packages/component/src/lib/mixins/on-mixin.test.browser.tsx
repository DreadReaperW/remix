import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { on } from './on-mixin.tsx'
import { invariant } from '../invariant.ts'
import type { Assert, Equal } from '../../test/utils.ts'
import type { Dispatched } from './on-mixin.tsx'

describe('on mixin', () => {
  it('updates listeners in place without rebinding when capture is unchanged', (t) => {
    let calls: string[] = []
    let { container, root } = t.render(
      <button mix={[on('click', () => { calls.push('first') })]}>click</button>,
    )

    let button = container.querySelector('button')
    invariant(button)
    let addSpy = t.spyOn(button, 'addEventListener')
    let removeSpy = t.spyOn(button, 'removeEventListener')

    root.render(
      <button mix={[on('click', () => { calls.push('second') })]}>click</button>,
    )
    root.flush()
    button.click()
    root.flush()

    assert.deepEqual(calls, ['second'])
    assert.equal(addSpy.mock.calls.length, 0)
    assert.equal(removeSpy.mock.calls.length, 0)
  })

  it('rebinds when capture option changes', (t) => {
    let { container, root } = t.render(
      <button mix={[on('click', () => {}, false)]}>click</button>,
    )

    let button = container.querySelector('button')
    invariant(button)
    let addSpy = t.spyOn(button, 'addEventListener')
    let removeSpy = t.spyOn(button, 'removeEventListener')

    root.render(<button mix={[on('click', () => {}, true)]}>click</button>)
    root.flush()

    assert.equal(addSpy.mock.calls.length, 1)
    assert.equal(removeSpy.mock.calls.length, 1)
  })

  it('passes abort signal as the second handler argument', (t) => {
    let receivedSignal = AbortSignal.abort()
    let { container, root } = t.render(
      <button mix={[on('click', (_event, signal) => { receivedSignal = signal })]}>click</button>,
    )

    let button = container.querySelector('button')
    invariant(button)
    button.click()
    root.flush()

    assert.ok(receivedSignal instanceof AbortSignal)
    assert.equal(receivedSignal.aborted, false)
  })

  it('supports multiple event types on the same element', (t) => {
    let calls: string[] = []
    let { container, root } = t.render(
      <button
        mix={[
          on('click', () => { calls.push('click') }),
          on('focus', () => { calls.push('focus') }),
        ]}
      >
        click
      </button>,
    )

    let button = container.querySelector('button')
    invariant(button)
    button.dispatchEvent(new FocusEvent('focus', { bubbles: true }))
    button.click()
    root.flush()

    assert.deepEqual(calls, ['focus', 'click'])
  })

  it('removes listeners when on() mixin is removed', (t) => {
    let calls = 0
    let { container, root } = t.render(
      <button mix={[on('click', () => { calls++ })]}>click</button>,
    )

    let button = container.querySelector('button')
    invariant(button)
    button.click()
    root.flush()
    assert.equal(calls, 1)

    root.render(<button>click</button>)
    root.flush()
    button.click()
    root.flush()
    assert.equal(calls, 1)
  })

  it('aborts previous handler signal on reentry', async (t) => {
    let signals: AbortSignal[] = []
    let pendingResolvers: Array<() => void> = []
    let { container, root } = t.render(
      <button
        mix={[
          on('click', async (_event, signal) => {
            signals.push(signal)
            await new Promise<void>((resolve) => {
              pendingResolvers.push(resolve)
            })
          }),
        ]}
      >
        click
      </button>,
    )

    let button = container.querySelector('button')
    invariant(button)
    button.click()
    button.click()
    root.flush()

    assert.equal(signals.length, 2)
    assert.equal(signals[0]!.aborted, true)
    assert.equal(signals[1]!.aborted, false)

    for (let resolve of pendingResolvers) resolve()
    await Promise.resolve()
  })
})

let infersNodeType = (
  <button
    mix={[
      on('pointerdown', (event, signal) => {
        type inferredEvent = Assert<
          Equal<typeof event, Dispatched<PointerEvent, HTMLButtonElement>>
        >
        type inferredTarget = Assert<Equal<typeof event.currentTarget, HTMLButtonElement>>
        type inferredSignal = Assert<Equal<typeof signal, AbortSignal>>
      }),
    ]}
  />
)
