// @jsxRuntime classic
// @jsx createElement
import {
  createElement,
  on,
  ref,
  type Handle,
  type Props,
  type RemixNode,
} from '@remix-run/component'

import type { AnchorPlacement } from './anchor.ts'
import { filterText } from './filter-text.tsx'
import { flashAttribute } from './flash-attribute.ts'
import { Glyph } from './glyph.tsx'
import { popover } from './popover.tsx'
import { ui } from './theme.ts'
import { waitForCssTransition } from './wait-for-css-transition.ts'

type HighlightOnOpen = 'none' | 'first' | 'last'

type MenuContext = {
  highlightedAction: string | null
}

type RemixElementLike = {
  $rmx: true
  type: string | Function
  props: Record<string, unknown>
}

let MENU_POINTER_UP_DELAY = 200
let SELECTION_FLASH_DELAY = 75
let enabledMenuItemSelector = '[role="menuitem"]:not([aria-disabled="true"])'

export let menuActionEventType = 'rmx:menu-action' as const

declare global {
  interface ElementEventMap {
    [menuActionEventType]: MenuActionEvent
  }

  interface HTMLElementEventMap {
    [menuActionEventType]: MenuActionEvent
  }

  namespace JSX {
    interface IntrinsicElements {
      'rmx-menu-button': JSX.IntrinsicElements['button']
      'rmx-popup': JSX.IntrinsicElements['div']
    }
  }
}

export class MenuActionEvent extends Event {
  action: string

  constructor(action: string) {
    super(menuActionEventType, {
      bubbles: true,
    })
    this.action = action
  }
}

export interface MenuButtonProps extends Omit<Props<'button'>, 'children' | 'type'> {
  children?: RemixNode
  label: string
  placement?: AnchorPlacement
}

export interface MenuItemProps extends Props<'div'> {
  action: string
  children?: RemixNode
  disabled?: boolean
  textValue?: string
}

export interface MenuSeparatorProps extends Omit<Props<'div'>, 'children'> {}

type MenuButtonComponent = typeof MenuButtonImpl & {
  readonly action: typeof menuActionEventType
}

function isRemixElement(node: RemixNode): node is RemixElementLike {
  return !!node && typeof node === 'object' && !Array.isArray(node) && '$rmx' in node
}

function getTextValue(node: RemixNode): string | undefined {
  if (Array.isArray(node)) {
    let text = node
      .map((child) => getTextValue(child))
      .filter(Boolean)
      .join('')

    return text || undefined
  }

  if (typeof node === 'string' || typeof node === 'number' || typeof node === 'bigint') {
    return String(node)
  }

  if (!isRemixElement(node)) {
    return undefined
  }

  return getTextValue(node.props.children as RemixNode)
}

function getTargetMenuItemNode(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return null
  }

  let node = target.closest(enabledMenuItemSelector)
  if (!(node instanceof HTMLElement)) {
    return null
  }

  return node
}

function getMenuOffset(node: HTMLElement) {
  let value = getComputedStyle(node).getPropertyValue('--rmx-menu-offset').trim()
  let offset = Number.parseFloat(value)
  return Number.isFinite(offset) ? offset : 0
}

