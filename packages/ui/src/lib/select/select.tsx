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
import { ListboxController, listbox } from '../listbox/listbox.ts'
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

function getListboxController(handle: Handle) {
  let controller = handle.context.get(listbox.context)
  if (!(controller instanceof ListboxController)) {
    throw new Error('Select internals must be used inside listbox.context')
  }

  return controller
}

type SelectButtonLabelProps = {
  initialLabel: string
  selectedValue: string | null
}

function SelectButtonLabel(handle: Handle) {
  let listboxController = getListboxController(handle)
  listboxController.addEventListener('change', () => handle.update(), { signal: handle.signal })

  return (props: SelectButtonLabelProps) => (
    <span mix={ui.button.label}>
      {listboxController.getLabelForValue(props.selectedValue) ?? props.initialLabel}
    </span>
  )
}

type SelectSurfaceProps = Omit<Props<'div'>, 'children'> & {
  children?: RemixNode
  getButton(): HTMLElement | null
  onCommit(value: string | null): void
  triggerId: string
}

function SelectSurface(handle: Handle) {
  let listboxController = getListboxController(handle)
  let pendingSelectedValue: string | null = null
  let selecting = false
  let surface: HTMLElement | null = null

  function clearSelectionInFlight() {
    pendingSelectedValue = null
    selecting = false
  }

  function syncPopoverMinWidth(getButton: () => HTMLElement | null) {
    if (!surface) {
      return
    }

    let button = getButton()
    if (!button) {
      return
    }

    let width = button.offsetWidth || button.getBoundingClientRect().width
    if (width <= 0) {
      return
    }

    surface.style.minWidth = `${width}px`
  }

  return (props: SelectSurfaceProps) => {
    let { children, getButton, mix, onCommit, triggerId, ...divProps } = props

    return (
      <div
        {...divProps}
        aria-labelledby={triggerId}
        mix={[
          popover.surface(),
          listbox.list(),
          popover.initialFocus(),
          ref((node: HTMLElement, signal) => {
            surface = node
            signal.addEventListener('abort', () => {
              if (surface === node) {
                surface = null
              }
            })
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

            let nextValue = pendingSelectedValue

            try {
              await wait(50)
              if (signal.aborted) {
                return
              }

              onCommit(nextValue)
            } finally {
              clearSelectionInFlight()
            }
          }),
          on('beforetoggle', (event) => {
            if (event.newState === 'open') {
              syncPopoverMinWidth(getButton)
            }
          }),
          on(listbox.change, async (event, signal) => {
            if (selecting) {
              return
            }

            selecting = true
            pendingSelectedValue = event.value || null

            try {
              let selectedNode = listboxController.getNodeForValue(event.value)
              if (selectedNode) {
                await flashAttribute(selectedNode, 'data-flash', 60)
              }

              if (signal.aborted) {
                clearSelectionInFlight()
                return
              }

              if (surface?.matches(':popover-open')) {
                surface.hidePopover()
                return
              }

              await wait(50)
              if (signal.aborted) {
                clearSelectionInFlight()
                return
              }

              onCommit(pendingSelectedValue)
              clearSelectionInFlight()
            } catch (error) {
              clearSelectionInFlight()
              throw error
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

function SelectImpl(handle: Handle) {
  let button: HTMLElement | null = null
  let hasInitializedValue = false
  let selectedValue: string | null = null
  let triggerId = `${handle.id}-trigger`

  function commitSelectedValue(value: string | null) {
    let nextValue = value || null
    if (selectedValue === nextValue) {
      return
    }

    selectedValue = nextValue
    void handle.update()
  }

  function getButton() {
    return button
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
                ref((node: HTMLElement, signal) => {
                  button = node
                  signal.addEventListener('abort', () => {
                    if (button === node) {
                      button = null
                    }
                  })
                }),
                popover.button({
                  inset: true,
                  placement: 'left',
                  relativeTo: selectedOptionAnchorSelector,
                }),
                ui.button.select,
              ]}
            >
              <SelectButtonLabel initialLabel={initialLabel} selectedValue={selectedValue} />
              <Glyph mix={ui.button.icon} name="chevronDown" />
            </button>

            <SelectSurface
              getButton={getButton}
              mix={[ui.popover.surface, ui.listbox.surface]}
              onCommit={commitSelectedValue}
              triggerId={triggerId}
            >
              {children}
            </SelectSurface>
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
