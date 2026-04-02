// @jsxRuntime classic
// @jsx createElement
import {
  TypedEventTarget,
  attrs,
  createElement,
  createMixin,
  on,
  ref,
  type ElementProps,
  type Handle,
  type MixinHandle,
  type Props,
  type RemixNode,
} from '@remix-run/component'

import { anchor } from '../anchor/anchor.ts'
import { Glyph } from '../glyph/glyph.tsx'
import { onOutsidePress } from '../outside-press/outside-press-mixin.ts'
import { press } from '../press/press-mixin.ts'
import { ui } from '../theme/theme.ts'
import { flashAttribute } from '../utils/flash-attribute.ts'
import { itemMatchesSearchText, type SearchValue } from '../utils/typeahead-mixin.tsx'

type ComboboxControllerEventMap = {
  change: Event
}

type RegisteredOption = {
  readonly id: string
  get disabled(): boolean
  get label(): string
  get node(): HTMLElement
  get searchValue(): SearchValue
  get value(): string
}

type ComboboxCommitOptions = {
  flash?: boolean
  signal?: AbortSignal
}

let selectionFlashDurationMs = 150

type ComboboxComponent = typeof ComboboxImpl & {
  readonly change: typeof comboboxChangeEventType
}

export type ComboboxContextProps = {
  children?: RemixNode
  defaultValue?: string | null
  disabled?: boolean
  name?: string
  ref?: (handle: ComboboxHandle) => void
}

export type ComboboxHandle = {
  readonly activeOptionId: string | null
  readonly id: string
  readonly inputText: string
  readonly isOpen: boolean
  readonly label: string | null
  readonly value: string | null
  close(options?: { focusInput?: boolean }): void
  open(strategy?: ComboboxOpenStrategy): Promise<void>
}

export type ComboboxOpenStrategy = 'selected' | 'first' | 'last'

export type ComboboxOptionOptions = {
  disabled?: boolean
  label: string
  searchValue?: SearchValue
  value: string
}

export type ComboboxProps = Omit<Props<'div'>, 'children'> & {
  children?: RemixNode
  defaultValue?: string | null
  disabled?: boolean
  inputId?: string
  name?: string
  placeholder?: string
}

export type OptionProps = Omit<Props<'div'>, 'children'> & {
  children?: RemixNode
  disabled?: boolean
  label: string
  searchValue?: SearchValue
  value: string
}

export const comboboxChangeEventType = 'rmx:combobox-change' as const

declare global {
  interface HTMLElementEventMap {
    [comboboxChangeEventType]: ComboboxChangeEvent
  }
}

export class ComboboxChangeEvent extends Event {
  readonly label: string | null
  readonly optionId: string | null
  readonly value: string | null

  constructor({
    label,
    optionId,
    value,
  }: {
    label: string | null
    optionId: string | null
    value: string | null
  }) {
    super(comboboxChangeEventType, { bubbles: true })
    this.label = label
    this.optionId = optionId
    this.value = value
  }
}

class ComboboxController extends TypedEventTarget<ComboboxControllerEventMap> {
  #activeOptionId: string | null = null
  #cleanupAnchor = () => {}
  #defaultListId: string
  #defaultSurfaceId: string
  #disabled = false
  #filterText = ''
  #focusInputOnClose = false
  #input: HTMLInputElement | null = null
  #inputText = ''
  #list: HTMLElement | null = null
  #listId: string
  #name: string | undefined = undefined
  #open = false
  #options = new Map<string, RegisteredOption>()
  #selectedOptionId: string | null = null
  #surface: HTMLElement | null = null
  #surfaceId: string
  #update: () => Promise<AbortSignal>
  #value: string | null = null

  constructor(id: string, update: () => Promise<AbortSignal>) {
    super()
    this.#defaultListId = `${id}-combobox-list`
    this.#defaultSurfaceId = `${id}-combobox-surface`
    this.#listId = this.#defaultListId
    this.#surfaceId = this.#defaultSurfaceId
    this.#update = update
  }

