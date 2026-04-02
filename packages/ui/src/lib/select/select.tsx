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

import { Glyph } from '../glyph/glyph.tsx'
import { listbox } from '../listbox/listbox.ts'
import type { ListboxEvent } from '../listbox/listbox.ts'
import { popover } from '../popover/popover.ts'
import { ui } from '../theme/theme.ts'

export type SelectProps = Omit<Props<'div'>, 'children'> & {
  children?: RemixNode
  defaultValue?: string | null
  disabled?: boolean
  initialLabel: string
  name?: string
}

export type OptionProps = Omit<Props<'div'>, 'children'> & {
  children?: RemixNode
  disabled?: boolean
  label: string
  value: string
}

export type SelectChangeEvent = ListboxEvent

type SelectComponent = typeof SelectImpl & {
  readonly change: typeof listbox.change
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

let selectedOptionAnchorSelector = '[role="option"][aria-selected="true"]'

function SelectImpl(handle: Handle) {
  let hasInitializedValue = false

  let selectedValue: string | null = null
  let selectedLabel: string | null = null

  let selectionPending = false
  let pendingSelectedLabel: string | null = null
  let pendingSelectedValue: string | null = null

  let triggerId = `${handle.id}-trigger`

  let button: HTMLElement
  let surface: HTMLElement

  function clearPendingSelection() {
    pendingSelectedLabel = null
    pendingSelectedValue = null
    selectionPending = false
  }

  function commitSelection() {
    selectedValue = pendingSelectedValue
    selectedLabel = pendingSelectedLabel
    void handle.update()
  }

  function syncPopoverMinWidth() {
    let width = button.offsetWidth
    if (width <= 0) {
      return
    }

    surface.style.minWidth = `${width}px`
  }

  return (props: SelectProps) => {
    let { children, defaultValue, disabled, initialLabel, name, ...divProps } = props

    if (!hasInitializedValue) {
      selectedValue = defaultValue ?? null
      hasInitializedValue = true
    }

    return (
      <popover.context>
        <listbox.context values={selectedValue === null ? [] : [selectedValue]}>
          <div {...divProps}>
            {name && (
              <input disabled={disabled} name={name} type="hidden" value={selectedValue ?? ''} />
            )}

            <button
              disabled={disabled}
              id={triggerId}
              mix={[
                ref((node: HTMLElement) => {
                  button = node
                }),
                popover.button({
                  inset: true,
                  placement: 'left',
                  relativeTo: selectedOptionAnchorSelector,
                }),
                ui.button.select,
              ]}
            >
              <span mix={ui.button.label}>{selectedLabel ?? initialLabel}</span>
              <Glyph mix={ui.button.icon} name="chevronDown" />
            </button>

            <div
              aria-labelledby={triggerId}
              mix={[
                popover.surface(),
                listbox.list(),
                popover.initialFocus(),
                ui.popover.surface,
                ui.listbox.surface,
                ref((node: HTMLElement) => {
                  surface = node
                }),
                on('beforetoggle', (event) => {
                  if (event.newState === 'open') {
                    syncPopoverMinWidth()
                  }
                }),
                on(listbox.change, (event) => {
                  selectionPending = true
                  pendingSelectedLabel = event.label || null
                  pendingSelectedValue = event.value || null
                  surface.hidePopover()
                }),
                on(popover.closeend, async (_event, signal) => {
                  if (!selectionPending) {
                    return
                  }

                  await wait(50)
                  if (signal.aborted) {
                    return
                  }

                  commitSelection()
                  clearPendingSelection()
                }),
              ]}
            >
              {children}
            </div>
          </div>
        </listbox.context>
      </popover.context>
    )
  }
}

export let Select: SelectComponent = Object.assign(SelectImpl, {
  change: listbox.change,
})

export function Option() {
  return (props: OptionProps) => {
    let { children, disabled, label, mix, value, ...divProps } = props

    return (
      <div {...divProps} mix={[listbox.option({ disabled, label, value }), ui.listbox.option, mix]}>
        <Glyph mix={ui.listbox.glyph} name="check" />
        <span mix={ui.listbox.label}>{children ?? label}</span>
      </div>
    )
  }
}
