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

export type SelectContextProps = {
  children?: RemixNode
  defaultValue?: string | null
  initialLabel: string
}

export type SelectChangeEvent = ListboxEvent

type SelectControllerEventMap = {
  change: Event
}

type RegisteredSelectOption = {
  readonly id: string
  get label(): string
  get node(): HTMLElement | null
  get value(): string
}

type SelectboxApi = {
  readonly button: typeof selectButtonMixin
  readonly change: typeof listbox.change
  readonly context: typeof SelectContext
  readonly hiddenInput: typeof selectHiddenInputMixin
  readonly surface: typeof selectSurfaceMixin
}

type SelectComponent = typeof SelectImpl & {
  readonly change: typeof listbox.change
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

let selectedOptionAnchorSelector = '[role="option"][aria-selected="true"]'

export class SelectController extends TypedEventTarget<SelectControllerEventMap> {
  #button: HTMLElement | null = null
  #hasInitializedValue = false
  #initialLabel = ''
  #options = new Map<string, RegisteredSelectOption>()
  #pendingSelectedValue: string | null = null
  #selectedValue: string | null = null
  #selecting = false
  #surface: HTMLElement | null = null
  #triggerId: string

  constructor(id: string) {
    super()
    this.#triggerId = `${id}-trigger`
  }

  get label() {
    return this.#getOptionForValue(this.#selectedValue)?.label ?? this.#initialLabel
  }

  get isSelecting() {
    return this.#selecting
  }

  get selectedValue() {
    return this.#selectedValue
  }

  get triggerId() {
    return this.#triggerId
  }

  get values() {
    return this.#selectedValue === null ? [] : [this.#selectedValue]
  }

  syncProps(props: Pick<SelectContextProps, 'defaultValue' | 'initialLabel'>) {
    this.#initialLabel = props.initialLabel

    if (!this.#hasInitializedValue) {
      this.#selectedValue = props.defaultValue ?? null
      this.#hasInitializedValue = true
    }
  }

  registerButton(node: HTMLElement) {
    this.#button = node
  }

  unregisterButton(node: HTMLElement) {
    if (this.#button === node) {
      this.#button = null
    }
  }

  registerOption(option: RegisteredSelectOption) {
    let previousLabel = this.label
    this.#options.set(option.id, option)
    if (this.label !== previousLabel) {
      this.#notify()
    }
  }

  unregisterOption(optionId: string) {
    let previousLabel = this.label
    this.#options.delete(optionId)
    if (this.label !== previousLabel) {
      this.#notify()
    }
  }

  registerSurface(node: HTMLElement) {
    this.#surface = node
  }

  unregisterSurface(node: HTMLElement) {
    if (this.#surface === node) {
      this.#surface = null
    }
  }

  async select(value: string | null) {
    if (this.#selecting) {
      return
    }

    this.#selecting = true
    let nextValue = value || null
    this.#pendingSelectedValue = nextValue

    try {
      let selectedNode = this.#getOptionForValue(nextValue)?.node
      if (selectedNode) {
        await flashAttribute(selectedNode, 'data-flash', 60)
      }

      if (this.#surface?.matches(':popover-open')) {
        this.#surface.hidePopover()
        return
      }
    } catch (error) {
      this.#pendingSelectedValue = null
      this.#selecting = false
      throw error
    }
  }

  async handleCloseEnd(signal?: AbortSignal) {
    if (!this.#selecting) {
      return
    }

    let nextValue = this.#pendingSelectedValue

    try {
      await wait(50)
      if (signal?.aborted) {
        return
      }

      this.#setSelectedValue(nextValue)
    } finally {
      this.#pendingSelectedValue = null
      this.#selecting = false
    }
  }

  #setSelectedValue(value: string | null) {
    let nextValue = value || null
    if (this.#selectedValue === nextValue) {
      return
    }

    this.#selectedValue = nextValue
    this.#notify()
  }

  handleSurfaceBeforeToggle(nextState: string) {
    if (nextState === 'open') {
      this.syncPopoverMinWidth()
    }
  }

  syncPopoverMinWidth() {
    if (!this.#button || !this.#surface) {
      return
    }

    let width = this.#button.offsetWidth || this.#button.getBoundingClientRect().width
    if (width <= 0) {
      return
    }

    this.#surface.style.minWidth = `${width}px`
  }

  #getOptionForValue(value: string | null) {
    if (value === null) {
      return null
    }

    for (let option of this.#options.values()) {
      if (option.value === value) {
        return option
      }
    }

    return null
  }

  #notify() {
    this.dispatchEvent(new Event('change'))
  }
}

