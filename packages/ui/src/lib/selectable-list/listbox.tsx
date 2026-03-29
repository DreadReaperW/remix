// @jsxRuntime classic
// @jsx createElement
import {
  createElement,
  css,
  on,
  TypedEventTarget,
  type Handle,
  type Props,
  type RemixNode,
} from '@remix-run/component'

import { Glyph } from '../glyph/glyph.tsx'
import { theme, ui } from '../theme/theme.ts'

let optionStateStyles = css({
  '&:hover:not([aria-disabled="true"]):not([aria-selected="true"])': {
    backgroundColor: theme.surface.lvl4,
    color: theme.colors.text.primary,
  },
})

let listboxStateStyles = css({
  '&:focus-within [role="option"][data-highlighted="true"]:not([aria-selected="true"])': {
    backgroundColor: 'transparent',
    color: theme.colors.text.primary,
    outline: `2px solid ${theme.colors.action.primary.background}`,
    outlineOffset: '-2px',
  },
  '&:focus-within [role="option"][aria-selected="true"]': {
    backgroundColor: theme.colors.action.primary.background,
    color: theme.colors.action.primary.foreground,
    outline: 'none',
  },
  '&:focus-within [role="option"][data-highlighted="true"][aria-selected="true"][data-keyboard-active="true"]':
    {
    outline: `2px solid ${theme.colors.action.primary.background}`,
    outlineOffset: '-2px',
    boxShadow: `inset 0 0 0 4px ${theme.surface.lvl0}`,
    },
  '&:not(:focus-within) [role="option"][aria-selected="true"]': {
    backgroundColor: `color-mix(in oklab, ${theme.surface.lvl4} 94%, black)`,
    color: theme.colors.text.primary,
    boxShadow: 'none',
    outline: 'none',
  },
  '&:not(:focus-within) [role="option"][data-highlighted="true"]:not([aria-selected="true"])': {
    backgroundColor: 'transparent',
    color: theme.colors.text.primary,
    boxShadow: 'none',
    outline: 'none',
  },
})

let staticOptionStyles = css({
  gridTemplateColumns: 'minmax(0, 1fr)',
  columnGap: '0',
})

export let listboxChangeEventType = 'rmx:selectable-listbox-change' as const

declare global {
  interface HTMLElementEventMap {
    [listboxChangeEventType]: ListboxChangeEvent
  }
}

type ListboxControllerEventMap = {
  change: Event
}

type RegisteredOption = {
  disabled: boolean
  id: string
  value: string
}

type ActiveOptionSource = 'keyboard' | 'selection'

type ListboxControllerInteractionResult = {
  optionValue: string | null
  selectedOptionValues: string[]
  selectionChanged: boolean
  stateChanged: boolean
}

type ListboxAccessibleNameProps =
  | { 'aria-label': string; 'aria-labelledby'?: string }
  | { 'aria-label'?: string; 'aria-labelledby': string }

type ListboxBaseProps = Omit<
  Props<'div'>,
  'aria-activedescendant' | 'aria-label' | 'aria-labelledby' | 'defaultValue' | 'role' | 'tabIndex' | 'value'
> &
  ListboxAccessibleNameProps & {
    children?: RemixNode
  }

export type ListboxSingleProps = ListboxBaseProps & {
  defaultValue?: string | null
  multiple?: false
  value?: string | null
}

export type ListboxMultipleProps = ListboxBaseProps & {
  defaultValue?: string[]
  multiple: true
  value?: string[]
}

export type ListboxProps = ListboxSingleProps | ListboxMultipleProps

export interface OptionProps extends Omit<Props<'div'>, 'id' | 'role' | 'value'> {
  disabled?: boolean
  value: string
}

export class ListboxChangeEvent extends Event {
  multiple: boolean
  optionValue: string | null
  value: string | null | string[]
  values: string[]

  constructor(values: string[], init: { multiple: boolean; optionValue: string | null }) {
    let normalizedValues = [...values]

    super(listboxChangeEventType, { bubbles: true })

    this.multiple = init.multiple
    this.optionValue = init.optionValue
    this.values = normalizedValues
    this.value = init.multiple ? normalizedValues : normalizedValues[0] ?? null
  }
}

function areArraysEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false
  }

  return left.every((value, index) => value === right[index])
}

