import * as assert from '@remix-run/assert'
import { afterEach, beforeEach, describe, it } from '@remix-run/test'
import { animateLayout } from './animate-layout-mixin.tsx'
import { invariant } from '../invariant.ts'

interface MockAnimation {
  keyframes: Keyframe[]
  options: KeyframeAnimationOptions
  playState: AnimationPlayState
  finished: Promise<Animation>
  cancel: () => void
}

let originalAnimate: typeof Element.prototype.animate
let originalRaf: typeof globalThis.requestAnimationFrame
let mockAnimations: MockAnimation[] = []

function createMockAnimation(
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions,
): MockAnimation {
  let resolveFinished!: () => void
  let finished = new Promise<Animation>((_resolve) => {
    resolveFinished = () => _resolve({} as Animation)
  })
  return {
    keyframes,
    options,
    playState: 'running',
    finished,
    cancel() {
      this.playState = 'idle'
      resolveFinished()
    },
  }
}

function mockBoundingRect(
  el: Element,
  rect: { left: number; top: number; right: number; bottom: number },
) {
  el.getBoundingClientRect = () =>
    ({
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.right - rect.left,
      height: rect.bottom - rect.top,
      x: rect.left,
      y: rect.top,
      toJSON() {
        return this
      },
    }) as DOMRect
}

function mockBoundingRectSequence(
  el: Element,
  rects: Array<{ left: number; top: number; right: number; bottom: number }>,
) {
  let index = 0
  el.getBoundingClientRect = () => {
    let next = rects[Math.min(index, rects.length - 1)]
    index++
    return {
      left: next.left,
      top: next.top,
      right: next.right,
      bottom: next.bottom,
      width: next.right - next.left,
      height: next.bottom - next.top,
      x: next.left,
      y: next.top,
      toJSON() {
        return this
      },
    } as DOMRect
  }
}

describe('animateLayout mixin', () => {
  beforeEach(() => {
    mockAnimations = []
    originalAnimate = Element.prototype.animate
    originalRaf = globalThis.requestAnimationFrame
    globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => {
      queueMicrotask(() => callback(performance.now() + 1000))
      return 0
    }
    Element.prototype.animate = function (keyframes, options) {
      let animation = createMockAnimation(
        keyframes as Keyframe[],
        options as KeyframeAnimationOptions,
      ) as unknown as Animation
      mockAnimations.push(animation as unknown as MockAnimation)
      return animation
    }
  })

  afterEach(() => {
    Element.prototype.animate = originalAnimate
    globalThis.requestAnimationFrame = originalRaf
  })

  it('animates when layout geometry changes', (t) => {
    let { container, root } = t.render(<div data-tick="0" mix={[animateLayout({ duration: 350, easing: 'linear' })]} />)
    let node = container.querySelector('div')
    invariant(node)

    mockBoundingRect(node, { left: 0, top: 0, right: 100, bottom: 100 })
    root.render(<div data-tick="1" mix={[animateLayout({ duration: 350, easing: 'linear' })]} />)
    root.flush()
    mockAnimations = []

    mockBoundingRectSequence(node, [
      { left: 0, top: 0, right: 100, bottom: 100 },
      { left: 40, top: 10, right: 140, bottom: 110 },
    ])
    root.render(<div data-tick="2" mix={[animateLayout({ duration: 350, easing: 'linear' })]} />)
    root.flush()

    assert.equal(mockAnimations.length, 1)
    let animation = mockAnimations[0]
    assert.equal(animation.options.duration, 350)
    assert.equal(animation.options.easing, 'linear')
  })

  it('does not animate when geometry does not change', (t) => {
    let { container, root } = t.render(<div data-tick="0" mix={[animateLayout()]} />)
    let node = container.querySelector('div')
    invariant(node)

    mockBoundingRect(node, { left: 5, top: 5, right: 105, bottom: 105 })
    root.render(<div data-tick="1" mix={[animateLayout()]} />)
    root.flush()
    mockAnimations = []

    mockBoundingRectSequence(node, [
      { left: 5, top: 5, right: 105, bottom: 105 },
      { left: 5, top: 5, right: 105, bottom: 105 },
    ])
    root.render(<div data-tick="2" mix={[animateLayout()]} />)
    root.flush()

    assert.equal(mockAnimations.length, 0)
  })

  it('cancels an in-flight layout animation when interrupted', (t) => {
    let { container, root } = t.render(<div data-tick="0" mix={[animateLayout()]} />)
    let node = container.querySelector('div')
    invariant(node)

    mockBoundingRect(node, { left: 0, top: 0, right: 100, bottom: 100 })
    root.render(<div data-tick="1" mix={[animateLayout()]} />)
    root.flush()
    mockAnimations = []

    mockBoundingRectSequence(node, [
      { left: 0, top: 0, right: 100, bottom: 100 },
      { left: 30, top: 0, right: 130, bottom: 100 },
    ])
    root.render(<div data-tick="2" mix={[animateLayout()]} />)
    root.flush()
    let firstAnimation = mockAnimations[0]
    assert.equal(firstAnimation.playState, 'running')

    mockBoundingRectSequence(node, [
      { left: 30, top: 0, right: 130, bottom: 100 },
      { left: 60, top: 0, right: 160, bottom: 100 },
    ])
    root.render(<div data-tick="3" mix={[animateLayout()]} />)
    root.flush()

    assert.equal(firstAnimation.playState, 'idle')
    assert.equal(mockAnimations.length, 2)
  })

  it('cancels active animation on remove', (t) => {
    let { container, root } = t.render(<div data-tick="0" mix={[animateLayout()]} />)
    let node = container.querySelector('div')
    invariant(node)

    mockBoundingRect(node, { left: 0, top: 0, right: 100, bottom: 100 })
    root.render(<div data-tick="1" mix={[animateLayout()]} />)
    root.flush()
    mockAnimations = []

    mockBoundingRectSequence(node, [
      { left: 0, top: 0, right: 100, bottom: 100 },
      { left: 30, top: 0, right: 130, bottom: 100 },
    ])
    root.render(<div data-tick="2" mix={[animateLayout()]} />)
    root.flush()
    let active = mockAnimations[0]
    assert.equal(active.playState, 'running')

    root.render(null)
    root.flush()

    assert.equal(active.playState, 'idle')
  })
})
