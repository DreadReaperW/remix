---
name: author-ui-components
description: Build idiomatic components and mixins for packages/ui. Use when authoring or revising first-party Remix UI primitives, popup-backed controls, or element mixins that should use setup-scope state, explicit updates, component context for internal coordination, and bubbling DOM events for external communication.
---

# Author UI Components

## Overview

Use this skill when building `packages/ui` components and mixins.

The goal is to write idiomatic Remix Component code: plain JS state in setup scope, explicit `handle.update()` calls, DOM work in handlers/tasks/lifecycle, mixins for one-element concerns, and components for tree coordination.

## Workflow

1. Start with the smallest abstraction that fits.

- Prefer elements first.
- Use a mixin when the concern belongs to one host element.
- Use a component when the concern coordinates a tree.

2. Keep state and control flow explicit.

- State is plain JS in setup scope.
- Nothing updates unless you call `handle.update()`.
- Prefer passing values directly over caching props or nodes in scope.

3. Choose the right communication path.

- Use component context for internal coordination.
- Use bubbling DOM event subclasses for external communication.
- Avoid wrapper-heavy `as` / `asChild` patterns.

4. Treat the rest of this skill as reference patterns.

Remix Component should feel familiar if you have used React or Preact.

You still write JSX. You still compose trees with components. You still attach behavior close to the markup.

The difference is the update model.

There are no reactive state containers, dependency arrays, or effect systems hidden behind render. Component state is plain JavaScript in setup scope. UI changes happen when you explicitly call `handle.update()`. Work that needs the DOM happens in event handlers and tasks, not reactive effects.

Element mixins are a powerful new abstraction. They let state, behavior, styling, attrs, and lifecycle layer onto host elements directly, which removes a lot of the wrapper-component, prop-spreading, and `as`/`asChild` style boilerplate common in other JSX libraries.

Abstractions:

- Elements: declare the final DOM shape
- Mixins: cross-cutting behavior and state layered onto one element
- Components: hierarchical behavior and state coordinated across a tree

## Elements

Like other JSX libraries, build UIs with host elements.

```tsx
<label>
  Email
  <input name="email" type="email" />
</label>
```

## Components

Components own trees.

```tsx
<Dialog title="Delete project" />
```

Components also have setup scope and render scope.

Like mixins, setup is once per instance and render is per update.

```tsx
function Counter(handle: Handle) {
  let count = 0

  return () => (
    <button
      type="button"
      mix={on('click', async () => {
        count++
        await handle.update()
      })}
    >
      {count}
    </button>
  )
}
```

Components must always return a render function, even if they do not use setup-scope values.

```tsx
// bad
function MenuButton(props: Props<'button'>) {
  return <button {...props} mix={[props.mix, ui.button.primary]} type={props.type ?? 'button'} />
}
```

```tsx
// good
function MenuButton(handle: Handle) {
  return (props: Props<'button'>) => (
    <button {...props} mix={[props.mix, ui.button.primary]} type={props.type ?? 'button'} />
  )
}
```

Component state is just plain JS variables in setup scope.

Nothing is reactive by itself. Updates happen when you call `handle.update()`.

```tsx
function Disclosure(handle: Handle) {
  let open = false

  return ({ label, children }: { label: string; children?: RemixNode }) => (
    <div>
      <button
        type="button"
        mix={on('click', async () => {
          open = !open
          await handle.update()
        })}
      >
        {label}
      </button>
      {open ? <div>{children}</div> : null}
    </div>
  )
}
```

## Mixins

Mixins add behavior, styling, attrs, and lifecycle to one element.

```tsx
<button mix={on('click', () => {})} />
```

```tsx
<button mix={[on('click', () => {}), css({ color: 'red' })]} />
```

Nested arrays are fine.

The runtime flattens them.

```tsx
<button mix={[props.mix, [ui.button.primary, disabled ? ui.item.selected : undefined]]} />
```

Do not normalize mix arrays manually.

The runtime ignores `undefined` items for you.

```tsx
<button mix={[props.mix, ui.button.primary]} />
```

