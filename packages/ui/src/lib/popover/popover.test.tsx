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

async function finishTransition(target: HTMLElement) {
  target.dispatchEvent(new TransitionEvent('transitionend', { bubbles: true, propertyName: 'opacity' }))
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
        <button id="dismiss" mix={popover.dismiss()}>
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
    let { container, root } = renderApp(<BasicPopover />)
    root.flush()

    let leftButton = container.querySelector('#left') as HTMLButtonElement
    let surface = container.querySelector('[popover="manual"]') as HTMLDivElement
    let action = container.querySelector('#action') as HTMLButtonElement
    let dismiss = container.querySelector('#dismiss') as HTMLButtonElement

    mockLayout(leftButton, { top: 40, left: 100, width: 80, height: 30 })
    mockLayout(surface, { top: 0, left: 0, width: 160, height: 96 })

    press(leftButton)
    root.flush()
    await finishTransition(surface)
    expect(document.activeElement).toBe(action)

    press(dismiss)
    root.flush()
    expect(document.activeElement).toBe(dismiss)

    await finishTransition(surface)

    expect(isPopoverOpen(surface)).toBe(false)
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
