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

import { press } from '../press/press-mixin.ts'

type ListboxControllerEventMap = {
  change: Event
}

type ListboxContextProps = {
  children?: RemixNode
}

type RegisteredOption = {
  readonly id: string
  get disabled(): boolean
  get node(): HTMLElement
  get value(): string
}

export type ListboxOptionOptions = {
  disabled?: boolean
  value: string
}

export const listboxChangeEventType = 'rmx:listbox-change' as const

declare global {
  interface HTMLElementEventMap {
    [listboxChangeEventType]: ListboxEvent
  }
}

export class ListboxEvent extends Event {
  readonly focusValue: string
  readonly value: string
  readonly values: string[]

  constructor({
    focusValue,
    value,
    values,
  }: {
    focusValue: string
    value: string
    values: string[]
  }) {
    super(listboxChangeEventType, { bubbles: true })
    this.focusValue = focusValue
    this.value = value
    this.values = values
  }
}

class ListboxController extends TypedEventTarget<ListboxControllerEventMap> {
  #focusedOptionId: string | null = null
  #list: HTMLElement | null = null
  #options = new Map<string, RegisteredOption>()
  #selectedOptionId: string | null = null

  get focusedOptionId() {
    return this.#focusedOptionId
  }

  get selectedOptionId() {
    return this.#selectedOptionId
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

    let selectedOption = this.#getSelectedOption()
    if (selectedOption && !selectedOption.disabled) {
      this.#setFocusedOptionId(selectedOption.id)
      return
    }

    let firstEnabledOption = this.#getEnabledOptions()[0]
    if (firstEnabledOption) {
      this.#setFocusedOptionId(firstEnabledOption.id)
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
  }

  selectFocused() {
    if (!this.#focusedOptionId) {
      this.focusOnEntry()
    }

    if (!this.#focusedOptionId) {
      return
    }

    this.selectOption(this.#focusedOptionId)
  }

  selectOption(optionId: string) {
    let option = this.#options.get(optionId)
    if (!option || option.disabled) {
      return
    }

    let selectionChanged = this.#selectedOptionId !== option.id
    let focusChanged = this.#focusedOptionId !== option.id

    this.#selectedOptionId = option.id
    this.#focusedOptionId = option.id

    if (selectionChanged || focusChanged) {
      this.#notify()
    }

    if (!selectionChanged) {
      return
    }

    this.#list?.dispatchEvent(
      new ListboxEvent({
        focusValue: option.value,
        value: option.value,
        values: [option.value],
      }),
    )
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

    let shouldNotify = false
    if (this.#selectedOptionId === optionId) {
      this.#selectedOptionId = null
      shouldNotify = true
    }

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

  #getSelectedOption() {
    return this.#selectedOptionId ? (this.#options.get(this.#selectedOptionId) ?? null) : null
  }

  #notify() {
    this.dispatchEvent(new Event('change'))
  }

  #setFocusedOptionId(optionId: string | null) {
    if (this.#focusedOptionId === optionId) {
      return
    }

    this.#focusedOptionId = optionId
    this.#notify()
  }
}

function ListboxContext(handle: Handle<ListboxController>) {
  let controller = new ListboxController()

  return (props: ListboxContextProps) => {
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
      'aria-orientation': 'vertical',
      role: 'listbox',
      tabIndex: props.tabIndex ?? 0,
    }),
    ref((node: HTMLElement, signal) => {
      controller.registerList(node)
      signal.addEventListener('abort', () => {
        controller.unregisterList(node)
      })
    }),
    on('focus', () => {
      controller.focusOnEntry()
    }),
    on('keydown', (event) => {
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
        case ' ':
          event.preventDefault()
          controller.selectFocused()
          return
      }
    }),
  ]
})

let listboxOptionMixin = createMixin<HTMLElement, [options: ListboxOptionOptions], ElementProps>(
  (handle) => {
    let controller = getListboxController(handle)
    let currentDisabled = false
    let currentValue = ''
    let node: HTMLElement
    let option: RegisteredOption = {
      id: handle.id,
      get disabled() {
        return currentDisabled
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
      currentValue = options.value

      let isFocused = controller.focusedOptionId === option.id
      let isSelected = controller.selectedOptionId === option.id

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
          on('pointermove', () => {
            controller.focusOption(option.id)
          }),
          on('pointerleave', () => {
            if (controller.focusedOptionId === option.id) {
              controller.clearFocusedOption()
            }
          }),
          on(press.press, () => {
            controller.selectOption(option.id)
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