```tsx
<button mix={props.mix ? [props.mix, ui.button.primary] : [ui.button.primary]} />
```

## Defining Mixins

Mixins have setup scope and render scope.

Setup runs once per element instance. Render runs on every update.

Unlike components, mixins may be setup-only and return nothing.

```tsx
import { createMixin } from 'remix/component'
import type { ElementProps } from 'remix/component'

let autofocus = createMixin<HTMLInputElement, [], ElementProps>((handle) => {
  // setup
  let node: HTMLInputElement

  handle.addEventListener('insert', (event) => {
    node = event.node
    node.focus()
  })

  return () => {
    // render
    return <handle.element />
  }
})
```

```tsx
let passthrough = createMixin((_handle) => {})
```

Use `handle.element` as the placeholder for the host element.

It represents the same host node as mixins layer onto it.

```tsx
let dataState = createMixin<HTMLElement, [state: string], ElementProps>((handle) => {
  return (state) => <handle.element data-state={state} />
})
```

Mixin render functions receive:

- mixin args
- current host props after previous mixins

They do not own:

- `props.children`
- `props.mix`

They still participate in producing the final host props.

Forward props to the host element unless you are intentionally changing something.

```tsx
let buttonType = createMixin<HTMLButtonElement, [type: 'button' | 'submit'], ElementProps>(
  (handle) => {
    return (type, props) => <handle.element {...props} type={props.type ?? type} />
  },
)
```

## Context

Use component context for internal coordination.

Context is how descendants see the current component state without prop threading.

```tsx
type TabsContext = {
  selected: string | null
}

function Tabs(handle: Handle<TabsContext>) {
  let selected = 'overview'

  return ({ children }: { children?: RemixNode }) => {
    handle.context.set({ selected })
    return <div>{children}</div>
  }
}
```

Read context from descendants with the component function.

```tsx
function Tab(handle: Handle) {
  return ({ value, children }: { value: string; children?: RemixNode }) => {
    let tabs = handle.context.get(Tabs)

    return (
      <button type="button" aria-selected={tabs.selected === value}>
        {children}
      </button>
    )
  }
}
```

For external communication use real bubbling DOM events.

```tsx
export let tabsChangeEventType = 'rmx:tabs-change' as const

type TabsComponent = typeof TabsImpl & {
  readonly change: typeof tabsChangeEventType
}

declare global {
  interface HTMLElementEventMap {
    [tabsChangeEventType]: TabsChangeEvent
  }
}

export class TabsChangeEvent extends Event {
  value: string

  constructor(value: string) {
    super(tabsChangeEventType, { bubbles: true })
    this.value = value
  }
}

function TabsImpl(handle: Handle<TabsContext>) {
  let selected = 'overview'

  return ({ children }: { children?: RemixNode }) => {
    handle.context.set({ selected })
    return <div>{children}</div>
  }
}

export let Tabs = Object.assign(TabsImpl, {
  change: tabsChangeEventType,
}) as TabsComponent

button.dispatchEvent(new TabsChangeEvent('activity'))
```

```tsx
<div
  mix={on(Tabs.change, (event) => {
    console.log(event.value)
  })}
/>
```

## Choosing Mixins vs Components

Use a mixin when the concern belongs to one host element.

Use a component when the concern coordinates multiple elements.

Prefer a mixin when you would otherwise introduce a wrapper just to add styling, attrs, listeners, refs, tasks, or context participation to one element.

Prefer a component when you need to render structure, own layout, or coordinate state, focus, or behavior across a tree.

Bad: component wrapper just to configure one popup element

```tsx
function Popover(handle: Handle) {
  let cleanupAnchor = () => {}

  return (props: Props<'div'>) => {
    props.id ??= handle.id
    props.popover ??= 'manual'

    return (
      <div
        {...props}
        mix={[
          props.mix,
          ui.popover.surface,
          on('beforetoggle', (event) => {
            if (event.newState !== 'open') return
            let owner = document.querySelector(`[popovertarget="${props.id}"]`)
            if (!(owner instanceof HTMLElement)) return
            cleanupAnchor()
            cleanupAnchor = anchor(event.currentTarget, owner, { placement: 'bottom-start' })
          }),
          on('toggle', (event) => {
            if (event.newState === 'closed') cleanupAnchor()
          }),
        ]}
      />
    )
  }
}

let el = <Popover placement="bottom-start" />
```

