import { attrs, createMixin, type ElementProps, type MixinHandle } from '@remix-run/component'

export type PressPointerType = 'mouse' | 'touch' | 'pen' | 'keyboard' | 'virtual'

export const pressEventType = 'rmx:ui-press' as const
export const pressStartEventType = 'rmx:ui-press-start' as const
export const pressEndEventType = 'rmx:ui-press-end' as const
export const pressUpEventType = 'rmx:ui-press-up' as const
export const pressCancelEventType = 'rmx:ui-press-cancel' as const
export const longPressEventType = 'rmx:ui-long-press' as const

type PressEventType =
  | typeof pressEventType
  | typeof pressStartEventType
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

type SharedPressState = {
  activePress: ActivePress | null
  currentDisabled: boolean
  longPressTimer: number
  node: HTMLElement | null
  refCount: number
  suppressNextClickPointerType: PressPointerType | null
  suppressNextCommit: boolean
  listenerController: AbortController | null
  attach(node: HTMLElement): void
  beginPress(init: ActivePress): void
  cancelPress(init: ActivePress): void
  clearClickSuppression(): void
  clearLongPressTimer(): void
  commitPress(init: ActivePress): void
  detach(): void
  dispatch(type: PressEventType, init: ActivePress): void
  setActivePress(nextPress: ActivePress | null): void
}

let sharedPressStates = new WeakMap<PressHandle, SharedPressState>()

