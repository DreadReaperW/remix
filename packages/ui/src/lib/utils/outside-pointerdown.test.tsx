// @jsxRuntime classic
// @jsx createElement

import { afterEach, describe, expect, it } from 'vitest'

import { createRoot, createElement, type Handle } from '@remix-run/component'

import { onOutsidePointerDown } from './outside-pointerdown.ts'

function pointerDown(target: HTMLElement) {
  target.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }))
}

function OutsideCounter(handle: Handle) {
  let outsideCount = 0

  return () => (
    <div>
      <div
        id="host"
        mix={onOutsidePointerDown(() => {
          outsideCount++
          void handle.update()
        })}
      >
        <button id="inside" type="button">
          Inside
        </button>
      </div>
      <button id="outside" type="button">
        Outside
      </button>
      <output id="count">{outsideCount}</output>
    </div>
  )
}

function createApp() {
  let container = document.createElement('div')
  document.body.append(container)
  let root = createRoot(container)
  root.render(<OutsideCounter />)
  return { container, root }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('onOutsidePointerDown', () => {
  it('calls the handler when pointerdown happens outside the host', () => {
    let { container, root } = createApp()

    let outside = container.querySelector('#outside') as HTMLElement
    pointerDown(outside)
    root.flush()

    let count = container.querySelector('#count') as HTMLOutputElement
    expect(count.textContent).toBe('1')
  })

  it('does not call the handler when pointerdown happens inside the host', () => {
    let { container, root } = createApp()

    let inside = container.querySelector('#inside') as HTMLElement
    pointerDown(inside)
    root.flush()

    let count = container.querySelector('#count') as HTMLOutputElement
    expect(count.textContent).toBe('0')
  })

  it('handles repeated outside pointerdowns across updates', () => {
    let { container, root } = createApp()

    let outside = container.querySelector('#outside') as HTMLElement
    pointerDown(outside)
    root.flush()
    pointerDown(outside)
    root.flush()

    let count = container.querySelector('#count') as HTMLOutputElement
    expect(count.textContent).toBe('2')
  })
})
