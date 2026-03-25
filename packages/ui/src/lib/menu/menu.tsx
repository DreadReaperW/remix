// @jsxRuntime classic
// @jsx createElement
import {
  createElement,
  css,
  keysEvents as keys,
  on,
  ref,
  type Handle,
  type Props,
} from '@remix-run/component'
import { ui } from '../theme.ts'
import { Glyph } from '../glyph.tsx'
import { anchor } from '../anchor.ts'
import { waitForCssTransition } from '../wait-for-css-transition.ts'
import { flashAttribute } from '../flash-attribute.ts'
import { hiddenTypeahead, matchNextItemBySearchText } from '../typeahead-mixin.tsx'
import { onOutsidePointerDown } from '../on-outside-pointer-down.ts'
import { createHoverAim } from './hover-aim.ts'

let menuStyles = [ui.menu.list, ui.rounded.lg]
let menuPopoverStyles = css({
  '&[data-close-animation="none"]:not(:popover-open)': {
    transition: 'none',
    transitionBehavior: 'normal',
  },
})
let submenuTriggerStyles = css({
  gridTemplateColumns: 'minmax(0, 1fr) max-content',
})
let submenuTriggerGlyphStyles = css({
  justifySelf: 'end',
})

const MENU_SELECT_EVENT = 'rmx:select' as const
const SUBMENU_OPEN_DELAY = 200

declare global {
  interface HTMLElementEventMap {
    [MENU_SELECT_EVENT]: MenuSelectEvent
  }
}

export class MenuSelectEvent extends Event {
  readonly item: { name: string; value: string }
  constructor(item: InternalMenuItem) {
    super(MENU_SELECT_EVENT, { bubbles: true })
    this.item = { name: item.name, value: item.value ?? '' }
  }
}

type OpenStrategy = 'first' | 'last' | 'none'
type OpenOptions = {
  focus?: boolean
}
type HideOptions = {
  animate: boolean
}
type MenuState = 'closed' | 'open' | 'selecting' | 'dismissing'

export interface MenuProps extends Props<'div'> {
  label: string
}

type ActiveItemTarget = InternalMenuItem | null | 'first' | 'last' | 'next' | 'previous'

interface MenuContext {
  parent: MenuContext | null
  registerItem: (item: InternalMenuItem) => void
  registerTrigger: (trigger: TriggerRef, item?: InternalMenuItem) => void
  registerPopover: (popover: PopoverRef) => void
  registerList: (list: ListRef) => void
  consumeTriggerFocusSuppression: () => boolean
  consumePointerLeaveClearSuppression: () => boolean
  suppressNextPointerLeaveClear: () => void
  startHoverAim: (target: HTMLElement, event: PointerEvent) => boolean
  acceptsHoverAim: (event: PointerEvent) => boolean
  setActiveItem: (target: ActiveItemTarget) => Promise<void>
  setOpenChildMenu: (nextChild: MenuContext | null) => Promise<void>
  clearOpenChildMenu: (child: MenuContext) => void
  collapseSelf: () => Promise<void>
  collapseBranch: () => Promise<void>
  collapseBranchToTrigger: () => Promise<void>
  dismissTree: () => Promise<void>
  hideSelf: (options: HideOptions) => Promise<void>
  open: (strategy: OpenStrategy, options?: OpenOptions) => Promise<void>
  select: () => Promise<void>
  activeItem: InternalMenuItem | null
  openChildMenu: MenuContext | null
  isOpen: boolean
  id: string
  label: string
  popoverId: string
  get list(): ListRef
  get trigger(): TriggerRef
}

interface TriggerRef {
  node: HTMLElement
}

interface PopoverRef {
  node: HTMLElement
}

interface ListRef {
  node: HTMLElement
}