function SelectContext(handle: Handle<SelectController>) {
  let controller = new SelectController(handle.id)

  return (props: SelectContextProps) => {
    controller.syncProps(props)
    handle.context.set(controller)

    return (
      <popover.context>
        <listbox.context values={controller.values}>{props.children}</listbox.context>
      </popover.context>
    )
  }
}

function getSelectController(handle: Handle | MixinHandle) {
  let controller = handle.context.get(SelectContext)
  if (!(controller instanceof SelectController)) {
    throw new Error('Select roles must be used inside selectbox.context')
  }

  return controller
}

let selectButtonMixin = createMixin<HTMLElement, [], ElementProps>((handle) => {
  let controller = getSelectController(handle)

  return () => [
    attrs({ id: controller.triggerId }),
    ref((node: HTMLElement, signal) => {
      controller.registerButton(node)
      signal.addEventListener('abort', () => {
        controller.unregisterButton(node)
      })
    }),
    popover.button({
      inset: true,
      placement: 'left',
      relativeTo: selectedOptionAnchorSelector,
    }),
  ]
})

let selectSurfaceMixin = createMixin<HTMLElement, [], ElementProps>((handle) => {
  let controller = getSelectController(handle)

  return () => [
    popover.surface(),
    listbox.list(),
    popover.initialFocus(),
    attrs({ 'aria-labelledby': controller.triggerId }),
    on(popover.closerequest, (event) => {
      if (controller.isSelecting) {
        event.preventDefault()
      }
    }),
    on(popover.closeend, (_event, signal) => {
      void controller.handleCloseEnd(signal)
    }),
    on('beforetoggle', (event) => {
      controller.handleSurfaceBeforeToggle(event.newState)
    }),
    ref((node: HTMLElement, signal) => {
      controller.registerSurface(node)
      signal.addEventListener('abort', () => {
        controller.unregisterSurface(node)
      })
    }),
    on(listbox.change, (event) => {
      void controller.select(event.value)
    }),
  ]
})

let selectHiddenInputMixin = createMixin<HTMLInputElement, [], ElementProps>((handle, hostType) => {
  let controller = getSelectController(handle)
  controller.addEventListener(
    'change',
    () => {
      void handle.update()
    },
    { signal: handle.signal },
  )

  return () => {
    let nextProps: ElementProps = {
      value: controller.selectedValue ?? '',
    }

    if (hostType === 'input') {
      nextProps.type = 'hidden'
    }

    return [attrs(nextProps)]
  }
})

let selectOptionRegistrationMixin = createMixin<
  HTMLElement,
  [option: Pick<OptionProps, 'label' | 'value'>],
  ElementProps
>((handle) => {
  let controller = getSelectController(handle)
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

  return (nextOption) => {
    currentLabel = nextOption.label
    currentValue = nextOption.value

    return [
      ref((nextNode: HTMLElement, signal) => {
        node = nextNode
        controller.registerOption(option)
        signal.addEventListener('abort', () => {
          controller.unregisterOption(option.id)
        })
      }),
    ]
  }
})

export let selectbox: SelectboxApi = {
  button: selectButtonMixin,
  change: listbox.change,
  context: SelectContext,
  hiddenInput: selectHiddenInputMixin,
  surface: selectSurfaceMixin,
}

function SelectButtonLabel(handle: Handle) {
  let controller = getSelectController(handle)
  controller.addEventListener(
    'change',
    () => {
      void handle.update()
    },
    { signal: handle.signal },
  )

  return () => <span mix={ui.button.label}>{controller.label}</span>
}

function SelectImpl() {
  return (props: SelectProps) => {
    let { children, defaultValue, disabled, initialLabel, name, ...divProps } = props

    return (
      <selectbox.context defaultValue={defaultValue} initialLabel={initialLabel}>
        <div {...divProps}>
          {name ? <input disabled={disabled} name={name} mix={selectbox.hiddenInput()} /> : null}

          <button disabled={disabled} mix={[selectbox.button(), ui.button.select]}>
            <SelectButtonLabel />
            <Glyph mix={ui.button.icon} name="chevronDown" />
          </button>

          <div mix={[selectbox.surface(), ui.popover.surface, ui.listbox.surface]}>{children}</div>
        </div>
      </selectbox.context>
    )
  }
}

export let Select: SelectComponent = Object.assign(SelectImpl, {
  change: selectbox.change,
})

export function Option() {
  return (props: OptionProps) => {
    let { children, disabled, label, mix, value, ...divProps } = props

    return (
      <div
        {...divProps}
        mix={[
          selectOptionRegistrationMixin({ label, value }),
          listbox.option({ disabled, value }),
          ui.listbox.option,
          mix,
        ]}
      >
        <Glyph mix={ui.listbox.glyph} name="check" />
        <span mix={ui.listbox.label}>{children ?? label}</span>
      </div>
    )
  }
}
