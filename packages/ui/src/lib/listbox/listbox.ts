import {
  TypedEventTarget,
  attrs,
  createMixin,
  on,
  ref,
  type ElementProps,
  type Handle,
  type MixinHandle,
  type RemixNode,
} from '@remix-run/component'

import { popover } from '../popover/popover.ts'
import { press } from '../press/press-mixin.ts'
import { flashAttribute } from '../utils/flash-attribute.ts'

type ListboxControllerEventMap = {
  change: Event
}

type ListboxContextProps = {
  children?: RemixNode
  multiple?: boolean
  values?: string[]
}

type RegisteredOption = {
  readonly id: string
  get disabled(): boolean
  get label(): string
  get node(): HTMLElement
  get value(): string
}

export type ListboxOptionOptions = {
  disabled?: boolean
  label: string
  value: string
}

type SelectionMode = 'replace' | 'toggle'
type SelectionDispatchOptions = {
  flash?: boolean
  signal?: AbortSignal
}

let selectionFlashDurationMs = 60

export const listboxChangeEventType = 'rmx:listbox-change' as const

declare global {
  interface HTMLElementEventMap {
    [listboxChangeEventType]: ListboxEvent
  }
}

export class ListboxEvent extends Event {
  readonly focusValue: string
  readonly label: string
  readonly optionId: string
  readonly value: string
  readonly values: string[]

  constructor({
    focusValue,
    label,
    optionId,
    value,
    values,
  }: {
    focusValue: string
    label: string
    optionId: string
    value: string
    values: string[]
  }) {
    super(listboxChangeEventType, { bubbles: true })
    this.focusValue = focusValue
    this.label = label
    this.optionId = optionId
    this.value = value
    this.values = values
  }
}

class ListboxController extends TypedEventTarget<ListboxControllerEventMap> {
  #focusedOptionId: string | null = null
  #list: HTMLElement | null = null
  #multiple = false
  #options = new Map<string, RegisteredOption>()
  #selectionFeedbackActive = false
  #selectedOptionIds: string[] = []
  #values: string[] = []

  get focusedOptionId() {
    return this.#focusedOptionId
  }

  get multiple() {
    return this.#multiple
  }

  get selectedOptionIds() {
    return this.#selectedOptionIds
  }

  get isSelectionFeedbackActive() {
    return this.#selectionFeedbackActive
  }

  focusList() {
    this.#list?.focus()
  }

