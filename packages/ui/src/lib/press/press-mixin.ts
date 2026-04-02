import { createMixin, type ElementProps, type MixinHandle } from '@remix-run/component'

export type PressPointerType = 'mouse' | 'touch' | 'pen' | 'keyboard' | 'virtual'

export const pressEventType = 'rmx:ui-press' as const
export const pressDownEventType = 'rmx:ui-press-start' as const
export const pressStartEventType = pressDownEventType
export const pressEndEventType = 'rmx:ui-press-end' as const
export const pressUpEventType = 'rmx:ui-press-up' as const
export const pressCancelEventType = 'rmx:ui-press-cancel' as const
export const longPressEventType = 'rmx:ui-long-press' as const

type PressEventType =
  | typeof pressEventType
  | typeof pressDownEventType
  | typeof pressEndEventType
  | typeof pressUpEventType
  | typeof pressCancelEventType
  | typeof longPressEventType

type PressEventInit = {
  altKey?: boolean
  clientX?: number
  clientY?: number
  ctrlKey?: boolean
  metaKey?: boolean
  pointerType?: PressPointerType
  shiftKey?: boolean
}

type ActivePress = Required<PressEventInit>
type PressHandle = MixinHandle<HTMLElement, ElementProps>

type ActivePressSession = {
  init: ActivePress
  origin: SharedPressState
  suppressNextCommit: boolean
}

type PressManager = {
  activePress: ActivePressSession | null
  listenerController: AbortController | null
  longPressTimer: number
  refCount: number
  suppressNextClickTarget: SharedPressState | null
  armClickSuppression(target: SharedPressState): void
  beginPress(origin: SharedPressState, init: ActivePress, event?: Event): void
  cancelPress(init: ActivePress, event?: Event): void
  clearClickSuppression(): void
  clearLongPressTimer(): void
  commitPress(target: SharedPressState | null, init: ActivePress, event?: Event): void
  dispatch(target: SharedPressState, type: PressEventType, init: ActivePress, event?: Event): boolean
  ensureListeners(): void
  releaseRegistration(target: SharedPressState): void
  startLongPressTimer(): void
}

type SharedPressState = {
  currentDisabled: boolean
  listenerController: AbortController | null
  manager: PressManager | null
  node: HTMLElement | null
  refCount: number
  attach(node: HTMLElement): void
  detach(): void
}

let sharedPressStates = new WeakMap<PressHandle, SharedPressState>()
let pressManagers = new WeakMap<Document, PressManager>()

declare global {
  interface HTMLElementEventMap {
    [pressEventType]: PressEvent
    [pressDownEventType]: PressEvent
    [pressEndEventType]: PressEvent
    [pressUpEventType]: PressEvent
    [pressCancelEventType]: PressEvent
    [longPressEventType]: PressEvent
  }
}

export class PressEvent extends Event {
  readonly altKey: boolean
  readonly clientX: number
  readonly clientY: number
  readonly ctrlKey: boolean
  readonly metaKey: boolean
  readonly pointerType: PressPointerType
  readonly shiftKey: boolean

  constructor(type: PressEventType, init: PressEventInit = {}) {
    super(type, { bubbles: true, cancelable: true })
    this.altKey = init.altKey ?? false
    this.clientX = init.clientX ?? 0
    this.clientY = init.clientY ?? 0
    this.ctrlKey = init.ctrlKey ?? false
    this.metaKey = init.metaKey ?? false
    this.pointerType = init.pointerType ?? 'mouse'
    this.shiftKey = init.shiftKey ?? false
  }

  get isVirtual() {
    return this.pointerType === 'virtual'
  }
}

const LONG_PRESS_DELAY_MS = 500

function getDisabledState(props: ElementProps) {
  return (
    props.disabled === true || props['aria-disabled'] === true || props['aria-disabled'] === 'true'
  )
}

function getPointerType(event: PointerEvent): PressPointerType {
  if (event.pointerType === 'touch' || event.pointerType === 'pen') {
    return event.pointerType
  }

  return 'mouse'
}

function getPointerPressInit(event: PointerEvent): ActivePress {
  return {
    altKey: event.altKey,
    clientX: event.clientX,
    clientY: event.clientY,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    pointerType: getPointerType(event),
    shiftKey: event.shiftKey,
  }
}

function getKeyboardPressInit(event: KeyboardEvent): ActivePress {
  return {
    altKey: event.altKey,
    clientX: 0,
    clientY: 0,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    pointerType: 'keyboard',
    shiftKey: event.shiftKey,
  }
}

function getVirtualPressInit(event: MouseEvent): ActivePress {
  return {
    altKey: event.altKey,
    clientX: event.clientX,
    clientY: event.clientY,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    pointerType: 'virtual',
    shiftKey: event.shiftKey,
  }
}

