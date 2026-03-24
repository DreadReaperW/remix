import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { invariant } from '../invariant.ts'
import { ref } from './ref-mixin.tsx'
import type { Assert, Equal } from '../../test/utils.ts'

describe('ref mixin', () => {
  it('passes the bound node and handle signal to the callback', (t) => {
    let receivedNode: Element | null = null
    let state: { signal?: AbortSignal } = {}
    let { container } = t.render(
      <button
        mix={[
          ref((node, signal) => {
            receivedNode = node
            state.signal = signal
          }),
        ]}
      >
        click
      </button>,
    )

    let button = container.querySelector('button')
    invariant(button)
    assert.equal(receivedNode, button)
    let signal =
      state.signal ??
      (() => {
        throw new Error('expected ref callback to receive signal')
      })()
    assert.ok(signal instanceof AbortSignal)
    assert.equal(signal.aborted, false)
  })

  it('aborts the signal when the host node is removed', (t) => {
    let state: { signal?: AbortSignal } = {}
    let { root } = t.render(
      <div
        mix={[
          ref((_node, signal) => {
            state.signal = signal
          }),
        ]}
      />,
    )
    let signal =
      state.signal ??
      (() => {
        throw new Error('expected ref callback to receive signal')
      })()
    assert.equal(signal.aborted, false)

    root.render(null)
    root.flush()
    assert.equal(signal.aborted, true)
  })
})

let infersNodeType = (
  <button
    mix={[
      ref((node, signal) => {
        type inferredNode = Assert<Equal<typeof node, HTMLButtonElement>>
        type inferredSignal = Assert<Equal<typeof signal, AbortSignal>>
      }),
    ]}
  />
)
