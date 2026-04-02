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
import { waitForCssTransition } from '../utils/wait-for-css-transition.ts'

type SelectControllerEventMap = {
  change: Event
}

type RegisteredOption = {
  readonly id: string
  get disabled(): boolean
  get label(): string
  get node(): HTMLElement
  get value(): string
}

type SelectChangeDispatchOptions = {
  flash?: boolean
  signal?: AbortSignal
}

type SelectComponent = typeof SelectImpl & {
  readonly change: typeof selectChangeEventType
}

export type SelectCloseRequestReason = 'dismiss' | 'escape' | 'outside-press'
export type SelectContextProps = {
  children?: RemixNode
  defaultValue?: string | null
  disabled?: boolean
  name?: string
  ref?: (handle: SelectHandle) => void
}
export type SelectHandle = {
  readonly activeOptionId: string | null
  readonly id: string
  readonly isOpen: boolean
  readonly label: string | null
  readonly value: string | null
  close(options?: { returnFocus?: boolean }): void
  open(strategy?: SelectOpenStrategy, options?: { focus?: boolean }): Promise<void>
  requestClose(reason: SelectCloseRequestReason, options?: { returnFocus?: boolean }): void
}
export type SelectOpenStrategy = 'selected' | 'first' | 'last'
export type SelectOptionOptions = {
  disabled?: boolean
  label: string
  value: string
}
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

let selectionFlashDurationMs = 60
let labelCommitDelayMs = 50
let pointerSelectionGuardMs = 300
let activeOptionAnchorSelector = '[role="option"][data-highlighted="true"]'

export const selectChangeEventType = 'rmx:select-change' as const
export const selectCloseRequestEventType = 'rmx:select-closerequest' as const

declare global {
  interface HTMLElementEventMap {
    [selectChangeEventType]: SelectChangeEvent
    [selectCloseRequestEventType]: SelectCloseRequestEvent
  }
}

export class SelectChangeEvent extends Event {
  readonly label: string
  readonly optionId: string
  readonly value: string

  constructor({ label, optionId, value }: { label: string; optionId: string; value: string }) {
    super(selectChangeEventType, { bubbles: true })
    this.label = label
    this.optionId = optionId
    this.value = value
  }
}

export class SelectCloseRequestEvent extends Event {
  readonly reason: SelectCloseRequestReason
  readonly returnFocus: boolean
  readonly trigger: HTMLElement | null

  constructor({
    reason,
    returnFocus,
    trigger,
  }: {
    reason: SelectCloseRequestReason
    returnFocus: boolean
    trigger: HTMLElement | null
  }) {
    super(selectCloseRequestEventType, { bubbles: true, cancelable: true })
    this.reason = reason
    this.returnFocus = returnFocus
    this.trigger = trigger
  }
}