function MenuImpl(handle: Handle<MenuContext>) {
  let trigger: TriggerRef
  let popover: PopoverRef
  let list: ListRef
  let parent: MenuContext | null = null

  let items = new Map<string, InternalMenuItem>()
  let activeItem: InternalMenuItem | null = null
  let openChildMenu: MenuContext | null = null
  let triggerItem: InternalMenuItem | null = null

  let state: MenuState = 'closed'
  let suppressNextTriggerFocusOpen = false
  let suppressNextPointerLeaveClear = false
  let hoverAim = createHoverAim()
  let cleanupAnchor = () => {}
  let self: MenuContext

  function getItems() {
    return Array.from(items.values())
  }

  function getEnabledItems() {
    return getItems().filter((item) => !item.disabled)
  }

  function isSameMenu(
    currentMenu: MenuContext | null | undefined,
    nextMenu: MenuContext | null | undefined,
  ) {
    return currentMenu?.id === nextMenu?.id
  }

  function isSameItem(
    currentItem: InternalMenuItem | null | undefined,
    nextItem: InternalMenuItem | null | undefined,
  ) {
    return currentItem?.id === nextItem?.id
  }

  function getItemSubmenu(item: InternalMenuItem | null | undefined) {
    return item?.submenu ?? null
  }

  function getRootMenu() {
    let currentMenu = self
    while (currentMenu.parent) {
      currentMenu = currentMenu.parent
    }
    return currentMenu
  }

  function getOpenChain() {
    let branch = [self]
    let currentMenu = self.openChildMenu
    while (currentMenu) {
      branch.push(currentMenu)
      currentMenu = currentMenu.openChildMenu
    }
    return branch
  }

  function setPopoverCloseAnimation(animate: boolean) {
    if (animate) {
      delete popover.node.dataset.closeAnimation
    } else {
      popover.node.dataset.closeAnimation = 'none'
    }
  }

  function consumeTriggerFocusSuppression() {
    if (!suppressNextTriggerFocusOpen) {
      return false
    }

    suppressNextTriggerFocusOpen = false
    return true
  }

  function consumePointerLeaveClearSuppression() {
    if (!suppressNextPointerLeaveClear) {
      return false
    }

    suppressNextPointerLeaveClear = false
    return true
  }

  function armPointerLeaveClearSuppression() {
    suppressNextPointerLeaveClear = true
  }

  function startHoverAim(target: HTMLElement, event: PointerEvent) {
    return hoverAim.start(target, event)
  }

  function acceptsHoverAim(event: PointerEvent) {
    return hoverAim.accepts(event)
  }

  function resolveActiveItemTarget(target: ActiveItemTarget) {
    if (target === null) {
      return null
    }

    if (typeof target !== 'string') {
      return target.disabled ? undefined : target
    }

    let enabledItems = getEnabledItems()
    if (enabledItems.length === 0) {
      return undefined
    }

    switch (target) {
      case 'first':
        return enabledItems[0]
      case 'last':
        return enabledItems[enabledItems.length - 1]
      case 'next': {
        if (!activeItem) {
          return enabledItems[0]
        }

        let currentItem = activeItem
        let activeIndex = enabledItems.findIndex((item) => item.id === currentItem.id)
        if (activeIndex === -1) {
          return enabledItems[0]
        }

        return enabledItems[activeIndex + 1]
      }
      case 'previous': {
        if (!activeItem) {
          return enabledItems[enabledItems.length - 1]
        }

        let currentItem = activeItem
        let activeIndex = enabledItems.findIndex((item) => item.id === currentItem.id)
        if (activeIndex === -1) {
          return enabledItems[enabledItems.length - 1]
        }

        return enabledItems[activeIndex - 1]
      }
    }
  }

  async function setOpenChildMenu(nextChild: MenuContext | null) {
    if (isSameMenu(openChildMenu, nextChild)) {
      return
    }

    let currentChild = openChildMenu
    openChildMenu = nextChild
    if (currentChild) {
      await currentChild.collapseSelf()
    }
  }

  function clearOpenChildMenu(child: MenuContext) {
    if (!isSameMenu(openChildMenu, child)) {
      return
    }

    openChildMenu = null
  }

  async function hideSelf(options: HideOptions) {
    if (state === 'closed') {
      return
    }

    setPopoverCloseAnimation(options.animate)
    if (options.animate) {
      await waitForCssTransition(popover.node, handle.signal, () => {
        popover.node.hidePopover()
      })
    } else {
      popover.node.hidePopover()
    }

    state = 'closed'
    suppressNextTriggerFocusOpen = false
    suppressNextPointerLeaveClear = false
    activeItem = null
    openChildMenu = null
    cleanupAnchor()
    parent?.clearOpenChildMenu(self)
    await handle.update()
  }

  async function collapseBranch() {
    let childMenu = openChildMenu
    if (!childMenu) {
      return
    }

    openChildMenu = null
    await childMenu.collapseSelf()
  }

  async function collapseSelf() {
    await collapseBranch()
    await hideSelf({ animate: false })
  }

  async function collapseBranchToTrigger() {
    if (!parent || !triggerItem) {
      return
    }

    let parentMenu = parent
    let trigger = triggerItem

    async function focusTriggerItem() {
      if (isSameItem(parentMenu.activeItem, trigger)) {
        trigger.node.focus()
      } else {
        await parentMenu.setActiveItem(trigger)
      }
    }

    parentMenu.suppressNextPointerLeaveClear()
    suppressNextTriggerFocusOpen = true
    await focusTriggerItem()
    await collapseSelf()
    await Promise.resolve()
    await focusTriggerItem()
  }

  async function dismissTree() {
    let rootMenu = getRootMenu()
    if (!isSameMenu(rootMenu, self)) {
      await rootMenu.dismissTree()
      return
    }

    if (state === 'dismissing') {
      return
    }

    let previousState = state
    state = 'dismissing'
    try {
      await Promise.all(getOpenChain().map((menu) => menu.hideSelf({ animate: true })))
      trigger.node.focus()
    } finally {
      if (state === 'dismissing') {
        state = previousState === 'closed' ? 'closed' : 'open'
      }
    }
  }

  async function open(strategy: OpenStrategy, options: OpenOptions = {}) {
    if (state === 'selecting') return

    if (parent) {
      await parent.setOpenChildMenu(self)
    }

    let nextItem = strategy === 'none' ? null : (resolveActiveItemTarget(strategy) ?? null)
    let shouldUpdate = state === 'closed' || !isSameItem(activeItem, nextItem)

    activeItem = nextItem
    if (state === 'closed') {
      setPopoverCloseAnimation(true)
      popover.node.showPopover()
      cleanupAnchor = anchor(popover.node, trigger.node, {
        placement: parent ? 'right-start' : 'bottom-start',
        offset: parent ? -4 : 6,
      })
      state = 'open'
    }

    if (shouldUpdate) {
      await handle.update()
    }

    if (options.focus === false) {
      return
    }

    if (activeItem) {
      activeItem.node.focus()
    } else {
      list.node.focus()
    }
  }

  async function select() {
    if (state === 'selecting') return
    if (!activeItem) return
    if (activeItem.disabled) return

    let item = activeItem
    state = 'selecting'
    await flashAttribute(item.node, 'data-flash', 60)
    item.node.dispatchEvent(new MenuSelectEvent(item))
    await dismissTree()
  }

  function registerItem(item: InternalMenuItem) {
    items.set(item.id, item)
  }

  async function setActiveItem(target: ActiveItemTarget) {
    if (state === 'selecting') return

    let currentItem = activeItem
    let nextItem = resolveActiveItemTarget(target)
    if (nextItem === undefined) {
      return
    }

    let nextChildMenu = getItemSubmenu(nextItem)
    let childMenuToCollapse =
      openChildMenu && !isSameMenu(openChildMenu, nextChildMenu) ? openChildMenu : null

    if (isSameItem(currentItem, nextItem)) {
      if (nextItem && document.activeElement !== nextItem.node) {
        nextItem.node.focus()
      }

      if (childMenuToCollapse) {
        await childMenuToCollapse.collapseSelf()
      }
      return
    }

    activeItem = nextItem
    await handle.update()
    if (nextItem) {
      nextItem.node.focus()
    } else {
      list.node.focus()
    }

    if (childMenuToCollapse) {
      await childMenuToCollapse.collapseSelf()
    }
  }

  function setMatchingItemActive(text: string) {
    let enabledItems = getEnabledItems()
    let currentIndex = enabledItems.findIndex((item) => item.id === activeItem?.id)
    let item = matchNextItemBySearchText(text, enabledItems, {
      fromIndex: currentIndex,
      getSearchValues: (item) => item.searchValue,
    })
    if (item) {
      void setActiveItem(item)
    }
  }

  return (props: MenuProps) => {
    items = new Map()
    parent = handle.context.get(Menu) ?? null
    let { children, label, mix, ...domProps } = props
    let menuId = `${handle.id}-menu`
    let popoverId = `${handle.id}-popover`

    self = {
      get parent() {
        return parent
      },
      registerItem,
      registerTrigger(_trigger, item) {
        trigger = _trigger
        triggerItem = item ?? null
      },
      registerPopover(_popover) {
        popover = _popover
      },
      registerList(_list) {
        list = _list
      },
      consumeTriggerFocusSuppression,
      consumePointerLeaveClearSuppression,
      suppressNextPointerLeaveClear: armPointerLeaveClearSuppression,
      startHoverAim,
      acceptsHoverAim,
      setActiveItem,
      setOpenChildMenu,
      clearOpenChildMenu,
      collapseSelf,
      collapseBranch,
      collapseBranchToTrigger,
      dismissTree,
      hideSelf,
      open,
      select,
      get activeItem() {
        return activeItem
      },
      get openChildMenu() {
        return openChildMenu
      },
      get isOpen() {
        return state !== 'closed'
      },
      id: menuId,
      label,
      popoverId,
      get list() {
        return list
      },
      get trigger() {
        return trigger
      },
    }
    handle.context.set(self)

    return (
      <div
        {...domProps}
        mix={[
          hiddenTypeahead((text) => {
            if (state === 'closed') return
            setMatchingItemActive(text)
          }),
          on('keydown', (event) => {
            if (parent && event.target instanceof Node && list.node.contains(event.target)) {
              event.stopPropagation()
            }
          }),
          !parent &&
            onOutsidePointerDown((event) => {
              if (state === 'closed') return
              event.preventDefault() // bring focus back to the trigger
              void dismissTree()
            }),
          mix,
        ]}
      >
        {children}
      </div>
    )
  }
}

