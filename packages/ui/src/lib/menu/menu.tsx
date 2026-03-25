// @jsxRuntime classic
// @jsx createElement
import {
  createElement,
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

export interface MenuProps extends Props<'div'> {
  label: string
}

type ActiveItemTarget = InternalMenuItem | null | 'first' | 'last' | 'next' | 'previous'

interface MenuContext {
  registerItem: (item: InternalMenuItem) => void
  registerTrigger: (trigger: TriggerRef) => void
  registerPopover: (popover: PopoverRef) => void
  registerList: (list: ListRef) => void
  setActiveItem: (target: ActiveItemTarget) => void
  open: (strategy: OpenStrategy) => void
  close: () => void
  select: () => void
  activeItem: InternalMenuItem | null
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

  let items: InternalMenuItem[] = []
  let activeItem: InternalMenuItem | null = null

  let isOpen = false
  let selecting = false
  let cleanupAnchor = () => {}

  function getEnabledItems() {
    return items.filter((item) => !item.disabled)
  }

  function isSameItem(
    currentItem: InternalMenuItem | null | undefined,
    nextItem: InternalMenuItem | null | undefined,
  ) {
    return currentItem?.name === nextItem?.name
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
        let activeIndex = enabledItems.findIndex((item) => item.name === currentItem.name)
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
        let activeIndex = enabledItems.findIndex((item) => item.name === currentItem.name)
        if (activeIndex === -1) {
          return enabledItems[enabledItems.length - 1]
        }

        return enabledItems[activeIndex - 1]
      }
    }
  }

  async function open(strategy: OpenStrategy) {
    if (selecting) return
    activeItem = strategy === 'none' ? null : (resolveActiveItemTarget(strategy) ?? null)

    popover.node.showPopover()
    cleanupAnchor = anchor(popover.node, trigger.node, { placement: 'bottom-start', offset: 6 })
    isOpen = true
    await handle.update()
    if (activeItem) {
      activeItem.node.focus()
    } else {
      list.node.focus()
    }
    document.addEventListener('pointerdown', outerClickHandler, { capture: true })
  }

  async function close() {
    await waitForCssTransition(popover.node, handle.signal, () => {
      popover.node.hidePopover()
    })
    isOpen = false
    activeItem = null
    selecting = false
    trigger.node.focus()
    cleanupAnchor()
    document.removeEventListener('pointerdown', outerClickHandler)
    await handle.update()
  }

  async function select() {
    if (selecting) return
    if (!activeItem) return
    if (activeItem.disabled) return
    selecting = true
    await flashAttribute(activeItem.node, 'data-flash', 100)
    activeItem.node.dispatchEvent(new MenuSelectEvent(activeItem))
    await close()
  }

  function outerClickHandler(event: PointerEvent) {
    if (event.target instanceof Node && list.node.contains(event.target)) {
      return
    }
    event.preventDefault() // bring focus back to the trigger
    close()
  }

  function registerItem(item: InternalMenuItem) {
    items.push(item)
  }

  async function setActiveItem(target: ActiveItemTarget) {
    if (selecting) return

    let currentItem = activeItem
    let nextItem = resolveActiveItemTarget(target)
    if (nextItem === undefined) {
      return
    }

    if (isSameItem(currentItem, nextItem)) {
      return
    }

    activeItem = nextItem
    await handle.update()
    if (nextItem) {
      nextItem.node.focus()
    } else {
      currentItem?.node.blur()
    }
  }

  function setMatchingItemActive(text: string) {
    let enabledItems = getEnabledItems()
    let currentIndex = enabledItems.findIndex((item) => item.name === activeItem?.name)
    let item = matchNextItemBySearchText(text, enabledItems, {
      fromIndex: currentIndex,
      getSearchValues: (item) => item.searchValue,
    })
    if (item) {
      void setActiveItem(item)
    }
  }

  return (props: MenuProps) => {
    items = []
    let { children, label, mix, ...domProps } = props
    let menuId = `${handle.id}-menu`
    let popoverId = `${handle.id}-popover`

    handle.context.set({
      open,
      close,
      activeItem,
      registerItem,
      setActiveItem,
      select,
      registerTrigger(_trigger) {
        trigger = _trigger
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
      isOpen,
      get trigger() {
        return trigger
      },
    })

    return (
      <div
        {...domProps}
        mix={[
          hiddenTypeahead((text) => {
            if (!isOpen) return
            setMatchingItemActive(text)
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
              menu.close()
            } else {
              menu.open('none')
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
            on(keys.escape, () => {
              menu.close()
            }),
            on('pointerleave', () => {
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

    let isActive = !disabled && menu.activeItem?.name === props.name

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
            menu.select()
          }),
          on('click', (event) => {
            if (event.button !== 0) return
            menu.select()
          }),
        ]}
      >
        {children}
      </div>
    )
  }
}