  get activeOptionId() {
    return this.#activeOptionId
  }

  get id() {
    return this.#listId
  }

  get inputText() {
    return this.#inputText
  }

  get isDisabled() {
    return this.#disabled
  }

  get isOpen() {
    return this.#open
  }

  get label() {
    return this.#getSelectedOption()?.label ?? null
  }

  get name() {
    return this.#name
  }

  get surfaceId() {
    return this.#surfaceId
  }

  get value() {
    return this.#value
  }

  activateOption(optionId: string) {
    let option = this.#options.get(optionId)
    if (!option || option.disabled || !this.#matchesFilter(option, this.#filterText)) {
      return
    }

    if (!this.#setActiveOptionId(option.id)) {
      return
    }

    this.#notify()
  }

  close({ focusInput = false }: { focusInput?: boolean } = {}) {
    let surface = this.#surface
    if (!surface) {
      return
    }

    if (!this.#open && !surface.matches(':popover-open')) {
      return
    }

    this.#focusInputOnClose = focusInput
    surface.hidePopover()
  }

  focusNext() {
    let options = this.#getEnabledVisibleOptions()
    if (options.length === 0) {
      return
    }

    let currentIndex = options.findIndex((option) => option.id === this.#activeOptionId)
    let nextIndex = currentIndex === -1 ? 0 : Math.min(currentIndex + 1, options.length - 1)
    if (!this.#setActiveOptionId(options[nextIndex].id)) {
      return
    }

    this.#notify()
  }

  focusPrevious() {
    let options = this.#getEnabledVisibleOptions()
    if (options.length === 0) {
      return
    }

    let currentIndex = options.findIndex((option) => option.id === this.#activeOptionId)
    let nextIndex = currentIndex === -1 ? options.length - 1 : Math.max(currentIndex - 1, 0)
    if (!this.#setActiveOptionId(options[nextIndex].id)) {
      return
    }

    this.#notify()
  }

  handleBeforeToggle(node: HTMLElement, nextState: string) {
    this.#surface = node

    if (nextState === 'open' || !this.#open) {
      return
    }

    this.#open = false
    this.#cleanupAnchor()
    this.#cleanupAnchor = () => {}

    let focusInput = this.#focusInputOnClose
    this.#focusInputOnClose = false
    this.#notify()

    if (focusInput && this.#input?.isConnected) {
      this.#input.focus()
    }
  }

  handleBlur() {
    this.#resolveDraftValueOnBlur()
    this.close()
  }

  handleEscape() {
    if (!this.#getExactInputMatch()) {
      this.#clearInputAndSelection()
    }

    this.close()
  }

  handleOutsidePress() {
    if (!this.#open) {
      return
    }

    this.#resolveDraftValueOnBlur()
    this.close()
  }

  isSelected(optionId: string) {
    return this.#selectedOptionId === optionId
  }

  isVisible(optionId: string) {
    let option = this.#options.get(optionId)
    if (!option) {
      return false
    }

    return this.#matchesFilter(option, this.#filterText)
  }

  async open(strategy: ComboboxOpenStrategy = 'selected') {
    if (this.#disabled) {
      return
    }

    let nextFilterText = this.#getArrowOpenFilterText()
    let visibleOptions = this.#getVisibleOptions(nextFilterText)
    if (visibleOptions.length === 0) {
      return
    }

    let activeOption = this.#resolveOpenOption(strategy, nextFilterText)
    let filterChanged = this.#setFilterText(nextFilterText)
    let activeChanged = this.#setActiveOptionId(activeOption?.id ?? null)

    if (filterChanged || activeChanged) {
      this.#notify()
      let signal = await this.#update()
      if (signal.aborted) {
        return
      }
    }

    let surface = this.#surface
    let input = this.#input
    if (!surface || !input) {
      return
    }

    if (!this.#open) {
      this.#syncMinWidth()
      surface.showPopover()
      this.#open = true
      this.#syncAnchor()
      this.#notify()
    } else {
      this.#syncAnchor()
    }

    input.focus()
  }

  openFromArrow(direction: 'first' | 'last') {
    let strategy: ComboboxOpenStrategy = this.#getExactInputMatch() ? 'selected' : direction
    return this.open(strategy)
  }

  registerInput(node: HTMLInputElement) {
    this.#input = node
  }

  registerList(node: HTMLElement) {
    this.#list = node
  }

  registerOption(option: RegisteredOption) {
    this.#options.set(option.id, option)

    let nextSelectedOptionId = this.#getOptionIdForValue(this.#value)
    let nextActiveOptionId = this.#activeOptionId
    if (nextActiveOptionId && !this.isVisible(nextActiveOptionId)) {
      nextActiveOptionId = this.#resolveOpenOption('first')?.id ?? null
    }

    if (
      this.#selectedOptionId === nextSelectedOptionId &&
      this.#activeOptionId === nextActiveOptionId
    ) {
      return
    }

    this.#selectedOptionId = nextSelectedOptionId
    this.#activeOptionId = nextActiveOptionId
    this.#notify()
  }

  registerSurface(node: HTMLElement) {
    this.#surface = node
    this.setSurfaceId(node.id || this.#defaultSurfaceId)
  }

  async selectActive(options: ComboboxCommitOptions = {}) {
    if (!this.#activeOptionId) {
      let activeOption = this.#resolveOpenOption('first')
      if (!activeOption) {
        return
      }

      this.#setActiveOptionId(activeOption.id)
      this.#notify()
    }

    if (!this.#activeOptionId) {
      return
    }

    await this.selectOption(this.#activeOptionId, options)
  }

  async selectOption(optionId: string, { flash = true, signal }: ComboboxCommitOptions = {}) {
    if (signal?.aborted) {
      return
    }

    let option = this.#options.get(optionId)
    if (!option || option.disabled || !this.#matchesFilter(option, this.#filterText)) {
      return
    }

    let activeChanged = this.#setActiveOptionId(option.id)
    let selectionChanged = this.#value !== option.value
    let inputChanged = this.#inputText !== option.label || this.#filterText !== ''

    this.#selectedOptionId = option.id
    this.#value = option.value
    this.#inputText = option.label
    this.#filterText = ''
    this.#setInputValue(option.label)

    if (activeChanged || selectionChanged || inputChanged) {
      this.#notify()
    }

    if (flash) {
      await flashAttribute(option.node, 'data-flash', selectionFlashDurationMs)
    }

    this.close({ focusInput: true })

    if (!selectionChanged) {
      return
    }

    this.#dispatchChange({
      label: option.label,
      optionId: option.id,
      value: option.value,
    })
  }

  async setInputText(text: string) {
    if (this.#disabled) {
      return
    }

    let inputChanged = this.#inputText !== text
    let filterChanged = this.#filterText !== text
    if (!inputChanged && !filterChanged) {
      return
    }

    this.#inputText = text
    this.#filterText = text

    if (text === '') {
      let activeChanged = this.#setActiveOptionId(null)
      if (inputChanged || filterChanged || activeChanged) {
        this.#notify()
      }

      this.close()
      return
    }

    let visibleOptions = this.#getVisibleOptions(text)
    if (visibleOptions.length === 0) {
      let activeChanged = this.#setActiveOptionId(null)
      if (inputChanged || filterChanged || activeChanged) {
        this.#notify()
      }

      this.close()
      return
    }

    let activeOption = this.#resolveOpenOption('first', text)
    let activeChanged = this.#setActiveOptionId(activeOption?.id ?? null)
    if (inputChanged || filterChanged || activeChanged) {
      this.#notify()
    }

    let surface = this.#surface
    if (!surface) {
      return
    }

    if (!this.#open) {
      this.#syncMinWidth()
      surface.showPopover()
      this.#open = true
      this.#syncAnchor()
      this.#notify()
      return
    }

    this.#syncAnchor()
  }

  setDisabled(disabled: boolean) {
    this.#disabled = disabled
  }

  setListId(id: string) {
    if (this.#listId === id) {
      return
    }

    this.#listId = id
    this.#notify()
  }

  setName(name: string | undefined) {
    this.#name = name
  }

  setSurfaceId(id: string) {
    if (this.#surfaceId === id) {
      return
    }

    this.#surfaceId = id
    this.#notify()
  }

  setValue(value: string | null) {
    let nextSelectedOptionId = this.#getOptionIdForValue(value)
    if (this.#value === value && this.#selectedOptionId === nextSelectedOptionId) {
      return
    }

    this.#value = value
    this.#selectedOptionId = nextSelectedOptionId
    this.#inputText = value ?? ''
    this.#filterText = ''
    this.#notify()
  }

  unregisterInput(node: HTMLInputElement) {
    if (this.#input !== node) {
      return
    }

    this.#input = null
  }

  unregisterList(node: HTMLElement) {
    if (this.#list !== node) {
      return
    }

    this.#list = null
  }

  unregisterOption(optionId: string) {
    let removedOption = this.#options.get(optionId)
    if (!removedOption || !this.#options.delete(optionId)) {
      return
    }

    let selectionChanged = false
    if (this.#selectedOptionId === optionId || this.#value === removedOption.value) {
      this.#selectedOptionId = null
      this.#value = null
      selectionChanged = true
    }

    if (this.#activeOptionId === optionId) {
      this.#activeOptionId = this.#resolveOpenOption('first')?.id ?? null
    }

    if (this.#inputText === removedOption.label) {
      this.#inputText = ''
      this.#setInputValue('')
    }

    this.#notify()

    if (!selectionChanged) {
      return
    }

    this.#dispatchChange({ label: null, optionId: null, value: null })
  }

  unregisterSurface(node: HTMLElement) {
    if (this.#surface !== node) {
      return
    }

    this.#cleanupAnchor()
    this.#cleanupAnchor = () => {}
    this.#surface = null
  }

  #clearInputAndSelection() {
    let activeChanged = this.#setActiveOptionId(null)
    let inputChanged = this.#inputText !== '' || this.#filterText !== ''
    let selectionChanged = this.#value !== null || this.#selectedOptionId !== null

    this.#inputText = ''
    this.#filterText = ''
    this.#selectedOptionId = null
    this.#value = null
    this.#setInputValue('')

    if (activeChanged || inputChanged || selectionChanged) {
      this.#notify()
    }

    if (!selectionChanged) {
      return
    }

    this.#dispatchChange({ label: null, optionId: null, value: null })
  }

  #dispatchChange(selection: {
    label: string | null
    optionId: string | null
    value: string | null
  }) {
    let target = this.#input ?? this.#list ?? this.#surface
    target?.dispatchEvent(
      new ComboboxChangeEvent({
        label: selection.label,
        optionId: selection.optionId,
        value: selection.value,
      }),
    )
  }

  #getArrowOpenFilterText() {
    if (this.#inputText === '') {
      return ''
    }

    if (this.#getExactInputMatch()) {
      return ''
    }

    if (this.#getVisibleOptions(this.#inputText).length === 0) {
      return ''
    }

    return this.#inputText
  }

  #getEnabledVisibleOptions(text = this.#filterText) {
    return this.#getVisibleOptions(text).filter((option) => !option.disabled)
  }

  #getExactInputMatch() {
    if (this.#inputText === '') {
      return null
    }

    let normalizedText = this.#inputText.toLowerCase()
    return (
      this.#getEnabledOptions().find((option) => {
        let values = Array.isArray(option.searchValue) ? option.searchValue : [option.searchValue]
        return values.some((value) => value.toLowerCase() === normalizedText)
      }) ?? null
    )
  }

  #getEnabledOptions() {
    return Array.from(this.#options.values()).filter((option) => !option.disabled)
  }

  #getOptionIdForValue(value: string | null) {
    if (value === null) {
      return null
    }

    let option = Array.from(this.#options.values()).find((candidate) => candidate.value === value)
    return option?.id ?? null
  }

  #getSelectedOption() {
    return this.#selectedOptionId ? (this.#options.get(this.#selectedOptionId) ?? null) : null
  }

  #getVisibleOptions(text = this.#filterText) {
    let options = Array.from(this.#options.values())
    if (text === '') {
      return options
    }

    return options.filter((option) => this.#matchesFilter(option, text))
  }

  #matchesFilter(option: RegisteredOption, text: string) {
    if (text === '') {
      return true
    }

    return itemMatchesSearchText(option, text, (candidate) => candidate.searchValue)
  }

  #notify() {
    this.dispatchEvent(new Event('change'))
  }

  #resolveDraftValueOnBlur() {
    let exactMatch = this.#getExactInputMatch()
    if (!exactMatch) {
      this.#clearInputAndSelection()
      return
    }

    let activeChanged = this.#setActiveOptionId(exactMatch.id)
    let selectionChanged = this.#value !== exactMatch.value
    let filterChanged = this.#filterText !== ''

    this.#selectedOptionId = exactMatch.id
    this.#value = exactMatch.value
    this.#filterText = ''

    if (activeChanged || selectionChanged || filterChanged) {
      this.#notify()
    }

    if (!selectionChanged) {
      return
    }

    this.#dispatchChange({
      label: exactMatch.label,
      optionId: exactMatch.id,
      value: exactMatch.value,
    })
  }

  #resolveOpenOption(strategy: ComboboxOpenStrategy, text = this.#filterText) {
    let options = this.#getEnabledVisibleOptions(text)
    if (options.length === 0) {
      return null
    }

    if (strategy === 'selected') {
      let exactInputMatch = this.#getExactInputMatch()
      if (exactInputMatch && this.#matchesFilter(exactInputMatch, text)) {
        return exactInputMatch
      }

      let selectedOption = this.#getSelectedOption()
      if (selectedOption && this.#matchesFilter(selectedOption, text) && !selectedOption.disabled) {
        return selectedOption
      }
    }

    return strategy === 'last' ? options[options.length - 1] : options[0]
  }

  #setActiveOptionId(optionId: string | null) {
    if (this.#activeOptionId === optionId) {
      return false
    }

    this.#activeOptionId = optionId
    return true
  }

  #setFilterText(text: string) {
    if (this.#filterText === text) {
      return false
    }

    this.#filterText = text
    return true
  }

  #setInputValue(value: string) {
    let input = this.#input
    if (!input || input.value === value) {
      return
    }

    input.value = value
  }

  #syncAnchor() {
    this.#cleanupAnchor()
    this.#cleanupAnchor = () => {}

    if (!this.#open || !this.#surface || !this.#input) {
      return
    }

    this.#cleanupAnchor = anchor(this.#surface, this.#input, {
      placement: 'bottom-start',
    })
  }

  #syncMinWidth() {
    let surface = this.#surface
    let input = this.#input
    if (!surface || !input) {
      return
    }

    let width = input.offsetWidth
    if (width <= 0) {
      return
    }

    surface.style.minWidth = `${width}px`
  }
}