export const Menu = Object.assign(MenuImpl, {
  select: MENU_SELECT_EVENT,
})

export function MenuButton(handle: Handle) {
  return (props: Props<'button'>) => {
    let menu = handle.context.get(Menu)
    let { children, ...domProps } = props

    return (
      <button
        {...domProps}
        type="button"
        aria-controls={menu.id}
        aria-haspopup="menu"
        aria-expanded={menu.isOpen}
        mix={[
          ui.button.menu,
          ref((node) => {
            menu.registerTrigger({ node })
          }),
          keys(),
          on(keys.arrowDown, () => {
            menu.open('first')
          }),
          on(keys.arrowUp, () => {
            menu.open('last')
          }),
          on(keys.space, () => {
            menu.open('none')
          }),
          on(keys.enter, () => {
            menu.open('none')
          }),
          on('pointerdown', (event) => {
            if (event.button !== 0) return
            if (menu.isOpen) {
              void menu.dismissTree()
            } else {
              void menu.open('none')
            }
          }),
        ]}
      >
        <span mix={ui.button.label}>{children}</span>
        <Glyph mix={ui.button.icon} name="chevronDown" />
      </button>
    )
  }
}

type InternalMenuItem = {
  value?: string
  name: string
  id: string
  disabled: boolean
  role: 'menuitem' | 'menuitemcheckbox' | 'menuitemradio' | 'option'
  submenu?: MenuContext
  get node(): HTMLElement
  get searchValue(): string | string[]
}

