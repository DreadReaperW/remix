import { createMixin } from '@remix-run/component'

type OutsidePointerDownHandler = (event: PointerEvent) => void

export let onOutsidePointerDown = createMixin<HTMLElement, [handler: OutsidePointerDownHandler]>(
  (handle) => {
    let currentHandler: OutsidePointerDownHandler = () => {}

    handle.addEventListener('insert', (event) => {
      let node = event.node
      let stableHandler = (pointerEvent: PointerEvent) => {
        if (pointerEvent.target instanceof Node && node.contains(pointerEvent.target)) {
          return
        }

        currentHandler(pointerEvent)
      }

      document.addEventListener('pointerdown', stableHandler, {
        capture: true,
        signal: handle.signal,
      })
    })

    return (handler) => {
      currentHandler = handler
      return handle.element
    }
  },
)
