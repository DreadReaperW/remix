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

import { anchor, type AnchorOptions } from '../anchor/anchor.ts'

type PopoverModelEventMap = {
  change: Event
}

type PopoverButtonRegistration = {
  node: HTMLElement
  get options(): AnchorOptions
}

type PopoverContextProps = {
  children?: RemixNode
}

export const popoverChangeEventType = 'rmx:popover-change' as const

declare global {
  interface HTMLElementEventMap {
    [popoverChangeEventType]: PopoverChangeEvent
  }
}

export class PopoverChangeEvent extends Event {
  readonly open: boolean
  readonly opener: HTMLElement | null

  constructor(open: boolean, opener: HTMLElement | null) {
    super(popoverChangeEventType, { bubbles: true })
    this.open = open
    this.opener = opener
  }
}

export class PopoverModel extends TypedEventTarget<PopoverModelEventMap> {
  #cleanupAnchor = () => {}
  #currentOpener: PopoverButtonRegistration | null = null
  #defaultSurfaceId: string
  #open = false
  #openFocusTarget: HTMLElement | null = null
  #surface: HTMLElement | null = null
  #surfaceId: string

  constructor(id: string) {
    super()
    this.#defaultSurfaceId = `${id}-popover`
    this.#surfaceId = this.#defaultSurfaceId
  }

  get id() {
    return this.#surfaceId
  }

  get isOpen() {
    return this.#open
  }

  get opener() {
    return this.#currentOpener?.node ?? null
  }

  setSurfaceId(id: string) {
    if (this.#surfaceId === id) {
      return
    }

    this.#surfaceId = id
    this.#notify()
  }

  unregisterButton(button: PopoverButtonRegistration) {
    if (this.#currentOpener !== button) {
      return
    }

    this.#currentOpener = null
    this.#cleanupAnchor()
    this.#cleanupAnchor = () => {}
    this.#notify()
  }

  registerSurface(node: HTMLElement) {
    this.#surface = node
    this.setSurfaceId(node.id || this.#defaultSurfaceId)
  }

  unregisterSurface(node: HTMLElement) {
    if (this.#surface !== node) {
      return
    }

    this.#surface = null
    this.#open = false
    this.#cleanupAnchor()
    this.#cleanupAnchor = () => {}
    this.#surfaceId = this.#defaultSurfaceId
    this.#notify()
  }

  registerOpenFocusTarget(node: HTMLElement) {
    this.#openFocusTarget = node
  }

  unregisterOpenFocusTarget(node: HTMLElement) {
    if (this.#openFocusTarget !== node) {
      return
    }

    this.#openFocusTarget = null
  }

  toggle(button: PopoverButtonRegistration) {
    if (this.#open && this.#currentOpener === button) {
      this.hide()
      return
    }

    this.open(button)
  }

  open(button: PopoverButtonRegistration) {
    this.#currentOpener = button
    if (!this.#surface) {
      return
    }

    if (this.#open) {
      this.#syncAnchor()
      this.#focusOpenTarget()
      this.#announceChange()
      return
    }

    this.#surface.showPopover()
    this.#open = true
    this.#syncAnchor()
    this.#focusOpenTarget()
    this.#announceChange()
  }

  hide() {
    if (!this.#surface) {
      return
    }

    if (!this.#open && !this.#surface.matches(':popover-open')) {
      return
    }

    this.#surface.hidePopover()
  }

  handleBeforeToggle(node: HTMLElement, nextState: string) {
    this.#surface = node
    if (nextState === 'open') {
      this.#syncAnchor()
      return
    }

    if (!this.#open) {
      return
    }

    this.#open = false
    this.#cleanupAnchor()
    this.#cleanupAnchor = () => {}
    this.#restoreFocusToOpener()
    this.#announceChange()
  }

  #announceChange() {
    this.#notify()
    this.#surface?.dispatchEvent(new PopoverChangeEvent(this.#open, this.opener))
  }

  #focusOpenTarget() {
    let target = this.#openFocusTarget
    if (!target?.isConnected) {
      return
    }

    target.focus()
  }

  #notify() {
    this.dispatchEvent(new Event('change'))
  }

  #restoreFocusToOpener() {
    let opener = this.opener
    if (!opener?.isConnected) {
      return
    }

    opener.focus()
  }

  #syncAnchor() {
    let surface = this.#surface
    let opener = this.opener
    if (!surface || !opener) {
      return
    }

    this.#cleanupAnchor()
    this.#cleanupAnchor = anchor(surface, opener, this.#currentOpener?.options ?? {})
  }
}

function PopoverContext(handle: Handle<PopoverModel>) {
  let model = new PopoverModel(handle.id)

  return (props: PopoverContextProps) => {
    handle.context.set(model)
    return props.children ?? null
  }
}

function getPopoverModel(handle: Handle | MixinHandle) {
  let model = handle.context.get(PopoverContext)
  if (!(model instanceof PopoverModel)) {
    throw new Error('Popover mixins must be used inside popover.context')
  }

  return model
}

let popoverButtonMixin = createMixin<HTMLElement, [options?: AnchorOptions], ElementProps>(
  (handle, hostType) => {
    let currentOptions: AnchorOptions = {}
    let registration: PopoverButtonRegistration = {
      node: null as never,
      get options() {
        return currentOptions
      },
    }

    let model = getPopoverModel(handle)
    model.addEventListener('change', () => handle.update(), { signal: handle.signal })
    handle.addEventListener('remove', () => model.unregisterButton(registration))

    return (options = {}) => {
      currentOptions = options

      let nextProps: ElementProps = {
        'aria-controls': model.id,
        'aria-expanded': model.isOpen && model.opener === registration.node ? true : false,
        'aria-haspopup': 'dialog',
      }

      if (hostType === 'button') {
        nextProps.type = 'button'
      }

      return [
        attrs(nextProps),
        ref((node: HTMLElement) => {
          registration.node = node
        }),
        on('click', () => {
          model.toggle(registration)
        }),
      ]
    }
  },
)

let popoverSurfaceMixin = createMixin<HTMLElement, [], ElementProps>((handle) => (props) => {
  let model = getPopoverModel(handle)
  let id = props.id ?? model.id
  model.setSurfaceId(id)

  return [
    attrs({ id, popover: 'manual' }),
    ref((node: HTMLElement, signal) => {
      model.registerSurface(node)
      signal.addEventListener('abort', () => {
        model.unregisterSurface(node)
      })
    }),
    on('beforetoggle', (event) => {
      model.handleBeforeToggle(event.currentTarget, event.newState)
    }),
  ]
})

let popoverOpenFocusTargetMixin = createMixin<HTMLElement, [], ElementProps>((handle) => () => {
  let model = getPopoverModel(handle)

  return [
    ref((node: HTMLElement, signal) => {
      model.registerOpenFocusTarget(node)
      signal.addEventListener('abort', () => {
        model.unregisterOpenFocusTarget(node)
      })
    }),
  ]
})

type PopoverApi = {
  readonly button: typeof popoverButtonMixin
  readonly change: typeof popoverChangeEventType
  readonly context: typeof PopoverContext
  readonly openFocusTarget: typeof popoverOpenFocusTargetMixin
  readonly surface: typeof popoverSurfaceMixin
}

export let popover: PopoverApi = {
  button: popoverButtonMixin,
  change: popoverChangeEventType,
  context: PopoverContext,
  openFocusTarget: popoverOpenFocusTargetMixin,
  surface: popoverSurfaceMixin,
}