export interface MenuListProps extends Props<'div'> {}

export function MenuList(handle: Handle) {
  return (props: MenuListProps) => {
    let menu = handle.context.get(Menu)
    let { children, mix, ...domProps } = props

    return (
      <div
        popover="manual"
        id={menu.popoverId}
        mix={[
          ui.popover.surface,
          menuPopoverStyles,
          ref((node) => {
            menu.registerPopover({ node })
          }),
        ]}
      >
        <div
          {...domProps}
          aria-label={menu.label}
          role="menu"
          id={menu.id}
          tabIndex={-1}
          mix={[
            ref((node) => {
              menu.registerList({ node })
            }),
            menuStyles,
            mix,
            keys(),
            on(keys.arrowDown, () => {
              void menu.setActiveItem('next')
            }),
            on(keys.arrowUp, () => {
              void menu.setActiveItem('previous')
            }),
            on(keys.home, () => {
              void menu.setActiveItem('first')
            }),
            on(keys.end, () => {
              void menu.setActiveItem('last')
            }),
            menu.parent
              ? on(keys.arrowLeft, () => {
                  void menu.collapseBranchToTrigger()
                })
              : undefined,
            on(keys.escape, () => {
              void menu.dismissTree()
            }),
            on('pointerleave', (event) => {
              if (menu.openChildMenu) {
                return
              }

              if (menu.consumePointerLeaveClearSuppression()) {
                return
              }

              let activeElement = document.activeElement
              if (
                activeElement !== event.currentTarget &&
                activeElement !== menu.activeItem?.node
              ) {
                return
              }

              void menu.setActiveItem(null)
            }),
          ]}
        >
          {children}
        </div>
      </div>
    )
  }
}