  focusNext() {
    let options = this.#getEnabledOptions()
    if (options.length === 0) {
      return
    }

    let currentIndex = options.findIndex((option) => option.id === this.#focusedOptionId)
    let nextIndex = currentIndex === -1 ? 0 : Math.min(currentIndex + 1, options.length - 1)
    this.#setFocusedOptionId(options[nextIndex].id)
  }

  setMultiple(multiple: boolean) {
    if (this.#multiple === multiple) {
      return
    }

    this.#multiple = multiple
    this.#values = this.#normalizeValues(this.#values)
    this.#selectedOptionIds = this.#getSelectedOptionIdsForValues(this.#values)

    this.#notify()
  }

  setValues(values: string[]) {
    let nextValues = this.#normalizeValues(values)
    let nextSelectedOptionIds = this.#getSelectedOptionIdsForValues(nextValues)
    let valuesChanged = !hasEqualIds(this.#values, nextValues)
    let selectionIdsChanged = !hasEqualIds(this.#selectedOptionIds, nextSelectedOptionIds)

    if (!valuesChanged && !selectionIdsChanged) {
      return
    }

    this.#values = nextValues
    this.#selectedOptionIds = nextSelectedOptionIds
    this.#notify()
  }

  clearFocusedOption() {
    this.#setFocusedOptionId(null)
  }

  focusOption(optionId: string) {
    let option = this.#options.get(optionId)
    if (!option || option.disabled) {
      return
    }

    this.#setFocusedOptionId(option.id)
  }

  focusOnEntry() {
    let focusedOption = this.#getFocusedOption()
    if (focusedOption && !focusedOption.disabled) {
      return
    }

    let selectedOption = this.#getLastSelectedOption()
    if (selectedOption && !selectedOption.disabled) {
      this.#setFocusedOptionId(selectedOption.id)
    }
  }

  focusPrevious() {
    let options = this.#getEnabledOptions()
    if (options.length === 0) {
      return
    }

    let currentIndex = options.findIndex((option) => option.id === this.#focusedOptionId)
    let nextIndex = currentIndex === -1 ? options.length - 1 : Math.max(currentIndex - 1, 0)
    this.#setFocusedOptionId(options[nextIndex].id)
  }

  registerList(node: HTMLElement) {
    this.#list = node
  }

  registerOption(option: RegisteredOption) {
    this.#options.set(option.id, option)
    if (this.#syncSelectionFromValues()) {
      this.#notify()
    }
  }

  isSelected(optionId: string) {
    return this.#selectedOptionIds.includes(optionId)
  }

  async selectFocused(
    mode: SelectionMode = 'replace',
    options: SelectionDispatchOptions = {},
  ) {
    if (!this.#focusedOptionId) {
      this.focusOnEntry()
    }

    if (!this.#focusedOptionId) {
      return
    }

    await this.selectOption(this.#focusedOptionId, mode, options)
  }

  async selectOption(
    optionId: string,
    mode: SelectionMode = 'replace',
    { flash = false, signal }: SelectionDispatchOptions = {},
  ) {
    if (signal?.aborted || this.#selectionFeedbackActive) {
      return
    }

    let option = this.#options.get(optionId)
    if (!option || option.disabled) {
      return
    }

    let nextSelectedOptionIds = this.#getNextSelectedOptionIds(option.id, mode)
    let selectionChanged = !hasEqualIds(this.#selectedOptionIds, nextSelectedOptionIds)
    let focusChanged = this.#focusedOptionId !== option.id

    this.#values = this.#getValuesForOptionIds(nextSelectedOptionIds)
    this.#selectedOptionIds = nextSelectedOptionIds
    this.#focusedOptionId = option.id

    if (selectionChanged || focusChanged) {
      this.#notify()
    }

    if (!selectionChanged) {
      return
    }

    let changeEvent = this.#createSelectionChangeEvent()

    if (flash) {
      this.#selectionFeedbackActive = true

      try {
        await flashAttribute(option.node, 'data-flash', selectionFlashDurationMs)
        if (signal?.aborted) {
          return
        }
      } finally {
        this.#selectionFeedbackActive = false
      }
    }

    if (signal?.aborted) {
      return
    }

    this.#list?.dispatchEvent(changeEvent)
  }

  unregisterList(node: HTMLElement) {
    if (this.#list !== node) {
      return
    }

    this.#list = null
  }

  unregisterOption(optionId: string) {
    if (!this.#options.delete(optionId)) {
      return
    }

    let shouldNotify = this.#syncSelectionFromValues()

    if (this.#focusedOptionId === optionId) {
      this.#focusedOptionId = null
      shouldNotify = true
    }

    if (shouldNotify) {
      this.#notify()
    }
  }

  #getEnabledOptions() {
    return Array.from(this.#options.values()).filter((option) => !option.disabled)
  }

  #getFocusedOption() {
    return this.#focusedOptionId ? (this.#options.get(this.#focusedOptionId) ?? null) : null
  }

  #getLastSelectedOption() {
    let options = this.#getSelectedOptions()
    return options.at(-1) ?? null
  }

  #getSelectedOptionIdsForValues(values: string[]) {
    return values.flatMap((value) => {
      let option = Array.from(this.#options.values()).find((candidate) => candidate.value === value)
      return option ? [option.id] : []
    })
  }

  #getValuesForOptionIds(optionIds: string[]) {
    return optionIds.flatMap((id) => {
      let option = this.#options.get(id)
      return option ? [option.value] : []
    })
  }

  #notify() {
    this.dispatchEvent(new Event('change'))
  }

  #normalizeValues(values: string[]) {
    let nextValues = Array.from(new Set(values))
    if (!this.#multiple && nextValues.length > 1) {
      return nextValues.slice(-1)
    }

    return nextValues
  }

  #setFocusedOptionId(optionId: string | null) {
    if (this.#focusedOptionId === optionId) {
      return
    }

    this.#focusedOptionId = optionId
    this.#notify()
  }

  #createSelectionChangeEvent() {
    let selectedOptions = this.#getSelectedOptions()
    let lastSelectedOption = selectedOptions.at(-1) ?? null
    let values = selectedOptions.map((option) => option.value)
    let focusValue = this.#getFocusedOption()?.value ?? ''

    return new ListboxEvent({
      focusValue,
      label: lastSelectedOption?.label ?? '',
      optionId: lastSelectedOption?.id ?? '',
      value: values.at(-1) ?? '',
      values,
    })
  }

  #getNextSelectedOptionIds(optionId: string, mode: SelectionMode) {
    if (!this.#multiple || mode === 'replace') {
      return [optionId]
    }

    if (this.#selectedOptionIds.includes(optionId)) {
      return this.#selectedOptionIds.filter((id) => id !== optionId)
    }

    return [...this.#selectedOptionIds, optionId]
  }

  #getSelectedOptions() {
    return this.#selectedOptionIds.flatMap((id) => {
      let option = this.#options.get(id)
      return option ? [option] : []
    })
  }

  #syncSelectionFromValues() {
    let nextSelectedOptionIds = this.#getSelectedOptionIdsForValues(this.#values)
    if (hasEqualIds(this.#selectedOptionIds, nextSelectedOptionIds)) {
      return false
    }

    this.#selectedOptionIds = nextSelectedOptionIds
    return true
  }
}

