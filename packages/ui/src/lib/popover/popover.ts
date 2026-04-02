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

type PopoverControllerEventMap = {
  change: Event
}

type PopoverContextProps = {
  children?: RemixNode
}

export const popoverChangeEventType = 'rmx:popover-change' as const
export const popoverCloseRequestEventType = 'rmx:popover-closerequest' as const
export const popoverCloseEndEventType = 'rmx:popover-closeend' as const

declare global {
  interface HTMLElementEventMap {
    [popoverChangeEventType]: PopoverChangeEvent
    [popoverCloseRequestEventType]: PopoverCloseRequestEvent
    [popoverCloseEndEventType]: PopoverCloseEndEvent
  }
}

export type PopoverCloseRequestReason = 'dismiss' | 'escape' | 'focusout' | 'outside-press'

export class PopoverChangeEvent extends Event {
  readonly open: boolean
  readonly opener: HTMLElement | null

  constructor(open: boolean, opener: HTMLElement | null) {
    super(popoverChangeEventType, { bubbles: true })
    this.open = open
    this.opener = opener
  }
}

export class PopoverCloseRequestEvent extends Event {
  readonly opener: HTMLElement | null
  readonly reason: PopoverCloseRequestReason
  readonly returnFocus: boolean

  constructor({
    opener,
    reason,
    returnFocus,
  }: {
    opener: HTMLElement | null
    reason: PopoverCloseRequestReason
    returnFocus: boolean
  }) {
    super(popoverCloseRequestEventType, { bubbles: true, cancelable: true })
    this.opener = opener
    this.reason = reason
    this.returnFocus = returnFocus
  }
}

export class PopoverCloseEndEvent extends Event {
  readonly opener: HTMLElement | null

  constructor(opener: HTMLElement | null) {
    super(popoverCloseEndEventType, { bubbles: true })
    this.opener = opener
  }
}

export class PopoverController extends TypedEventTarget<PopoverControllerEventMap> {
  #cleanupAnchor = () => {}
  #cleanupPendingOpenFocus = () => {}
  #currentAnchorOptions: AnchorOptions = {}
  #currentOpener: HTMLElement | null = null
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
    return this.#currentOpener
  }

  setSurfaceId(id: string) {
    if (this.#surfaceId === id) {
      return
    }

    this.#surfaceId = id
    this.#notify()
  }

  unregisterOpener(node: HTMLElement) {
    if (this.#currentOpener !== node) {
      return
    }

    this.#currentOpener = null
    this.#currentAnchorOptions = {}
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

    this.#currentAnchorOptions = {}
    this.#currentOpener = null
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

  show(
    node: HTMLElement,
    anchorOptions: AnchorOptions = {},
    { deferFocusUntilPointerRelease = false }: { deferFocusUntilPointerRelease?: boolean } = {},
  ) {
    this.#currentAnchorOptions = anchorOptions
    this.#currentOpener = node
    let surface = this.#surface
    if (!surface) {
      return
    }

    let transitionId = ++this.#transitionId
    this.#cleanupPendingOpenFocus()
    this.#cleanupPendingOpenFocus = () => {}
    if (this.#open) {
      this.#syncAnchor()
      this.#announceChange()
      this.#queueOpenFocus(surface, transitionId, deferFocusUntilPointerRelease)
      return
    }

    surface.showPopover()
    this.#open = true
    this.#syncAnchor()
    this.#announceChange()
    this.#queueOpenFocus(surface, transitionId, deferFocusUntilPointerRelease)
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

  requestHide(
    reason: PopoverCloseRequestReason,
    { returnFocus = true }: { returnFocus?: boolean } = {},
  ) {
    let surface = this.#surface
    if (!surface) {
      return
    }

    if (!this.#open && !surface.matches(':popover-open')) {
      return
    }

    let event = new PopoverCloseRequestEvent({
      opener: this.opener,
      reason,
      returnFocus,
    })
    if (!surface.dispatchEvent(event)) {
      return
    }

    this.hide({ returnFocus })
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
    this.#cleanupPendingOpenFocus()
    this.#cleanupPendingOpenFocus = () => {}
    this.#cleanupAnchor()
    this.#cleanupAnchor = () => {}
    let returnFocus = this.#returnFocusOnClose
    this.#returnFocusOnClose = true
    let transitionId = ++this.#transitionId
    let opener = this.opener
    this.#announceChange()
    void this.#handleCloseEndAfterTransition(node, opener, returnFocus, transitionId)
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

  #queueOpenFocus(
    surface: HTMLElement,
    transitionId: number,
    deferFocusUntilPointerRelease: boolean,
  ) {
    if (!deferFocusUntilPointerRelease) {
      if (transitionId !== this.#transitionId || this.#surface !== surface || !this.#open) {
        return
      }

      this.#focusOpenTarget()
      return
    }

    let controller = new AbortController()
    let signal = controller.signal
    let document = surface.ownerDocument

    let finish = () => {
      requestAnimationFrame(() => {
        if (signal.aborted) {
          return
        }

        if (transitionId !== this.#transitionId || this.#surface !== surface || !this.#open) {
          return
        }

        this.#focusOpenTarget()
      })
    }

    this.#cleanupPendingOpenFocus = () => {
      controller.abort()
      this.#cleanupPendingOpenFocus = () => {}
    }

    this.#surfaceSignal?.addEventListener('abort', this.#cleanupPendingOpenFocus, { once: true })
    document.addEventListener('pointerup', finish, { capture: true, once: true, signal })
    document.addEventListener('pointercancel', finish, { capture: true, once: true, signal })
  }

  #notify() {
    this.dispatchEvent(new Event('change'))
  }

  async #handleCloseEndAfterTransition(
    surface: HTMLElement,
    opener: HTMLElement | null,
    returnFocus: boolean,
    transitionId: number,
  ) {
    let signal = this.#surfaceSignal
    if (signal) {
      await waitForCssTransition(surface, signal, () => {})
    }

    if (transitionId !== this.#transitionId || this.#open) {
      return
    }

    if (!surface.isConnected) {
      return
    }

    if (returnFocus && opener?.isConnected) {
      opener.focus()
    }

    surface.dispatchEvent(new PopoverCloseEndEvent(opener))
  }

  #syncAnchor() {
    let surface = this.#surface
    let opener = this.opener
    if (!surface || !opener) {
      return
    }

    this.#cleanupAnchor()
    this.#cleanupAnchor = anchor(surface, opener, this.#currentAnchorOptions)
  }
}