class SelectController extends TypedEventTarget<SelectControllerEventMap> {
  #activeOptionId: string | null = null
  #button: HTMLElement | null = null
  #cleanupAnchor = () => {}
  #defaultSurfaceId: string
  #disabled = false
  #guardPointerSelectionAfterOpen = false
  #guardPointerSelectionOptionId: string | null = null
  #list: HTMLElement | null = null
  #name: string | undefined = undefined
  #open = false
  #openedAt = 0
  #options = new Map<string, RegisteredOption>()
  #pendingSelectionChange: {
    label: string
    optionId: string
    value: string
  } | null = null
  #returnFocusOnClose = true
  #selectedOptionId: string | null = null
  #selectionFeedbackActive = false
  #surface: HTMLElement | null = null
  #surfaceId: string
  #surfaceSignal: AbortSignal | null = null
  #transitionId = 0
  #update: () => Promise<AbortSignal>
  #value: string | null = null

  constructor(id: string, update: () => Promise<AbortSignal>) {
    super()
    this.#defaultSurfaceId = `${id}-select`
    this.#surfaceId = this.#defaultSurfaceId
    this.#update = update
  }

  get activeOptionId() {
    return this.#activeOptionId
  }

  get id() {
    return this.#surfaceId
  }

  get isOpen() {
    return this.#open
  }

  get isSelectionFeedbackActive() {
    return this.#selectionFeedbackActive
  }

  get hasSelectedOption() {
    return this.#getSelectedOption() !== null
  }

  get label() {
    return this.#getSelectedOption()?.label ?? null
  }

  get name() {
    return this.#name
  }

  get value() {
    return this.#value
  }

  activateOption(optionId: string) {
    let option = this.#options.get(optionId)
    if (!option || option.disabled) {
      return
    }

    if (this.#guardPointerSelectionAfterOpen && option.id !== this.#guardPointerSelectionOptionId) {
      this.#guardPointerSelectionAfterOpen = false
      this.#guardPointerSelectionOptionId = null
      this.#openedAt = 0
    }

    if (!this.#setActiveOptionId(option.id)) {
      return
    }

    this.#notify()
  }

  shouldAcceptPointerSelection() {
    return (
      !this.#guardPointerSelectionAfterOpen ||
      Date.now() - this.#openedAt >= pointerSelectionGuardMs
    )
  }

  async open(
    strategy: SelectOpenStrategy = 'selected',
    {
      focus = true,
      guardPointerSelection = false,
    }: { focus?: boolean; guardPointerSelection?: boolean } = {},
  ) {
    if (this.#disabled || this.#selectionFeedbackActive) {
      return
    }

    let surface = this.#surface
    let trigger = this.#button
    if (!surface || !trigger) {
      return
    }

    let option = this.#resolveOpenOption(strategy)
    let activeChanged = this.#setActiveOptionId(option?.id ?? null)
    if (activeChanged) {
      this.#notify()
      let signal = await this.#update()
      if (signal.aborted) {
        return
      }
    }

    if (!this.#open) {
      this.#openedAt = Date.now()
      this.#guardPointerSelectionAfterOpen = guardPointerSelection
      this.#guardPointerSelectionOptionId = guardPointerSelection ? (option?.id ?? null) : null
      this.#syncMinWidth()
      surface.showPopover()
      this.#open = true
      this.#syncAnchor()
      this.#notify()
    }

    if (focus) {
      this.#list?.focus()
    }
  }

  focusNext() {
    let options = this.#getEnabledOptions()
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

  focusOnEntry() {
    let activeOption = this.#getActiveOption()
    if (activeOption && !activeOption.disabled) {
      return
    }

    let option = this.#resolveOpenOption('selected')
    if (!this.#setActiveOptionId(option?.id ?? null)) {
      return
    }

    this.#notify()
  }

  focusList() {
    this.#list?.focus()
  }

  focusFirst() {
    let option = this.#getEnabledOptions()[0]
    if (!option) {
      return
    }

    if (!this.#setActiveOptionId(option.id)) {
      return
    }

    this.#notify()
  }

  clearActiveOption() {
    if (!this.#setActiveOptionId(null)) {
      return
    }

    this.#notify()
  }

  focusPrevious() {
    let options = this.#getEnabledOptions()
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

  hide({ returnFocus = true }: { returnFocus?: boolean } = {}) {
    let surface = this.#surface
    if (!surface) {
      return
    }

    if (!this.#open && !surface.matches(':popover-open')) {
      return
    }

    this.#returnFocusOnClose = returnFocus
    surface.hidePopover()
  }

  isSelected(optionId: string) {
    return this.#selectedOptionId === optionId
  }

  registerButton(node: HTMLElement) {
    this.#button = node
  }

  registerList(node: HTMLElement) {
    this.#list = node
  }

  registerOption(option: RegisteredOption) {
    this.#options.set(option.id, option)

    let nextSelectedOptionId = this.#getOptionIdForValue(this.#value)
    if (this.#selectedOptionId === nextSelectedOptionId) {
      return
    }

    this.#selectedOptionId = nextSelectedOptionId
    this.#notify()
  }

  registerSurface(node: HTMLElement, signal: AbortSignal) {
    this.#surface = node
    this.#surfaceSignal = signal
    this.setSurfaceId(node.id || this.#defaultSurfaceId)
  }

  requestHide(
    reason: SelectCloseRequestReason,
    { returnFocus = true }: { returnFocus?: boolean } = {},
  ) {
    let surface = this.#surface
    if (!surface) {
      return
    }

    if (!this.#open && !surface.matches(':popover-open')) {
      return
    }

    let event = new SelectCloseRequestEvent({
      reason,
      returnFocus,
      trigger: this.#button,
    })

    if (this.#selectionFeedbackActive) {
      event.preventDefault()
    }

    if (!surface.dispatchEvent(event)) {
      return
    }

    this.hide({ returnFocus })
  }

  async selectActive(options: SelectChangeDispatchOptions = {}) {
    if (!this.#activeOptionId) {
      this.focusOnEntry()
    }

    if (!this.#activeOptionId) {
      return
    }

    await this.selectOption(this.#activeOptionId, options)
  }

  async selectOption(optionId: string, { flash = true, signal }: SelectChangeDispatchOptions = {}) {
    if (signal?.aborted || this.#selectionFeedbackActive) {
      return
    }

    let option = this.#options.get(optionId)
    if (!option || option.disabled) {
      return
    }

    let activeChanged = this.#setActiveOptionId(option.id)
    let selectionChanged = this.#value !== option.value

    this.#value = option.value
    this.#selectedOptionId = option.id

    if (activeChanged || selectionChanged) {
      this.#notify()
    }

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

    if (!selectionChanged) {
      this.hide()
      return
    }

    this.#pendingSelectionChange = {
      label: option.label,
      optionId: option.id,
      value: option.value,
    }
    this.hide()
  }

  setDisabled(disabled: boolean) {
    this.#disabled = disabled
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
    this.#notify()
  }

  handleBeforeToggle(node: HTMLElement, nextState: string) {
    this.#surface = node

    if (nextState === 'open' || !this.#open) {
      return
    }

    this.#guardPointerSelectionAfterOpen = false
    this.#guardPointerSelectionOptionId = null
    this.#open = false
    this.#openedAt = 0
    this.#cleanupAnchor()
    this.#cleanupAnchor = () => {}

    let returnFocus = this.#returnFocusOnClose
    this.#returnFocusOnClose = true

    let trigger = this.#button
    let transitionId = ++this.#transitionId
    this.#notify()
    void this.#handleCloseEndAfterTransition(node, trigger, returnFocus, transitionId)
  }

  unregisterButton(node: HTMLElement) {
    if (this.#button !== node) {
      return
    }

    this.#button = null
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

    let nextActiveOptionId = this.#activeOptionId
    if (nextActiveOptionId === optionId) {
      nextActiveOptionId = this.#resolveOpenOption('selected')?.id ?? null
    }

    let nextSelectedOptionId = this.#getOptionIdForValue(this.#value)
    if (
      this.#activeOptionId === nextActiveOptionId &&
      this.#selectedOptionId === nextSelectedOptionId
    ) {
      return
    }

    this.#activeOptionId = nextActiveOptionId
    this.#selectedOptionId = nextSelectedOptionId
    this.#notify()
  }

  unregisterSurface(node: HTMLElement) {
    if (this.#surface !== node) {
      return
    }

    this.#cleanupAnchor()
    this.#cleanupAnchor = () => {}
    this.#list = null
    this.#open = false
    this.#pendingSelectionChange = null
    this.#surface = null
    this.#surfaceId = this.#defaultSurfaceId
    this.#surfaceSignal = null
    this.#notify()
  }

  #dispatchPendingSelectionChange() {
    let pendingSelectionChange = this.#pendingSelectionChange
    if (!pendingSelectionChange) {
      return
    }

    this.#pendingSelectionChange = null
    let target = this.#list ?? this.#surface
    target?.dispatchEvent(
      new SelectChangeEvent({
        label: pendingSelectionChange.label,
        optionId: pendingSelectionChange.optionId,
        value: pendingSelectionChange.value,
      }),
    )
  }

  #getActiveOption() {
    return this.#activeOptionId ? (this.#options.get(this.#activeOptionId) ?? null) : null
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

  async #handleCloseEndAfterTransition(
    surface: HTMLElement,
    trigger: HTMLElement | null,
    returnFocus: boolean,
    transitionId: number,
  ) {
    let signal = this.#surfaceSignal
    if (signal) {
      await waitForCssTransition(surface, signal, () => {})
    }

    if (transitionId !== this.#transitionId || this.#open || !surface.isConnected) {
      return
    }

    if (returnFocus && trigger?.isConnected) {
      trigger.focus()
    }

    this.#dispatchPendingSelectionChange()
  }

  #notify() {
    this.dispatchEvent(new Event('change'))
  }

  #resolveOpenOption(strategy: SelectOpenStrategy) {
    let options = this.#getEnabledOptions()
    if (options.length === 0) {
      return null
    }

    if (strategy === 'selected') {
      let selectedOption = this.#getSelectedOption()
      if (selectedOption && !selectedOption.disabled) {
        return selectedOption
      }

      return options[0]
    }

    if (strategy === 'last') {
      return options.at(-1) ?? null
    }

    return options[0]
  }

  #setActiveOptionId(optionId: string | null) {
    if (this.#activeOptionId === optionId) {
      return false
    }

    this.#activeOptionId = optionId
    return true
  }

  #syncAnchor() {
    let surface = this.#surface
    let trigger = this.#button
    if (!surface || !trigger) {
      return
    }

    this.#cleanupAnchor()
    this.#cleanupAnchor = anchor(surface, trigger, {
      inset: true,
      placement: 'left',
      relativeTo: activeOptionAnchorSelector,
    })
  }

  #syncMinWidth() {
    let surface = this.#surface
    let trigger = this.#button
    if (!surface || !trigger) {
      return
    }

    let width = trigger.offsetWidth
    if (width <= 0) {
      return
    }

    surface.style.minWidth = `${width}px`
  }
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