Good: mixin layered onto the host element

```tsx
let popover = createMixin<HTMLElement, [options?: AnchorOptions], ElementProps>((handle) => {
  let cleanupAnchor = () => {}

  return (options, props) => {
    props.id ??= handle.id
    props.popover ??= 'manual'

    return (
      <handle.element
        {...props}
        mix={[
          ui.popover.surface,
          on('beforetoggle', (event) => {
            if (event.newState !== 'open') return
            let owner = document.querySelector(`[popovertarget="${props.id}"]`)
            if (!(owner instanceof HTMLElement)) return
            cleanupAnchor()
            cleanupAnchor = anchor(event.currentTarget, owner, options)
          }),
          on('toggle', (event) => {
            if (event.newState === 'closed') cleanupAnchor()
          }),
        ]}
      />
    )
  }
})

let popup = <div mix={popover({ placement: 'bottom-start' })} />
```

## Cleanup

Use `on(...)` for element events, they cleanup automatically.

The runtime binds and unbinds them with the element lifecycle.

```tsx
<button mix={on('click', () => {})} />
```

Use `handle.signal` for global listeners.

The signal aborts when the component is removed.

```tsx
function EscapeToClose(handle: Handle) {
  let open = false

  handle.queueTask(() => {
    document.addEventListener(
      'keydown',
      async (event) => {
        if (event.key !== 'Escape' || !open) return
        open = false
        await handle.update()
      },
      { signal: handle.signal },
    )
  })

  return () => <div />
}
```

Mixin lifecycle semantics:

- `insert` runs once when the host node is first bound
- `reclaimed` runs when a persisted node is reused
- `beforeRemove` runs before teardown and can persist the node
- `remove` runs once when the mixin lifecycle actually ends

Mixin cleanup belongs in the handle's remove event

```tsx
let resizeObserver = createMixin<HTMLElement, [], ElementProps>((handle) => {
  let observer: ResizeObserver | undefined

  handle.addEventListener('insert', (event) => {
    observer = new ResizeObserver(() => {})
    observer.observe(event.node)
  })

  handle.addEventListener('remove', () => {
    observer?.disconnect()
  })
})
```

Cleanup side effects. Do not null out scoped values just to "clean up". Garbage collection will clean it up.

```tsx
// bad
let measure = createMixin<HTMLElement, [], ElementProps>((handle) => {
  let observer: ResizeObserver | undefined
  let node: HTMLElement | undefined

  handle.addEventListener('insert', (event) => {
    node = event.node
    observer = new ResizeObserver(() => {})
    observer.observe(node)
  })

  handle.addEventListener('remove', () => {
    observer?.disconnect()
    observer = undefined
    node = undefined
  })
})
```

```tsx
// good
let measure = createMixin<HTMLElement, [], ElementProps>((handle) => {
  let observer: ResizeObserver | undefined
  let node: HTMLElement

  handle.addEventListener('insert', (event) => {
    node = event.node
    observer = new ResizeObserver(() => {})
    observer.observe(node)
  })

  handle.addEventListener('remove', () => {
    observer?.disconnect()
  })
})
```

Same rule in `ref(...)` abort cleanup.

```tsx
// bad
let popupNode: HTMLDivElement | undefined
;<div
  mix={ref((node, signal) => {
    popupNode = node

    signal.addEventListener('abort', () => {
      popupNode = undefined
    })
  })}
/>
```

```tsx
// good
let popupNode: HTMLDivElement
;<div
  mix={ref((node, signal) => {
    popupNode = node
  })}
/>
```

## State

Avoid unnecessary setup-scope state.

If a value only matters during one callback, keep it in that callback.

Often the right lifetime is narrower:

- event handler scope
- task scope
- `ref(...)` scope
- `insert` callback scope

Keep state in the handlers that need them:

```tsx
// over-stateful
let measure = createMixin<HTMLElement, [], ElementProps>((handle) => {
  let observer: ResizeObserver | undefined

  handle.addEventListener('insert', (event) => {
    observer = new ResizeObserver(() => {})
    observer.observe(event.node)
  })

  handle.addEventListener('remove', () => {
    observer?.disconnect()
  })

  return () => handle.element
})
```

```tsx
// tighter
let measure = createMixin<HTMLElement, [], ElementProps>((handle) => {
  handle.addEventListener('insert', (event) => {
    let observer = new ResizeObserver(() => {})
    observer.observe(event.node)

    handle.addEventListener('remove', () => {
      observer.disconnect()
    })
  })

  return () => handle.element
})
```

Pass props to helpers instead of caching props into the setup scope:

```tsx
// over-stateful
function Field(handle: Handle) {
  let currentProps: { value: string } = { value: '' }

  function submit() {
    save(currentProps.value)
  }

  return (props: { value: string }) => {
    currentProps = props

    return (
      <button
        type="button"
        mix={on('click', () => {
          submit()
        })}
      />
    )
  }
}
```

```tsx
// tighter
function Field(handle: Handle) {
  function submit(value: string) {
    save(value)
  }

  return (props: { value: string }) => (
    <button
      type="button"
      mix={on('click', () => {
        submit(props.value)
      })}
    />
  )
}
```

Pass nodes from event objects instead of storing on variables when possible:

```tsx
// over-stateful
function MenuButton(handle: Handle) {
  let buttonNode: HTMLButtonElement

  function openMenu() {
    positionMenu(buttonNode)
  }

  return () => (
    <button
      type="button"
      mix={[
        ref((node) => {
          buttonNode = node
        }),
        on('click', () => {
          openMenu()
        }),
      ]}
    />
  )
}
```

```tsx
// tighter
function MenuButton(handle: Handle) {
  function openMenu(buttonNode: HTMLButtonElement) {
    positionMenu(buttonNode)
  }

  return () => (
    <button
      type="button"
      mix={on('click', (event) => {
        openMenu(event.currentTarget)
      })}
    />
  )
}
```

## Imperative DOM Work

Do imperative work:

- in event handlers
- in queued tasks that are intentionally reactive

Prefer event handlers.

The event already gives you the timing and the current node.

```tsx
on('keydown', async (event) => {
  if (event.key !== 'ArrowDown') return

  open = true
  await handle.update()

  firstOptionNode.focus()
})
```

Prefer `event.currentTarget`.

It is typed to the listener host. `event.target` is for delegation.

```tsx
on('input', (event) => {
  let value = event.currentTarget.value
})
```

Do not build reactive state pipelines just to do DOM work later.

```tsx
// bad
function Bad(handle: Handle) {
  let shouldFocus = false // confusing state for reactive tasks
  let input: HTMLInputElement

  return () => {
    handle.queueTask(() => {
      // confusing reactive task
      if (shouldFocus) input.focus()
    })

    return (
      <>
        <input
          mix={ref((node) => {
            input = node
          })}
        />
        <button
          mix={on('click', async () => {
            shouldFocus = true
            void handle.update()
          })}
        />
      </>
    )
  }
}
```

```tsx
// good
function Good(handle: Handle) {
  let input: HTMLInputElement

  return () => (
    <>
      <input
        mix={ref((node) => {
          input = node
        })}
      />
      <button
        type="button"
        mix={on('click', async () => {
          await handle.update()
          // do the work after the update in the same handler
          input.focus()
        })}
      />
    </>
  )
}
```

Examples:

```tsx
on('click', async (event) => {
  await handle.update()
  event.currentTarget.scrollIntoView({ block: 'nearest' })
})
```

```tsx
on('click', async () => {
  await flashAttribute(node, 'data-flash', 120)
  popoverElement.hidePopover()
})
```

```tsx
on('click', async () => {
  await handle.update()
  popupNode.style.minWidth = `${triggerNode.offsetWidth}px`
  popupNode.showPopover()
})
```

## Async and Time

You can await `handle.update()`.

It resolves after this component has rendered the new state.

```tsx
on('click', async () => {
  open = true
  await handle.update()

  panel.focus()
})
```

