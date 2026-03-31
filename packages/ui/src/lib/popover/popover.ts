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
import { onOutsidePress } from '../outside-press/outside-press-mixin.ts'
import { press } from '../press/press-mixin.ts'
import { waitForCssTransition } from '../utils/wait-for-css-transition.ts'

type PopoverCoordinatorEventMap = {
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

export class PopoverCoordinator extends TypedEventTarget<PopoverCoordinatorEventMap> {
  #cleanupAnchor = () => {}
  #currentOpener: PopoverButtonRegistration | null = null
  #defaultSurfaceId: string
  #initialFocus: HTMLElement | null = null
  #open = false
  #returnFocusOnClose = true
  #surface: HTMLElement | null = null
  #surfaceId: string
  #surfaceSignal: AbortSignal | null = null
  #transitionId = 0

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

  registerSurface(node: HTMLElement, signal: AbortSignal) {
    this.#surface = node
    this.#surfaceSignal = signal
    this.setSurfaceId(node.id || this.#defaultSurfaceId)
  }

  unregisterSurface(node: HTMLElement) {
    if (this.#surface !== node) {
      return
    }

    this.#surface = null
    this.#surfaceSignal = null
    this.#open = false
    this.#cleanupAnchor()
    this.#cleanupAnchor = () => {}
    this.#surfaceId = this.#defaultSurfaceId
    this.#notify()
  }

  registerInitialFocus(node: HTMLElement) {
    this.#initialFocus = node
  }

  unregisterInitialFocus(node: HTMLElement) {
    if (this.#initialFocus !== node) {
      return
    }

    this.#initialFocus = null
  }

  show(button: PopoverButtonRegistration) {
    this.#currentOpener = button
    let surface = this.#surface
    if (!surface) {
      return
    }

    let transitionId = ++this.#transitionId
    if (this.#open) {
      this.#syncAnchor()
      this.#focusOpenTarget()
      this.#announceChange()
      return
    }

    void this.#openAfterTransition(surface, transitionId)
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
    let returnFocus = this.#returnFocusOnClose
    this.#returnFocusOnClose = true
    let transitionId = ++this.#transitionId
    let opener = this.opener
    this.#announceChange()
    if (!returnFocus) {
      return
    }

    void this.#restoreFocusToOpenerAfterTransition(node, opener, transitionId)
  }

  #announceChange() {
    this.#notify()
    this.#surface?.dispatchEvent(new PopoverChangeEvent(this.#open, this.opener))
  }

  #focusOpenTarget() {
    let target = this.#initialFocus?.isConnected ? this.#initialFocus : this.#surface
    if (!target?.isConnected) {
      return
    }

    target.focus()
  }

  #notify() {
    this.dispatchEvent(new Event('change'))
  }

  async #openAfterTransition(surface: HTMLElement, transitionId: number) {
    let signal = this.#surfaceSignal
    if (signal) {
      await waitForCssTransition(surface, signal, () => {
        surface.showPopover()
        this.#open = true
        this.#syncAnchor()
        this.#announceChange()
      })
    } else {
      surface.showPopover()
      this.#open = true
      this.#syncAnchor()
      this.#announceChange()
    }

    if (transitionId !== this.#transitionId || this.#surface !== surface || !this.#open) {
      return
    }

    this.#focusOpenTarget()
  }

  async #restoreFocusToOpenerAfterTransition(
    surface: HTMLElement,
    opener: HTMLElement | null,
    transitionId: number,
  ) {
    let signal = this.#surfaceSignal
    if (signal) {
      await waitForCssTransition(surface, signal, () => {})
    }

    if (transitionId !== this.#transitionId || this.#open) {
      return
    }

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

function PopoverContext(handle: Handle<PopoverCoordinator>) {
  let coordinator = new PopoverCoordinator(handle.id)

  return (props: PopoverContextProps) => {
    handle.context.set(coordinator)
    return props.children ?? null
  }
}

function getPopoverCoordinator(handle: Handle | MixinHandle) {
  let coordinator = handle.context.get(PopoverContext)
  if (!(coordinator instanceof PopoverCoordinator)) {
    throw new Error('Popover mixins must be used inside popover.context')
  }

  return coordinator
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

    let coordinator = getPopoverCoordinator(handle)
    coordinator.addEventListener('change', () => handle.update(), { signal: handle.signal })
    handle.addEventListener('remove', () => coordinator.unregisterButton(registration))

    return (options = {}) => {
      currentOptions = options

      let nextProps: ElementProps = {
        'aria-controls': coordinator.id,
        'aria-expanded':
          coordinator.isOpen && coordinator.opener === registration.node ? true : false,
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
        press(),
        on(press.start, (event) => {
          if (event.pointerType === 'keyboard' || event.pointerType === 'virtual') {
            return
          }

          coordinator.show(registration)
        }),
        on(press.press, (event) => {
          if (event.pointerType !== 'keyboard' && event.pointerType !== 'virtual') {
            return
          }

          coordinator.show(registration)
        }),
      ]
    }
  },
)