function createNoopInteractionResult(
  selectedOptionValues: string[],
): ListboxControllerInteractionResult {
  return {
    optionValue: null,
    selectedOptionValues: [...selectedOptionValues],
    selectionChanged: false,
    stateChanged: false,
  }
}

function isMultipleListboxProps(props: ListboxProps): props is ListboxMultipleProps {
  return props.multiple === true
}

function isSelectionModifierPressed(event: KeyboardEvent | MouseEvent) {
  return event.metaKey || event.ctrlKey
}

function normalizeSelectedOptionValues(
  value: string | null | string[] | undefined,
  multiple: boolean,
) {
  let values = Array.isArray(value) ? value : value == null ? [] : [value]
  let normalizedValues = Array.from(new Set(values))

  return multiple ? normalizedValues : normalizedValues.slice(0, 1)
}

function dispatchListboxChange(
  target: HTMLElement,
  controller: ListboxController,
  interaction: ListboxControllerInteractionResult,
) {
  if (!interaction.selectionChanged) {
    return
  }

  target.dispatchEvent(
    new ListboxChangeEvent(interaction.selectedOptionValues, {
      multiple: controller.multiple,
      optionValue: interaction.optionValue,
    }),
  )
}

function getClosestListboxNode(node: HTMLElement) {
  let listboxNode = node.closest('[role="listbox"]')

  return listboxNode instanceof HTMLElement ? listboxNode : null
}

export class ListboxController extends TypedEventTarget<ListboxControllerEventMap> {
  #activeOptionId: string | null = null
  #activeOptionSource: ActiveOptionSource | null = null
  #controlled = false
  #multiple = false
  #options: RegisteredOption[] = []
  #selectedOptionValues: string[] = []
  #selectionAnchorValue: string | null = null

  get activeOptionId() {
    return this.#activeOptionId
  }

  get activeOptionSource() {
    return this.#activeOptionSource
  }

  get controlled() {
    return this.#controlled
  }

  get multiple() {
    return this.#multiple
  }

  get options() {
    return this.#options
  }

  get selectedOptionValues() {
    return this.#selectedOptionValues
  }

  get selectionAnchorValue() {
    return this.#selectionAnchorValue
  }

  configure(config: {
    controlled: boolean
    multiple: boolean
    selectedOptionValues: string[]
  }) {
    this.#controlled = config.controlled
    this.#multiple = config.multiple
    this.#selectedOptionValues = normalizeSelectedOptionValues(
      config.selectedOptionValues,
      config.multiple,
    )

