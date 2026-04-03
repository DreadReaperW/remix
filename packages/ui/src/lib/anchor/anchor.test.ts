import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { anchor } from './anchor.ts'

type RectInit = {
  height: number
  left: number
  top: number
  width: number
}

function createRect({ top, left, width, height }: RectInit) {
  return new DOMRect(left, top, width, height)
}

function mockLayout(element: HTMLElement, rectInit: RectInit) {
  let rect = createRect(rectInit)

  Object.defineProperty(element, 'offsetWidth', {
    configurable: true,
    get: () => rect.width,
  })

  Object.defineProperty(element, 'offsetHeight', {
    configurable: true,
    get: () => rect.height,
  })

  element.getBoundingClientRect = () => rect

  return {
    setRect(nextRectInit: RectInit) {
      rect = createRect(nextRectInit)
    },
  }
}

beforeEach(() => {
  vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(() => 1)
  vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {})

  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: 800,
    writable: true,
  })

  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: 600,
    writable: true,
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('anchor', () => {
  it('positions a floating element below its anchor by default', () => {
    let floating = document.createElement('div')
    let anchorElement = document.createElement('button')
    document.body.append(floating, anchorElement)

    mockLayout(floating, { top: 0, left: 0, width: 120, height: 80 })
    mockLayout(anchorElement, { top: 40, left: 200, width: 80, height: 28 })

    let cleanup = anchor(floating, anchorElement)

    expect(floating.style.position).toBe('absolute')
    expect(floating.style.top).toBe('68px')
    expect(floating.style.left).toBe('180px')

    cleanup()
  })

  it('supports aligned placements and offset', () => {
    let floating = document.createElement('div')
    let anchorElement = document.createElement('button')
    document.body.append(floating, anchorElement)

    mockLayout(floating, { top: 0, left: 0, width: 120, height: 80 })
    mockLayout(anchorElement, { top: 40, left: 200, width: 80, height: 28 })

    let cleanup = anchor(floating, anchorElement, {
      offset: 8,
      placement: 'bottom-start',
    })

    expect(floating.style.top).toBe('76px')
    expect(floating.style.left).toBe('200px')

    cleanup()
  })

  it('flips when the requested placement would overflow the viewport', () => {
    let floating = document.createElement('div')
    let anchorElement = document.createElement('button')
    document.body.append(floating, anchorElement)

    mockLayout(floating, { top: 0, left: 0, width: 120, height: 80 })
    mockLayout(anchorElement, { top: 560, left: 200, width: 80, height: 28 })

    let cleanup = anchor(floating, anchorElement, {
      placement: 'bottom',
    })

    expect(floating.style.top).toBe('480px')
    expect(floating.style.left).toBe('180px')

    cleanup()
  })

  it('supports inset positioning', () => {
    let floating = document.createElement('div')
    let anchorElement = document.createElement('button')
    document.body.append(floating, anchorElement)

    mockLayout(floating, { top: 0, left: 0, width: 120, height: 80 })
    mockLayout(anchorElement, { top: 40, left: 200, width: 80, height: 28 })

    let cleanup = anchor(floating, anchorElement, {
      inset: true,
      placement: 'bottom-start',
    })

    expect(floating.style.top).toBe('40px')
    expect(floating.style.left).toBe('200px')

    cleanup()
  })

  it('supports positioning relative to an inner element', () => {
    let floating = document.createElement('div')
    let inner = document.createElement('div')
    inner.className = 'inner'
    floating.append(inner)

    let anchorElement = document.createElement('button')
    document.body.append(floating, anchorElement)

    mockLayout(floating, { top: 0, left: 0, width: 200, height: 100 })
    mockLayout(inner, { top: 10, left: 20, width: 100, height: 40 })
    mockLayout(anchorElement, { top: 40, left: 200, width: 80, height: 28 })

    let cleanup = anchor(floating, anchorElement, {
      placement: 'bottom-start',
      relativeTo: '.inner',
    })

    expect(floating.style.top).toBe('58px')
    expect(floating.style.left).toBe('180px')

    cleanup()
  })

  it('supports inset left positioning relative to a selected inner element', () => {
    let floating = document.createElement('div')
    let selected = document.createElement('div')
    selected.setAttribute('aria-selected', 'true')
    selected.setAttribute('role', 'option')
    floating.append(selected)

    let anchorElement = document.createElement('button')
    document.body.append(floating, anchorElement)

    mockLayout(floating, { top: 0, left: 0, width: 200, height: 100 })
    mockLayout(selected, { top: 10, left: 20, width: 100, height: 40 })
    mockLayout(anchorElement, { top: 40, left: 200, width: 80, height: 28 })

    let cleanup = anchor(floating, anchorElement, {
      inset: true,
      placement: 'left',
      relativeTo: '[role="option"][aria-selected="true"]',
    })

    expect(floating.style.top).toBe('24px')
    expect(floating.style.left).toBe('180px')

    cleanup()
  })

  it('repositions when the floating dimensions change during animation-frame polling', () => {
    let pollForPositionChanges: ((time: number) => void) | null = null
    vi.mocked(requestAnimationFrame).mockImplementation((callback) => {
      pollForPositionChanges = callback
      return 1
    })

    let floating = document.createElement('div')
    let anchorElement = document.createElement('button')
    document.body.append(floating, anchorElement)

    let floatingLayout = mockLayout(floating, { top: 0, left: 0, width: 120, height: 40 })
    mockLayout(anchorElement, { top: 520, left: 200, width: 80, height: 28 })

    let cleanup = anchor(floating, anchorElement, {
      placement: 'bottom',
    })

    expect(floating.style.top).toBe('548px')
    expect(floating.style.left).toBe('180px')

    floatingLayout.setRect({ top: 0, left: 0, width: 120, height: 80 })
    if (!pollForPositionChanges) {
      throw new Error('Expected anchor() to schedule polling')
    }

    ;(pollForPositionChanges as (time: number) => void)(16)

    expect(floating.style.top).toBe('440px')
    expect(floating.style.left).toBe('180px')

    cleanup()
  })

  it('cancels its animation frame polling during cleanup', () => {
    let floating = document.createElement('div')
    let anchorElement = document.createElement('button')
    document.body.append(floating, anchorElement)

    mockLayout(floating, { top: 0, left: 0, width: 120, height: 80 })
    mockLayout(anchorElement, { top: 40, left: 200, width: 80, height: 28 })

    let cleanup = anchor(floating, anchorElement)
    cleanup()

    expect(cancelAnimationFrame).toHaveBeenCalledWith(1)
  })
})
