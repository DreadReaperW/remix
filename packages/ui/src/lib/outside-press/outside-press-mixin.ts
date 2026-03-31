import { createMixin, type ElementProps } from '@remix-run/component'

export type OutsidePressEvent = PointerEvent | MouseEvent
export type OutsidePressHandler = (event: OutsidePressEvent) => void

export let onOutsidePress = createMixin<
  HTMLElement,
  [handler: OutsidePressHandler],
  ElementProps
>((handle) => {
  let currentHandler: OutsidePressHandler = () => {}
  let mounted = false
  let node: HTMLElement
  let sawOutsidePointerDown = false

  function isOutsideEventTarget(event: Event) {
    return !(event.target instanceof Node && node.contains(event.target))
  }

  function handlePointerDown(event: PointerEvent) {
    if (!mounted || event.button !== 0 || event.isPrimary === false) {
      return
    }

    sawOutsidePointerDown = false
    if (!isOutsideEventTarget(event)) {
      return
    }

    sawOutsidePointerDown = true
    currentHandler(event)
  }

  function handleClick(event: MouseEvent) {
    if (!mounted || event.button !== 0 || !isOutsideEventTarget(event)) {
      return
    }

    let shouldSuppressPointerGestureClick = sawOutsidePointerDown
    sawOutsidePointerDown = false

    if (shouldSuppressPointerGestureClick) {
      event.stopPropagation()
      return
    }

    currentHandler(event)
  }

  handle.addEventListener('insert', (event) => {
    mounted = true
    node = event.node
    let document = node.ownerDocument

    document.addEventListener('pointerdown', handlePointerDown, {
      capture: true,
      signal: handle.signal,
    })

    document.addEventListener('click', handleClick, {
      capture: true,
      signal: handle.signal,
    })
  })

  handle.addEventListener('remove', () => {
    mounted = false
  })

  return (handler) => {
    currentHandler = handler
  }
})
