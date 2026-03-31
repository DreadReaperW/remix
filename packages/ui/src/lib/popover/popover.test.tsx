import { afterEach, describe, expect, it, vi } from 'vitest'

import { createRoot } from '@remix-run/component'

import { PopoverChangeEvent, popover } from './popover.ts'

function renderApp(node: JSX.Element) {
  let container = document.createElement('div')
  document.body.append(container)
  let root = createRoot(container)
  root.render(node)
  return { container, root }
}

function isPopoverOpen(element: HTMLElement) {
  return element.matches(':popover-open')
}

function mockLayout(
  element: HTMLElement,
  rect: { top: number; left: number; width: number; height: number },
) {
  Object.defineProperty(element, 'offsetWidth', {
    configurable: true,
    get: () => rect.width,
  })

  Object.defineProperty(element, 'offsetHeight', {
    configurable: true,
    get: () => rect.height,
  })

  element.getBoundingClientRect = () => new DOMRect(rect.left, rect.top, rect.width, rect.height)
}

function press(target: HTMLElement, key: 'Enter' | ' ' = 'Enter') {
  target.focus()
  target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key }))
  target.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key }))
}

function key(target: HTMLElement, key: string) {
  target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key }))
}

function pointerDown(target: HTMLElement) {
  target.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }))
}

function pointerUp(target: HTMLElement) {
  target.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, button: 0 }))
}

function click(target: HTMLElement, options: { button?: number; detail?: number } = {}) {
  target.dispatchEvent(
    new MouseEvent('click', {
      bubbles: true,
      button: options.button ?? 0,
      detail: options.detail ?? 0,
    }),
  )
}

async function finishTransition(target: HTMLElement) {
  target.dispatchEvent(new TransitionEvent('transitionend', { bubbles: true, propertyName: 'opacity' }))
  await Promise.resolve()
}

async function settle() {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve()
      })
    })
  })
  await Promise.resolve()
}

function BasicPopover() {
  return () => (
    <popover.context>
      <button id="left" mix={popover.button({ placement: 'bottom-start' })}>
        Open from left
      </button>
      <button id="right" mix={popover.button({ placement: 'bottom-end' })}>
        Open from right
      </button>
      <div mix={popover.surface()}>
        <button id="action" mix={popover.initialFocus()}>
          First action
        </button>
        <button id="secondary">Second action</button>
        <button id="dismiss" mix={popover.dismiss()}>
          Close
        </button>
      </div>
      <button id="outside">Outside</button>
    </popover.context>
  )
}

