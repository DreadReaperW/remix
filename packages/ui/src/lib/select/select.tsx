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
import { flashAttribute } from '../utils/flash-attribute.ts'

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
  let button: HTMLElement | null = null
  let hasInitializedValue = false
  let selectedLabel: string | null = null
  let selectedValue: string | null = null
  let pendingSelectedLabel: string | null = null
  let pendingSelectedValue: string | null = null
  let selecting = false
  let surface: HTMLElement | null = null
  let triggerId = `${handle.id}-trigger`

  function clearSelectionInFlight() {
    pendingSelectedLabel = null
    pendingSelectedValue = null
    selecting = false
  }

  function commitSelection() {
    let nextValue = pendingSelectedValue
    let nextLabel = pendingSelectedLabel

    selectedValue = nextValue
    selectedLabel = nextValue === null ? null : (nextLabel ?? null)
    void handle.update()
  }

  function syncPopoverMinWidth() {
    if (!surface || !button) {
      return
    }

    let width = button.offsetWidth || button.getBoundingClientRect().width
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
            {name ? (
              <input disabled={disabled} name={name} type="hidden" value={selectedValue ?? ''} />
            ) : null}

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
                on(popover.closerequest, (event) => {
                  if (selecting) {
                    event.preventDefault()
                  }
                }),
                on(popover.closeend, async (_event, signal) => {
                  if (!selecting) {
                    return
                  }

                  try {
                    await wait(50)
                    if (signal.aborted) {
                      return
                    }

                    commitSelection()
                  } finally {
                    clearSelectionInFlight()
                  }
                }),
                on('beforetoggle', (event) => {
                  if (event.newState === 'open') {
                    syncPopoverMinWidth()
                  }
                }),
                on(listbox.change, async (event, signal) => {
                  if (selecting) {
                    return
                  }

                  selecting = true
                  pendingSelectedLabel = event.label || null
                  pendingSelectedValue = event.value || null

                  let surfaceNode = surface ?? event.currentTarget

                  try {
                    let selectedNode = surfaceNode.ownerDocument.getElementById(event.optionId)
                    if (selectedNode instanceof HTMLElement && surfaceNode.contains(selectedNode)) {
                      await flashAttribute(selectedNode, 'data-flash', 60)
                    }

                    if (signal.aborted) {
                      clearSelectionInFlight()
                      return
                    }

                    if (surfaceNode.matches(':popover-open')) {
                      surfaceNode.hidePopover()
                      return
                    }

                    await wait(50)
                    if (signal.aborted) {
                      clearSelectionInFlight()
                      return
                    }

                    commitSelection()
                    clearSelectionInFlight()
                  } catch (error) {
                    clearSelectionInFlight()
                    throw error
                  }
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
