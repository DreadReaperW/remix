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
import { filterText } from './filter-text.tsx'
import { flashAttribute } from './flash-attribute.ts'
import { Glyph } from './glyph.tsx'
import { popover } from './popover.tsx'
import { ui } from './theme.ts'
import { waitForCssTransition } from './wait-for-css-transition.ts'

type HighlightOnOpen = 'selectedOrFirst' | 'first' | 'last'

let MENU_POINTER_UP_DELAY = 200
let SELECTION_FLASH_DELAY = 75
let enabledOptionSelector = '[role="option"]:not([aria-disabled="true"])'

type ListboxContext = {
  disabled: boolean
  highlightedValue: string | null
  selectedValue: string | null
}

export let listboxChangeEventType = 'rmx:listbox-change' as const

declare global {
  interface HTMLElementEventMap {
    [listboxChangeEventType]: ListboxChangeEvent
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

type RemixElementLike = {
  $rmx: true
  type: string | Function
  props: Record<string, unknown>
}

type ListboxOptionData = {
  disabled: boolean
  textValue: string
  value: string
}

export interface ListboxProps extends Omit<Props<'button'>, 'defaultValue' | 'value'> {
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

  return undefined
}

function getListboxOptions(node: RemixNode): ListboxOptionData[] {
  if (Array.isArray(node)) {
    return node.flatMap((child) => getListboxOptions(child))
  }

  if (!isRemixElement(node) || node.type !== ListboxOption) {
    return []
  }

  let props = node.props as ListboxOptionProps

  return [
    {
      disabled: props.disabled === true,
      textValue: props.textValue ?? getTextValue(props.children) ?? props.value,
      value: props.value,
    },
  ]
}

function getOptionDataByValue(options: ListboxOptionData[], value: string | null) {
  if (value == null) {
    return null
  }

  return options.find((option) => !option.disabled && option.value === value) ?? null
}

function resolveSelectedValue(options: ListboxOptionData[], value: string | null | undefined) {
  return getOptionDataByValue(options, value ?? null)?.value ?? null
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

function ListboxComponentImpl(handle: Handle<ListboxContext>) {
  let highlightedValue: string | null = null
  let buttonPointerDownTime: number | null = null
  let currentProps: ListboxProps | null = null
  let hasInitializedValue = false
  let menuPointerDownStarted = false
  let open = false
  let popupId = `${handle.id}-popup`
  let listId = `${handle.id}-list`
  let selectionActive = false
  let selectedValue: string | null = null
  let triggerNode: HTMLButtonElement
  let uncontrolledValue: string | null = null
  let popupNode: HTMLDivElement

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

  function getOptionNodes() {
    return Array.from(popupNode.querySelectorAll(enabledOptionSelector)).filter(
      (node): node is HTMLElement => node instanceof HTMLElement,
    )
  }

  function getOptionNodeByValue(value: string | null) {
    if (value == null) {
      return null
    }

    return getOptionNodes().find((node) => node.dataset.value === value) ?? null
  }

  function getHighlightedOptionNode() {
    return getOptionNodeByValue(highlightedValue)
  }

  function setHighlightedValue(value: string | null) {
    if (highlightedValue === value) {
      return
    }

    highlightedValue = value
    void handle.update()
  }

  function resolveHighlightedValue(strategy: HighlightOnOpen) {
    let enabledOptions = getOptionNodes()

    if (strategy === 'first') {
      return enabledOptions[0]?.dataset.value ?? null
    }

    if (strategy === 'last') {
      let option = enabledOptions.at(-1)
      return option?.dataset.value ?? null
    }

    if (selectedValue != null) {
      return selectedValue
    }

    return enabledOptions[0]?.dataset.value ?? null
  }

  function moveHighlight(direction: 'next' | 'previous' | 'first' | 'last') {
    let enabledOptions = getOptionNodes()
    if (enabledOptions.length === 0) {
      return
    }

    if (direction === 'first') {
      setHighlightedValue(enabledOptions[0]?.dataset.value ?? null)
      return
    }

    if (direction === 'last') {
      let option = enabledOptions.at(-1)
      setHighlightedValue(option?.dataset.value ?? null)
      return
    }

    let currentIndex = enabledOptions.findIndex(
      (option) => option.dataset.value === highlightedValue,
    )
    if (currentIndex === -1) {
      setHighlightedValue(
        enabledOptions[direction === 'next' ? 0 : enabledOptions.length - 1].dataset.value ?? null,
      )
      return
    }

    let nextIndex = currentIndex + (direction === 'next' ? 1 : -1)
    if (nextIndex < 0 || nextIndex >= enabledOptions.length) {
      return
    }

    setHighlightedValue(enabledOptions[nextIndex]!.dataset.value ?? null)
  }

  async function openPopup(disabled: boolean, strategy: HighlightOnOpen = 'selectedOrFirst') {
    if (disabled || open || selectionActive) {
      return
    }

    menuPointerDownStarted = false
    let nextHighlightedValue = resolveHighlightedValue(strategy)
    open = true
    highlightedValue = nextHighlightedValue
    await handle.update()
    popupNode.showPopover()
    popupNode.style.minWidth = `${triggerNode.offsetWidth}px`

    getHighlightedOptionNode()?.scrollIntoView({
      block: 'nearest',
    })
  }

  function closePopup({ focusTrigger = false }: { focusTrigger?: boolean } = {}) {
    open = false
    highlightedValue = null
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

  function dispatchChange(value: string | null) {
    triggerNode.dispatchEvent(new ListboxChangeEvent(value))
  }

  async function commitSelectedValue(value: string) {
    let changed = selectedValue !== value
    if (!changed) {
      return
    }

    if (currentProps?.value === undefined) {
      uncontrolledValue = value
      await handle.update()
      dispatchChange(value)
      return
    }

    dispatchChange(value)
  }

  async function selectValue(
    option: HTMLElement,
    { focusTrigger = true }: { focusTrigger?: boolean } = {},
  ) {
    let value = option.dataset.value!
    selectionActive = true
    highlightedValue = null
    await handle.update()

    await flashAttribute(option, 'data-flash', SELECTION_FLASH_DELAY)
    if (handle.signal.aborted) return

    await waitForCssTransition(popupNode, handle.signal, () => {
      closePopup({ focusTrigger })
    })
    if (handle.signal.aborted) return

    selectionActive = false
    await commitSelectedValue(value)
  }

  async function selectHighlightedValue() {
    let option = getHighlightedOptionNode()
    if (!(option instanceof HTMLElement)) {
      return
    }

    await selectValue(option)
  }

  async function selectFilteredValue(text: string) {
    if (selectionActive || text === '') {
      return
    }

    let option = getOptionNodes().find((node) =>
      node.dataset.label?.toLowerCase().includes(text.toLowerCase()),
    )
    if (!(option instanceof HTMLElement)) {
      return
    }

    highlightedValue = null

    if (open) {
      closePopup()
    }

    await commitSelectedValue(option.dataset.value!)
  }

  return (props: ListboxProps) => {
    let { children, defaultValue, initialLabel, mix, name, type, value, ...buttonProps } = props
    let options = getListboxOptions(children)

    currentProps = props

    if (!hasInitializedValue) {
      uncontrolledValue = defaultValue ?? null
      hasInitializedValue = true
    }

    selectedValue = resolveSelectedValue(options, value !== undefined ? value : uncontrolledValue)
    let selectedOption = getOptionDataByValue(options, selectedValue)

    handle.context.set({
      disabled: props.disabled === true,
      highlightedValue,
      selectedValue,
    })

    return (
      <button
        {...buttonProps}
        aria-activedescendant={open ? (getHighlightedOptionNode()?.id ?? undefined) : undefined}
        aria-expanded={open}
        popovertarget={popupId}
        role="combobox"
        mix={[
          ui.listbox.trigger,
          mix,
          ref((node: HTMLButtonElement) => {
            triggerNode = node
          }),
          filterText((text) => {
            void selectFilteredValue(text)
          }),
          on('click', (event) => {
            event.preventDefault()
          }),
          on('pointerdown', (event) => {
            if (event.currentTarget.disabled) {
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

            void openPopup(event.currentTarget.disabled)
          }),
          on('keydown', (event) => {
            if (event.currentTarget.disabled) {
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
                  void openPopup(event.currentTarget.disabled)
                } else {
                  void selectHighlightedValue()
                }
                break
              case 'ArrowDown':
                event.preventDefault()
                if (!open) {
                  void openPopup(event.currentTarget.disabled)
                } else {
                  moveHighlight('next')
                }
                break
              case 'ArrowUp':
                event.preventDefault()
                if (!open) {
                  void openPopup(event.currentTarget.disabled, 'last')
                } else {
                  moveHighlight('previous')
                }
                break
              case 'Home':
                event.preventDefault()
                if (!open) {
                  void openPopup(event.currentTarget.disabled, 'first')
                } else {
                  moveHighlight('first')
                }
                break
              case 'End':
                event.preventDefault()
                if (!open) {
                  void openPopup(event.currentTarget.disabled, 'last')
                } else {
                  moveHighlight('last')
                }
                break
              case 'Escape':
                if (!open) {
                  return
                }
                event.preventDefault()
                closePopup()
                break
              case 'Tab':
                if (!open) {
                  return
                }
                event.preventDefault()
                moveHighlight('first')
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
        type={type ?? 'button'}
      >
        <span mix={ui.listbox.value}>{selectedOption?.textValue ?? initialLabel}</span>
        <Glyph mix={ui.listbox.indicator} name="chevronDown" />
        <input
          disabled={props.disabled === true}
          name={name}
          type="hidden"
          value={selectedValue ?? ''}
        />
        <div
          id={popupId}
          mix={[
            popover({
              inset: true,
              placement: 'top-start',
              relativeTo: selectedValue ? '[aria-selected="true"]' : '[role="option"]',
            }),
            ui.listbox.popup,
            ref((node) => {
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
            id={listId}
            role="listbox"
            mix={[
              ui.listbox.list,
              on('pointermove', (event) => {
                if (selectionActive) {
                  return
                }

                let option = getTargetOptionNode(event.target)
                if (!(option instanceof HTMLElement)) {
                  setHighlightedValue(null)
                  return
                }

                setHighlightedValue(option.dataset.value ?? null)
              }),
              on('pointerleave', () => {
                if (selectionActive) {
                  return
                }

                setHighlightedValue(null)
              }),
              on('pointerup', (event) => {
                if (selectionActive) {
                  return
                }

                if (event.button !== 0) {
                  return
                }

                let shouldSelect =
                  menuPointerDownStarted ||
                  (buttonPointerDownTime !== null &&
                    Date.now() - buttonPointerDownTime >= MENU_POINTER_UP_DELAY)
                menuPointerDownStarted = false
                buttonPointerDownTime = null

                if (!shouldSelect) {
                  return
                }

                let option = getTargetOptionNode(event.target)
                if (!(option instanceof HTMLElement)) {
                  return
                }

                event.preventDefault()
                event.stopPropagation()
                void selectValue(option)
              }),
            ]}
          >
            {children}
          </div>
        </div>
      </button>
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
    let resolvedTextValue =
      textValue ??
      (typeof children === 'string' || typeof children === 'number' ? String(children) : value)
    let resolvedDisabled = listbox.disabled || disabled === true

    let selected = listbox.selectedValue === value
    let highlighted = listbox.highlightedValue === value

    return (
      <div
        {...domProps}
        aria-disabled={resolvedDisabled ? true : undefined}
        aria-selected={selected ? true : undefined}
        data-highlighted={highlighted ? 'true' : undefined}
        data-label={resolvedTextValue}
        data-value={value}
        id={handle.id}
        mix={[ui.listbox.item, mix]}
        role="option"
        tabIndex={-1}
      >
        <Glyph mix={ui.listbox.itemIndicator} name="check" />
        <span mix={ui.listbox.itemLabel}>{children ?? value}</span>
      </div>
    )
  }
}