function ComboboxContext(handle: Handle<ComboboxController>) {
  let controller = new ComboboxController(handle.id, handle.update)
  let hasInitializedValue = false
  let publicHandle: ComboboxHandle = {
    get activeOptionId() {
      return controller.activeOptionId
    },
    get id() {
      return controller.id
    },
    get inputText() {
      return controller.inputText
    },
    get isOpen() {
      return controller.isOpen
    },
    get label() {
      return controller.label
    },
    get value() {
      return controller.value
    },
    close(options) {
      controller.close(options)
    },
    open(strategy) {
      return controller.open(strategy)
    },
  }

  return (props: ComboboxContextProps) => {
    controller.setDisabled(props.disabled === true)
    controller.setName(props.name)

    if (!hasInitializedValue) {
      controller.setValue(props.defaultValue ?? null)
      hasInitializedValue = true
    }

    handle.context.set(controller)
    props.ref?.(publicHandle)
    return props.children ?? null
  }
}

function getComboboxController(handle: Handle | MixinHandle) {
  let controller = handle.context.get(ComboboxContext)
  if (!(controller instanceof ComboboxController)) {
    throw new Error('Combobox roles must be used inside combobox.context')
  }

  return controller
}

let comboboxInputMixin = createMixin<HTMLInputElement, [], ElementProps>((handle) => {
  let controller = getComboboxController(handle)
  controller.addEventListener('change', () => handle.update(), { signal: handle.signal })

  return (props) => [
    attrs({
      'aria-activedescendant': controller.activeOptionId ?? undefined,
      'aria-autocomplete': 'list',
      'aria-controls': controller.id,
      'aria-expanded': controller.isOpen ? true : false,
      autocomplete: props.autocomplete ?? 'off',
      defaultValue: controller.inputText,
      role: 'combobox',
      type: props.type ?? 'text',
    }),
    ref((nextNode: HTMLInputElement, signal) => {
      controller.registerInput(nextNode)

      signal.addEventListener('abort', () => {
        controller.unregisterInput(nextNode)
      })
    }),
    on('input', (event) => {
      void controller.setInputText((event.currentTarget as HTMLInputElement).value)
    }),
    on('keydown', (event, signal) => {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault()
          if (controller.isOpen) {
            controller.focusNext()
          } else {
            void controller.openFromArrow('first')
          }
          return
        case 'ArrowUp':
          event.preventDefault()
          if (controller.isOpen) {
            controller.focusPrevious()
          } else {
            void controller.openFromArrow('last')
          }
          return
        case 'Enter':
          if (!controller.isOpen) {
            return
          }

          event.preventDefault()
          void controller.selectActive({ signal })
          return
        case 'Escape':
          if (!controller.isOpen && controller.inputText === '') {
            return
          }

          event.preventDefault()
          controller.handleEscape()
          return
      }
    }),
    on('blur', () => {
      controller.handleBlur()
    }),
  ]
})

