// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createRoot, on, type Handle, type RemixNode } from '@remix-run/component'

import { MenuButton, MenuItem, MenuSeparator } from './menu.tsx'

let MENU_POINTER_UP_DELAY = 200
let SELECTION_FLASH_DELAY = 75

function ensureAdoptedStyleSheets() {
  if (document.adoptedStyleSheets) {
    return
  }

  Object.defineProperty(document, 'adoptedStyleSheets', {
    configurable: true,
    value: [],
    writable: true,
  })
}

class MockCSSStyleSheet {
  cssRules: Array<{ cssText: string }> = []

  insertRule(rule: string) {
    this.cssRules.push({ cssText: rule })
    return this.cssRules.length - 1
  }

  deleteRule(index: number) {
    this.cssRules.splice(index, 1)
  }
}

function ensureConstructableStylesheets() {
  globalThis.CSSStyleSheet = MockCSSStyleSheet as unknown as typeof CSSStyleSheet
}

function ensurePopoverMethods() {
  if (typeof HTMLElement.prototype.showPopover !== 'function') {
    HTMLElement.prototype.showPopover = function () {
      let beforetoggle = new Event('beforetoggle')
      Object.assign(beforetoggle, { newState: 'open', oldState: 'closed' })
      this.dispatchEvent(beforetoggle)
      this.dataset.popoverOpen = 'true'
      let toggle = new Event('toggle')
      Object.assign(toggle, { newState: 'open', oldState: 'closed' })
      this.dispatchEvent(toggle)
    }
  }

  if (typeof HTMLElement.prototype.hidePopover !== 'function') {
    HTMLElement.prototype.hidePopover = function () {
      let beforetoggle = new Event('beforetoggle')
      Object.assign(beforetoggle, { newState: 'closed', oldState: 'open' })
      this.dispatchEvent(beforetoggle)
      delete this.dataset.popoverOpen
      let toggle = new Event('toggle')
      Object.assign(toggle, { newState: 'closed', oldState: 'open' })
      this.dispatchEvent(toggle)
    }
  }
}

function ensureAnimations() {
  if (typeof HTMLElement.prototype.animate === 'function') {
    return
  }

  HTMLElement.prototype.animate = function () {
    return {
      playState: 'finished',
      reverse() {},
      commitStyles() {},
      cancel() {},
      finished: Promise.resolve(),
    } as unknown as Animation
  }
}

function ensureScrollIntoView() {
  if (typeof HTMLElement.prototype.scrollIntoView === 'function') {
    return
  }

  HTMLElement.prototype.scrollIntoView = function () {}
}

function renderApp(node: RemixNode) {
  let container = document.createElement('div')
  document.body.append(container)
  let root = createRoot(container)
  root.render(node)
  return { container, root }
}

function renderExampleMenu() {
  return (
    <MenuButton label="File">
      <MenuItem action="new">New File</MenuItem>
      <MenuItem textValue="Rename file" action="rename">
        Rename
      </MenuItem>
      <MenuSeparator />
      <MenuItem action="delete">Delete</MenuItem>
      <MenuItem disabled action="archive">
        Archive
      </MenuItem>
    </MenuButton>
  )
}

function ActionCaptureExample(handle: Handle) {
  let buttonAction: string | null = null
  let itemAction: string | null = null

  return () => (
    <MenuButton
      label="File"
      mix={on(MenuButton.action, (event) => {
        buttonAction = event.action
        void handle.update()
      })}
    >
      <MenuItem action="new">New File</MenuItem>
      <MenuItem
        action="rename"
        mix={on(MenuButton.action, (event) => {
          itemAction = event.action
          void handle.update()
        })}
      >
        Rename
      </MenuItem>
      <MenuItem action="delete">Delete</MenuItem>
      <output data-button-action={buttonAction ?? ''} data-item-action={itemAction ?? ''} />
    </MenuButton>
  )
}

function getPopup(container: HTMLElement) {
  return container.querySelector('[popover="manual"]') as HTMLElement
}

function getTrigger(container: HTMLElement) {
  return container.querySelector('rmx-menu-button[role="button"]') as HTMLElement
}

function getMenu(container: HTMLElement) {
  return container.querySelector('[role="menu"]') as HTMLElement
}

function getItem(container: HTMLElement, action: string) {
  return container.querySelector(`[data-action="${action}"]`) as HTMLElement
}

function press(target: HTMLElement, key: string) {
  target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key }))
}