function PopoverContext(handle: Handle<PopoverController>) {
  let controller = new PopoverController(handle.id)

  return (props: PopoverContextProps) => {
    handle.context.set(controller)
    return props.children ?? null
  }
}

function getPopoverController(handle: Handle | MixinHandle) {
  let controller = handle.context.get(PopoverContext)
  if (!(controller instanceof PopoverController)) {
    throw new Error('Popover mixins must be used inside popover.context')
  }

  return controller
}

let popoverButtonMixin = createMixin<HTMLElement, [options?: AnchorOptions], ElementProps>(
  (handle, hostType) => {
    let button: HTMLElement | null = null

    let controller = getPopoverController(handle)
    controller.addEventListener('change', () => handle.update(), { signal: handle.signal })

    return (options = {}) => {
      let nextProps: ElementProps = {
        'aria-controls': controller.id,
        'aria-expanded': controller.isOpen && controller.opener === button ? true : false,
        'aria-haspopup': 'dialog',
      }

      if (hostType === 'button') {
        nextProps.type = 'button'
      }

      return [
        attrs(nextProps),
        ref((node: HTMLElement, signal) => {
          button = node
          signal.addEventListener('abort', () => {
            controller.unregisterOpener(node)
            if (button === node) {
              button = null
            }
          })
        }),
        press(),
        on(press.down, (event) => {
          if (event.defaultPrevented || event.pointerType === 'virtual') {
            return
          }

          controller.show(event.currentTarget as HTMLElement, options, {
            deferFocusUntilPointerRelease: event.pointerType !== 'keyboard',
          })
        }),
        on(press.press, (event) => {
          if (event.defaultPrevented || event.pointerType !== 'virtual') {
            return
          }

          controller.show(event.currentTarget as HTMLElement, options)
        }),
      ]
    }
  },
)

let popoverDismissMixin = createMixin<HTMLElement, [], ElementProps>((handle, hostType) => {
  let controller = getPopoverController(handle)

  return () => {
    let nextProps: ElementProps = {}

    if (hostType === 'button') {
      nextProps.type = 'button'
    }

    return [
      attrs(nextProps),
      on('click', () => {
        controller.requestHide('dismiss')
      }),
    ]
  }
})

let popoverSurfaceMixin = createMixin<HTMLElement, [], ElementProps>((handle) => {
  let controller = getPopoverController(handle)
  controller.addEventListener('change', () => handle.update(), { signal: handle.signal })

  return (props) => {
    let id = props.id ?? controller.id
    controller.setSurfaceId(id)

    return [
      attrs({ id, popover: 'manual', tabIndex: props.tabIndex ?? -1 }),
      ref((node: HTMLElement, signal) => {
        controller.registerSurface(node, signal)
        signal.addEventListener('abort', () => {
          controller.unregisterSurface(node)
        })
      }),
      on('beforetoggle', (event) => {
        controller.handleBeforeToggle(event.currentTarget, event.newState)
      }),
      on('keydown', (event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          controller.requestHide('escape')
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

        controller.requestHide('focusout', { returnFocus: false })
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

let popoverInitialFocusMixin = createMixin<HTMLElement, [], ElementProps>((handle) => () => {
  let controller = getPopoverController(handle)

  return [
    ref((node: HTMLElement, signal) => {
      controller.registerInitialFocus(node)
      signal.addEventListener('abort', () => {
        controller.unregisterInitialFocus(node)
      })
    }),
  ]
})

type PopoverApi = {
  readonly button: typeof popoverButtonMixin
  readonly change: typeof popoverChangeEventType
  readonly closerequest: typeof popoverCloseRequestEventType
  readonly closeend: typeof popoverCloseEndEventType
  readonly context: typeof PopoverContext
  readonly dismiss: typeof popoverDismissMixin
  readonly initialFocus: typeof popoverInitialFocusMixin
  readonly surface: typeof popoverSurfaceMixin
}

export let popover: PopoverApi = {
  button: popoverButtonMixin,
  change: popoverChangeEventType,
  closerequest: popoverCloseRequestEventType,
  closeend: popoverCloseEndEventType,
  context: PopoverContext,
  dismiss: popoverDismissMixin,
  initialFocus: popoverInitialFocusMixin,
  surface: popoverSurfaceMixin,
}
