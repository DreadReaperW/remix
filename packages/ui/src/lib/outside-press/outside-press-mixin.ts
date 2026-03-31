import { createMixin, type ElementProps } from '@remix-run/component'

export type OutsidePressEvent = PointerEvent | MouseEvent
export type OutsidePressHandler = (event: OutsidePressEvent) => void

export let onOutsidePress = createMixin<
  HTMLElement,
  [handler: OutsidePressHandler],
  ElementProps
>((handle) => {
  let currentHandler: OutsidePressHandler = () => {}
  let node: HTMLElement
  let sawOutsidePointerDown = false

  function isOutsideEventTarget(event: Event) {
    return !(event.target instanceof Node && node.contains(event.target))
  }

  function handlePointerDown(event: PointerEvent) {
    if (event.button !== 0 || event.isPrimary === false) {
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
    if (event.button !== 0 || !isOutsideEventTarget(event)) {
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

  return (handler) => {
    currentHandler = handler
  }
})