function pointer(target: HTMLElement, type: 'pointerdown' | 'pointermove' | 'pointerup') {
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0 }))
}

async function settle(root: ReturnType<typeof createRoot>) {
  await Promise.resolve()
  root.flush()
  await Promise.resolve()
  root.flush()
}

async function advance(root: ReturnType<typeof createRoot>, ms: number) {
  await vi.advanceTimersByTimeAsync(ms)
  await settle(root)
}

async function finishClose(root: ReturnType<typeof createRoot>, popup: HTMLElement) {
  popup.dispatchEvent(new Event('transitionend'))
  await settle(root)
}

ensureAdoptedStyleSheets()
ensureConstructableStylesheets()
ensurePopoverMethods()
ensureAnimations()
ensureScrollIntoView()

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('MenuButton', () => {
  it('styles the flash state with the current data attribute', () => {
    renderApp(renderExampleMenu())

    let cssText = document.adoptedStyleSheets
      .flatMap((sheet) => Array.from(sheet.cssRules, (rule) => rule.cssText))
      .join('\n')

    expect(cssText).toContain('[data-flash="true"]')
  })

  it('renders separators with separator semantics', () => {
    let { container } = renderApp(renderExampleMenu())

    expect(container.querySelector('[role="separator"]')).toBeTruthy()
  })

  it('opens from ArrowDown, focuses the menu, and highlights the first enabled item', async () => {
    let showPopover = vi.spyOn(HTMLElement.prototype, 'showPopover')
    let { container, root } = renderApp(renderExampleMenu())
    let popup = getPopup(container)
    let trigger = getTrigger(container)

    trigger.focus()
    press(trigger, 'ArrowDown')
    root.flush()
    await settle(root)

    let menu = getMenu(container)
    let highlighted = container.querySelector('[data-highlighted="true"]') as HTMLElement

    expect(trigger.getAttribute('aria-haspopup')).toBe('menu')
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(document.activeElement).toBe(menu)
    expect(menu.getAttribute('aria-activedescendant')).toBe(highlighted.id)
    expect(highlighted.dataset.action).toBe('new')
    expect(showPopover).toHaveBeenCalledTimes(1)
    expect(popup.dataset.popoverOpen).toBe('true')
  })

  it('opens from ArrowUp with the last enabled item highlighted', async () => {
    let { container, root } = renderApp(renderExampleMenu())
    let trigger = getTrigger(container)

    trigger.focus()
    press(trigger, 'ArrowUp')
    root.flush()
    await settle(root)

    let highlighted = container.querySelector('[data-highlighted="true"]') as HTMLElement
    expect(highlighted.dataset.action).toBe('delete')
  })

  it('opens from Enter without highlighting an item', async () => {
    let { container, root } = renderApp(renderExampleMenu())
    let trigger = getTrigger(container)

    trigger.focus()
    press(trigger, 'Enter')
    root.flush()
    await settle(root)

    let menu = getMenu(container)

    expect(document.activeElement).toBe(menu)
    expect(menu.getAttribute('aria-activedescendant')).toBe(null)
    expect(container.querySelector('[data-highlighted="true"]')).toBe(null)
  })

  it('opens from Space without highlighting an item', async () => {
    let { container, root } = renderApp(renderExampleMenu())
    let trigger = getTrigger(container)

    trigger.focus()
    press(trigger, ' ')
    root.flush()
    await settle(root)

    let menu = getMenu(container)

    expect(document.activeElement).toBe(menu)
    expect(menu.getAttribute('aria-activedescendant')).toBe(null)
    expect(container.querySelector('[data-highlighted="true"]')).toBe(null)
  })

  it('opens from pointerdown without highlighting an item', async () => {
    let { container, root } = renderApp(renderExampleMenu())
    let trigger = getTrigger(container)

    pointer(trigger, 'pointerdown')
    root.flush()
    await settle(root)

    let menu = getMenu(container)

    expect(document.activeElement).toBe(menu)
    expect(menu.getAttribute('aria-activedescendant')).toBe(null)
    expect(container.querySelector('[data-highlighted="true"]')).toBe(null)
  })

  it('moves highlight with keyboard navigation and typeahead while skipping disabled items', async () => {
    let { container, root } = renderApp(renderExampleMenu())
    let trigger = getTrigger(container)

    trigger.focus()
    press(trigger, 'Enter')
    root.flush()
    await settle(root)

    let menu = getMenu(container)

    press(menu, 'ArrowDown')
    root.flush()
    await settle(root)

    let highlighted = container.querySelector('[data-highlighted="true"]') as HTMLElement
    expect(highlighted.dataset.action).toBe('new')

    press(menu, 'End')
    root.flush()
    await settle(root)

    highlighted = container.querySelector('[data-highlighted="true"]') as HTMLElement
    expect(highlighted.dataset.action).toBe('delete')

    press(menu, 'ArrowDown')
    root.flush()
    await settle(root)

    highlighted = container.querySelector('[data-highlighted="true"]') as HTMLElement
    expect(highlighted.dataset.action).toBe('new')

    press(menu, 'r')
    root.flush()
    await settle(root)

    highlighted = container.querySelector('[data-highlighted="true"]') as HTMLElement
    expect(highlighted.dataset.action).toBe('rename')
  })

  it('dispatches the action event from the activated item so it bubbles to the MenuButton', async () => {
    let { container, root } = renderApp(<ActionCaptureExample />)
    let popup = getPopup(container)
    let trigger = getTrigger(container)

    trigger.focus()
    press(trigger, 'ArrowDown')
    root.flush()
    await settle(root)

    let menu = getMenu(container)

    press(menu, 'ArrowDown')
    root.flush()
    await settle(root)

    press(menu, 'Enter')
    root.flush()
    await settle(root)

    await advance(root, SELECTION_FLASH_DELAY * 2)
    await finishClose(root, popup)

    let output = container.querySelector('output') as HTMLOutputElement

    expect(output.dataset.itemAction).toBe('rename')
    expect(output.dataset.buttonAction).toBe('rename')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('closes on Escape and returns focus to the trigger', async () => {
    let { container, root } = renderApp(renderExampleMenu())
    let popup = getPopup(container)
    let trigger = getTrigger(container)

    trigger.focus()
    press(trigger, 'ArrowDown')
    root.flush()
    await settle(root)

    let menu = getMenu(container)

    press(menu, 'Escape')
    root.flush()
    await settle(root)

    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(popup.dataset.popoverOpen).toBeUndefined()
    expect(document.activeElement).toBe(trigger)
  })

  it('closes on outside pointerdown and returns focus to the trigger', async () => {
    let { container, root } = renderApp(renderExampleMenu())
    let trigger = getTrigger(container)
    let outside = document.createElement('button')
    document.body.append(outside)

    trigger.focus()
    press(trigger, 'ArrowDown')
    root.flush()
    await settle(root)

    let event = new MouseEvent('pointerdown', {
      bubbles: true,
      button: 0,
      cancelable: true,
    })
    outside.dispatchEvent(event)
    if (!event.defaultPrevented) {
      outside.focus()
    }
    root.flush()
    await settle(root)

    expect(event.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('supports pointerdown drag and pointerup activation', async () => {
    let { container, root } = renderApp(renderExampleMenu())
    let popup = getPopup(container)
    let trigger = getTrigger(container)
    let rename = getItem(container, 'rename')

    pointer(trigger, 'pointerdown')
    root.flush()
    await settle(root)

    pointer(rename, 'pointermove')
    root.flush()
    await settle(root)

    await advance(root, MENU_POINTER_UP_DELAY + 10)

    pointer(rename, 'pointerup')
    root.flush()
    await settle(root)

    await advance(root, SELECTION_FLASH_DELAY * 2)
    await finishClose(root, popup)

    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('supports click plus click activation inside the open menu', async () => {
    let { container, root } = renderApp(renderExampleMenu())
    let popup = getPopup(container)
    let trigger = getTrigger(container)
    let deleteItem = getItem(container, 'delete')

    pointer(trigger, 'pointerdown')
    root.flush()
    await settle(root)

    pointer(deleteItem, 'pointerdown')
    pointer(deleteItem, 'pointerup')
    root.flush()
    await settle(root)

    await advance(root, SELECTION_FLASH_DELAY * 2)
    await finishClose(root, popup)

    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('does not activate from the same pointer gesture that opens the menu', async () => {
    let { container, root } = renderApp(renderExampleMenu())
    let trigger = getTrigger(container)
    let deleteItem = getItem(container, 'delete')

    pointer(trigger, 'pointerdown')
    root.flush()
    await settle(root)

    pointer(deleteItem, 'pointerup')
    root.flush()
    await settle(root)

    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(container.querySelector('[data-flash="true"]')).toBe(null)
  })
})
