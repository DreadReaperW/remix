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
import { filterText } from '../utils/filter-text.tsx'
import { Glyph } from '../glyph/glyph.tsx'
import { MenuCloseRequestEvent, menu as menuMixin } from './menu-mixins.tsx'
import { popover } from './popover.tsx'
import { ui } from '../theme/theme.ts'
let enabledOptionSelector = '[role="option"]:not([aria-disabled="true"])'

type ListboxContext = {
  disabled: boolean
  setSelectedLabel: (value: string, label: string) => void
  selectedValue: string | null
}

export let listboxChangeEventType = 'rmx:listbox-change' as const

declare global {
  interface HTMLElementEventMap {
    [listboxChangeEventType]: ListboxChangeEvent
  }

  namespace JSX {
    interface IntrinsicElements {
      'rmx-button': JSX.IntrinsicElements['button']
      'rmx-popup': JSX.IntrinsicElements['div']
    }
  }
}

export class ListboxChangeEvent extends Event {
  value: string | null

  constructor(value: string | null) {
    super(listboxChangeEventType, {
      bubbles: true,
    })
    this.value = value
  }
}

type ListboxAccessibleNameProps =
  | { 'aria-label': string; 'aria-labelledby'?: string }
  | { 'aria-label'?: string; 'aria-labelledby': string }

export type ListboxProps = Omit<
  Props<'button'>,
  'aria-label' | 'aria-labelledby' | 'defaultValue' | 'value'
> &
  ListboxAccessibleNameProps & {
    children?: RemixNode
    defaultValue?: string | null
    initialLabel: string
    name?: string
    value?: string | null
  }

export interface ListboxOptionProps extends Props<'div'> {
  disabled?: boolean
  textValue?: string
  value: string
}

type ListboxComponent = typeof ListboxComponentImpl & {
  readonly change: typeof listboxChangeEventType
}

function getTargetOptionNode(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return null
  }

  let node = target.closest(enabledOptionSelector)
  if (!(node instanceof HTMLElement)) {
    return null
  }

  return node
}

function getOptionTextValue(option: HTMLElement) {
  return option.dataset.label?.toLowerCase() ?? option.textContent?.trim().toLowerCase() ?? ''
}