let popoverDismissMixin = createMixin<HTMLElement, [], ElementProps>((handle, hostType) => {
  let coordinator = getPopoverCoordinator(handle)

  return () => {
    let nextProps: ElementProps = {}

    if (hostType === 'button') {
      nextProps.type = 'button'
    }

    return [
      attrs(nextProps),
      on('click', () => {
        coordinator.hide()
      }),
    ]
  }
})

let popoverSurfaceMixin = createMixin<HTMLElement, [], ElementProps>((handle) => {
  let coordinator = getPopoverCoordinator(handle)
  coordinator.addEventListener('change', () => handle.update(), { signal: handle.signal })

  return (props) => {
    let id = props.id ?? coordinator.id
    coordinator.setSurfaceId(id)

    return [
      attrs({ id, popover: 'manual', tabIndex: props.tabIndex ?? -1 }),
      ref((node: HTMLElement, signal) => {
        coordinator.registerSurface(node, signal)
        signal.addEventListener('abort', () => {
          coordinator.unregisterSurface(node)
        })
      }),
      on('beforetoggle', (event) => {
        coordinator.handleBeforeToggle(event.currentTarget, event.newState)
      }),
      on('keydown', (event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          coordinator.hide()
        }
      }),
      on('focusout', (event) => {
        let surface = event.currentTarget

        if (event.relatedTarget instanceof Node && surface.contains(event.relatedTarget)) {
          return
        }

        if (!(event.relatedTarget instanceof Node)) {
          return
        }

        coordinator.hide({ returnFocus: false })
      }),
      onOutsidePress((event) => {
        if (!coordinator.isOpen) {
          return
        }

        event.stopPropagation()
        coordinator.hide()
      }),
    ]
  }
})

let popoverInitialFocusMixin = createMixin<HTMLElement, [], ElementProps>((handle) => () => {
  let coordinator = getPopoverCoordinator(handle)

  return [
    ref((node: HTMLElement, signal) => {
      coordinator.registerInitialFocus(node)
      signal.addEventListener('abort', () => {
        coordinator.unregisterInitialFocus(node)
      })
    }),
  ]
})

type PopoverApi = {
  readonly button: typeof popoverButtonMixin
  readonly change: typeof popoverChangeEventType
  readonly context: typeof PopoverContext
  readonly dismiss: typeof popoverDismissMixin
  readonly initialFocus: typeof popoverInitialFocusMixin
  readonly surface: typeof popoverSurfaceMixin
}

export let popover: PopoverApi = {
  button: popoverButtonMixin,
  change: popoverChangeEventType,
  context: PopoverContext,
  dismiss: popoverDismissMixin,
  initialFocus: popoverInitialFocusMixin,
  surface: popoverSurfaceMixin,
}