export interface SubmenuTriggerProps extends Props<'div'> {
  name?: string
  searchValue?: string | string[]
  disabled?: boolean
}

export function SubmenuTrigger(handle: Handle) {
  let openTimer = 0
  let node: HTMLElement

  function clearPendingOpen() {
    clearTimeout(openTimer)
  }

  handle.signal.addEventListener('abort', clearPendingOpen)

  return (props: SubmenuTriggerProps) => {
    let menu = handle.context.get(Menu)
    let parent = menu.parent
    if (!parent) {
      throw new Error('SubmenuTrigger must be rendered inside a nested Menu')
    }

    let disabled = props.disabled === true
    let item = {
      name: props.name ?? handle.id,
      disabled,
      role: 'menuitem',
      submenu: menu,
      get node() {
        return node
      },
      id: handle.id,
      get searchValue() {
        return props.searchValue ?? node.textContent?.trim() ?? ''
      },
    } satisfies InternalMenuItem

    parent.registerItem(item)

    let isActive = !disabled && parent.activeItem?.id === item.id
    let { children, ...domProps } = props

    return (
      <div
        role="menuitem"
        {...domProps}
        aria-controls={menu.id}
        aria-disabled={disabled ? true : undefined}
        aria-expanded={menu.isOpen}
        aria-haspopup="menu"
        tabIndex={isActive ? 0 : -1}
        data-highlighted={isActive ? 'true' : 'false'}
        id={item.id}
        mix={[
          ui.menu.item,
          submenuTriggerStyles,
          keys(),
          ref((_node) => {
            node = _node
            menu.registerTrigger({ node }, item)
          }),
          on('blur', () => {
            clearPendingOpen()
          }),
          on('focus', () => {
            if (disabled) return
            void parent.setActiveItem(item)

            if (menu.consumeTriggerFocusSuppression()) {
              return
            }

            clearPendingOpen()
            openTimer = window.setTimeout(() => {
              if (document.activeElement !== node) {
                return
              }

              void menu.open('none', { focus: false })
            }, SUBMENU_OPEN_DELAY)
          }),
          on('pointermove', (event) => {
            if (disabled) return
            if (!parent.acceptsHoverAim(event)) {
              return
            }

            void parent.setActiveItem(item)
          }),
          on('pointerleave', (event) => {
            if (!menu.isOpen) {
              return
            }

            parent.startHoverAim(menu.list.node, event)
          }),
          on(keys.arrowRight, () => {
            if (disabled) return
            clearPendingOpen()
            void menu.open('first')
          }),
        ]}
      >
        <span mix={ui.menu.itemLabel}>{children}</span>
        <Glyph mix={[ui.menu.itemGlyph, submenuTriggerGlyphStyles]} name="chevronRight" />
      </div>
    )
  }
}

export interface MenuItemProps extends Props<'div'> {
  searchValue?: string | string[]
  name: string
  value?: string
  disabled?: boolean
  role?: 'menuitem' | 'menuitemcheckbox' | 'menuitemradio' | 'option'
}

export function MenuItem(handle: Handle) {
  let node: HTMLElement

  return (props: MenuItemProps) => {
    let menu = handle.context.get(Menu)

    let disabled = props.disabled === true
    let role = props.role ?? 'menuitem'

    let item = {
      value: props.value,
      name: props.name,
      disabled,
      role,
      get node() {
        return node
      },
      id: handle.id,
      get searchValue() {
        return props.searchValue ?? node.textContent?.trim() ?? ''
      },
    }

    menu.registerItem(item)

    let isActive = !disabled && menu.activeItem?.id === item.id

    let { children, ...domProps } = props
    return (
      <div
        role={role}
        {...domProps}
        aria-disabled={disabled ? true : undefined}
        tabIndex={isActive ? 0 : -1}
        data-highlighted={isActive ? 'true' : 'false'}
        id={item.id}
        mix={[
          ui.menu.item,
          keys(),
          ref((_node) => {
            node = _node
          }),
          on('pointermove', (event) => {
            if (disabled) return
            if (!menu.acceptsHoverAim(event)) {
              return
            }

            void menu.setActiveItem(item)
          }),
          on(keys.enter, menu.select),
          on(keys.space, menu.select),
          on('pointerup', (event) => {
            if (event.button !== 0) return
            void menu.select()
          }),
          on('click', (event) => {
            if (event.button !== 0) return
            void menu.select()
          }),
        ]}
      >
        {children}
      </div>
    )
  }
}