function DismissFirstPopover() {
  return () => (
    <popover.context>
      <button id="left" mix={popover.button({ placement: 'bottom-start' })}>
        Open from left
      </button>
      <div mix={popover.surface()}>
        <button id="action">First action</button>
        <button id="dismiss" mix={[popover.initialFocus(), popover.dismiss()]}>
          Close
        </button>
      </div>
    </popover.context>
  )
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('popover', () => {
  it('adds manual popover behavior and trigger aria wiring', () => {
    let showPopover = vi.spyOn(HTMLElement.prototype, 'showPopover')
    let { container, root } = renderApp(<BasicPopover />)
    root.flush()

    let leftButton = container.querySelector('#left') as HTMLButtonElement
    let rightButton = container.querySelector('#right') as HTMLButtonElement
    let surface = container.querySelector('[popover="manual"]') as HTMLDivElement

    expect(showPopover).not.toHaveBeenCalled()
    expect(surface.id).toBeTruthy()
    expect(surface.getAttribute('popover')).toBe('manual')
    expect(isPopoverOpen(surface)).toBe(false)
    expect(leftButton.getAttribute('aria-controls')).toBe(surface.id)
    expect(rightButton.getAttribute('aria-controls')).toBe(surface.id)
    expect(leftButton.getAttribute('aria-expanded')).toBe('false')
    expect(rightButton.getAttribute('aria-expanded')).toBe('false')
    expect(leftButton.getAttribute('aria-haspopup')).toBe('dialog')
    expect(rightButton.getAttribute('aria-haspopup')).toBe('dialog')
  })

  it('does not intercept trigger pointerdown while the popover is closed', () => {
    let { container, root } = renderApp(<BasicPopover />)
    root.flush()

    let leftButton = container.querySelector('#left') as HTMLButtonElement
    let surface = container.querySelector('[popover="manual"]') as HTMLDivElement

    pointerDown(leftButton)
    root.flush()

    expect(isPopoverOpen(surface)).toBe(true)
    expect(leftButton.getAttribute('aria-expanded')).toBe('true')
  })

  it('opens from click when no pointerdown fired first', () => {
    let { container, root } = renderApp(<BasicPopover />)
    root.flush()

    let leftButton = container.querySelector('#left') as HTMLButtonElement
    let surface = container.querySelector('[popover="manual"]') as HTMLDivElement

    click(leftButton)
    root.flush()

    expect(isPopoverOpen(surface)).toBe(true)
    expect(leftButton.getAttribute('aria-expanded')).toBe('true')
  })

  it('ignores the click that follows an activating pointerdown', () => {
    let { container, root } = renderApp(<BasicPopover />)
    root.flush()

    let leftButton = container.querySelector('#left') as HTMLButtonElement
    let surface = container.querySelector('[popover="manual"]') as HTMLDivElement

    pointerDown(leftButton)
    root.flush()
    click(leftButton, { detail: 1 })
    root.flush()

    expect(isPopoverOpen(surface)).toBe(true)
    expect(leftButton.getAttribute('aria-expanded')).toBe('true')
  })

  it('anchors to the opener that started the current session', async () => {
    let { container, root } = renderApp(<BasicPopover />)
    root.flush()

    let leftButton = container.querySelector('#left') as HTMLButtonElement
    let rightButton = container.querySelector('#right') as HTMLButtonElement
    let surface = container.querySelector('[popover="manual"]') as HTMLDivElement
    let action = container.querySelector('#action') as HTMLButtonElement

    mockLayout(leftButton, { top: 40, left: 100, width: 80, height: 30 })
    mockLayout(rightButton, { top: 40, left: 300, width: 80, height: 30 })
    mockLayout(surface, { top: 0, left: 0, width: 160, height: 96 })

    press(leftButton)
    root.flush()

    expect(surface.style.top).toBe('70px')
    expect(surface.style.left).toBe('100px')
    expect(leftButton.getAttribute('aria-expanded')).toBe('true')
    expect(rightButton.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(leftButton)

    await finishTransition(surface)
    expect(document.activeElement).toBe(action)

    press(rightButton)
    root.flush()

    expect(surface.style.top).toBe('70px')
    expect(surface.style.left).toBe('220px')
    expect(leftButton.getAttribute('aria-expanded')).toBe('false')
    expect(rightButton.getAttribute('aria-expanded')).toBe('true')
    expect(document.activeElement).toBe(rightButton)

    await finishTransition(surface)
    expect(document.activeElement).toBe(action)
  })

  it('moves focus to the initial target without requiring an opening transitionend', async () => {
    let { container, root } = renderApp(<BasicPopover />)
    root.flush()

    let leftButton = container.querySelector('#left') as HTMLButtonElement
    let surface = container.querySelector('[popover="manual"]') as HTMLDivElement
    let action = container.querySelector('#action') as HTMLButtonElement

    mockLayout(leftButton, { top: 40, left: 100, width: 80, height: 30 })
    mockLayout(surface, { top: 0, left: 0, width: 160, height: 96 })

    press(leftButton)
    root.flush()

    expect(isPopoverOpen(surface)).toBe(true)
    expect(document.activeElement).toBe(leftButton)

    await settle()

    expect(document.activeElement).toBe(action)
  })

  it('returns focus to the opener that closed the popover session', async () => {
    let { container, root } = renderApp(<BasicPopover />)
    root.flush()

    let leftButton = container.querySelector('#left') as HTMLButtonElement
    let rightButton = container.querySelector('#right') as HTMLButtonElement
    let surface = container.querySelector('[popover="manual"]') as HTMLDivElement
    let action = container.querySelector('#action') as HTMLButtonElement

    mockLayout(leftButton, { top: 40, left: 100, width: 80, height: 30 })
    mockLayout(rightButton, { top: 40, left: 300, width: 80, height: 30 })
    mockLayout(surface, { top: 0, left: 0, width: 160, height: 96 })

    press(leftButton)
    root.flush()
    expect(document.activeElement).toBe(leftButton)

    await finishTransition(surface)
    expect(document.activeElement).toBe(action)

    surface.hidePopover()
    root.flush()
    expect(document.activeElement).toBe(action)

    await finishTransition(surface)
    expect(document.activeElement).toBe(leftButton)

    press(rightButton)
    root.flush()
    expect(document.activeElement).toBe(rightButton)

    await finishTransition(surface)
    expect(document.activeElement).toBe(action)

    surface.hidePopover()
    root.flush()
    expect(document.activeElement).toBe(action)

    await finishTransition(surface)
    expect(document.activeElement).toBe(rightButton)
  })

  it('dismisses from a descendant control and restores focus to the opener', async () => {
    let { container, root } = renderApp(<DismissFirstPopover />)
    root.flush()

    let leftButton = container.querySelector('#left') as HTMLButtonElement
    let surface = container.querySelector('[popover="manual"]') as HTMLDivElement
    let dismiss = container.querySelector('#dismiss') as HTMLButtonElement

    mockLayout(leftButton, { top: 40, left: 100, width: 80, height: 30 })
    mockLayout(surface, { top: 0, left: 0, width: 160, height: 96 })

    press(leftButton)
    root.flush()
    await finishTransition(surface)
    expect(document.activeElement).toBe(dismiss)

    pointerDown(dismiss)
    root.flush()
    expect(isPopoverOpen(surface)).toBe(true)

    click(dismiss)
    root.flush()

    await finishTransition(surface)

    expect(isPopoverOpen(surface)).toBe(false)
    expect(document.activeElement).toBe(leftButton)
  })

  it('closes on Escape and restores focus to the opener after the transition', async () => {
    let { container, root } = renderApp(<BasicPopover />)
    root.flush()

    let leftButton = container.querySelector('#left') as HTMLButtonElement
    let surface = container.querySelector('[popover="manual"]') as HTMLDivElement
    let action = container.querySelector('#action') as HTMLButtonElement

    mockLayout(leftButton, { top: 40, left: 100, width: 80, height: 30 })
    mockLayout(surface, { top: 0, left: 0, width: 160, height: 96 })

    press(leftButton)
    root.flush()
    await finishTransition(surface)
    expect(document.activeElement).toBe(action)

    key(action, 'Escape')
    root.flush()
    expect(isPopoverOpen(surface)).toBe(false)
    expect(document.activeElement).toBe(action)

    await finishTransition(surface)
    expect(document.activeElement).toBe(leftButton)
  })

  it('closes on outside pointerdown and restores focus to the opener', async () => {
    let { container, root } = renderApp(<BasicPopover />)
    root.flush()

    let leftButton = container.querySelector('#left') as HTMLButtonElement
    let surface = container.querySelector('[popover="manual"]') as HTMLDivElement
    let action = container.querySelector('#action') as HTMLButtonElement
    let outside = container.querySelector('#outside') as HTMLButtonElement

    mockLayout(leftButton, { top: 40, left: 100, width: 80, height: 30 })
    mockLayout(surface, { top: 0, left: 0, width: 160, height: 96 })

    press(leftButton)
    root.flush()
    await finishTransition(surface)
    expect(document.activeElement).toBe(action)

    pointerDown(outside)
    root.flush()
    expect(isPopoverOpen(surface)).toBe(false)
    expect(document.activeElement).toBe(action)

    await finishTransition(surface)
    expect(document.activeElement).toBe(leftButton)
  })

  it('closes on focus leaving the surface and lets focus land on the next target', async () => {
    let { container, root } = renderApp(<BasicPopover />)
    root.flush()

    let leftButton = container.querySelector('#left') as HTMLButtonElement
    let surface = container.querySelector('[popover="manual"]') as HTMLDivElement
    let action = container.querySelector('#action') as HTMLButtonElement
    let outside = container.querySelector('#outside') as HTMLButtonElement

    mockLayout(leftButton, { top: 40, left: 100, width: 80, height: 30 })
    mockLayout(surface, { top: 0, left: 0, width: 160, height: 96 })

    press(leftButton)
    root.flush()
    await finishTransition(surface)
    expect(document.activeElement).toBe(action)

    outside.focus()
    action.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: outside }))
    root.flush()
    expect(isPopoverOpen(surface)).toBe(false)
    expect(document.activeElement).toBe(outside)

    await finishTransition(surface)
    expect(document.activeElement).toBe(outside)
  })

  it('does not close when focus moves within the surface', async () => {
    let { container, root } = renderApp(<BasicPopover />)
    root.flush()

    let leftButton = container.querySelector('#left') as HTMLButtonElement
    let surface = container.querySelector('[popover="manual"]') as HTMLDivElement
    let action = container.querySelector('#action') as HTMLButtonElement
    let secondary = container.querySelector('#secondary') as HTMLButtonElement

    mockLayout(leftButton, { top: 40, left: 100, width: 80, height: 30 })
    mockLayout(surface, { top: 0, left: 0, width: 160, height: 96 })

    press(leftButton)
    root.flush()
    await finishTransition(surface)
    expect(document.activeElement).toBe(action)

    secondary.focus()
    action.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: secondary }))
    root.flush()

    expect(isPopoverOpen(surface)).toBe(true)
    expect(document.activeElement).toBe(secondary)

    await finishTransition(surface)
    expect(document.activeElement).toBe(secondary)
  })

  it('does not close when pointerdown inside the surface produces focusout without relatedTarget', async () => {
    let { container, root } = renderApp(<BasicPopover />)
    root.flush()

    let leftButton = container.querySelector('#left') as HTMLButtonElement
    let surface = container.querySelector('[popover="manual"]') as HTMLDivElement
    let action = container.querySelector('#action') as HTMLButtonElement

    mockLayout(leftButton, { top: 40, left: 100, width: 80, height: 30 })
    mockLayout(surface, { top: 0, left: 0, width: 160, height: 96 })

    press(leftButton)
    root.flush()
    await finishTransition(surface)
    expect(document.activeElement).toBe(action)

    pointerDown(surface)
    action.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    root.flush()

    expect(isPopoverOpen(surface)).toBe(true)
    expect(leftButton.getAttribute('aria-expanded')).toBe('true')
  })

  it('treats another trigger as outside pointerdown', async () => {
    let { container, root } = renderApp(<BasicPopover />)
    root.flush()

    let leftButton = container.querySelector('#left') as HTMLButtonElement
    let rightButton = container.querySelector('#right') as HTMLButtonElement
    let surface = container.querySelector('[popover="manual"]') as HTMLDivElement
    let action = container.querySelector('#action') as HTMLButtonElement

    mockLayout(leftButton, { top: 40, left: 100, width: 80, height: 30 })
    mockLayout(rightButton, { top: 40, left: 300, width: 80, height: 30 })
    mockLayout(surface, { top: 0, left: 0, width: 160, height: 96 })

    press(leftButton)
    root.flush()
    await finishTransition(surface)
    expect(document.activeElement).toBe(action)

    pointerDown(rightButton)
    root.flush()
    expect(isPopoverOpen(surface)).toBe(false)
    expect(leftButton.getAttribute('aria-expanded')).toBe('false')
    expect(rightButton.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(action)

    await finishTransition(surface)

    expect(isPopoverOpen(surface)).toBe(false)
    expect(leftButton.getAttribute('aria-expanded')).toBe('false')
    expect(rightButton.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(leftButton)
  })

  it('dispatches bubbled change events from the surface', async () => {
    let events: Array<{ open: boolean; openerId: string | null }> = []
    let { container, root } = renderApp(<BasicPopover />)
    root.flush()

    let leftButton = container.querySelector('#left') as HTMLButtonElement
    let rightButton = container.querySelector('#right') as HTMLButtonElement
    let surface = container.querySelector('[popover="manual"]') as HTMLDivElement

    mockLayout(leftButton, { top: 40, left: 100, width: 80, height: 30 })
    mockLayout(rightButton, { top: 40, left: 300, width: 80, height: 30 })
    mockLayout(surface, { top: 0, left: 0, width: 160, height: 96 })

    container.addEventListener(popover.change, (event) => {
      if (!(event instanceof PopoverChangeEvent)) {
        return
      }

      events.push({
        open: event.open,
        openerId: event.opener?.id ?? null,
      })
    })

    press(leftButton)
    root.flush()
    await finishTransition(surface)
    surface.hidePopover()
    root.flush()
    await finishTransition(surface)
    press(rightButton)
    root.flush()
    await finishTransition(surface)

    expect(events).toEqual([
      { open: true, openerId: 'left' },
      { open: false, openerId: 'left' },
      { open: true, openerId: 'right' },
    ])
  })
})