function MenuButtonImpl(handle: Handle<MenuContext>) {
  let buttonPointerDownTime: number | null = null
  let highlightedAction: string | null = null
  let menuNode: HTMLElement
  let menuPointerDownStarted = false
  let open = false
  let popupId = `${handle.id}-popup`
  let menuId = `${handle.id}-menu`
  let selectionActive = false
  let triggerNode: HTMLElement
  let popupNode: HTMLElement

  handle.queueTask(() => {
    document.addEventListener(
      'pointerdown',
      (event) => {
        if (!open || event.button !== 0) {
          return
        }

        if (!(event.target instanceof Node)) {
          return
        }

        if (triggerNode.contains(event.target) || popupNode.contains(event.target)) {
          return
        }

        event.preventDefault()

        if (selectionActive) {
          return
        }

        closePopup({ focusTrigger: true })
      },
      {
        capture: true,
        signal: handle.signal,
      },
    )
  })

  function getMenuItemNodes() {
    return Array.from(popupNode.querySelectorAll(enabledMenuItemSelector)).filter(
      (node): node is HTMLElement => node instanceof HTMLElement,
    )
  }

  function getMenuItemNodeByAction(action: string | null) {
    if (action == null) {
      return null
    }

    return getMenuItemNodes().find((node) => node.dataset.action === action) ?? null
  }

  function getHighlightedMenuItemNode() {
    return getMenuItemNodeByAction(highlightedAction)
  }

  function setHighlightedAction(action: string | null) {
    if (highlightedAction === action) {
      return
    }

    highlightedAction = action
    void handle.update()
  }

  function resolveHighlightedAction(strategy: HighlightOnOpen) {
    let items = getMenuItemNodes()

    if (strategy === 'first') {
      return items[0]?.dataset.action ?? null
    }

    if (strategy === 'last') {
      return items.at(-1)?.dataset.action ?? null
    }

    return null
  }

  function moveHighlight(direction: 'next' | 'previous' | 'first' | 'last') {
    let items = getMenuItemNodes()
    if (items.length === 0) {
      return
    }

    if (direction === 'first') {
      let item = items[0] ?? null
      setHighlightedAction(item?.dataset.action ?? null)
      item?.scrollIntoView({ block: 'nearest' })
      return
    }

    if (direction === 'last') {
      let item = items.at(-1) ?? null
      setHighlightedAction(item?.dataset.action ?? null)
      item?.scrollIntoView({ block: 'nearest' })
      return
    }

    let currentIndex = items.findIndex((item) => item.dataset.action === highlightedAction)
    if (currentIndex === -1) {
      let item = direction === 'next' ? (items[0] ?? null) : (items.at(-1) ?? null)
      setHighlightedAction(item?.dataset.action ?? null)
      item?.scrollIntoView({ block: 'nearest' })
      return
    }

    let nextIndex = currentIndex + (direction === 'next' ? 1 : -1)
    if (nextIndex < 0) {
      nextIndex = items.length - 1
    } else if (nextIndex >= items.length) {
      nextIndex = 0
    }

    let item = items[nextIndex] ?? null
    setHighlightedAction(item?.dataset.action ?? null)
    item?.scrollIntoView({ block: 'nearest' })
  }

  function moveHighlightByText(text: string) {
    let items = getMenuItemNodes()
    if (items.length === 0 || text === '') {
      return
    }

    let normalizedText = text.toLowerCase()
    let currentIndex = items.findIndex((item) => item.dataset.action === highlightedAction)

    for (let offset = 1; offset <= items.length; offset++) {
      let item = items[(currentIndex + offset + items.length) % items.length]
      if (!(item instanceof HTMLElement)) {
        continue
      }

      let label = item.dataset.label?.toLowerCase() ?? ''
      if (!label.startsWith(normalizedText)) {
        continue
      }

      setHighlightedAction(item.dataset.action ?? null)
      item.scrollIntoView({ block: 'nearest' })
      return
    }
  }

  async function openPopup(disabled: boolean, strategy: HighlightOnOpen = 'none') {
    if (disabled || open || selectionActive) {
      return
    }

    menuPointerDownStarted = false
    highlightedAction = resolveHighlightedAction(strategy)
    open = true
    await handle.update()
    popupNode.showPopover()
    menuNode.focus()

    getHighlightedMenuItemNode()?.scrollIntoView({
      block: 'nearest',
    })
  }

  function closePopup({ focusTrigger = false }: { focusTrigger?: boolean } = {}) {
    open = false
    highlightedAction = null
    menuPointerDownStarted = false
    buttonPointerDownTime = null
    popupNode.hidePopover()
    void handle.update()

    if (focusTrigger) {
      handle.queueTask(() => {
        triggerNode.focus()
      })
    }
  }

  async function activateItem(
    item: HTMLElement,
    { focusTrigger = true }: { focusTrigger?: boolean } = {},
  ) {
    let action = item.dataset.action
    if (!action || selectionActive || item.getAttribute('aria-disabled') === 'true') {
      return
    }

    selectionActive = true
    highlightedAction = null
    await handle.update()

    await flashAttribute(item, 'data-flash', SELECTION_FLASH_DELAY)
    if (handle.signal.aborted) return

    await waitForCssTransition(popupNode, handle.signal, () => {
      closePopup({ focusTrigger })
    })
    if (handle.signal.aborted) return

    selectionActive = false
    item.dispatchEvent(new MenuActionEvent(action))
  }

  async function activateHighlightedItem() {
    let item = getHighlightedMenuItemNode()
    if (!(item instanceof HTMLElement)) {
      return
    }

    await activateItem(item)
  }

  return (props: MenuButtonProps) => {
    let { children, label, mix, placement = 'bottom-start', ...buttonProps } = props

    handle.context.set({
      highlightedAction,
    })

    return (
      <rmx-menu-button
        {...buttonProps}
        aria-controls={menuId}
        aria-disabled={props.disabled === true ? true : undefined}
        aria-expanded={open}
        aria-haspopup="menu"
        id={handle.id}
        popovertarget={popupId}
        role="button"
        tabIndex={props.disabled === true ? -1 : 0}
        mix={[
          ui.button.menu,
          mix,
          ref((node: HTMLElement) => {
            triggerNode = node
          }),
          on('click', (event) => {
            event.preventDefault()
          }),
          on('pointerdown', (event) => {
            if (props.disabled === true) {
              return
            }

            if (selectionActive) {
              return
            }

            if (event.button !== 0) {
              return
            }

            event.preventDefault()
            buttonPointerDownTime = Date.now()
            event.currentTarget.focus()

            if (open) {
              closePopup()
              return
            }

            void openPopup(false, 'none')
          }),
          on('keydown', (event) => {
            if (props.disabled === true) {
              return
            }

            if (selectionActive) {
              event.preventDefault()
              return
            }

            switch (event.key) {
              case ' ':
              case 'Enter':
                event.preventDefault()
                if (!open) {
                  void openPopup(false, 'none')
                }
                break
              case 'ArrowDown':
                event.preventDefault()
                if (!open) {
                  void openPopup(false, 'first')
                }
                break
              case 'ArrowUp':
                event.preventDefault()
                if (!open) {
                  void openPopup(false, 'last')
                }
                break
              case 'Escape':
                if (!open) {
                  return
                }
                event.preventDefault()
                closePopup({ focusTrigger: true })
                break
            }
          }),
          on('focusout', (event) => {
            if (!open) {
              return
            }

            let nextTarget = event.relatedTarget
            if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
              return
            }

            closePopup()
          }),
        ]}
      >
        <span mix={ui.button.label}>{label}</span>
        <Glyph mix={ui.button.icon} name="chevronDown" />
        <rmx-popup
          id={popupId}
          mix={[
            popover({
              offset: open ? getMenuOffset(popupNode) : 0,
              placement,
            }),
            ui.menu.popup,
            ref((node: HTMLElement) => {
              popupNode = node
            }),
            on('pointerdown', (event) => {
              if (event.button !== 0) {
                return
              }

              menuPointerDownStarted = true
              event.stopPropagation()
            }),
            on('click', (event) => {
              event.preventDefault()
              event.stopPropagation()
            }),
          ]}
        >
          <div
            aria-activedescendant={highlightedAction ? (getHighlightedMenuItemNode()?.id ?? undefined) : undefined}
            aria-labelledby={handle.id}
            id={menuId}
            role="menu"
            tabIndex={-1}
            mix={[
              ui.menu.list,
              ref((node: HTMLElement) => {
                menuNode = node
              }),
              filterText((text) => {
                moveHighlightByText(text)
              }),
              on('keydown', (event) => {
                event.stopPropagation()

                if (selectionActive) {
                  event.preventDefault()
                  return
                }

                switch (event.key) {
                  case 'ArrowDown':
                    event.preventDefault()
                    moveHighlight('next')
                    break
                  case 'ArrowUp':
                    event.preventDefault()
                    moveHighlight('previous')
                    break
                  case 'Home':
                    event.preventDefault()
                    moveHighlight('first')
                    break
                  case 'End':
                    event.preventDefault()
                    moveHighlight('last')
                    break
                  case 'Enter':
                  case ' ':
                    event.preventDefault()
                    void activateHighlightedItem()
                    break
                  case 'Escape':
                    event.preventDefault()
                    closePopup({ focusTrigger: true })
                    break
                }
              }),
              on('focusout', (event) => {
                if (!open) {
                  return
                }

                let nextTarget = event.relatedTarget
                if (nextTarget instanceof Node && popupNode.contains(nextTarget)) {
                  return
                }

                closePopup()
              }),
              on('pointermove', (event) => {
                if (selectionActive) {
                  return
                }

                let item = getTargetMenuItemNode(event.target)
                if (!(item instanceof HTMLElement)) {
                  setHighlightedAction(null)
                  return
                }

                setHighlightedAction(item.dataset.action ?? null)
              }),
              on('pointerleave', () => {
                if (selectionActive) {
                  return
                }

                setHighlightedAction(null)
              }),
              on('pointerup', (event) => {
                if (selectionActive) {
                  return
                }

                if (event.button !== 0) {
                  return
                }

                let shouldActivate =
                  menuPointerDownStarted ||
                  (buttonPointerDownTime !== null &&
                    Date.now() - buttonPointerDownTime >= MENU_POINTER_UP_DELAY)
                menuPointerDownStarted = false
                buttonPointerDownTime = null

                if (!shouldActivate) {
                  return
                }

                let item = getTargetMenuItemNode(event.target)
                if (!(item instanceof HTMLElement)) {
                  return
                }

                event.preventDefault()
                event.stopPropagation()
                void activateItem(item)
              }),
            ]}
          >
            {children}
          </div>
        </rmx-popup>
      </rmx-menu-button>
    )
  }
}

export let MenuButton = Object.assign(MenuButtonImpl, {
  action: menuActionEventType,
}) as MenuButtonComponent

export function MenuItem(handle: Handle) {
  return (props: MenuItemProps) => {
    let { action, children, disabled, mix, textValue, ...domProps } = props
    let menu = handle.context.get(MenuButton)
    let resolvedTextValue = textValue ?? getTextValue(children) ?? action

    return (
      <div
        {...domProps}
        aria-disabled={disabled ? true : undefined}
        data-action={action}
        data-highlighted={menu.highlightedAction === action ? 'true' : undefined}
        data-label={resolvedTextValue}
        id={handle.id}
        mix={[ui.menu.item, mix]}
        role="menuitem"
        tabIndex={-1}
      >
        <span mix={ui.menu.itemLabel}>{children ?? action}</span>
      </div>
    )
  }
}

export function MenuSeparator(_handle: Handle) {
  return (props: MenuSeparatorProps) => {
    let { mix, ...domProps } = props

    return <div {...domProps} mix={[ui.menu.separator, mix]} role="separator" />
  }
}
