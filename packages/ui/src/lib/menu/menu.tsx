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

const menuSelectEventType = 'rmx:select' as const

declare global {
  interface HTMLElementEventMap {
    [menuSelectEventType]: MenuSelectEvent
  }
}

export class MenuSelectEvent extends Event {
  readonly item: { name: string; value: string }
  constructor(item: InternalMenuItem) {
    super(menuSelectEventType, { bubbles: true })
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
  setActiveItem: (target: ActiveItemTarget) => Promise<void>
  setOpenChildMenu: (nextChild: MenuContext | null) => Promise<void>
  clearOpenChildMenu: (child: MenuContext) => void
  collapseSelf: () => Promise<void>
  collapseBranch: () => Promise<void>
  collapseBranchToTrigger: () => Promise<void>
  dismissTree: () => Promise<void>
  hideSelf: (options: HideOptions) => Promise<void>
  openOnTriggerFocus: () => Promise<void>
  open: (strategy: OpenStrategy, options?: OpenOptions) => Promise<void>
  select: () => Promise<void>
  activeItem: InternalMenuItem | null
  openChildMenu: MenuContext | null
  isOpen: boolean
  id: string
  label: string
  popoverId: string
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

  let isOpen = false
  let dismissingTree = false
  let selecting = false
  let suppressNextTriggerFocusOpen = false
  let cleanupAnchor = () => {}
  let self: MenuContext

  function getItems() {
    return Array.from(items.values())
  }

  function getEnabledItems() {
    return getItems().filter((item) => !item.disabled)
  }

  function isSameMenu(currentMenu: MenuContext | null | undefined, nextMenu: MenuContext | null | undefined) {
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
    if (!isOpen) {
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

    isOpen = false
    activeItem = null
    openChildMenu = null
    selecting = false
    cleanupAnchor()
    document.removeEventListener('pointerdown', outerClickHandler)
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

    suppressNextTriggerFocusOpen = true
    if (isSameItem(parent.activeItem, triggerItem)) {
      triggerItem.node.focus()
    } else {
      await parent.setActiveItem(triggerItem)
    }
    await collapseSelf()
  }

  async function dismissTree() {
    let rootMenu = getRootMenu()
    if (!isSameMenu(rootMenu, self)) {
      await rootMenu.dismissTree()
      return
    }

    if (dismissingTree) {
      return
    }

    dismissingTree = true
    try {
      trigger.node.focus()
      await Promise.all(getOpenChain().map(menu => menu.hideSelf({ animate: true })))
    } finally {
      dismissingTree = false
    }
  }

  async function openOnTriggerFocus() {
    if (suppressNextTriggerFocusOpen) {
      suppressNextTriggerFocusOpen = false
      return
    }

    await open('none', { focus: false })
  }

  async function open(strategy: OpenStrategy, options: OpenOptions = {}) {
    if (selecting) return

    if (parent) {
      await parent.setOpenChildMenu(self)
    }

    let nextItem = strategy === 'none' ? null : (resolveActiveItemTarget(strategy) ?? null)
    let shouldUpdate = !isOpen || !isSameItem(activeItem, nextItem)

    activeItem = nextItem
    if (!isOpen) {
      setPopoverCloseAnimation(true)
      popover.node.showPopover()
      cleanupAnchor = anchor(popover.node, trigger.node, {
        placement: parent ? 'right-start' : 'bottom-start',
        offset: 6,
      })
      isOpen = true
      document.addEventListener('pointerdown', outerClickHandler, { capture: true })
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
    if (selecting) return
    if (!activeItem) return
    if (activeItem.disabled) return

    let item = activeItem
    selecting = true
    await flashAttribute(item.node, 'data-flash', 100)
    item.node.dispatchEvent(new MenuSelectEvent(item))
    await dismissTree()
  }

  function outerClickHandler(event: PointerEvent) {
    if (
      event.target instanceof Node &&
      (list.node.contains(event.target) || trigger.node.contains(event.target))
    ) {
      return
    }

    event.preventDefault() // bring focus back to the trigger
    void dismissTree()
  }

  function registerItem(item: InternalMenuItem) {
    items.set(item.id, item)
  }

  async function setActiveItem(target: ActiveItemTarget) {
    if (selecting) return

    let currentItem = activeItem
    let nextItem = resolveActiveItemTarget(target)
    if (nextItem === undefined) {
      return
    }

    let nextChildMenu = getItemSubmenu(nextItem)
    let childMenuToCollapse =
      openChildMenu && !isSameMenu(openChildMenu, nextChildMenu) ? openChildMenu : null

    if (isSameItem(currentItem, nextItem)) {
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
      currentItem?.node.blur()
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
      hideSelf,
      dismissTree,
      collapseSelf,
      collapseBranch,
      collapseBranchToTrigger,
      open,
      openOnTriggerFocus,
      get activeItem() {
        return activeItem
      },
      get openChildMenu() {
        return openChildMenu
      },
      registerItem,
      setOpenChildMenu,
      clearOpenChildMenu,
      setActiveItem,
      select,
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
      id: menuId,
      label,
      popoverId,
      get isOpen() {
        return isOpen
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
            if (!isOpen) return
            setMatchingItemActive(text)
          }),
          on('keydown', (event) => {
            if (parent && event.target instanceof Node && list.node.contains(event.target)) {
              event.stopPropagation()
            }
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
  select: menuSelectEventType,
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
            on('pointerleave', () => {
              if (menu.openChildMenu) {
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
  let node: HTMLElement

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
          on('focus', () => {
            if (disabled) return
            void parent.setActiveItem(item)
            void menu.openOnTriggerFocus()
          }),
          on('pointerenter', () => {
            if (disabled) return
            void parent.setActiveItem(item)
          }),
          on(keys.arrowRight, () => {
            if (disabled) return
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
          on('pointerenter', () => {
            if (disabled) return
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
