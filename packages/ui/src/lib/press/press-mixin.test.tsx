import { afterEach, describe, expect, it, vi } from 'vitest'

import { createRoot, on } from '@remix-run/component'

import { press, type PressEvent } from './press-mixin.ts'

function renderButton(node: JSX.Element) {
  let container = document.createElement('div')
  document.body.append(container)
  let root = createRoot(container)
  root.render(node)
  root.flush()

  return {
    button: container.querySelector('button') as HTMLButtonElement,
    root,
  }
}

function dispatchPointer(
  target: EventTarget,
  type: 'pointercancel' | 'pointerdown' | 'pointerleave' | 'pointerup',
  init: {
    altKey?: boolean
    button?: number
    clientX?: number
    clientY?: number
    ctrlKey?: boolean
    isPrimary?: boolean
    metaKey?: boolean
    pointerType?: string
    shiftKey?: boolean
  } = {},
) {
  let event = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent
  Object.defineProperties(event, {
    altKey: { configurable: true, value: init.altKey ?? false },
    button: { configurable: true, value: init.button ?? 0 },
    clientX: { configurable: true, value: init.clientX ?? 0 },
    clientY: { configurable: true, value: init.clientY ?? 0 },
    ctrlKey: { configurable: true, value: init.ctrlKey ?? false },
    isPrimary: { configurable: true, value: init.isPrimary ?? true },
    metaKey: { configurable: true, value: init.metaKey ?? false },
    pointerType: { configurable: true, value: init.pointerType ?? 'mouse' },
    shiftKey: { configurable: true, value: init.shiftKey ?? false },
  })
  target.dispatchEvent(event)
}

function dispatchClick(
  target: EventTarget,
  init: {
    altKey?: boolean
    button?: number
    clientX?: number
    clientY?: number
    ctrlKey?: boolean
    detail?: number
    metaKey?: boolean
    shiftKey?: boolean
  } = {},
) {
  target.dispatchEvent(
    new MouseEvent('click', {
      altKey: init.altKey ?? false,
      bubbles: true,
      button: init.button ?? 0,
      cancelable: true,
      clientX: init.clientX ?? 0,
      clientY: init.clientY ?? 0,
      ctrlKey: init.ctrlKey ?? false,
      detail: init.detail ?? 0,
      metaKey: init.metaKey ?? false,
      shiftKey: init.shiftKey ?? false,
    }),
  )
}

function dispatchKey(
  target: EventTarget,
  type: 'keydown' | 'keyup',
  key: ' ' | 'Enter' | 'Escape',
  init: {
    altKey?: boolean
    ctrlKey?: boolean
    metaKey?: boolean
    repeat?: boolean
    shiftKey?: boolean
  } = {},
) {
  let event = new KeyboardEvent(type, {
    altKey: init.altKey ?? false,
    bubbles: true,
    cancelable: true,
    ctrlKey: init.ctrlKey ?? false,
    key,
    metaKey: init.metaKey ?? false,
    repeat: init.repeat ?? false,
    shiftKey: init.shiftKey ?? false,
  })
  target.dispatchEvent(event)
  return event
}