declare global {
  interface HTMLElementEventMap {
    [pressEventType]: PressEvent
    [pressStartEventType]: PressEvent
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

function getSharedPressState(handle: PressHandle): SharedPressState {
  let existing = sharedPressStates.get(handle)

  if (existing) {
    return existing
  }

  let shared!: SharedPressState

  shared = {
    activePress: null,
    currentDisabled: false,
    longPressTimer: 0,
    node: null,
    refCount: 0,
    suppressNextClickPointerType: null,
    suppressNextCommit: false,
    listenerController: null,
    attach(node) {
      if (shared.node === node && shared.listenerController) {
        return
      }

      shared.detach()
      shared.node = node
      shared.listenerController = new AbortController()
      let signal = shared.listenerController.signal

      node.addEventListener('pointerdown', handlePointerDown, { signal })
      node.addEventListener('pointerup', handlePointerUp, { signal })
      node.addEventListener('pointercancel', handlePointerCancel, { signal })
      node.addEventListener('pointerleave', handlePointerLeave, { signal })
      node.addEventListener('keydown', handleKeyDown, { signal })
      node.addEventListener('keyup', handleKeyUp, { signal })
      node.addEventListener('click', handleClick, { signal })
      node.ownerDocument.addEventListener('pointerup', handleDocumentPointerUp, { signal })
    },
    beginPress(init) {
      if (shared.currentDisabled || shared.activePress) {
        return
      }

      shared.suppressNextCommit = false
      shared.setActivePress(init)
      shared.dispatch(pressStartEventType, init)
      startLongPressTimer()
    },
    cancelPress(init) {
      if (!shared.activePress) {
        return
      }

      shared.clearLongPressTimer()
      shared.suppressNextCommit = false
      shared.setActivePress(null)
      shared.dispatch(pressCancelEventType, init)
      shared.dispatch(pressEndEventType, init)
    },
    clearClickSuppression() {
      shared.suppressNextClickPointerType = null
    },
    clearLongPressTimer() {
      if (shared.longPressTimer === 0) {
        return
      }

      clearTimeout(shared.longPressTimer)
      shared.longPressTimer = 0
    },
    commitPress(init) {
      if (!shared.activePress) {
        return
      }

      let shouldSuppressCommit = shared.suppressNextCommit
      shared.clearLongPressTimer()
      shared.suppressNextCommit = false
      shared.setActivePress(null)

      if (shouldSuppressCommit) {
        shared.dispatch(pressEndEventType, init)
        return
      }

      shared.dispatch(pressUpEventType, init)
      shared.dispatch(pressEndEventType, init)
      shared.dispatch(pressEventType, init)
    },
    detach() {
      shared.clearLongPressTimer()
      shared.clearClickSuppression()
      shared.activePress = null
      shared.node = null
      shared.suppressNextCommit = false
      shared.listenerController?.abort()
      shared.listenerController = null
    },
    dispatch(type, init) {
      shared.node?.dispatchEvent(new PressEvent(type, init))
    },
    setActivePress(nextPress) {
      if (
        shared.activePress?.pointerType === nextPress?.pointerType &&
        shared.activePress?.clientX === nextPress?.clientX &&
        shared.activePress?.clientY === nextPress?.clientY &&
        shared.activePress?.altKey === nextPress?.altKey &&
        shared.activePress?.ctrlKey === nextPress?.ctrlKey &&
        shared.activePress?.metaKey === nextPress?.metaKey &&
        shared.activePress?.shiftKey === nextPress?.shiftKey
      ) {
        return
      }

      shared.activePress = nextPress
      void handle.update()
    },
  }

  function startLongPressTimer() {
    if (!shared.activePress || !shared.node) {
      return
    }

    shared.clearLongPressTimer()
    shared.longPressTimer = window.setTimeout(() => {
      if (!shared.activePress || !shared.node) {
        return
      }

      shared.suppressNextCommit = !shared.node.dispatchEvent(
        new PressEvent(longPressEventType, shared.activePress),
      )
    }, LONG_PRESS_DELAY_MS)
  }

  function armClickSuppression() {
    shared.clearClickSuppression()
    shared.suppressNextClickPointerType = shared.activePress?.pointerType ?? null
  }

  function handleDocumentPointerUp(event: PointerEvent) {
    if (!shared.activePress || !shared.node) {
      return
    }

    if (event.target instanceof Node && shared.node.contains(event.target)) {
      return
    }

    shared.cancelPress(getPointerPressInit(event))
  }

  function handlePointerDown(event: PointerEvent) {
    shared.clearClickSuppression()

    if (shared.currentDisabled || event.button !== 0 || event.isPrimary === false) {
      return
    }

    shared.beginPress(getPointerPressInit(event))
  }

  function handlePointerUp(event: PointerEvent) {
    if (!shared.activePress || shared.currentDisabled) {
      return
    }

    let init = getPointerPressInit(event)
    armClickSuppression()
    shared.commitPress(init)
  }

  function handlePointerCancel(event: PointerEvent) {
    if (!shared.activePress || shared.currentDisabled) {
      return
    }

    shared.cancelPress(getPointerPressInit(event))
  }

  function handlePointerLeave() {
    if (!shared.activePress || shared.currentDisabled) {
      return
    }

    shared.clearLongPressTimer()
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key !== 'Escape') {
      shared.clearClickSuppression()
    }

    if (event.key === 'Escape') {
      if (!shared.activePress) {
        return
      }

      shared.cancelPress(getKeyboardPressInit(event))
      return
    }

    if (shared.currentDisabled || (event.key !== 'Enter' && event.key !== ' ')) {
      return
    }

    if (event.repeat) {
      return
    }

    event.preventDefault()
    shared.beginPress(getKeyboardPressInit(event))
  }

  function handleKeyUp(event: KeyboardEvent) {
    if (
      !shared.activePress ||
      shared.currentDisabled ||
      (event.key !== 'Enter' && event.key !== ' ')
    ) {
      return
    }

    let init = getKeyboardPressInit(event)
    armClickSuppression()
    shared.commitPress(init)
  }

  function handleClick(event: MouseEvent) {
    if (shared.currentDisabled || shared.activePress) {
      return
    }

    if (shared.suppressNextClickPointerType) {
      shared.clearClickSuppression()
      return
    }

    let init = getVirtualPressInit(event)
    shared.dispatch(pressStartEventType, init)
    shared.dispatch(pressUpEventType, init)
    shared.dispatch(pressEndEventType, init)
    shared.dispatch(pressEventType, init)
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

    return attrs({
      'data-pressed': shared.activePress ? '' : undefined,
      'data-press-pointer-type': shared.activePress?.pointerType,
    })
  }
})

type PressMixin = typeof basePressMixin & {
  readonly press: typeof pressEventType
  readonly start: typeof pressStartEventType
  readonly end: typeof pressEndEventType
  readonly up: typeof pressUpEventType
  readonly cancel: typeof pressCancelEventType
  readonly long: typeof longPressEventType
}

export let press: PressMixin = Object.assign(basePressMixin, {
  press: pressEventType,
  start: pressStartEventType,
  end: pressEndEventType,
  up: pressUpEventType,
  cancel: pressCancelEventType,
  long: longPressEventType,
})
