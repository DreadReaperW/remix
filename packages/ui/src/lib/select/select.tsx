// @jsxRuntime classic
// @jsx createElement
import { createElement, css, on, ref } from '@remix-run/component'
import type { Handle, Props, RemixNode } from '@remix-run/component'

import { Glyph } from '../glyph/glyph.tsx'
import { listbox } from '../listbox/listbox.ts'
import type { ListboxEvent } from '../listbox/listbox.ts'
import { popover } from '../popover/popover.ts'
import { press } from '../press/press-mixin.ts'
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

type RegisteredSelectOption = {
  readonly id: string
  get label(): string
  get node(): HTMLElement | null
  get value(): string
}

type SelectContextValue = {
  getOptionByValue(value: string): RegisteredSelectOption | null
  registerOption(option: RegisteredSelectOption): void
  unregisterOption(optionId: string): void
}

type SelectComponent = typeof SelectImpl & {
  readonly change: typeof listbox.change
}

let selectRootCss = css({
  display: 'inline-grid',
  minWidth: 0,
})
let selectedOptionAnchorSelector = '[role="option"][aria-selected="true"]'

function SelectImpl(handle: Handle<SelectContextValue>) {
  let buttonRef: HTMLButtonElement | null = null
  let currentProps: SelectProps | null = null
  let hasInitializedValue = false
  let popoverRef: HTMLElement | null = null
  let selectedValue: string | null = null
  let triggerId = `${handle.id}-trigger`
  let options = new Map<string, RegisteredSelectOption>()
  let selectContext: SelectContextValue = {
    getOptionByValue(value) {
      for (let option of options.values()) {
        if (option.value === value) {
          return option
        }
      }

      return null
    },
    registerOption(option) {
      let previousOption = options.get(option.id) ?? null
      options.set(option.id, option)
      if (selectedValue !== null && option.value === selectedValue && previousOption !== option) {
        void handle.update()
      }
    },
    unregisterOption(optionId) {
      let option = options.get(optionId) ?? null
      options.delete(optionId)
      if (selectedValue !== null && option?.value === selectedValue) {
        void handle.update()
      }
    },
  }

  function getSelectedValue() {
    if (!currentProps) {
      return null
    }

    if (!hasInitializedValue) {
      selectedValue = currentProps.defaultValue ?? null
      hasInitializedValue = true
    }

    return selectedValue
  }

  function syncPopoverMinWidth() {
    if (!buttonRef || !popoverRef) {
      return
    }

    let width = buttonRef.offsetWidth || buttonRef.getBoundingClientRect().width
    if (width <= 0) {
      return
    }

    popoverRef.style.minWidth = `${width}px`
  }

  return (props: SelectProps) => {
    let { children, defaultValue, disabled, initialLabel, mix, name, ...divProps } = props
    void defaultValue
    currentProps = props
    handle.context.set(selectContext)

    let currentSelectedValue = getSelectedValue()
    let selectedOption =
      currentSelectedValue === null ? null : selectContext.getOptionByValue(currentSelectedValue)

    let currentLabel = selectedOption?.label ?? initialLabel
    let currentValue = currentSelectedValue ?? ''

    return (
      <div {...divProps} mix={[selectRootCss, ...(mix ?? [])]}>
        {name ? <input disabled={disabled} name={name} type="hidden" value={currentValue} /> : null}

        <popover.context>
          <button
            disabled={disabled}
            id={triggerId}
            mix={[
              ref((node: HTMLButtonElement) => {
                buttonRef = node
              }),
              on(press.down, (event) => {
                if (event.pointerType === 'keyboard' || event.pointerType === 'virtual') {
                  return
                }

                syncPopoverMinWidth()
              }),
              on(press.press, (event) => {
                if (event.pointerType !== 'keyboard' && event.pointerType !== 'virtual') {
                  return
                }

                syncPopoverMinWidth()
              }),
              popover.button({
                inset: true,
                placement: 'left',
                relativeTo: selectedOptionAnchorSelector,
              }),
              ui.button.select,
            ]}
          >
            <span mix={ui.button.label}>{currentLabel}</span>
            <Glyph mix={ui.button.icon} name="chevronDown" />
          </button>

          <div
            mix={[
              popover.surface(),
              ui.popover.surface,
              ref((node) => {
                popoverRef = node
              }),
            ]}
          >
            <listbox.context
              selectedValues={currentSelectedValue === null ? [] : [currentSelectedValue]}
            >
              <div
                aria-labelledby={triggerId}
                mix={[
                  listbox.list(),
                  popover.initialFocus(),
                  ui.listbox.surface,
                  on(listbox.change, async (event, signal) => {
                    selectedValue = (event as ListboxEvent).value
                    let updateSignal = await handle.update()
                    if (signal.aborted || updateSignal.aborted) {
                      return
                    }

                    let selectedOption =
                      selectedValue === null ? null : selectContext.getOptionByValue(selectedValue)
                    let selectedNode = selectedOption?.node
                    if (selectedNode) {
                      await flashAttribute(selectedNode, 'data-flash', 60)
                      if (signal.aborted || updateSignal.aborted) {
                        return
                      }
                    }

                    popoverRef?.hidePopover()
                  }),
                ]}
              >
                {children}
              </div>
            </listbox.context>
          </div>
        </popover.context>
      </div>
    )
  }
}

export let Select: SelectComponent = Object.assign(SelectImpl, {
  change: listbox.change,
})

export function Option(handle: Handle) {
  let currentLabel = ''
  let currentValue = ''
  let node: HTMLElement | null = null
  let option: RegisteredSelectOption = {
    id: handle.id,
    get label() {
      return currentLabel
    },
    get node() {
      return node
    },
    get value() {
      return currentValue
    },
  }

  let select = getSelectContext(handle)

  return (props: OptionProps) => {
    let { children, disabled, label, mix, value, ...divProps } = props
    currentLabel = label
    currentValue = value

    return (
      <div
        {...divProps}
        mix={[
          ui.listbox.option,
          listbox.option({ disabled, value }),
          ref((nextNode: HTMLElement, signal) => {
            node = nextNode
            select.registerOption(option)
            signal.addEventListener('abort', () => {
              select.unregisterOption(option.id)
            })
          }),
          ...(mix ?? []),
        ]}
      >
        <Glyph mix={ui.listbox.glyph} name="check" />
        <span mix={ui.listbox.label}>{children ?? label}</span>
      </div>
    )
  }
}

function getSelectContext(handle: Handle) {
  let select = handle.context.get(Select)
  if (!isSelectContextValue(select)) {
    throw new Error('Option must be used inside Select')
  }

  return select
}

function isSelectContextValue(value: unknown): value is SelectContextValue {
  return (
    typeof value === 'object' &&
    value !== null &&
    'getOptionByValue' in value &&
    typeof value.getOptionByValue === 'function' &&
    'registerOption' in value &&
    typeof value.registerOption === 'function' &&
    'unregisterOption' in value &&
    typeof value.unregisterOption === 'function'
  )
}
