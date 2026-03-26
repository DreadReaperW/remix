import { afterEach, describe, expect, it, vi } from 'vitest'

import { createRoot, type RemixNode } from '@remix-run/component'

import { popover } from './popover.tsx'

function renderApp(node: RemixNode) {
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

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('popover', () => {
  it('defaults to manual and stays closed on insert', async () => {
    let showPopover = vi.spyOn(HTMLElement.prototype, 'showPopover')
    let { container, root } = renderApp(
      <div>
        <button popovertarget="menu" type="button">
          Owner
        </button>
        <div id="menu" mix={popover()}>
          Menu
        </div>
      </div>,
    )
    root.flush()

    let popup = container.querySelector('#menu') as HTMLDivElement

    expect(popup.id).toBeTruthy()
    expect(popup.getAttribute('popover')).toBe('manual')
    expect(showPopover).not.toHaveBeenCalled()
    expect(isPopoverOpen(popup)).toBe(false)
  })

  it('anchors to a trigger that controls its id', async () => {
    let { container, root } = renderApp(
      <div>
        <button id="owner" popovertarget="menu" type="button">
          Owner
        </button>
        <div id="menu" mix={popover()}>
          Menu
        </div>
      </div>,
    )
    root.flush()

    let owner = container.querySelector('#owner') as HTMLButtonElement
    let popup = container.querySelector('#menu') as HTMLDivElement

    mockLayout(owner, { top: 40, left: 200, width: 80, height: 28 })
    mockLayout(popup, { top: 0, left: 0, width: 160, height: 96 })
    popup.showPopover()
    root.flush()

    expect(popup.style.position).toBe('fixed')
    expect(popup.style.top).toBe('68px')
    expect(popup.style.left).toBe('160px')
  })

  it('respects anchor options', async () => {
    let { container, root } = renderApp(
      <div>
        <button id="owner" popovertarget="menu" type="button">
          Owner
        </button>
        <div id="menu" mix={popover({ offset: 8, placement: 'bottom-end' })}>
          Menu
        </div>
      </div>,
    )
    root.flush()

    let owner = container.querySelector('#owner') as HTMLButtonElement
    let popup = container.querySelector('#menu') as HTMLDivElement

    mockLayout(owner, { top: 40, left: 200, width: 80, height: 28 })
    mockLayout(popup, { top: 0, left: 0, width: 160, height: 96 })
    popup.showPopover()
    root.flush()

    expect(popup.style.top).toBe('76px')
    expect(popup.style.left).toBe('120px')
  })

  it('resolves offset from the floating element at open time', async () => {
    let { container, root } = renderApp(
      <div>
        <button id="owner" popovertarget="menu" type="button">
          Owner
        </button>
        <div
          id="menu"
          mix={popover({
            offset: node => Number.parseFloat(getComputedStyle(node).getPropertyValue('--test-offset')),
            placement: 'bottom-end',
          })}
          style={{ '--test-offset': '8px' }}
        >
          Menu
        </div>
      </div>,
    )
    root.flush()

    let owner = container.querySelector('#owner') as HTMLButtonElement
    let popup = container.querySelector('#menu') as HTMLDivElement

    mockLayout(owner, { top: 40, left: 200, width: 80, height: 28 })
    mockLayout(popup, { top: 0, left: 0, width: 160, height: 96 })
    popup.showPopover()
    root.flush()

    expect(popup.style.top).toBe('76px')
    expect(popup.style.left).toBe('120px')
  })

  it('warns when it cannot find an owner', async () => {
    let warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    let { container, root } = renderApp(
      <div id="menu" mix={popover()}>
        Menu
      </div>,
    )
    root.flush()

    let popup = container.querySelector('#menu') as HTMLDivElement
    popup.showPopover()
    root.flush()

    expect(warn).toHaveBeenCalledWith('No popover owner found for #menu')
    expect(popup.getAttribute('popover')).toBe('manual')
  })
})
