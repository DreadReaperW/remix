import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createRoot, on, type Handle, type RemixNode } from '@remix-run/component'

import { popover } from './popover.tsx'
import {
  MenuHighlightRequestEvent,
  menu,
  type MenuCloseReason,
  type MenuOpenStrategy,
} from './menu-mixins.tsx'

let MENU_CLOSE_DELAY = 75
let MENU_POINTER_UP_DELAY = 200

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

function press(target: HTMLElement, key: string) {
  target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key }))
}

function pointer(target: HTMLElement, type: 'pointerdown' | 'pointermove' | 'pointerup') {
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0 }))
}

async function advance(root: ReturnType<typeof createRoot>, ms: number) {
  await vi.advanceTimersByTimeAsync(ms)
  root.flush()
}

type PrototypeCloseReason = MenuCloseReason | `select:${string}` | ''

function PrototypeMenu(handle: Handle) {
  let closeReason: PrototypeCloseReason = ''
  let highlightedItemId: string | null = null
  let open = false
  let openSource = ''
  let openStrategy: MenuOpenStrategy = 'none'
  let requestSeen = false
  let selectedItemId: string | null = null

  return () => {
    let popupId = `${handle.id}-popup`
    let menuId = `${handle.id}-menu`

    return (
      <div
        mix={[
          on(menu.openRequest, async () => {
            requestSeen = true
            await handle.update()
          }),
          on(menu.open, async (event) => {
            open = true
            openSource = event.source
            openStrategy = event.strategy
            await handle.update()
          }),
          on(menu.close, async (event) => {
            closeReason = event.reason
            open = false
            highlightedItemId = null
            await handle.update()
          }),
          on(menu.highlight, async (event) => {
            highlightedItemId = event.itemId
            await handle.update()
          }),
          on(menu.select, async (event) => {
            selectedItemId = event.itemId
            await handle.update()
          }),
        ]}
      >
        <button
          aria-controls={menuId}
          id={handle.id}
          mix={menu.trigger({ controls: menuId })}
          popovertarget={popupId}
          type="button"
        >
          Open Prototype
        </button>
        <button data-outside type="button">
          Outside
        </button>
        <div id={popupId} mix={popover({ placement: 'bottom-start' })}>
          <div
            id={menuId}
            mix={[
              menu.list({
                pointerUpDelay: MENU_POINTER_UP_DELAY,
                selectionFlashDelay: MENU_CLOSE_DELAY,
              }),
              on(menu.select, async (event) => {
                selectedItemId = event.itemId
                await handle.update()
              }),
            ]}
            role="menu"
            tabIndex={-1}
          >
            <div data-label="New File" id={`${handle.id}-new`} role="menuitem" tabIndex={-1}>
              New File
            </div>
            <div data-label="Rename File" id={`${handle.id}-rename`} role="menuitem" tabIndex={-1}>
              Rename
            </div>
            <div
              aria-disabled="true"
              data-label="Archive"
              id={`${handle.id}-archive`}
              role="menuitem"
              tabIndex={-1}
            >
              Archive
            </div>
            <div data-label="Delete File" id={`${handle.id}-delete`} role="menuitem" tabIndex={-1}>
              Delete
            </div>
          </div>
        </div>
        <output
          data-close-reason={closeReason}
          data-highlighted={highlightedItemId ?? ''}
          data-open={open ? 'true' : 'false'}
          data-open-source={openSource}
          data-open-strategy={openStrategy}
          data-request-seen={requestSeen ? 'true' : 'false'}
          data-selected={selectedItemId ?? ''}
        />
      </div>
    )
  }
}

function getOutput(container: HTMLElement) {
  return container.querySelector('output') as HTMLOutputElement
}

function getPopup(container: HTMLElement) {
  return container.querySelector('[popover="manual"]') as HTMLElement
}

function getMenu(container: HTMLElement) {
  return container.querySelector('[role="menu"]') as HTMLElement
}

function getTrigger(container: HTMLElement) {
  return container.querySelector('button[popovertarget]') as HTMLButtonElement
}

function getOutside(container: HTMLElement) {
  return container.querySelector('[data-outside]') as HTMLButtonElement
}

