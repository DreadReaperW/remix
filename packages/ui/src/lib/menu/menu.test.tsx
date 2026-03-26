// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createRoot, type RemixNode } from '@remix-run/component'

import { Menu, MenuButton, MenuItem, MenuList, SubmenuTrigger } from './menu.tsx'
import type { MenuSelectEvent } from './menu.tsx'

const SUBMENU_OPEN_DELAY = 200

type RectInit = {
  height: number
  left: number
  top: number
  width: number
}

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

function createRect({ top, left, width, height }: RectInit) {
  return new DOMRect(left, top, width, height)
}

function mockLayout(element: HTMLElement, rectInit: RectInit) {
  let rect = createRect(rectInit)
  element.getBoundingClientRect = () => rect
}

function renderApp(node: RemixNode) {
  let container = document.createElement('div')
  document.body.append(container)
  let root = createRoot(container)
  root.render(node)
  return { container, root }
}

function renderNestedMenu() {
  return (
    <Menu label="File actions">
      <MenuButton>File</MenuButton>
      <MenuList>
        <Menu label="Color actions">
          <SubmenuTrigger name="colors">Colors</SubmenuTrigger>
          <MenuList>
            <MenuItem name="red" value="red">
              Red
            </MenuItem>
            <MenuItem name="green" value="green">
              Green
            </MenuItem>
          </MenuList>
        </Menu>
        <MenuItem name="rename" value="rename-file">
          Rename
        </MenuItem>
        <MenuItem name="delete" value="delete-file">
          Delete
        </MenuItem>
      </MenuList>
    </Menu>
  )
}

function getRootTrigger(container: HTMLElement) {
  return container.querySelector('button[aria-haspopup="menu"]') as HTMLElement
}

function getMenuByLabel(container: HTMLElement, label: string) {
  return container.querySelector(`[role="menu"][aria-label="${label}"]`) as HTMLElement
}

function getPopoverForMenu(menu: HTMLElement) {
  return menu.parentElement as HTMLElement
}