let comboboxPopoverMixin = createMixin<HTMLElement, [], ElementProps>((handle) => {
  let controller = getComboboxController(handle)
  controller.addEventListener('change', () => handle.update(), { signal: handle.signal })

  return (props) => {
    let id = props.id ?? controller.surfaceId
    controller.setSurfaceId(id)

    return [
      attrs({ id, popover: 'manual' }),
      ref((node: HTMLElement, signal) => {
        controller.registerSurface(node)
        signal.addEventListener('abort', () => {
          controller.unregisterSurface(node)
        })
      }),
      on('beforetoggle', (event) => {
        controller.handleBeforeToggle(event.currentTarget as HTMLElement, event.newState)
      }),
      onOutsidePress(() => {
        controller.handleOutsidePress()
      }),
    ]
  }
})

let comboboxListMixin = createMixin<HTMLElement, [], ElementProps>((handle) => {
  let controller = getComboboxController(handle)
  controller.addEventListener('change', () => handle.update(), { signal: handle.signal })

  return (props) => {
    let id = props.id ?? controller.id
    controller.setListId(id)

    return [
      attrs({
        id,
        role: 'listbox',
      }),
      ref((node: HTMLElement, signal) => {
        controller.registerList(node)
        signal.addEventListener('abort', () => {
          controller.unregisterList(node)
        })
      }),
    ]
  }
})