function SelectContext(handle: Handle<SelectController>) {
  let controller = new SelectController(handle.id, handle.update)
  let hasInitializedValue = false
  let publicHandle: SelectHandle = {
    get activeOptionId() {
      return controller.activeOptionId
    },
    get id() {
      return controller.id
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
      controller.hide(options)
    },
    open(strategy, options) {
      return controller.open(strategy, options)
    },
    requestClose(reason, options) {
      controller.requestHide(reason, options)
    },
  }

  return (props: SelectContextProps) => {
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

function getSelectController(handle: Handle | MixinHandle) {
  let controller = handle.context.get(SelectContext)
  if (!(controller instanceof SelectController)) {
    throw new Error('Select roles must be used inside select.context')
  }

  return controller
}

let selectButtonMixin = createMixin<HTMLElement, [], ElementProps>((handle, hostType) => {
  let controller = getSelectController(handle)
  controller.addEventListener('change', () => handle.update(), { signal: handle.signal })

  return () => {
    let nextProps: ElementProps = {
      'aria-controls': controller.id,
      'aria-expanded': controller.isOpen ? true : false,
      'aria-haspopup': 'listbox',
      'aria-label': controller.label,
    }

    if (hostType === 'button') {
      nextProps.type = 'button'
    }

    return [
      attrs(nextProps),
      ref((node: HTMLElement, signal) => {
        controller.registerButton(node)
        signal.addEventListener('abort', () => {
          controller.unregisterButton(node)
        })
      }),
      press(),
      on(press.down, (event) => {
        if (event.defaultPrevented || event.pointerType === 'virtual') {
          return
        }

        event.preventDefault()
        void controller.open('selected', {
          guardPointerSelection: event.pointerType !== 'keyboard',
        })
      }),
      on(press.press, (event) => {
        if (event.defaultPrevented || event.pointerType !== 'virtual') {
          return
        }

        event.preventDefault()
        void controller.open('selected')
      }),
      on('keydown', (event) => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
          return
        }

        event.preventDefault()
        if (controller.isOpen) {
          controller.focusList()
          if (event.key === 'ArrowDown') {
            controller.focusNext()
          } else {
            controller.focusPrevious()
          }
          return
        }

        let strategy: SelectOpenStrategy = controller.hasSelectedOption
          ? 'selected'
          : event.key === 'ArrowDown'
            ? 'first'
            : 'last'
        void controller.open(strategy)
      }),
    ]
  }
})