function getMenuItemByText(container: HTMLElement, text: string) {
  return Array.from(container.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(
    item => item.textContent?.trim() === text,
  ) as HTMLElement
}

function pointer(
  target: HTMLElement,
  type: 'pointerdown' | 'pointerleave' | 'pointermove' | 'pointerup',
  options: { x?: number; y?: number } = {},
) {
  target.dispatchEvent(
    new MouseEvent(type, {
      bubbles: true,
      button: 0,
      clientX: options.x ?? 0,
      clientY: options.y ?? 0,
    }),
  )
}

function key(target: HTMLElement, key: string) {
  target.dispatchEvent(
    new KeyboardEvent('keydown', {
      bubbles: true,
      key,
    }),
  )
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

async function openRootMenu(root: ReturnType<typeof createRoot>, container: HTMLElement) {
  let trigger = getRootTrigger(container)
  pointer(trigger, 'pointerdown')
  root.flush()
  await settle(root)
}

async function openColorSubmenu(root: ReturnType<typeof createRoot>, container: HTMLElement) {
  let colors = getMenuItemByText(container, 'Colors')
  pointer(colors, 'pointermove', { x: 92, y: 70 })
  root.flush()
  await settle(root)
  await advance(root, SUBMENU_OPEN_DELAY + 1)
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

describe('nested menu hover aim', () => {
  it('keeps the parent branch open while moving into an open submenu', async () => {
    let { container, root } = renderApp(renderNestedMenu())

    let colorsMenu = getMenuByLabel(container, 'Color actions')
    let colorsPopover = getPopoverForMenu(colorsMenu)
    mockLayout(colorsMenu, { top: 40, left: 120, width: 120, height: 100 })

    await openRootMenu(root, container)
    await openColorSubmenu(root, container)

    let rootMenu = getMenuByLabel(container, 'File actions')
    let colors = getMenuItemByText(container, 'Colors')
    let red = getMenuItemByText(container, 'Red')

    pointer(colors, 'pointerleave', { x: 92, y: 70 })
    root.flush()
    await settle(root)

    pointer(rootMenu, 'pointerleave', { x: 100, y: 70 })
    root.flush()
    await settle(root)

    pointer(red, 'pointermove', { x: 140, y: 70 })
    root.flush()
    await settle(root)

    expect(colors.dataset.highlighted).toBe('true')
    expect(red.dataset.highlighted).toBe('true')
    expect(colorsPopover.dataset.popoverOpen).toBe('true')
  })

  it('suppresses sibling retargeting while moving toward an open submenu', async () => {
    let { container, root } = renderApp(renderNestedMenu())

    let colorsMenu = getMenuByLabel(container, 'Color actions')
    let colorsPopover = getPopoverForMenu(colorsMenu)
    mockLayout(colorsMenu, { top: 40, left: 120, width: 120, height: 100 })

    await openRootMenu(root, container)
    await openColorSubmenu(root, container)

    let colors = getMenuItemByText(container, 'Colors')
    let rename = getMenuItemByText(container, 'Rename')

    pointer(colors, 'pointerleave', { x: 92, y: 70 })
    root.flush()
    await settle(root)

    pointer(rename, 'pointermove', { x: 110, y: 70 })
    root.flush()
    await settle(root)

    expect(colors.dataset.highlighted).toBe('true')
    expect(rename.dataset.highlighted).toBe('false')
    expect(colorsPopover.dataset.popoverOpen).toBe('true')
  })

  it('clears the submenu trigger after hover aim expires outside the parent list', async () => {
    let { container, root } = renderApp(renderNestedMenu())

    let rootMenu = getMenuByLabel(container, 'File actions')
    let colorsMenu = getMenuByLabel(container, 'Color actions')
    let colorsPopover = getPopoverForMenu(colorsMenu)
    mockLayout(colorsMenu, { top: 40, left: 120, width: 120, height: 100 })

    await openRootMenu(root, container)
    await openColorSubmenu(root, container)

    let colors = getMenuItemByText(container, 'Colors')

    pointer(colors, 'pointerleave', { x: 92, y: 70 })
    root.flush()
    await settle(root)

    pointer(rootMenu, 'pointerleave', { x: 92, y: 70 })
    root.flush()
    await settle(root)
    await advance(root, 121)

    expect(document.activeElement).toBe(rootMenu)
    expect(colors.dataset.highlighted).toBe('false')
    expect(colorsPopover.dataset.popoverOpen).toBeUndefined()
  })

  it('resumes normal retargeting after the pointer leaves the aim corridor', async () => {
    let { container, root } = renderApp(renderNestedMenu())

    let colorsMenu = getMenuByLabel(container, 'Color actions')
    let colorsPopover = getPopoverForMenu(colorsMenu)
    mockLayout(colorsMenu, { top: 40, left: 120, width: 120, height: 100 })

    await openRootMenu(root, container)
    await openColorSubmenu(root, container)

    let colors = getMenuItemByText(container, 'Colors')
    let rename = getMenuItemByText(container, 'Rename')

    pointer(colors, 'pointerleave', { x: 92, y: 70 })
    root.flush()
    await settle(root)

    pointer(rename, 'pointermove', { x: 60, y: 20 })
    root.flush()
    await settle(root)

    expect(colors.dataset.highlighted).toBe('false')
    expect(rename.dataset.highlighted).toBe('true')
    expect(colorsPopover.dataset.popoverOpen).toBeUndefined()
  })

  it('selects a sibling item after leaving an open submenu branch', async () => {
    let { container, root } = renderApp(renderNestedMenu())
    let selections: Array<{ name: string; value: string }> = []
    container.addEventListener(Menu.select, (event) => {
      let selection = event as MenuSelectEvent
      selections.push(selection.item)
    })

    let colorsMenu = getMenuByLabel(container, 'Color actions')
    mockLayout(colorsMenu, { top: 40, left: 120, width: 120, height: 100 })

    await openRootMenu(root, container)
    await openColorSubmenu(root, container)

    let colors = getMenuItemByText(container, 'Colors')
    let rename = getMenuItemByText(container, 'Rename')

    pointer(colors, 'pointerleave', { x: 92, y: 70 })
    root.flush()
    await settle(root)

    pointer(rename, 'pointermove', { x: 110, y: 70 })
    root.flush()
    await settle(root)

    pointer(rename, 'pointermove', { x: 60, y: 20 })
    root.flush()
    await settle(root)

    pointer(rename, 'pointermove', { x: 110, y: 70 })
    root.flush()
    await settle(root)

    pointer(rename, 'pointerdown', { x: 110, y: 70 })
    root.flush()
    await settle(root)

    pointer(rename, 'pointerup', { x: 110, y: 70 })
    root.flush()
    await settle(root)
    await advance(root, 80)

    expect(selections).toEqual([{ name: 'rename', value: 'rename-file' }])
  })

  it('refocuses an open submenu trigger when hovering back from its child menu', async () => {
    let { container, root } = renderApp(renderNestedMenu())

    let colorsMenu = getMenuByLabel(container, 'Color actions')
    mockLayout(colorsMenu, { top: 40, left: 120, width: 120, height: 100 })

    await openRootMenu(root, container)
    await openColorSubmenu(root, container)

    let colors = getMenuItemByText(container, 'Colors')
    let red = getMenuItemByText(container, 'Red')

    pointer(red, 'pointermove', { x: 140, y: 70 })
    root.flush()
    await settle(root)

    pointer(colors, 'pointermove', { x: 92, y: 70 })
    root.flush()
    await settle(root)

    expect(document.activeElement).toBe(colors)
  })

  it('keeps focus on the submenu trigger when arrow left collapses a hovered child menu', async () => {
    let { container, root } = renderApp(renderNestedMenu())

    let rootMenu = getMenuByLabel(container, 'File actions')
    let colorsMenu = getMenuByLabel(container, 'Color actions')
    let colorsPopover = getPopoverForMenu(colorsMenu)
    mockLayout(colorsMenu, { top: 40, left: 120, width: 120, height: 100 })

    await openRootMenu(root, container)
    await openColorSubmenu(root, container)

    let colors = getMenuItemByText(container, 'Colors')
    let red = getMenuItemByText(container, 'Red')

    pointer(red, 'pointermove', { x: 140, y: 70 })
    root.flush()
    await settle(root)

    let hidePopover = colorsPopover.hidePopover
    colorsPopover.hidePopover = function () {
      hidePopover.call(this)
      queueMicrotask(() => {
        pointer(rootMenu, 'pointerleave', { x: 140, y: 70 })
      })
    }

    key(red, 'ArrowLeft')
    root.flush()
    await settle(root)

    expect(document.activeElement).toBe(colors)
    expect(colors.dataset.highlighted).toBe('true')
  })

  it('keeps keyboard focus on the next item when collapsing a submenu under a stationary pointer', async () => {
    let { container, root } = renderApp(renderNestedMenu())

    let rootMenu = getMenuByLabel(container, 'File actions')
    let colorsMenu = getMenuByLabel(container, 'Color actions')
    let colorsPopover = getPopoverForMenu(colorsMenu)
    mockLayout(colorsMenu, { top: 40, left: 120, width: 120, height: 100 })

    await openRootMenu(root, container)

    key(rootMenu, 'ArrowDown')
    root.flush()
    await settle(root)
    await advance(root, SUBMENU_OPEN_DELAY + 1)

    let rename = getMenuItemByText(container, 'Rename')

    let hidePopover = colorsPopover.hidePopover
    colorsPopover.hidePopover = function () {
      hidePopover.call(this)
      queueMicrotask(() => {
        pointer(rootMenu, 'pointerleave', { x: 140, y: 70 })
      })
    }

    key(rootMenu, 'ArrowDown')
    root.flush()
    await settle(root)

    expect(document.activeElement).toBe(rename)
    expect(rename.dataset.highlighted).toBe('true')
  })
})