function ListboxComponentImpl(handle: Handle<ListboxContext>) {
  let currentProps: ListboxProps | null = null
  let hasInitializedValue = false
  let listNode: HTMLElement
  let open = false
  let popupId = `${handle.id}-popup`
  let listId = `${handle.id}-list`
  let selectedLabel: string | null = null
  let selectedLabelValue: string | null = null
  let selectedValue: string | null = null
  let triggerNode: HTMLElement
  let uncontrolledValue: string | null = null
  let popupNode: HTMLElement

  function getOptionNodes() {
    return Array.from(popupNode.querySelectorAll(enabledOptionSelector)).filter(
      (node): node is HTMLElement => node instanceof HTMLElement,
    )
  }

  function getFirstEnabledOptionNode() {
    return getOptionNodes()[0] ?? null
  }

  function requestClose() {
    listNode.dispatchEvent(
      new MenuCloseRequestEvent({
        reason: 'trigger',
        returnFocus: true,
      }),
    )
  }

  function dispatchChange(value: string | null) {
    triggerNode.dispatchEvent(new ListboxChangeEvent(value))
  }

  function setSelectedLabel(value: string, label: string) {
    if (selectedValue !== value) {
      return
    }

    if (selectedLabelValue === value && selectedLabel === label) {
      return
    }

    selectedLabelValue = value
    selectedLabel = label
    void handle.update()
  }

  async function commitSelectedValue(value: string, label?: string) {
    let changed = selectedValue !== value
    if (!changed) {
      return
    }

    if (currentProps?.value === undefined) {
      uncontrolledValue = value
      selectedLabelValue = value
      selectedLabel = label ?? null
      await handle.update()
      dispatchChange(value)
      return
    }

    dispatchChange(value)
  }

  async function selectFilteredValue(text: string) {
    if (text === '') {
      return
    }

    let normalizedText = text.toLowerCase()
    let option = getOptionNodes().find((node) => getOptionTextValue(node).includes(normalizedText))
    if (!(option instanceof HTMLElement)) {
      return
    }

    let phase = listNode.dataset.menuPhase
    if (phase === 'closing') {
      return
    }

    if (phase === 'open') {
      requestClose()
      await commitSelectedValue(option.dataset.value!, getOptionTextValue(option))
      return
    }

    await commitSelectedValue(option.dataset.value!, getOptionTextValue(option))
  }

  return (props: ListboxProps) => {
    let {
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledby,
      children,
      defaultValue,
      initialLabel,
      mix,
      name,
      type,
      value,
      ...buttonProps
    } = props

    currentProps = props

    if (!hasInitializedValue) {
      uncontrolledValue = defaultValue ?? null
      hasInitializedValue = true
    }

    selectedValue = value !== undefined ? value : uncontrolledValue
    if (selectedLabelValue !== selectedValue) {
      selectedLabelValue = selectedValue
      selectedLabel = null
    }

    handle.context.set({
      disabled: props.disabled === true,
      setSelectedLabel,
      selectedValue,
    })

    return (
      <rmx-button
        {...buttonProps}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
        aria-controls={listId}
        aria-disabled={props.disabled === true ? true : undefined}
        aria-expanded={open}
        popovertarget={popupId}
        role="combobox"
        tabIndex={props.disabled === true ? -1 : 0}
        mix={[
          ui.listbox.button,
          mix,
          ref((node: HTMLElement) => {
            triggerNode = node
          }),
          filterText((text: string) => {
            void selectFilteredValue(text)
          }),
          on(menuMixin.open, async () => {
            open = true
            popupNode.style.minWidth = `${triggerNode.offsetWidth}px`
            await handle.update()
          }),
          on(menuMixin.close, async () => {
            open = false
            await handle.update()
          }),
          on(menuMixin.select, async (event) => {
            let value = event.item.dataset.value
            if (!value) {
              return
            }

            await commitSelectedValue(value, getOptionTextValue(event.item))
          }),
          on('click', (event) => {
            event.preventDefault()
          }),
          menuMixin.trigger({
            controls: listId,
            defaultStrategy: 'selectedOrFirst',
          }),
        ]}
      >
        <span mix={ui.listbox.value}>{selectedLabel ?? initialLabel}</span>
        <Glyph mix={ui.listbox.indicator} name="chevronDown" />
        <input
          disabled={props.disabled === true}
          name={name}
          type="hidden"
          value={selectedValue ?? ''}
        />
        <rmx-popup
          id={popupId}
          mix={[
            popover({
              inset: true,
              placement: 'top-start',
              relativeTo: selectedValue ? '[aria-selected="true"]' : '[role="option"]',
            }),
            ui.listbox.popover,
            ref((node: HTMLElement) => {
              popupNode = node
            }),
          ]}
        >
          <div
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledby}
            id={listId}
            role="listbox"
            tabIndex={-1}
            mix={[
              ui.listbox.root,
              ref((node: HTMLElement) => {
                listNode = node
              }),
              menuMixin.list({
                onTypeahead: (text) => {
                  void selectFilteredValue(text)
                },
                pointerUpDelay: 200,
                selectedItemSelector: '[aria-selected="true"]',
                selectionFlashDelay: 75,
              }),
            ]}
          >
            {children}
          </div>
        </rmx-popup>
      </rmx-button>
    )
  }
}

export let Listbox = Object.assign(ListboxComponentImpl, {
  change: listboxChangeEventType,
}) as ListboxComponent

export function ListboxOption(handle: Handle) {
  return (props: ListboxOptionProps) => {
    let { children, disabled, mix, textValue, value, ...domProps } = props
    let listbox = handle.context.get(Listbox)
    let resolvedDisabled = listbox.disabled || disabled === true

    let selected = listbox.selectedValue === value

    return (
      <div
        {...domProps}
        aria-disabled={resolvedDisabled ? true : undefined}
        aria-selected={selected ? 'true' : 'false'}
        data-label={textValue}
        data-value={value}
        id={handle.id}
        mix={[
          ui.listbox.option,
          mix,
          ref((node: HTMLElement) => {
            if (selected) {
              listbox.setSelectedLabel(value, getOptionTextValue(node))
            }
          }),
        ]}
        role="option"
        tabIndex={-1}
      >
        <Glyph mix={ui.listbox.optionIndicator} name="check" />
        <span mix={ui.listbox.optionLabel}>{children ?? value}</span>
      </div>
    )
  }
}