function getItem(container: HTMLElement, suffix: 'new' | 'rename' | 'archive' | 'delete') {
  return container.querySelector(`[id$="${suffix}"]`) as HTMLElement
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('menu mixins', () => {
  it('opens from pointerdown with a none strategy', async () => {
    let { container, root } = renderApp(<PrototypeMenu />)
    let output = getOutput(container)
    let menu = getMenu(container)
    let trigger = getTrigger(container)

    pointer(trigger, 'pointerdown')
    root.flush()

    expect(output.dataset.openSource).toBe('pointer')
    expect(output.dataset.openStrategy).toBe('none')
    expect(output.dataset.highlighted).toBe('')
    expect(output.dataset.requestSeen).toBe('false')
    expect(document.activeElement).toBe(menu)
    expect(menu.dataset.menuPhase).toBe('open')
  })

  it('opens from Enter with a none strategy', async () => {
    let { container, root } = renderApp(<PrototypeMenu />)
    let output = getOutput(container)
    let trigger = getTrigger(container)

    trigger.focus()
    press(trigger, 'Enter')
    root.flush()

    expect(output.dataset.openSource).toBe('enter')
    expect(output.dataset.openStrategy).toBe('none')
    expect(output.dataset.highlighted).toBe('')
  })

  it('opens from Space with a none strategy', async () => {
    let { container, root } = renderApp(<PrototypeMenu />)
    let output = getOutput(container)
    let trigger = getTrigger(container)

    trigger.focus()
    press(trigger, ' ')
    root.flush()

    expect(output.dataset.openSource).toBe('space')
    expect(output.dataset.openStrategy).toBe('none')
    expect(output.dataset.highlighted).toBe('')
  })

  it('opens from ArrowDown and highlights the first enabled item', async () => {
    let { container, root } = renderApp(<PrototypeMenu />)
    let output = getOutput(container)
    let trigger = getTrigger(container)
    let firstItem = getItem(container, 'new')

    trigger.focus()
    press(trigger, 'ArrowDown')
    root.flush()

    expect(output.dataset.openSource).toBe('arrowDown')
    expect(output.dataset.openStrategy).toBe('first')
    expect(output.dataset.highlighted).toBe(firstItem.id)
  })

  it('opens from ArrowUp and highlights the last enabled item', async () => {
    let { container, root } = renderApp(<PrototypeMenu />)
    let output = getOutput(container)
    let trigger = getTrigger(container)
    let lastItem = getItem(container, 'delete')

    trigger.focus()
    press(trigger, 'ArrowUp')
    root.flush()

    expect(output.dataset.openSource).toBe('arrowUp')
    expect(output.dataset.openStrategy).toBe('last')
    expect(output.dataset.highlighted).toBe(lastItem.id)
  })

  it('moves highlight with typeahead while open', async () => {
    let { container, root } = renderApp(<PrototypeMenu />)
    let menu = getMenu(container)
    let output = getOutput(container)
    let trigger = getTrigger(container)
    let rename = getItem(container, 'rename')

    trigger.focus()
    press(trigger, 'Enter')
    root.flush()

    press(menu, 'r')
    root.flush()

    expect(output.dataset.highlighted).toBe(rename.id)
  })

  it('clamps keyboard navigation at the start and end', async () => {
    let { container, root } = renderApp(<PrototypeMenu />)
    let menu = getMenu(container)
    let output = getOutput(container)
    let firstItem = getItem(container, 'new')
    let lastItem = getItem(container, 'delete')
    let trigger = getTrigger(container)

    trigger.focus()
    press(trigger, 'ArrowDown')
    root.flush()

    press(menu, 'ArrowUp')
    root.flush()

    expect(output.dataset.highlighted).toBe(firstItem.id)

    press(menu, 'End')
    root.flush()

    press(menu, 'ArrowDown')
    root.flush()

    expect(output.dataset.highlighted).toBe(lastItem.id)
  })

  it('delegates pointer interactions from the popup root', async () => {
    let { container, root } = renderApp(<PrototypeMenu />)
    let popup = getPopup(container)
    let menu = getMenu(container)
    let output = getOutput(container)
    let rename = getItem(container, 'rename')
    let trigger = getTrigger(container)

    trigger.focus()
    press(trigger, 'Enter')
    root.flush()

    pointer(rename, 'pointermove')
    root.flush()

    expect(output.dataset.highlighted).toBe(rename.id)

    pointer(rename, 'pointerup')
    root.flush()

    expect(menu.dataset.menuPhase).toBe('closing')

    await advance(root, MENU_CLOSE_DELAY * 2)
    popup.dispatchEvent(new Event('transitionend'))
    root.flush()

    expect(menu.dataset.menuPhase).toBeUndefined()
    expect(isPopoverOpen(popup)).toBe(false)
  })

  it('closes on Escape and returns focus to the trigger', async () => {
    let { container, root } = renderApp(<PrototypeMenu />)
    let menu = getMenu(container)
    let output = getOutput(container)
    let popup = getPopup(container)
    let trigger = getTrigger(container)

    trigger.focus()
    press(trigger, 'Enter')
    root.flush()

    press(menu, 'Escape')
    root.flush()

    expect(output.dataset.closeReason).toBe('escape')
    expect(output.dataset.open).toBe('false')
    expect(document.activeElement).toBe(trigger)
    expect(menu.dataset.menuPhase).toBeUndefined()
    expect(isPopoverOpen(popup)).toBe(false)
  })

  it('closes on outside pointerdown and returns focus to the trigger', async () => {
    let { container, root } = renderApp(<PrototypeMenu />)
    let output = getOutput(container)
    let outside = getOutside(container)
    let trigger = getTrigger(container)

    trigger.focus()
    press(trigger, 'Enter')
    root.flush()

    pointer(outside, 'pointerdown')
    root.flush()

    expect(output.dataset.closeReason).toBe('outsidePointerdown')
    expect(output.dataset.open).toBe('false')
    expect(document.activeElement).toBe(trigger)
  })

  it('closes on focusout without restoring focus', async () => {
    let { container, root } = renderApp(<PrototypeMenu />)
    let menu = getMenu(container)
    let output = getOutput(container)
    let outside = getOutside(container)
    let trigger = getTrigger(container)

    trigger.focus()
    press(trigger, 'Enter')
    root.flush()

    outside.focus()
    menu.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: outside }))
    root.flush()

    expect(output.dataset.closeReason).toBe('focusout')
    expect(output.dataset.open).toBe('false')
    expect(document.activeElement).toBe(outside)
  })

  it('does not select from the same pointer gesture that opens the popup', async () => {
    let { container, root } = renderApp(<PrototypeMenu />)
    let popup = getPopup(container)
    let menu = getMenu(container)
    let output = getOutput(container)
    let deleteItem = getItem(container, 'delete')
    let trigger = getTrigger(container)

    pointer(trigger, 'pointerdown')
    root.flush()

    pointer(deleteItem, 'pointerup')
    root.flush()

    expect(output.dataset.selected).toBe('')
    expect(output.dataset.open).toBe('true')

    await advance(root, MENU_POINTER_UP_DELAY + 10)

    pointer(deleteItem, 'pointerup')
    root.flush()

    expect(menu.dataset.menuPhase).toBe('closing')

    await advance(root, MENU_CLOSE_DELAY * 2)
    popup.dispatchEvent(new Event('transitionend'))
    root.flush()

    expect(menu.dataset.menuPhase).toBeUndefined()
    expect(isPopoverOpen(popup)).toBe(false)
  })

  it('ignores open and highlight requests while closing', async () => {
    let { container, root } = renderApp(<PrototypeMenu />)
    let popup = getPopup(container)
    let menu = getMenu(container)
    let output = getOutput(container)
    let rename = getItem(container, 'rename')
    let deleteItem = getItem(container, 'delete')
    let trigger = getTrigger(container)

    trigger.focus()
    press(trigger, 'Enter')
    root.flush()

    pointer(rename, 'pointermove')
    root.flush()

    pointer(rename, 'pointerup')
    root.flush()

    expect(menu.dataset.menuPhase).toBe('closing')
    expect(output.dataset.selected).toBe('')
    expect(output.dataset.highlighted).toBe(rename.id)
    expect(menu.getAttribute('aria-activedescendant')).toBe(null)
    expect(rename.dataset.highlighted).toBeUndefined()

    menu.dispatchEvent(
      new MenuHighlightRequestEvent({
        item: deleteItem,
        source: 'keyboard',
      }),
    )
    pointer(deleteItem, 'pointermove')
    press(trigger, 'Enter')
    root.flush()

    expect(menu.dataset.menuPhase).toBe('closing')
    expect(output.dataset.highlighted).toBe(rename.id)
    expect(output.dataset.openSource).toBe('enter')

    await advance(root, MENU_CLOSE_DELAY * 2)
    popup.dispatchEvent(new Event('transitionend'))
    root.flush()

    expect(menu.dataset.menuPhase).toBeUndefined()
    expect(isPopoverOpen(popup)).toBe(false)
    expect(document.activeElement).toBe(trigger)
  })
})