    if (this.#selectionAnchorValue === null && this.#selectedOptionValues.length > 0) {
      this.#selectionAnchorValue = this.#selectedOptionValues[this.#selectedOptionValues.length - 1]
    }
  }

  notify() {
    this.dispatchEvent(new Event('change'))
  }

  registerOption(option: RegisteredOption) {
    this.#options.push(option)
  }

  resetOptions() {
    this.#options = []
  }

  ensureActiveOption() {
    let activeOption = this.#getEnabledOptionById(this.#activeOptionId)
    if (activeOption) {
      return createNoopInteractionResult(this.#selectedOptionValues)
    }

    let anchorOption = this.#getEnabledOptionByValue(this.#selectionAnchorValue)
    if (anchorOption) {
      return {
        optionValue: anchorOption.value,
        selectedOptionValues: [...this.#selectedOptionValues],
        selectionChanged: false,
        stateChanged: this.#setActiveOption(anchorOption, 'selection'),
      }
    }

    let selectedOption = this.#getFirstSelectedEnabledOption()
    if (selectedOption) {
      return {
        optionValue: selectedOption.value,
        selectedOptionValues: [...this.#selectedOptionValues],
        selectionChanged: false,
        stateChanged: this.#setActiveOption(selectedOption, 'selection'),
      }
    }

    return this.move('next')
  }

  isSelectedValue(value: string) {
    return this.#selectedOptionValues.includes(value)
  }

  move(direction: 'next' | 'previous', options: { extendSelection?: boolean } = {}) {
    let nextOption = this.#resolveStep(direction)
    if (!nextOption) {
      return createNoopInteractionResult(this.#selectedOptionValues)
    }

    if (options.extendSelection && this.#multiple) {
      let anchorOption =
        this.#getEnabledOptionByValue(this.#selectionAnchorValue) ??
        this.#getEnabledOptionById(this.#activeOptionId) ??
        nextOption

      return this.extendSelectionToOption(nextOption, {
        anchorValue: anchorOption.value,
        preserveExisting: false,
        source: 'keyboard',
      })
    }

    return {
      optionValue: nextOption.value,
      selectedOptionValues: [...this.#selectedOptionValues],
      selectionChanged: false,
      stateChanged: this.#setActiveOption(nextOption, 'keyboard'),
    }
  }

  selectActiveOption(source: ActiveOptionSource = 'keyboard') {
    let option = this.#getEnabledOptionById(this.#activeOptionId)
    if (!option) {
      return createNoopInteractionResult(this.#selectedOptionValues)
    }

    return this.selectOnlyOption(option, { source })
  }

  toggleActiveOptionSelection(source: ActiveOptionSource = 'keyboard') {
    let option = this.#getEnabledOptionById(this.#activeOptionId)
    if (!option) {
      return createNoopInteractionResult(this.#selectedOptionValues)
    }

    return this.toggleOptionSelection(option, { source })
  }

  selectOnlyOption(option: RegisteredOption, options: { source: ActiveOptionSource }) {
    return this.#applySelectionChange([option.value], {
      activeOption: option,
      activeOptionSource: options.source,
      optionValue: option.value,
      selectionAnchorValue: option.value,
    })
  }

  toggleOptionSelection(option: RegisteredOption, options: { source: ActiveOptionSource }) {
    if (!this.#multiple) {
      return this.selectOnlyOption(option, options)
    }

    let selectedOptionValues = this.isSelectedValue(option.value)
      ? this.#selectedOptionValues.filter((value) => value !== option.value)
      : [...this.#selectedOptionValues, option.value]

    return this.#applySelectionChange(selectedOptionValues, {
      activeOption: option,
      activeOptionSource: options.source,
      optionValue: option.value,
      selectionAnchorValue: option.value,
    })
  }

  extendSelectionToOption(
    option: RegisteredOption,
    options: {
      anchorValue?: string
      preserveExisting?: boolean
      source: ActiveOptionSource
    },
  ) {
    if (!this.#multiple) {
      return this.selectOnlyOption(option, options)
    }

    let anchorOption =
      this.#getEnabledOptionByValue(options.anchorValue ?? this.#selectionAnchorValue) ??
      this.#getEnabledOptionById(this.#activeOptionId) ??
      option

    let selectedOptionValues = this.#getEnabledRangeValues(anchorOption.value, option.value)

    if (options.preserveExisting) {
      selectedOptionValues = this.#mergeSelectedOptionValues(selectedOptionValues)
    }

    return this.#applySelectionChange(selectedOptionValues, {
      activeOption: option,
      activeOptionSource: options.source,
      optionValue: option.value,
      selectionAnchorValue: anchorOption.value,
    })
  }

  #applySelectionChange(
    nextSelectedOptionValues: string[],
    options: {
      activeOption?: RegisteredOption | null
      activeOptionSource?: ActiveOptionSource | null
      optionValue: string | null
      selectionAnchorValue?: string | null
    },
  ) {
    let normalizedValues = this.#sortSelectedOptionValues(nextSelectedOptionValues)
    let selectionChanged = !areArraysEqual(this.#selectedOptionValues, normalizedValues)
    let stateChanged = false

    if (selectionChanged && !this.#controlled) {
      stateChanged = this.#setSelectedOptionValues(normalizedValues) || stateChanged
    }

    if ('activeOption' in options) {
      stateChanged =
        this.#setActiveOption(
          options.activeOption ?? null,
          options.activeOption ? (options.activeOptionSource ?? 'selection') : null,
        ) || stateChanged
    }

    if ('selectionAnchorValue' in options) {
      stateChanged =
        this.#setSelectionAnchorValue(options.selectionAnchorValue ?? null) || stateChanged
    }

    return {
      optionValue: options.optionValue,
      selectedOptionValues: normalizedValues,
      selectionChanged,
      stateChanged,
    } satisfies ListboxControllerInteractionResult
  }

  #getEnabledOptionById(id: string | null) {
    if (id === null) {
      return null
    }

    return this.#options.find((option) => option.id === id && !option.disabled) ?? null
  }

  #getEnabledOptionByValue(value: string | null) {
    if (value === null) {
      return null
    }

    return this.#options.find((option) => option.value === value && !option.disabled) ?? null
  }

  #getEnabledOptions() {
    return this.#options.filter((option) => !option.disabled)
  }

  #getEnabledRangeValues(anchorValue: string, targetValue: string) {
    let enabledOptions = this.#getEnabledOptions()
    let anchorIndex = enabledOptions.findIndex((option) => option.value === anchorValue)
    let targetIndex = enabledOptions.findIndex((option) => option.value === targetValue)

    if (anchorIndex === -1 || targetIndex === -1) {
      return [targetValue]
    }

    let startIndex = Math.min(anchorIndex, targetIndex)
    let endIndex = Math.max(anchorIndex, targetIndex)

    return enabledOptions.slice(startIndex, endIndex + 1).map((option) => option.value)
  }

  #getFirstSelectedEnabledOption() {
    return this.#getEnabledOptions().find((option) => this.isSelectedValue(option.value)) ?? null
  }

  #mergeSelectedOptionValues(nextSelectedOptionValues: string[]) {
    return this.#sortSelectedOptionValues([
      ...this.#selectedOptionValues,
      ...nextSelectedOptionValues,
    ])
  }

  #resolveStep(direction: 'next' | 'previous') {
    let enabledOptions = this.#getEnabledOptions()
    if (enabledOptions.length === 0) {
      return null
    }

    if (this.#activeOptionId === null) {
      return direction === 'next' ? enabledOptions[0] : enabledOptions[enabledOptions.length - 1]
    }

    let activeIndex = enabledOptions.findIndex((option) => option.id === this.#activeOptionId)
    if (activeIndex === -1) {
      return direction === 'next' ? enabledOptions[0] : enabledOptions[enabledOptions.length - 1]
    }

    if (direction === 'next') {
      return enabledOptions[activeIndex + 1] ?? enabledOptions[activeIndex]
    }

    return enabledOptions[activeIndex - 1] ?? enabledOptions[activeIndex]
  }

  #setActiveOption(option: RegisteredOption | null, source: ActiveOptionSource | null) {
    let nextId = option?.id ?? null
    let nextSource = nextId === null ? null : source

    if (this.#activeOptionId === nextId && this.#activeOptionSource === nextSource) {
      return false
    }

    this.#activeOptionId = nextId
    this.#activeOptionSource = nextSource

    return true
  }

  #setSelectedOptionValues(selectedOptionValues: string[]) {
    if (areArraysEqual(this.#selectedOptionValues, selectedOptionValues)) {
      return false
    }

    this.#selectedOptionValues = selectedOptionValues

    return true
  }

  #setSelectionAnchorValue(selectionAnchorValue: string | null) {
    if (this.#selectionAnchorValue === selectionAnchorValue) {
      return false
    }

    this.#selectionAnchorValue = selectionAnchorValue

    return true
  }

  #sortSelectedOptionValues(selectedOptionValues: string[]) {
    let normalizedValues = normalizeSelectedOptionValues(selectedOptionValues, this.#multiple)
    let optionOrder = new Map(this.#options.map((option, index) => [option.value, index]))

    return [...normalizedValues].sort((left, right) => {
      let leftIndex = optionOrder.get(left)
      let rightIndex = optionOrder.get(right)

      if (leftIndex === undefined && rightIndex === undefined) {
        return 0
      }

      if (leftIndex === undefined) {
        return 1
      }

      if (rightIndex === undefined) {
        return -1
      }

      return leftIndex - rightIndex
    })
  }
}