function getPressManager(doc: Document): PressManager {
  let existing = pressManagers.get(doc)

  if (existing) {
    return existing
  }

  let manager!: PressManager

  manager = {
    activePress: null,
    listenerController: null,
    longPressTimer: 0,
    refCount: 0,
    suppressNextClickTarget: null,
    armClickSuppression(target) {
      manager.suppressNextClickTarget = target
    },
    beginPress(origin, init, event) {
      if (origin.currentDisabled || manager.activePress) {
        return
      }

      manager.clearClickSuppression()
      manager.activePress = {
        init,
        origin,
        suppressNextCommit: false,
      }
      manager.dispatch(origin, pressDownEventType, init, event)
      manager.startLongPressTimer()
    },
    cancelPress(init, event) {
      if (!manager.activePress) {
        return
      }

      let origin = manager.activePress.origin
      manager.clearLongPressTimer()
      manager.activePress = null
      manager.dispatch(origin, pressCancelEventType, init, event)
      manager.dispatch(origin, pressEndEventType, init, event)
    },
    clearClickSuppression() {
      manager.suppressNextClickTarget = null
    },
    clearLongPressTimer() {
      if (manager.longPressTimer === 0) {
        return
      }

      clearTimeout(manager.longPressTimer)
      manager.longPressTimer = 0
    },
    commitPress(target, init, event) {
      if (!manager.activePress) {
        return
      }

      let origin = manager.activePress.origin
      let shouldSuppressCommit = manager.activePress.suppressNextCommit
      manager.clearLongPressTimer()
      manager.activePress = null

      if (target && !target.currentDisabled) {
        manager.armClickSuppression(target)
        manager.dispatch(target, pressUpEventType, init, event)
      }

      manager.dispatch(origin, pressEndEventType, init, event)

      if (shouldSuppressCommit || !target || target.currentDisabled) {
        return
      }

      manager.dispatch(target, pressEventType, init, event)
    },
    dispatch(target, type, init, event) {
      let pressEvent = new PressEvent(type, init)
      let didDispatch = target.node?.dispatchEvent(pressEvent) ?? false
      if (pressEvent.defaultPrevented && event?.cancelable) {
        event.preventDefault()
      }
      return didDispatch
    },
    ensureListeners() {
      if (manager.listenerController) {
        return
      }

      manager.listenerController = new AbortController()
      let signal = manager.listenerController.signal
      doc.addEventListener('pointercancel', handleDocumentPointerCancel, { signal })
      doc.addEventListener('pointerup', handleDocumentPointerUp, { signal })
      doc.addEventListener('keyup', handleDocumentKeyUp, { capture: true, signal })
    },
    releaseRegistration(target) {
      if (manager.suppressNextClickTarget === target) {
        manager.clearClickSuppression()
      }

      if (manager.activePress?.origin === target) {
        manager.clearLongPressTimer()
        manager.activePress = null
      }

      if (manager.refCount === 0) {
        return
      }

      manager.refCount--

      if (manager.refCount !== 0) {
        return
      }

      manager.clearClickSuppression()
      manager.clearLongPressTimer()
      manager.activePress = null
      manager.listenerController?.abort()
      manager.listenerController = null
      pressManagers.delete(doc)
    },
    startLongPressTimer() {
      if (!manager.activePress || !manager.activePress.origin.node) {
        return
      }

      let activePress = manager.activePress
      manager.clearLongPressTimer()
      manager.longPressTimer = window.setTimeout(() => {
        if (
          !manager.activePress ||
          manager.activePress !== activePress ||
          !activePress.origin.node
        ) {
          return
        }

        manager.activePress.suppressNextCommit = !manager.dispatch(
          activePress.origin,
          longPressEventType,
          activePress.init,
        )
      }, LONG_PRESS_DELAY_MS)
    },
  }

  function handleDocumentPointerCancel(event: PointerEvent) {
    if (!manager.activePress || manager.activePress.init.pointerType === 'keyboard') {
      return
    }

    manager.cancelPress(getPointerPressInit(event), event)
  }

  function handleDocumentPointerUp(event: PointerEvent) {
    if (!manager.activePress || manager.activePress.init.pointerType === 'keyboard') {
      return
    }

    let originNode = manager.activePress.origin.node
    if (originNode && event.target instanceof Node && originNode.contains(event.target)) {
      return
    }

    manager.cancelPress(getPointerPressInit(event))
  }

  function handleDocumentKeyUp(event: KeyboardEvent) {
    if (
      !manager.activePress ||
      manager.activePress.init.pointerType !== 'keyboard' ||
      manager.activePress.origin.currentDisabled ||
      (event.key !== 'Enter' && event.key !== ' ')
    ) {
      return
    }

    let originNode = manager.activePress.origin.node
    if (originNode && event.target instanceof Node && originNode.contains(event.target)) {
      return
    }

    manager.commitPress(manager.activePress.origin, getKeyboardPressInit(event), event)
  }

  pressManagers.set(doc, manager)
  return manager
}