let selectPopoverMixin = createMixin<HTMLElement, [], ElementProps>((handle) => {
  let controller = getSelectController(handle)
  controller.addEventListener('change', () => handle.update(), { signal: handle.signal })

  return (props) => {
    let id = props.id ?? controller.id
    controller.setSurfaceId(id)

    return [
      attrs({ id, popover: 'manual' }),
      ref((node: HTMLElement, signal) => {
        controller.registerSurface(node, signal)
        signal.addEventListener('abort', () => {
          controller.unregisterSurface(node)
        })
      }),
      on('beforetoggle', (event) => {
        controller.handleBeforeToggle(event.currentTarget as HTMLElement, event.newState)
      }),
      on('keydown', (event) => {
        if (event.key !== 'Escape') {
          return
        }

        event.preventDefault()
        controller.requestHide('escape')
      }),
      onOutsidePress((event) => {
        if (!controller.isOpen) {
          return
        }

        event.stopPropagation()
        controller.requestHide('outside-press')
      }),
    ]
  }
})

let selectListMixin = createMixin<HTMLElement, [], ElementProps>((handle) => {
  let controller = getSelectController(handle)
  controller.addEventListener('change', () => handle.update(), { signal: handle.signal })

  return (props) => [
    attrs({
      'aria-activedescendant': controller.activeOptionId ?? undefined,
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
    on('pointerleave', () => {
      controller.clearActiveOption()
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
        case 'Tab':
          event.preventDefault()
          controller.focusFirst()
          return
        case 'Enter':
        case ' ':
          if (event.repeat) {
            return
          }
          event.preventDefault()
          void controller.selectActive({ flash: true, signal })
          return
      }
    }),
  ]
})

let selectHiddenInputMixin = createMixin<HTMLInputElement, [], ElementProps>((handle) => {
  let controller = getSelectController(handle)
  controller.addEventListener('change', () => handle.update(), { signal: handle.signal })

  return () => attrs({ name: controller.name, type: 'hidden', value: controller.value ?? '' })
})

let selectOptionMixin = createMixin<HTMLElement, [options: SelectOptionOptions], ElementProps>(
  (handle) => {
    let controller = getSelectController(handle)
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

      return [
        attrs({
          'aria-disabled': currentDisabled ? true : undefined,
          'aria-selected': controller.isSelected(option.id) ? true : false,
          'data-highlighted': controller.activeOptionId === option.id ? 'true' : 'false',
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
            controller.activateOption(option.id)
          }),
          on('pointermove', () => {
            controller.activateOption(option.id)
          }),
          on(press.up, (event, signal) => {
            if (event.pointerType === 'virtual' || !controller.shouldAcceptPointerSelection()) {
              return
            }

            void controller.selectOption(option.id, { flash: true, signal })
          }),
          on(press.press, (event, signal) => {
            if (event.pointerType !== 'virtual') {
              return
            }

            void controller.selectOption(option.id, { flash: true, signal })
          }),
        ],
      ]
    }
  },
)