function ListboxImpl(handle: Handle<ListboxController>) {
  let controller = new ListboxController()
  let hasInitializedDefaultValue = false

  handle.context.set(controller)
  controller.addEventListener('change', handle.update, { signal: handle.signal })

  return (props: ListboxProps) => {
    let { children, defaultValue, mix, value, ...domProps } = props
    let multiple = isMultipleListboxProps(props)
    let selectedOptionValues =
      value !== undefined
        ? normalizeSelectedOptionValues(value, multiple)
        : hasInitializedDefaultValue
          ? controller.selectedOptionValues
          : normalizeSelectedOptionValues(defaultValue, multiple)

    if (value === undefined && !hasInitializedDefaultValue) {
      hasInitializedDefaultValue = true
    }

    controller.resetOptions()
    controller.configure({
      controlled: value !== undefined,
      multiple,
      selectedOptionValues,
    })

    return (
      <div
        {...domProps}
        aria-activedescendant={controller.activeOptionId ?? undefined}
        aria-multiselectable={multiple ? true : undefined}
        role="listbox"
        tabIndex={0}
        mix={[
          ui.listbox.list,
          listboxStateStyles,
          on('focus', () => {
            let interaction = controller.ensureActiveOption()

            if (interaction.stateChanged) {
              controller.notify()
            }
          }),
          on('keydown', (event) => {
            switch (event.key) {
              case 'ArrowDown':
                event.preventDefault()
                {
                  let interaction = controller.move('next', {
                    extendSelection: controller.multiple && event.shiftKey,
                  })

                  dispatchListboxChange(event.currentTarget, controller, interaction)

                  if (interaction.stateChanged) {
                    controller.notify()
                  }
                }
                break
              case 'ArrowUp':
                event.preventDefault()
                {
                  let interaction = controller.move('previous', {
                    extendSelection: controller.multiple && event.shiftKey,
                  })

                  dispatchListboxChange(event.currentTarget, controller, interaction)

                  if (interaction.stateChanged) {
                    controller.notify()
                  }
                }
                break
              case 'Enter':
                event.preventDefault()
                {
                  let interaction = controller.selectActiveOption()

                  dispatchListboxChange(event.currentTarget, controller, interaction)

                  if (interaction.stateChanged) {
                    controller.notify()
                  }
                }
                break
              case ' ':
                event.preventDefault()
                {
                  let interaction = controller.multiple
                    ? controller.toggleActiveOptionSelection()
                    : controller.selectActiveOption()

                  dispatchListboxChange(event.currentTarget, controller, interaction)

                  if (interaction.stateChanged) {
                    controller.notify()
                  }
                }
                break
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

type ListboxComponent = typeof ListboxImpl & {
  readonly change: typeof listboxChangeEventType
}

export let Listbox = Object.assign(ListboxImpl, {
  change: listboxChangeEventType,
}) as ListboxComponent

export function Option(handle: Handle) {
  let controller = handle.context.get(Listbox)
  if (!controller) {
    throw new Error('Option must be rendered inside Listbox')
  }

  let staticOption = true

  controller.addEventListener(
    'change',
    () => {
      void handle.update()
    },
    { signal: handle.signal },
  )

  return (props: OptionProps) => {
    let { children, disabled, mix, value, ...domProps } = props
    let option = {
      disabled: disabled === true,
      id: handle.id,
      value,
    } satisfies RegisteredOption

    controller.registerOption(option)

    let highlighted = controller.activeOptionId === option.id
    let keyboardActive = highlighted && controller.activeOptionSource === 'keyboard'
    let selected = controller.isSelectedValue(option.value)

    return (
      <div
        {...domProps}
        aria-disabled={option.disabled ? true : undefined}
        data-highlighted={highlighted ? 'true' : 'false'}
        data-keyboard-active={keyboardActive ? 'true' : undefined}
        aria-selected={selected ? 'true' : 'false'}
        id={option.id}
        role="option"
        tabIndex={-1}
        mix={[
          ui.listbox.option,
          optionStateStyles,
          staticOption ? staticOptionStyles : undefined,
          on('pointerdown', (event) => {
            if (event.button !== 0 || option.disabled) {
              return
            }

            event.preventDefault()

            let listboxNode = getClosestListboxNode(event.currentTarget)

            let interaction =
              controller.multiple && event.shiftKey
                ? controller.extendSelectionToOption(option, {
                    preserveExisting: isSelectionModifierPressed(event),
                    source: 'selection',
                  })
                : controller.multiple && isSelectionModifierPressed(event)
                  ? controller.toggleOptionSelection(option, { source: 'selection' })
                  : controller.selectOnlyOption(option, { source: 'selection' })

            listboxNode?.focus()
            dispatchListboxChange(event.currentTarget, controller, interaction)

            if (interaction.stateChanged) {
              controller.notify()
            }
          }),
          mix,
        ]}
      >
        {!staticOption ? <Glyph mix={ui.listbox.optionIndicator} name="check" /> : null}
        <span mix={ui.listbox.optionLabel}>{children}</span>
      </div>
    )
  }
}
