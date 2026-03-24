import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { animateEntrance, animateExit } from './animate-mixins.tsx'
import { invariant } from '../invariant.ts'

describe('animate entrance/exit mixins', () => {
  it('reclaims persisted nodes by type/key and reuses the same DOM element', (t) => {
    let { container, root } = t.render(
      <div key="item" id="reclaim-target" mix={[animateExit({ opacity: 0, duration: 150 })]} />,
    )

    let first = container.querySelector('#reclaim-target')
    invariant(first)

    root.render(null)
    root.flush()
    assert.equal(container.querySelector('#reclaim-target'), first)

    root.render(
      <div key="item" id="reclaim-target" mix={[animateExit({ opacity: 0, duration: 150 })]} />,
    )
    root.flush()

    let second = container.querySelector('#reclaim-target')
    assert.equal(second, first)
  })

  it('retargets reclaim to natural styles instead of reversing exit animation', async (t) => {
    let reverse = t.mock()
    let commitStyles = t.mock()
    let cancel = t.mock()
    let animateSpy = t.spyOn(
      HTMLElement.prototype,
      'animate',
      () =>
        ({
          playState: 'running',
          reverse,
          commitStyles,
          cancel,
          finished: new Promise(() => {}),
        }) as unknown as Animation,
    )

    let { container, root } = t.render(
      <div key="item" id="reverse-target" mix={[animateExit({ opacity: 0, duration: 150 })]} />,
    )

    root.render(null)
    root.flush()
    await Promise.resolve()
    assert.equal(animateSpy.mock.calls.length, 1)

    root.render(
      <div key="item" id="reverse-target" mix={[animateExit({ opacity: 0, duration: 150 })]} />,
    )
    root.flush()
    await Promise.resolve()

    assert.equal(reverse.mock.calls.length, 0)
    assert.equal(commitStyles.mock.calls.length, 1)
    assert.equal(cancel.mock.calls.length, 1)
    assert.equal(animateSpy.mock.calls.length, 2)
  })

  it('does not reverse on initial insert when entrance and exit mixins are both present', (t) => {
    let reverse = t.mock()
    let animateSpy = t.spyOn(
      HTMLElement.prototype,
      'animate',
      () =>
        ({
          playState: 'running',
          reverse,
          finished: new Promise(() => {}),
        }) as unknown as Animation,
    )

    t.render(
      <div
        key="both"
        id="both-mixins-target"
        mix={[
          animateEntrance({ opacity: 0, duration: 150 }),
          animateExit({ opacity: 0, duration: 150 }),
        ]}
      />,
    )

    assert.equal(animateSpy.mock.calls.length, 1)
    assert.equal(reverse.mock.calls.length, 0)
  })

  it('keeps persist behavior after reclaim interruption completes', async (t) => {
    let mix = [
      animateEntrance({ opacity: 0, duration: 40 }),
      animateExit({ opacity: 0, duration: 40 }),
    ]

    let { container, root } = t.render(
      <div key="item" id="persist-after-interrupt" mix={mix} />,
    )

    root.render(null)
    root.flush()
    assert.notEqual(container.querySelector('#persist-after-interrupt'), null)

    root.render(<div key="item" id="persist-after-interrupt" mix={mix} />)
    root.flush()
    await new Promise((resolve) => setTimeout(resolve, 80))

    root.render(null)
    root.flush()
    assert.notEqual(container.querySelector('#persist-after-interrupt'), null)
  })

  it('skips first entrance when initial is false, but animates on reclaimed add', async (t) => {
    let animateSpy = t.spyOn(
      HTMLElement.prototype,
      'animate',
      () =>
        ({
          playState: 'running',
          reverse: t.mock(),
          commitStyles: t.mock(),
          cancel: t.mock(),
          finished: new Promise(() => {}),
        }) as unknown as Animation,
    )

    let mix = [
      animateEntrance({ initial: false, opacity: 0, duration: 100 }),
      animateExit({ opacity: 0, duration: 100 }),
    ]

    let { container, root } = t.render(
      <div key="initial-false" id="initial-false-target" mix={mix} />,
    )
    assert.equal(animateSpy.mock.calls.length, 0)

    root.render(null)
    root.flush()
    await Promise.resolve()
    assert.equal(animateSpy.mock.calls.length, 1)

    root.render(<div key="initial-false" id="initial-false-target" mix={mix} />)
    root.flush()
    await Promise.resolve()
    assert.equal(animateSpy.mock.calls.length, 2)
  })
})