function ListboxContext(handle: Handle<ListboxController>) {
  let controller = new ListboxController()

  return (props: ListboxContextProps) => {
    controller.setMultiple(props.multiple === true)
    if (props.values !== undefined) {
      controller.setValues(props.values)
    }
    handle.context.set(controller)
    return props.children ?? null
  }
}

function getListboxController(handle: Handle | MixinHandle) {
  let controller = handle.context.get(ListboxContext)
  if (!(controller instanceof ListboxController)) {
    throw new Error('Listbox roles must be used inside listbox.context')
  }

  return controller
}

let listboxListMixin = createMixin<HTMLElement, [], ElementProps>((handle) => {
  let controller = getListboxController(handle)
  controller.addEventListener('change', () => handle.update(), { signal: handle.signal })

  return (props) => [
    attrs({
      'aria-activedescendant': controller.focusedOptionId ?? undefined,
      'aria-multiselectable': controller.multiple ? true : undefined,
      'aria-orientation': 'vertical',
      role: 'listbox',
      tabIndex: props.tabIndex ?? 0,
    }),
    ref((node: HTMLElement, signal) => {
      controller.registerList(node)
      let popover = node.closest('[popover]')
      if (popover instanceof HTMLElement) {
        popover.addEventListener(
          'beforetoggle',
          (event) => {
            if (event.newState === 'open') {
              controller.focusOnEntry()
            }
          },
          { signal },
        )
      }

      signal.addEventListener('abort', () => {
        controller.unregisterList(node)
      })
    }),
    on('focus', () => {
      controller.focusOnEntry()
    }),
    on(popover.closerequest, (event) => {
      if (controller.isSelectionFeedbackActive) {
        event.preventDefault()
      }
    }),
    on('keydown', (event, signal) => {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault()
          controller.focusNext()
          return
        case 'ArrowUp':
          event.preventDefault()
          controller.focusPrevious()
          return
        case 'Enter':
          event.preventDefault()
          void controller.selectFocused('replace', { flash: true, signal })
          return
        case ' ':
          event.preventDefault()
          void controller.selectFocused(controller.multiple ? 'toggle' : 'replace', {
            flash: controller.multiple ? false : true,
            signal,
          })
          return
      }
    }),
  ]
})

let listboxOptionMixin = createMixin<HTMLElement, [options: ListboxOptionOptions], ElementProps>(
  (handle) => {
    let controller = getListboxController(handle)
    let currentDisabled = false
    let currentLabel = ''
    let currentValue = ''
    let node: HTMLElement
    let option: RegisteredOption = {
      id: handle.id,
      get disabled() {
        return currentDisabled
      },
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

    controller.addEventListener('change', () => handle.update(), { signal: handle.signal })

    return (options) => {
      currentDisabled = options.disabled === true
      currentLabel = options.label
      currentValue = options.value

      let isFocused = controller.focusedOptionId === option.id
      let isSelected = controller.isSelected(option.id)

      return [
        attrs({
          'aria-disabled': currentDisabled ? true : undefined,
          'aria-selected': isSelected ? true : false,
          'data-highlighted': isFocused ? 'true' : 'false',
          id: option.id,
          role: 'option',
        }),
        ref((nextNode: HTMLElement, signal) => {
          node = nextNode
          controller.registerOption(option)
          signal.addEventListener('abort', () => {
            controller.unregisterOption(option.id)
          })
        }),
        !currentDisabled && [
          press(),
          on(press.down, () => {
            controller.focusOption(option.id)
          }),
          on('pointermove', () => {
            controller.focusOption(option.id)
          }),
          on('pointerleave', (event) => {
            let popover = event.currentTarget.closest('[popover]')
            if (popover instanceof HTMLElement && !popover.matches(':popover-open')) {
              return
            }

            if (controller.focusedOptionId === option.id) {
              controller.clearFocusedOption()
            }
          }),
          on(press.press, (_event, signal) => {
            void controller.selectOption(option.id, controller.multiple ? 'toggle' : 'replace', {
              flash: controller.multiple ? false : true,
              signal,
            })
            controller.focusList()
          }),
        ],
      ]
    }
  },
)

type ListboxApi = {
  readonly change: typeof listboxChangeEventType
  readonly context: typeof ListboxContext
  readonly list: typeof listboxListMixin
  readonly option: typeof listboxOptionMixin
}

export let listbox: ListboxApi = {
  change: listboxChangeEventType,
  context: ListboxContext,
  list: listboxListMixin,
  option: listboxOptionMixin,
}

function hasEqualIds(currentIds: string[], nextIds: string[]) {
  return (
    currentIds.length === nextIds.length && currentIds.every((id, index) => id === nextIds[index])
  )
}
