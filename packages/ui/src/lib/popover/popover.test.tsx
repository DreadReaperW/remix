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
        <button id="action" mix={popover.openFocusTarget()}>
          First action
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

  it('anchors to the opener that started the current session', () => {
    let { container, root } = renderApp(<BasicPopover />)
    root.flush()

    let leftButton = container.querySelector('#left') as HTMLButtonElement
    let rightButton = container.querySelector('#right') as HTMLButtonElement
    let surface = container.querySelector('[popover="manual"]') as HTMLDivElement
    let action = container.querySelector('#action') as HTMLButtonElement

    mockLayout(leftButton, { top: 40, left: 100, width: 80, height: 30 })
    mockLayout(rightButton, { top: 40, left: 300, width: 80, height: 30 })
    mockLayout(surface, { top: 0, left: 0, width: 160, height: 96 })

    leftButton.click()
    root.flush()

    expect(surface.style.top).toBe('70px')
    expect(surface.style.left).toBe('100px')
    expect(leftButton.getAttribute('aria-expanded')).toBe('true')
    expect(rightButton.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(action)

    rightButton.click()
    root.flush()

    expect(surface.style.top).toBe('70px')
    expect(surface.style.left).toBe('220px')
    expect(leftButton.getAttribute('aria-expanded')).toBe('false')
    expect(rightButton.getAttribute('aria-expanded')).toBe('true')
    expect(document.activeElement).toBe(action)
  })

  it('returns focus to the opener that closed the popover session', () => {
    let { container, root } = renderApp(<BasicPopover />)
    root.flush()

    let leftButton = container.querySelector('#left') as HTMLButtonElement
    let rightButton = container.querySelector('#right') as HTMLButtonElement
    let surface = container.querySelector('[popover="manual"]') as HTMLDivElement
    let action = container.querySelector('#action') as HTMLButtonElement

    mockLayout(leftButton, { top: 40, left: 100, width: 80, height: 30 })
    mockLayout(rightButton, { top: 40, left: 300, width: 80, height: 30 })
    mockLayout(surface, { top: 0, left: 0, width: 160, height: 96 })

    leftButton.click()
    root.flush()
    expect(document.activeElement).toBe(action)

    surface.hidePopover()
    root.flush()
    expect(document.activeElement).toBe(leftButton)

    rightButton.click()
    root.flush()
    expect(document.activeElement).toBe(action)

    surface.hidePopover()
    root.flush()
    expect(document.activeElement).toBe(rightButton)
  })

  it('dispatches bubbled change events from the surface', () => {
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

    leftButton.click()
    root.flush()
    surface.hidePopover()
    root.flush()
    rightButton.click()
    root.flush()

    expect(events).toEqual([
      { open: true, openerId: 'left' },
      { open: false, openerId: 'left' },
      { open: true, openerId: 'right' },
    ])
  })
})