let comboboxHiddenInputMixin = createMixin<HTMLInputElement, [], ElementProps>((handle) => {
  let controller = getComboboxController(handle)
  controller.addEventListener('change', () => handle.update(), { signal: handle.signal })

  return () => attrs({ name: controller.name, type: 'hidden', value: controller.value ?? '' })
})

let comboboxOptionMixin = createMixin<HTMLElement, [options: ComboboxOptionOptions], ElementProps>(
  (handle) => {
    let controller = getComboboxController(handle)
    let currentDisabled = false
    let currentLabel = ''
    let currentSearchValue: SearchValue = ''
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
      get searchValue() {
        return currentSearchValue
      },
      get value() {
        return currentValue
      },
    }

    controller.addEventListener('change', () => handle.update(), { signal: handle.signal })

    return (options) => {
      currentDisabled = options.disabled === true
      currentLabel = options.label
      currentSearchValue = options.searchValue ?? options.label
      currentValue = options.value
      let isVisible = controller.isVisible(option.id)

      return [
        attrs({
          'aria-disabled': currentDisabled ? true : undefined,
          'aria-hidden': isVisible ? undefined : true,
          'aria-selected': controller.isSelected(option.id) ? true : false,
          'data-highlighted': controller.activeOptionId === option.id ? 'true' : 'false',
          hidden: isVisible ? undefined : true,
          id: option.id,
          role: 'option',
          style: {
            display: isVisible ? undefined : 'none',
          },
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
          on(press.down, (event) => {
            event.preventDefault()
            controller.activateOption(option.id)
          }),
          on('pointermove', () => {
            controller.activateOption(option.id)
          }),
          on(press.up, (event, signal) => {
            if (event.pointerType === 'virtual') {
              return
            }

            void controller.selectOption(option.id, { signal })
          }),
          on(press.press, (event, signal) => {
            if (event.pointerType !== 'virtual') {
              return
            }

            void controller.selectOption(option.id, { signal })
          }),
        ],
      ]
    }
  },
)

