import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { createMixin, on, ref } from '../index.ts'
import { invariant } from '../lib/invariant.ts'
import type { Handle } from '../lib/component.ts'

describe('vnode mixins', () => {
  it('composes mixins in order and does not leak mix to the DOM', (t) => {
    let withTitle = createMixin((handle) => (title: string, props: { title?: string }) => (
      <handle.element {...props} title={title} />
    ))
    let appendTitle = createMixin((handle) => (suffix: string, props: { title?: string }) => (
      <handle.element {...props} title={`${props.title ?? ''}${suffix}`} />
    ))

    let { container } = t.render(<div mix={[withTitle('hello'), appendTitle('-world')]} />)

    let div = container.querySelector('div')
    invariant(div)
    assert.equal(div.getAttribute('title'), 'hello-world')
    assert.equal(div.hasAttribute('mix'), false)
  })

  it('supports nested mix descriptors via handle.element', (t) => {
    let withData = createMixin((handle) => (value: string, props: { ['data-mixed']?: string }) => (
      <handle.element {...props} data-mixed={value} />
    ))
    let withNested = createMixin(
      (handle) => (value: string, props: { ['data-mixed']?: string }) => (
        <handle.element {...props} mix={[withData(value)]} />
      ),
    )

    let { container } = t.render(<div mix={[withNested('nested')]} />)

    let div = container.querySelector('div')
    invariant(div)
    assert.equal(div.getAttribute('data-mixed'), 'nested')
  })

  it('shares one handle instance across mixins on the same host node', (t) => {
    let handles: unknown[] = []
    let one = createMixin((handle) => {
      handles.push(handle)
    })
    let two = createMixin((handle) => {
      handles.push(handle)
    })
    let three = createMixin((handle) => {
      handles.push(handle)
    })

    let { root } = t.render(<div mix={[one(), two(), three()]} />)
    root.flush()

    assert.equal(handles.length, 3)
    assert.equal(handles[0], handles[1])
    assert.equal(handles[1], handles[2])
  })

  it('aborts handle.signal when the host node is removed', (t) => {
    let signal = AbortSignal.abort()
    let withSignal = createMixin((handle) => {
      signal = handle.signal
    })

    let { root } = t.render(<div mix={[withSignal()]} />)
    root.flush()
    assert.equal(signal.aborted, false)

    root.render(null)
    root.flush()
    assert.ok(signal.aborted)
  })

  it('supports setup-only passthrough mixins', (t) => {
    let withPassthrough = createMixin((_handle) => {})
    let withTitle = createMixin((handle) => (title: string, props: { title?: string }) => (
      <handle.element {...props} title={title} />
    ))

    let { container, root } = t.render(<div mix={[withPassthrough(), withTitle('ok')]} />)
    root.flush()

    let div = container.querySelector('div')
    invariant(div)
    assert.equal(div.getAttribute('title'), 'ok')
  })

  it('does not duplicate on handlers for passthrough mixins', (t) => {
    let clicks = 0
    let passthrough = createMixin((_handle) => {})

    let { container, root } = t.render(
      <button
        mix={[
          passthrough(),
          on('click', () => {
            clicks++
          }),
        ]}
      />,
    )
    root.flush()

    let button = container.querySelector('button')
    invariant(button)
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    root.flush()

    assert.equal(clicks, 1)
  })

  it('runs remove lifecycle when descriptor type changes and on unmount', (t) => {
    let removedA = 0
    let removedB = 0
    let persistApiSeenOnRemoveA = false
    let persistApiSeenOnRemoveB = false

    let a = createMixin((handle) => {
      handle.addEventListener('remove', (event) => {
        removedA++
        persistApiSeenOnRemoveA = 'persistNode' in event
      })
      return (props: { id?: string }) => <handle.element {...props} id="a" />
    })

    let b = createMixin((handle) => {
      handle.addEventListener('remove', (event) => {
        removedB++
        persistApiSeenOnRemoveB = 'persistNode' in event
      })
      return (props: { id?: string }) => <handle.element {...props} id="b" />
    })

    let { root } = t.render(<div mix={[a()]} />)
    root.render(<div mix={[b()]} />)
    root.render(null)

    assert.equal(removedA, 1)
    assert.equal(removedB, 1)
    assert.equal(persistApiSeenOnRemoveA, false)
    assert.equal(persistApiSeenOnRemoveB, false)
  })

  it('exposes persistNode in beforeRemove lifecycle', (t) => {
    let beforeRemoveCalls = 0
    let persistApiSeen = false

    let withBeforeRemove = createMixin((handle) => {
      handle.addEventListener('beforeRemove', (event) => {
        beforeRemoveCalls++
        persistApiSeen = typeof event.persistNode === 'function'
      })
      return (props: { id?: string }) => <handle.element {...props} id="before-remove" />
    })

    let { root } = t.render(<div mix={[withBeforeRemove()]} />)
    root.flush()
    root.render(null)
    root.flush()

    assert.equal(beforeRemoveCalls, 1)
    assert.ok(persistApiSeen)
  })

  it('runs insert lifecycle with the bound host node', (t) => {
    let insertedNode: Element | null = null
    let insertCount = 0

    let withInsert = createMixin((handle) => {
      handle.addEventListener('insert', (event) => {
        insertedNode = event.node
        insertCount++
      })
      return (props: { id?: string }) => <handle.element {...props} id="inserted" />
    })

    let { container, root } = t.render(<div mix={[withInsert()]} />)
    root.flush()
    root.render(<div mix={[withInsert()]} />)
    root.flush()

    let div = container.querySelector('#inserted')
    invariant(div)
    assert.equal(insertedNode, div)
    assert.equal(insertCount, 1)
  })

  it('runs beforeUpdate and commit lifecycle events in update order', (t) => {
    let calls: string[] = []
    let withUpdateLifecycle = createMixin((handle) => {
      handle.addEventListener('beforeUpdate', (event) => {
        calls.push(`before:${(event.node as HTMLElement).dataset.step}`)
      })
      handle.addEventListener('commit', (event) => {
        calls.push(`commit:${(event.node as HTMLElement).dataset.step}`)
      })
      return (step: string, props: { ['data-step']?: string }) => (
        <handle.element {...props} data-step={step} />
      )
    })

    let { root } = t.render(<div mix={[withUpdateLifecycle('0')]} />)
    root.flush()
    root.render(<div mix={[withUpdateLifecycle('1')]} />)
    root.flush()

    assert.deepEqual(calls, ['before:0', 'commit:1'])
  })

  it('composes ref callbacks across mixins and base mix', (t) => {
    let calls: string[] = []

    let withConnectA = createMixin((handle) => (props: {}) => (
      <handle.element
        {...props}
        mix={[
          ref((node: Element) => {
            calls.push('a')
            if (node instanceof HTMLElement) {
              node.dataset.a = '1'
            }
          }),
        ]}
      />
    ))

    let withConnectB = createMixin((handle) => (props: {}) => (
      <handle.element
        {...props}
        mix={[
          ref((node: Element) => {
            calls.push('b')
            if (node instanceof HTMLElement) {
              node.dataset.b = '1'
            }
          }),
        ]}
      />
    ))

    let { container, root } = t.render(
      <div
        mix={[
          withConnectA(),
          withConnectB(),
          ref((node: Element) => {
            calls.push('base')
            if (node instanceof HTMLElement) {
              node.dataset.base = '1'
            }
          }),
        ]}
      />,
    )
    root.flush()

    let div = container.querySelector('div')
    invariant(div)
    assert.equal(div.dataset.a, '1')
    assert.equal(div.dataset.b, '1')
    assert.equal(div.dataset.base, '1')
    assert.deepEqual(new Set(calls), new Set(['a', 'b', 'base']))
  })

  it('composes on mixins across nested mixins', (t) => {
    let calls: string[] = []

    let withOnA = createMixin<HTMLElement>((handle) => (props: {}) => (
      <handle.element
        {...props}
        mix={[
          on('click', () => {
            calls.push('a')
          }),
        ]}
      />
    ))

    let withOnB = createMixin<HTMLElement>((handle) => (props: {}) => (
      <handle.element
        {...props}
        mix={[
          on('click', () => {
            calls.push('b')
          }),
        ]}
      />
    ))

    let { container, root } = t.render(
      <button
        mix={[
          withOnA(),
          withOnB(),
          on('click', () => {
            calls.push('base')
          }),
        ]}
      >
        click
      </button>,
    )
    root.flush()

    let button = container.querySelector('button')
    invariant(button)
    button.click()
    root.flush()
    assert.deepEqual(calls, ['base', 'a', 'b'])
  })

  it('supports on mixin helper composition standalone', (t) => {
    let calls: string[] = []
    let { container, root } = t.render(
      <button
        mix={[
          on('click', () => {
            calls.push('first')
          }),
          on('click', () => {
            calls.push('second')
          }),
        ]}
      >
        click
      </button>,
    )
    root.flush()

    let button = container.querySelector('button')
    invariant(button)
    button.click()
    root.flush()
    assert.deepEqual(calls, ['first', 'second'])
  })

  it('updates only host props when mixin calls handle.update', (t) => {
    let appRenderCount = 0

    let withCounter = createMixin<HTMLButtonElement>((handle) => {
      let count = 0
      return (props: { ['data-count']?: string }) => (
        <handle.element
          {...props}
          data-count={String(count)}
          mix={[
            on('click', () => {
              count++
              handle.update()
            }),
          ]}
        />
      )
    })

    function App(_handle: Handle) {
      appRenderCount++
      return () => <button mix={[withCounter()]}>click</button>
    }

    let { container, root } = t.render(<App />)
    root.flush()

    let button = container.querySelector('button')
    invariant(button)
    assert.equal(button.getAttribute('data-count'), '0')
    assert.equal(appRenderCount, 1)

    button.click()
    root.flush()

    assert.equal(button.getAttribute('data-count'), '1')
    assert.equal(appRenderCount, 1)
  })

  it('dispatches reclaimed on persisted reuse without rerunning insert or remove', async (t) => {
    let insertCalls = 0
    let reclaimedCalls = 0
    let removeCalls = 0
    let beforeRemoveCalls = 0
    let resolvePending: (() => void) | null = null

    let withReclaimLifecycle = createMixin((handle) => {
      handle.addEventListener('insert', () => {
        insertCalls++
      })
      handle.addEventListener('reclaimed', () => {
        reclaimedCalls++
      })
      handle.addEventListener('beforeRemove', (event) => {
        beforeRemoveCalls++
        event.persistNode(
          (signal) =>
            new Promise<void>((resolve) => {
              let done = () => resolve()
              resolvePending = done
              signal.addEventListener('abort', done, { once: true })
            }),
        )
      })
      handle.addEventListener('remove', () => {
        removeCalls++
      })
      return (props: { id?: string }) => <handle.element {...props} id="reclaimed-target" />
    })

    let { root } = t.render(<div key="reclaimed" mix={[withReclaimLifecycle()]} />)
    root.flush()
    assert.equal(insertCalls, 1)
    assert.equal(reclaimedCalls, 0)
    assert.equal(removeCalls, 0)

    root.render(null)
    root.flush()
    await Promise.resolve()
    assert.equal(beforeRemoveCalls, 1)
    assert.equal(removeCalls, 0)

    root.render(<div key="reclaimed" mix={[withReclaimLifecycle()]} />)
    root.flush()
    await Promise.resolve()

    assert.equal(insertCalls, 1)
    assert.equal(reclaimedCalls, 1)
    assert.equal(removeCalls, 0)

    if (resolvePending !== null) {
      ;(resolvePending as () => void)()
    }
  })

  it('defers host removal when beforeRemove.persistNode is used', async (t) => {
    let releaseRemoval: (() => void) | null = null
    let beforeRemoveCalls = 0
    let removeCalls = 0
    let withDeferredRemove = createMixin((handle) => {
      handle.addEventListener('beforeRemove', (event) => {
        beforeRemoveCalls++
        event.persistNode(
          () =>
            new Promise<void>((resolve) => {
              releaseRemoval = () => resolve()
            }),
        )
      })
      handle.addEventListener('remove', () => {
        removeCalls++
      })
      return (props: { id?: string }) => <handle.element {...props} id="deferred-remove" />
    })

    let { container, root } = t.render(<div key="deferred" mix={[withDeferredRemove()]} />)
    root.flush()

    let beforeRemove = container.querySelector('#deferred-remove')
    invariant(beforeRemove)

    root.render(null)
    root.flush()
    await Promise.resolve()
    assert.equal(beforeRemoveCalls, 1)
    assert.equal(removeCalls, 0)
    assert.equal(container.querySelector('#deferred-remove'), beforeRemove)

    let release =
      releaseRemoval ??
      (() => {
        throw new Error('expected deferred remove callback')
      })
    release()
    await new Promise((resolve) => setTimeout(resolve, 0))
    assert.equal(removeCalls, 1)
    assert.equal(container.querySelector('#deferred-remove'), null)
  })
})