function getSharedPressState(handle: PressHandle): SharedPressState {
  let existing = sharedPressStates.get(handle)

  if (existing) {
    return existing
  }

  let shared!: SharedPressState

  shared = {
    currentDisabled: false,
    listenerController: null,
    manager: null,
    node: null,
    refCount: 0,
    attach(node) {
      if (shared.node === node && shared.listenerController) {
        return
      }

      shared.detach()
      shared.node = node
      shared.manager = getPressManager(node.ownerDocument)
      shared.manager.refCount++
      shared.manager.ensureListeners()
      shared.listenerController = new AbortController()
      let signal = shared.listenerController.signal

      node.addEventListener('pointerdown', handlePointerDown, { signal })
      node.addEventListener('pointerup', handlePointerUp, { signal })
      node.addEventListener('pointercancel', handlePointerCancel, { signal })
      node.addEventListener('pointerleave', handlePointerLeave, { signal })
      node.addEventListener('keydown', handleKeyDown, { signal })
      node.addEventListener('keyup', handleKeyUp, { signal })
      node.addEventListener('click', handleClick, { signal })
    },
    detach() {
      shared.listenerController?.abort()
      shared.listenerController = null
      shared.manager?.releaseRegistration(shared)
      shared.manager = null
      shared.node = null
    },
  }

  function handlePointerDown(event: PointerEvent) {
    let manager = shared.manager

    if (!manager) {
      return
    }

    manager.clearClickSuppression()

    if (shared.currentDisabled || event.button !== 0 || event.isPrimary === false) {
      return
    }

    manager.beginPress(shared, getPointerPressInit(event), event)
  }

  function handlePointerUp(event: PointerEvent) {
    let manager = shared.manager

    if (
      !manager?.activePress ||
      manager.activePress.init.pointerType === 'keyboard' ||
      shared.currentDisabled ||
      event.button !== 0 ||
      event.isPrimary === false
    ) {
      return
    }

    manager.commitPress(shared, getPointerPressInit(event), event)
  }

  function handlePointerCancel(event: PointerEvent) {
    let manager = shared.manager

    if (
      !manager?.activePress ||
      manager.activePress.init.pointerType === 'keyboard' ||
      shared.currentDisabled
    ) {
      return
    }

    manager.cancelPress(getPointerPressInit(event), event)
  }

  function handlePointerLeave() {
    let manager = shared.manager

    if (
      !manager?.activePress ||
      manager.activePress.init.pointerType === 'keyboard' ||
      manager.activePress.origin !== shared ||
      shared.currentDisabled
    ) {
      return
    }

    manager.clearLongPressTimer()
  }

  function handleKeyDown(event: KeyboardEvent) {
    let manager = shared.manager

    if (!manager) {
      return
    }

    if (event.key !== 'Escape') {
      manager.clearClickSuppression()
    }

    if (event.key === 'Escape') {
      if (!manager.activePress || manager.activePress.init.pointerType !== 'keyboard') {
        return
      }

      manager.cancelPress(getKeyboardPressInit(event), event)
      return
    }

    if (shared.currentDisabled || (event.key !== 'Enter' && event.key !== ' ')) {
      return
    }

    if (event.repeat) {
      return
    }

    event.preventDefault()
    manager.beginPress(shared, getKeyboardPressInit(event), event)
  }

  function handleKeyUp(event: KeyboardEvent) {
    let manager = shared.manager

    if (
      !manager?.activePress ||
      manager.activePress.init.pointerType !== 'keyboard' ||
      shared.currentDisabled ||
      (event.key !== 'Enter' && event.key !== ' ')
    ) {
      return
    }

    manager.commitPress(shared, getKeyboardPressInit(event), event)
  }

  function handleClick(event: MouseEvent) {
    let manager = shared.manager

    if (!manager || shared.currentDisabled || manager.activePress) {
      return
    }

    if (manager.suppressNextClickTarget === shared) {
      manager.clearClickSuppression()
      return
    }

    manager.clearClickSuppression()
    let init = getVirtualPressInit(event)
    manager.dispatch(shared, pressDownEventType, init, event)
    manager.dispatch(shared, pressUpEventType, init, event)
    manager.dispatch(shared, pressEndEventType, init, event)
    manager.dispatch(shared, pressEventType, init, event)
  }

  sharedPressStates.set(handle, shared)
  return shared
}

let basePressMixin = createMixin<HTMLElement, [], ElementProps>((handle) => {
  let shared = getSharedPressState(handle)
  shared.refCount++

  handle.addEventListener('insert', (event) => {
    shared.attach(event.node)
  })

  handle.addEventListener('remove', () => {
    if (shared.refCount === 0) {
      return
    }

    shared.refCount--

    if (shared.refCount !== 0) {
      return
    }

    shared.detach()
    sharedPressStates.delete(handle)
  })

  return (props) => {
    shared.currentDisabled = getDisabledState(props)
    return []
  }
})

type PressMixin = typeof basePressMixin & {
  readonly down: typeof pressDownEventType
  readonly press: typeof pressEventType
  readonly start: typeof pressStartEventType
  readonly end: typeof pressEndEventType
  readonly up: typeof pressUpEventType
  readonly cancel: typeof pressCancelEventType
  readonly long: typeof longPressEventType
}

export let press: PressMixin = Object.assign(basePressMixin, {
  down: pressDownEventType,
  press: pressEventType,
  start: pressStartEventType,
  end: pressEndEventType,
  up: pressUpEventType,
  cancel: pressCancelEventType,
  long: longPressEventType,
})
