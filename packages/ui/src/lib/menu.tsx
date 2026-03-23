// @jsxRuntime classic
// @jsx createElement
import {
  createElement,
  on,
  type Handle,
  type Props,
  type RemixNode,
} from '@remix-run/component'

import type { AnchorPlacement } from './anchor.ts'
import { Glyph, type GlyphName } from './glyph.tsx'
import { menu as menuMixin } from './menu-mixins.tsx'
import { popover } from './popover.tsx'
import { ui } from './theme.ts'

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
  glyph?: GlyphName
  textValue?: string
}

export interface MenuSeparatorProps extends Omit<Props<'div'>, 'children'> {}

type MenuButtonComponent = typeof MenuButtonImpl & {
  readonly action: typeof menuActionEventType
}

function getMenuOffset(node: HTMLElement) {
  let value = getComputedStyle(node).getPropertyValue('--rmx-menu-offset').trim()
  let offset = Number.parseFloat(value)
  return Number.isFinite(offset) ? offset : 0
}

function MenuButtonImpl(handle: Handle) {
  let open = false
  let popupId = `${handle.id}-popup`
  let menuId = `${handle.id}-menu`

  return (props: MenuButtonProps) => {
    let { children, label, mix, placement = 'bottom-start', ...buttonProps } = props

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
          on(menuMixin.open, async () => {
            open = true
            await handle.update()
          }),
          on(menuMixin.close, async () => {
            open = false
            await handle.update()
          }),
          on(menuMixin.select, (event) => {
            let action = event.item.dataset.action
            if (!action) {
              return
            }

            event.item.dispatchEvent(new MenuActionEvent(action))
          }),
          menuMixin.trigger({ controls: menuId }),
        ]}
      >
        <span mix={ui.button.label}>{label}</span>
        <Glyph mix={ui.button.icon} name="chevronDown" />
        <rmx-popup
          id={popupId}
          mix={[
            popover({
              offset: getMenuOffset,
              placement,
            }),
            ui.menu.popup,
          ]}
        >
          <div
            aria-labelledby={handle.id}
            id={menuId}
            role="menu"
            tabIndex={-1}
            mix={[ui.menu.list, menuMixin.list()]}
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
    let { action, children, disabled, glyph, mix, textValue, ...domProps } = props

    return (
      <div
        {...domProps}
        aria-disabled={disabled ? true : undefined}
        data-action={action}
        data-label={textValue}
        id={handle.id}
        mix={[ui.menu.item, glyph ? ui.menu.itemLeading : undefined, mix]}
        role="menuitem"
        tabIndex={-1}
      >
        {glyph ? <Glyph mix={ui.menu.itemGlyph} name={glyph} /> : null}
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