type SelectApi = {
  readonly button: typeof selectButtonMixin
  readonly change: typeof selectChangeEventType
  readonly closerequest: typeof selectCloseRequestEventType
  readonly context: typeof SelectContext
  readonly hiddenInput: typeof selectHiddenInputMixin
  readonly list: typeof selectListMixin
  readonly option: typeof selectOptionMixin
  readonly popover: typeof selectPopoverMixin
}

export let select: SelectApi = {
  button: selectButtonMixin,
  change: selectChangeEventType,
  closerequest: selectCloseRequestEventType,
  context: SelectContext,
  hiddenInput: selectHiddenInputMixin,
  list: selectListMixin,
  option: selectOptionMixin,
  popover: selectPopoverMixin,
}

function SelectImpl(handle: Handle) {
  let controller: SelectHandle | null = null
  let displayedLabel: string | null = null
  let triggerId = `${handle.id}-trigger`

  return (props: SelectProps) => {
    let { children, defaultValue, disabled, initialLabel, name, ...divProps } = props

    return (
      <select.context
        defaultValue={defaultValue}
        disabled={disabled}
        name={name}
        ref={(nextController) => {
          controller = nextController
        }}
      >
        <div {...divProps}>
          <button disabled={disabled} id={triggerId} mix={[ui.button.select, select.button()]}>
            <span mix={ui.button.label}>{displayedLabel ?? initialLabel}</span>
            <Glyph mix={ui.button.icon} name="chevronDown" />
          </button>

          <div
            mix={[
              select.popover(),
              ui.popover.surface,
              on(select.change, async (_event, signal) => {
                await wait(labelCommitDelayMs)
                if (signal.aborted) {
                  return
                }

                displayedLabel = controller?.label ?? null
                void handle.update()
              }),
            ]}
          >
            <div aria-labelledby={triggerId} mix={[select.list(), ui.listbox.surface]}>
              {children}
            </div>
          </div>
          {name && <input disabled={disabled} mix={select.hiddenInput()} />}
        </div>
      </select.context>
    )
  }
}

export let Select: SelectComponent = Object.assign(SelectImpl, {
  change: select.change,
})

export function Option() {
  return (props: OptionProps) => {
    let { children, disabled, label, mix, value, ...divProps } = props

    return (
      <div {...divProps} mix={[select.option({ disabled, label, value }), ui.listbox.option, mix]}>
        <Glyph mix={ui.listbox.glyph} name="check" />
        <span mix={ui.listbox.label}>{children ?? label}</span>
      </div>
    )
  }
}