Do not add `handle.signal.aborted` checks after your own `handle.update()`.

That update already completed for this component.

Check `handle.signal.aborted` after other awaited work.

The component can be removed while unrelated async work is still pending.

```tsx
on('click', async () => {
  state = 'animating'
  await handle.update()

  let animation = node.animate()
  await animation.finished
  if (handle.signal.aborted) return

  state = 'open'
  void handle.update()
})
```

Use abort-aware utilities when possible.

They stop cleanly if the component goes away mid-transition.

```tsx
await waitForCssTransition(node, handle.signal)
```

## Styling with Themes

Theme tokens are 1:1 CSS custom property references.

```tsx
css({
  padding: theme.space.sm,
  color: theme.colors.text.primary,
})
```

UI mixins compose theme tokens and can also add attrs/defaults.

```tsx
<button mix={ui.button.primary}>Save</button>
```

```tsx
let destructiveAction = [ui.button.base, ui.button.tone.danger]
```

Prefer shared primitives over component-specific one-offs.

```tsx
// good
<button mix={ui.button.secondary} />
<a mix={ui.button.secondary} />
```

```tsx
// bad
let teamInviteButtonCss = css({
  borderRadius: '999px',
  padding: '6px 10px',
  ...
})
```

## Animation

Persistent nodes: CSS transitions.

```tsx
css({
  transition: 'opacity 150ms linear',
})
```

Conditional nodes: `animateEntrance`, `animateExit`.

```tsx
{
  open ? <div mix={animateEntrance()} /> : null
}
```

```tsx
{
  open ? <div mix={animateExit()} /> : null
}
```

FLIP/layout movement: `animateLayout`.

```tsx
<div mix={animateLayout()} />
```

Default spring timing is usually enough.

```tsx
node.animate(keyframes, spring())
```

Do not add transitions to hover/focus/highlight states by default.

```tsx
// good
css({
  '&:hover': {
    backgroundColor: theme.colors.background.surface,
  },
})
```

```tsx
// bad
css({
  transition: 'background-color 150ms ease',
  '&:hover': {
    backgroundColor: theme.colors.background.surface,
  },
})
```

## Guidance

Prefer mixins over wrapper components.

```tsx
// good
<button mix={[ui.button.primary, on(pressEvents.press, save)]} />

// bad
<PrimaryButton onPress={save} />
```

Wrapper components are best when they provide:

- familiar HTML-like APIs
- tree behavior
- context
- cross-element event orchestration

Avoid defensive code that cannot happen under the public API.

```tsx
// bad
event.currentTarget?.focus()

// good
event.currentTarget.focus()
```

```tsx
// bad
handle.queueTask(async (signal) => {
  // will never happen
  if (signal.aborted) return
  // continue task
})

// good
handle.queueTask(async () => {
  // continue task
})
```

Avoid casts when the API can be typed correctly.

```tsx
// good
on(Listbox.change, (event) => {
  event.value
})

// bad
on(Listbox.change, (event) => {
  ;(event as ListboxChangeEvent).value
})
```

Do not use `event.target` unless you are intentionally delegating.

```tsx
// good
on('input', (event) => {
  event.currentTarget.value
})

// delegation only
on('pointermove', (event) => {
  let option = event.target instanceof Element ? event.target.closest('[role="option"]') : null
})
```

For stable refs used inside tasks/listeners, do not force `null` unions unless the code truly needs them.

```tsx
// bad
let popupNode: HTMLDivElement | null = null

return () => (
  <>
    <div
      mix={ref((node) => {
        popupNode = node
      })}
    />
    <button
      type="button"
      mix={on('click', () => {
        if (!popupNode) return
        popupNode.focus()
      })}
    />
  </>
)
```

```tsx
// good
let popupNode: HTMLDivElement

return () => (
  <>
    <div
      mix={ref((node) => {
        popupNode = node
      })}
    />
    <button
      type="button"
      mix={on('click', () => {
        // runtime guarantees popupNode is available because
        // the referenced div is not rendered conditionally
        popupNode.focus()
      })}
    />
  </>
)
```