async function settleClick() {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve()
      })
    })
  })
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('press', () => {
  it('dispatches pointer lifecycle events and host pressed attrs', () => {
    let events: Array<{ clientX: number; clientY: number; pointerType: string; type: string }> = []
    let { button, root } = renderButton(
      <button
        type="button"
        mix={[
          press(),
          on(press.start, (event) => {
            events.push({
              clientX: event.clientX,
              clientY: event.clientY,
              pointerType: event.pointerType,
              type: 'start',
            })
          }),
          on(press.up, (event) => {
            events.push({
              clientX: event.clientX,
              clientY: event.clientY,
              pointerType: event.pointerType,
              type: 'up',
            })
          }),
          on(press.end, (event) => {
            events.push({
              clientX: event.clientX,
              clientY: event.clientY,
              pointerType: event.pointerType,
              type: 'end',
            })
          }),
          on(press.press, (event) => {
            events.push({
              clientX: event.clientX,
              clientY: event.clientY,
              pointerType: event.pointerType,
              type: 'press',
            })
          }),
        ]}
      >
        Press me
      </button>,
    )

    dispatchPointer(button, 'pointerdown', { clientX: 11, clientY: 22, shiftKey: true })
    root.flush()

    expect(button.hasAttribute('data-pressed')).toBe(true)
    expect(button.getAttribute('data-press-pointer-type')).toBe('mouse')

    dispatchPointer(button, 'pointerup', { clientX: 33, clientY: 44, shiftKey: true })
    root.flush()

    expect(button.hasAttribute('data-pressed')).toBe(false)
    expect(button.hasAttribute('data-press-pointer-type')).toBe(false)
    expect(events).toEqual([
      { clientX: 11, clientY: 22, pointerType: 'mouse', type: 'start' },
      { clientX: 33, clientY: 44, pointerType: 'mouse', type: 'up' },
      { clientX: 33, clientY: 44, pointerType: 'mouse', type: 'end' },
      { clientX: 33, clientY: 44, pointerType: 'mouse', type: 'press' },
    ])
  })

  it('dispatches keyboard lifecycle events and suppresses the native follow-up click', () => {
    let events: Array<{ pointerType: string; type: string }> = []
    let { button, root } = renderButton(
      <button
        type="button"
        mix={[
          press(),
          on(press.start, (event) => {
            events.push({ pointerType: event.pointerType, type: 'start' })
          }),
          on(press.up, (event) => {
            events.push({ pointerType: event.pointerType, type: 'up' })
          }),
          on(press.end, (event) => {
            events.push({ pointerType: event.pointerType, type: 'end' })
          }),
          on(press.press, (event) => {
            events.push({ pointerType: event.pointerType, type: 'press' })
          }),
        ]}
      >
        Press me
      </button>,
    )

    dispatchKey(button, 'keydown', 'Enter')
    root.flush()

    expect(button.hasAttribute('data-pressed')).toBe(true)
    expect(button.getAttribute('data-press-pointer-type')).toBe('keyboard')

    dispatchKey(button, 'keyup', 'Enter')
    dispatchClick(button)
    root.flush()

    expect(button.hasAttribute('data-pressed')).toBe(false)
    expect(events).toEqual([
      { pointerType: 'keyboard', type: 'start' },
      { pointerType: 'keyboard', type: 'up' },
      { pointerType: 'keyboard', type: 'end' },
      { pointerType: 'keyboard', type: 'press' },
    ])
  })

  it('normalizes Enter and Space to the same keyboard path without leaking native clicks', () => {
    let enterEvents: Array<{ pointerType: string; type: string }> = []
    let spaceEvents: Array<{ pointerType: string; type: string }> = []
    let { button, root } = renderButton(
      <button
        type="button"
        mix={[
          press(),
          on(press.start, (event) => {
            let targetEvents = event.currentTarget.dataset.sequence === 'space' ? spaceEvents : enterEvents
            targetEvents.push({ pointerType: event.pointerType, type: 'start' })
          }),
          on(press.up, (event) => {
            let targetEvents = event.currentTarget.dataset.sequence === 'space' ? spaceEvents : enterEvents
            targetEvents.push({ pointerType: event.pointerType, type: 'up' })
          }),
          on(press.end, (event) => {
            let targetEvents = event.currentTarget.dataset.sequence === 'space' ? spaceEvents : enterEvents
            targetEvents.push({ pointerType: event.pointerType, type: 'end' })
          }),
          on(press.press, (event) => {
            let targetEvents = event.currentTarget.dataset.sequence === 'space' ? spaceEvents : enterEvents
            targetEvents.push({ pointerType: event.pointerType, type: 'press' })
          }),
        ]}
      >
        Press me
      </button>,
    )

    button.dataset.sequence = 'enter'
    let enterKeyDown = dispatchKey(button, 'keydown', 'Enter')
    dispatchKey(button, 'keyup', 'Enter')
    root.flush()

    button.dataset.sequence = 'space'
    let spaceKeyDown = dispatchKey(button, 'keydown', ' ')
    dispatchKey(button, 'keyup', ' ')
    root.flush()

    expect(enterKeyDown.defaultPrevented).toBe(true)
    expect(spaceKeyDown.defaultPrevented).toBe(true)
    expect(enterEvents).toEqual([
      { pointerType: 'keyboard', type: 'start' },
      { pointerType: 'keyboard', type: 'up' },
      { pointerType: 'keyboard', type: 'end' },
      { pointerType: 'keyboard', type: 'press' },
    ])
    expect(spaceEvents).toEqual([
      { pointerType: 'keyboard', type: 'start' },
      { pointerType: 'keyboard', type: 'up' },
      { pointerType: 'keyboard', type: 'end' },
      { pointerType: 'keyboard', type: 'press' },
    ])
  })

  it('treats click without a prior pointer sequence as a virtual press', () => {
    let events: PressEvent[] = []
    let { button, root } = renderButton(
      <button
        type="button"
        mix={[
          press(),
          on(press.start, (event) => {
            events.push(event)
          }),
          on(press.up, (event) => {
            events.push(event)
          }),
          on(press.end, (event) => {
            events.push(event)
          }),
          on(press.press, (event) => {
            events.push(event)
          }),
        ]}
      >
        Press me
      </button>,
    )

    dispatchClick(button, { clientX: 8, clientY: 13 })
    root.flush()

    expect(events.map((event) => event.type)).toEqual([
      press.start,
      press.up,
      press.end,
      press.press,
    ])
    expect(events.every((event) => event.pointerType === 'virtual')).toBe(true)
    expect(events[0]?.isVirtual).toBe(true)
    expect(events[3]?.clientX).toBe(8)
    expect(events[3]?.clientY).toBe(13)
  })

  it('suppresses the click that follows a completed pointer press', async () => {
    let presses = 0
    let { button, root } = renderButton(
      <button
        type="button"
        mix={[
          press(),
          on(press.press, () => {
            presses++
          }),
        ]}
      >
        Press me
      </button>,
    )

    dispatchPointer(button, 'pointerdown')
    dispatchPointer(button, 'pointerup')
    await settleClick()
    dispatchClick(button, { detail: 1 })
    root.flush()

    expect(presses).toBe(1)
  })

  it('treats duplicate press mixins as one shared handle capability', () => {
    let presses = 0
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)

    function render(pressCount: 0 | 1 | 2) {
      root.render(
        <button
          type="button"
          mix={[
            pressCount >= 1 ? press() : undefined,
            pressCount >= 2 ? press() : undefined,
            on(press.press, () => {
              presses++
            }),
          ]}
        >
          Press me
        </button>,
      )
      root.flush()
      return container.querySelector('button') as HTMLButtonElement
    }

    let button = render(2)
    dispatchClick(button)
    root.flush()
    expect(presses).toBe(1)

    button = render(1)
    dispatchClick(button)
    root.flush()
    expect(presses).toBe(2)

    button = render(0)
    dispatchClick(button)
    root.flush()
    expect(presses).toBe(2)

    button = render(1)
    dispatchClick(button)
    root.flush()
    expect(presses).toBe(3)
  })

  it('dispatches cancel and end when pointerup happens outside the host', () => {
    let events: Array<{ pointerType: string; type: string }> = []
    let { button, root } = renderButton(
      <button
        type="button"
        mix={[
          press(),
          on(press.start, (event) => {
            events.push({ pointerType: event.pointerType, type: 'start' })
          }),
          on(press.cancel, (event) => {
            events.push({ pointerType: event.pointerType, type: 'cancel' })
          }),
          on(press.end, (event) => {
            events.push({ pointerType: event.pointerType, type: 'end' })
          }),
        ]}
      >
        Press me
      </button>,
    )

    dispatchPointer(button, 'pointerdown')
    root.flush()
    expect(button.hasAttribute('data-pressed')).toBe(true)

    dispatchPointer(button.ownerDocument, 'pointerup', { clientX: 40, clientY: 50 })
    root.flush()

    expect(button.hasAttribute('data-pressed')).toBe(false)
    expect(events).toEqual([
      { pointerType: 'mouse', type: 'start' },
      { pointerType: 'mouse', type: 'cancel' },
      { pointerType: 'mouse', type: 'end' },
    ])
  })

  it('suppresses up and press after a prevented long press', () => {
    vi.useFakeTimers()

    let events: string[] = []
    let { button, root } = renderButton(
      <button
        type="button"
        mix={[
          press(),
          on(press.long, (event) => {
            events.push('long')
            event.preventDefault()
          }),
          on(press.up, () => {
            events.push('up')
          }),
          on(press.end, () => {
            events.push('end')
          }),
          on(press.press, () => {
            events.push('press')
          }),
        ]}
      >
        Press me
      </button>,
    )

    dispatchPointer(button, 'pointerdown')
    vi.advanceTimersByTime(501)
    dispatchPointer(button, 'pointerup')
    root.flush()

    expect(events).toEqual(['long', 'end'])
  })

  it('ignores press interactions for disabled hosts', () => {
    let disabledCount = 0
    let ariaDisabledCount = 0
    let disabledApp = renderButton(
      <button
        disabled
        type="button"
        mix={[
          press(),
          on(press.press, () => {
            disabledCount++
          }),
        ]}
      >
        Press me
      </button>,
    )
    let ariaDisabledApp = renderButton(
      <button
        aria-disabled="true"
        type="button"
        mix={[
          press(),
          on(press.press, () => {
            ariaDisabledCount++
          }),
        ]}
      >
        Press me
      </button>,
    )

    dispatchPointer(disabledApp.button, 'pointerdown')
    dispatchPointer(disabledApp.button, 'pointerup')
    dispatchClick(disabledApp.button)
    dispatchKey(disabledApp.button, 'keydown', 'Enter')
    dispatchKey(disabledApp.button, 'keyup', 'Enter')
    disabledApp.root.flush()

    dispatchPointer(ariaDisabledApp.button, 'pointerdown')
    dispatchPointer(ariaDisabledApp.button, 'pointerup')
    dispatchClick(ariaDisabledApp.button)
    dispatchKey(ariaDisabledApp.button, 'keydown', 'Enter')
    dispatchKey(ariaDisabledApp.button, 'keyup', 'Enter')
    ariaDisabledApp.root.flush()

    expect(disabledCount).toBe(0)
    expect(ariaDisabledCount).toBe(0)
    expect(disabledApp.button.hasAttribute('data-pressed')).toBe(false)
    expect(ariaDisabledApp.button.hasAttribute('data-pressed')).toBe(false)
  })
})