type ComboboxApi = {
  readonly change: typeof comboboxChangeEventType
  readonly context: typeof ComboboxContext
  readonly hiddenInput: typeof comboboxHiddenInputMixin
  readonly input: typeof comboboxInputMixin
  readonly list: typeof comboboxListMixin
  readonly option: typeof comboboxOptionMixin
  readonly popover: typeof comboboxPopoverMixin
}

export let combobox: ComboboxApi = {
  change: comboboxChangeEventType,
  context: ComboboxContext,
  hiddenInput: comboboxHiddenInputMixin,
  input: comboboxInputMixin,
  list: comboboxListMixin,
  option: comboboxOptionMixin,
  popover: comboboxPopoverMixin,
}

function ComboboxImpl() {
  return (props: ComboboxProps) => {
    let { children, defaultValue, disabled, inputId, name, placeholder, ...divProps } = props

    return (
      <combobox.context defaultValue={defaultValue} disabled={disabled} name={name}>
        <div {...divProps}>
          <input
            disabled={disabled}
            id={inputId}
            mix={[ui.field.base, combobox.input()]}
            placeholder={placeholder}
          />

          <div mix={[combobox.popover(), ui.combobox.popover]}>
            <div mix={[combobox.list(), ui.listbox.surface]}>{children}</div>
          </div>

          {name && <input disabled={disabled} mix={combobox.hiddenInput()} />}
        </div>
      </combobox.context>
    )
  }
}

export let Combobox: ComboboxComponent = Object.assign(ComboboxImpl, {
  change: combobox.change,
})

export function Option() {
  return (props: OptionProps) => {
    let { children, disabled, label, mix, searchValue, value, ...divProps } = props

    return (
      <div
        {...divProps}
        mix={[combobox.option({ disabled, label, searchValue, value }), ui.listbox.option, mix]}
      >
        <Glyph mix={ui.listbox.glyph} name="check" />
        <span mix={ui.listbox.label}>{children ?? label}</span>
      </div>
    )
  }
}

export let ComboboxOption = Option
