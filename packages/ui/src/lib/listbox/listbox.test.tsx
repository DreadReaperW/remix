import { afterEach, describe, expect, it, vi } from 'vitest'

import { createRoot, on, ref, type RemixNode } from '@remix-run/component'

import { popover } from '../popover/popover.ts'
import { listbox } from './listbox.ts'
import type { ListboxEvent } from './listbox.ts'

let roots: ReturnType<typeof createRoot>[] = []
let flashDurationMs = 60

function renderApp(node: RemixNode) {
  let container = document.createElement('div')
  document.body.append(container)
  let root = createRoot(container)
  root.render(node)
  root.flush()
  roots.push(root)
  return { container, root }
}

function renderStaticListbox() {
  return (
    <listbox.context>
      <ul aria-label="Frameworks" mix={listbox.list()}>
        <li mix={listbox.option({ label: 'Remix', value: 'remix' })}>Remix</li>
        <li mix={listbox.option({ disabled: true, label: 'React Router', value: 'react-router' })}>
          React Router
        </li>
        <li mix={listbox.option({ label: 'React', value: 'react' })}>React</li>
        <li mix={listbox.option({ label: 'Preact', value: 'preact' })}>Preact</li>
      </ul>
    </listbox.context>
  )
}

function renderStaticMultiListbox() {
  return (
    <listbox.context multiple>
      <ul aria-label="Frameworks" mix={listbox.list()}>
        <li mix={listbox.option({ label: 'Remix', value: 'remix' })}>Remix</li>
        <li mix={listbox.option({ disabled: true, label: 'React Router', value: 'react-router' })}>
          React Router
        </li>
        <li mix={listbox.option({ label: 'React', value: 'react' })}>React</li>
        <li mix={listbox.option({ label: 'Preact', value: 'preact' })}>Preact</li>
      </ul>
    </listbox.context>
  )
}

function renderListboxInPopover({ closeOnChange = true }: { closeOnChange?: boolean } = {}) {
  let popoverRef!: HTMLElement

  return (
    <popover.context>
      <button id="trigger" mix={popover.button({ placement: 'bottom-start' })}>
        Filters
      </button>
      <listbox.context>
        <div
          id="surface"
          aria-label="Frameworks"
          mix={[
            popover.surface(),
            listbox.list(),
            popover.initialFocus(),
            ref((node) => {
              popoverRef = node
            }),
            closeOnChange
              ? on(listbox.change, () => {
                  popoverRef.hidePopover()
                })
              : undefined,
          ]}
        >
          <div mix={listbox.option({ label: 'Remix', value: 'remix' })}>Remix</div>
          <div mix={listbox.option({ label: 'React', value: 'react' })}>React</div>
          <div mix={listbox.option({ label: 'Preact', value: 'preact' })}>Preact</div>
        </div>
      </listbox.context>
      <button id="outside">Outside</button>
    </popover.context>
  )
}

function getList(container: HTMLElement) {
  return container.querySelector('[role="listbox"]') as HTMLElement
}

function getOptionByText(container: HTMLElement, text: string) {
  return Array.from(container.querySelectorAll<HTMLElement>('[role="option"]')).find(
    (option) => option.textContent?.trim() === text,
  ) as HTMLElement
}

function key(target: HTMLElement, key: string) {
  target.dispatchEvent(
    new KeyboardEvent('keydown', {
      bubbles: true,
      key,
    }),
  )
}

function pointer(
  target: HTMLElement,
  type: 'click' | 'pointerdown' | 'pointerleave' | 'pointermove' | 'pointerup',
  options: { button?: number } = {},
) {
  target.dispatchEvent(
    new MouseEvent(type, {
      bubbles: true,
      button: options.button ?? 0,
    }),
  )
}

async function settle(root: ReturnType<typeof createRoot>) {
  await Promise.resolve()
  root.flush()
  await Promise.resolve()
  root.flush()
}

async function settleFrames(root: ReturnType<typeof createRoot>) {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve()
      })
    })
  })
  await settle(root)
}

async function finishSelectionFlash(root: ReturnType<typeof createRoot>) {
  await vi.advanceTimersByTimeAsync(flashDurationMs)
  await settle(root)
}

afterEach(() => {
  for (let root of roots) {
    root.render(null)
    root.flush()
  }
  roots = []
  document.body.innerHTML = ''
  vi.useRealTimers()
})

describe('listbox', () => {
  it('makes the list focusable without activating an option on focus', async () => {
    let { container, root } = renderApp(renderStaticListbox())
    let list = getList(container)
    let remix = getOptionByText(container, 'Remix')

    list.focus()
    await settle(root)

    expect(list.getAttribute('role')).toBe('listbox')
    expect(list.tabIndex).toBe(0)
    expect(document.activeElement).toBe(list)
    expect(list.getAttribute('aria-activedescendant')).toBe(null)
    expect(remix.dataset.highlighted).toBe('false')
    expect(remix.getAttribute('aria-selected')).toBe('false')
  })

  it('ArrowUp and ArrowDown move the active descendant and skip disabled options', async () => {
    let { container, root } = renderApp(renderStaticListbox())
    let list = getList(container)
    let remix = getOptionByText(container, 'Remix')
    let react = getOptionByText(container, 'React')
    let preact = getOptionByText(container, 'Preact')

    list.focus()
    await settle(root)

    expect(list.getAttribute('aria-activedescendant')).toBe(null)

    key(list, 'ArrowDown')
    await settle(root)

    expect(list.getAttribute('aria-activedescendant')).toBe(remix.id)
    expect(remix.dataset.highlighted).toBe('true')

    key(list, 'ArrowDown')
    await settle(root)

    expect(list.getAttribute('aria-activedescendant')).toBe(react.id)
    expect(react.dataset.highlighted).toBe('true')

    key(list, 'ArrowDown')
    await settle(root)

    expect(list.getAttribute('aria-activedescendant')).toBe(preact.id)

    key(list, 'ArrowUp')
    await settle(root)

    expect(list.getAttribute('aria-activedescendant')).toBe(react.id)
  })

  it('Enter and Space select the focused option and bubble a ListboxEvent with value details', async () => {
    vi.useFakeTimers()

    let { container, root } = renderApp(
      <div>
        <listbox.context>
          <ul aria-label="Frameworks" mix={listbox.list()}>
            <li mix={listbox.option({ label: 'Remix', value: 'remix' })}>Remix</li>
            <li
              mix={listbox.option({ disabled: true, label: 'React Router', value: 'react-router' })}
            >
              React Router
            </li>
            <li mix={listbox.option({ label: 'React', value: 'react' })}>React</li>
            <li mix={listbox.option({ label: 'Preact', value: 'preact' })}>Preact</li>
          </ul>
        </listbox.context>
      </div>,
    )
    let changes: ListboxEvent[] = []
    container.addEventListener(listbox.change, (event) => {
      changes.push(event as ListboxEvent)
    })

    let list = getList(container)
    let react = getOptionByText(container, 'React')
    let preact = getOptionByText(container, 'Preact')

    list.focus()
    await settle(root)

    key(list, 'ArrowDown')
    await settle(root)
    key(list, 'ArrowDown')
    await settle(root)
    key(list, 'Enter')
    await settle(root)

    expect(changes).toHaveLength(0)
    expect(react.dataset.flash).toBe('true')
    expect(react.getAttribute('aria-selected')).toBe('true')

    await finishSelectionFlash(root)

    expect(changes).toHaveLength(1)
    expect(changes[0].label).toBe('React')
    expect(changes[0].optionId).toBe(react.id)
    expect(changes[0].value).toBe('react')
    expect(changes[0].values).toEqual(['react'])
    expect(changes[0].focusValue).toBe('react')
    expect(react.getAttribute('aria-selected')).toBe('true')

    key(list, 'ArrowDown')
    await settle(root)
    key(list, ' ')
    await settle(root)

    expect(changes).toHaveLength(1)
    expect(preact.dataset.flash).toBe('true')
    expect(preact.getAttribute('aria-selected')).toBe('true')
    expect(react.getAttribute('aria-selected')).toBe('false')

    await finishSelectionFlash(root)

    expect(changes).toHaveLength(2)
    expect(changes[1].label).toBe('Preact')
    expect(changes[1].optionId).toBe(preact.id)
    expect(changes[1].value).toBe('preact')
    expect(changes[1].values).toEqual(['preact'])
    expect(changes[1].focusValue).toBe('preact')
    expect(preact.getAttribute('aria-selected')).toBe('true')
    expect(react.getAttribute('aria-selected')).toBe('false')
  })

  it('renders hidden inputs from listbox selection state when name is provided', async () => {
    vi.useFakeTimers()

    let { container, root } = renderApp(
      <listbox.context defaultValues={['react']} name="framework">
        <ul aria-label="Frameworks" mix={listbox.list()}>
          <li mix={listbox.option({ label: 'Remix', value: 'remix' })}>Remix</li>
          <li
            mix={listbox.option({ disabled: true, label: 'React Router', value: 'react-router' })}
          >
            React Router
          </li>
          <li mix={listbox.option({ label: 'React', value: 'react' })}>React</li>
          <li mix={listbox.option({ label: 'Preact', value: 'preact' })}>Preact</li>
        </ul>
      </listbox.context>,
    )

    let hiddenInput = container.querySelector('input[type="hidden"]') as HTMLInputElement
    let list = getList(container)
    let react = getOptionByText(container, 'React')
    let preact = getOptionByText(container, 'Preact')

    expect(hiddenInput.value).toBe('react')
    expect(react.getAttribute('aria-selected')).toBe('true')

    list.focus()
    await settle(root)
    key(list, 'ArrowDown')
    await settle(root)
    key(list, 'Enter')
    await settle(root)

    expect(preact.getAttribute('data-flash')).toBe('true')
    expect(hiddenInput.value).toBe('preact')

    await finishSelectionFlash(root)

    expect(hiddenInput.value).toBe('preact')
  })

  it('pointermove makes an enabled option active without selecting it', async () => {
    let { container, root } = renderApp(renderStaticListbox())
    let changes: ListboxEvent[] = []
    container.addEventListener(listbox.change, (event) => {
      changes.push(event as ListboxEvent)
    })

    let list = getList(container)
    let remix = getOptionByText(container, 'Remix')
    let react = getOptionByText(container, 'React')

    list.focus()
    await settle(root)

    pointer(react, 'pointermove')
    await settle(root)

    expect(changes).toHaveLength(0)
    expect(list.getAttribute('aria-activedescendant')).toBe(react.id)
    expect(react.dataset.highlighted).toBe('true')
    expect(remix.dataset.highlighted).toBe('false')
    expect(react.getAttribute('aria-selected')).toBe('false')
  })

  it('pointerleave clears the active item without selecting it', async () => {
    let { container, root } = renderApp(renderStaticListbox())
    let changes: ListboxEvent[] = []
    container.addEventListener(listbox.change, (event) => {
      changes.push(event as ListboxEvent)
    })

    let list = getList(container)
    let react = getOptionByText(container, 'React')

    list.focus()
    await settle(root)

    pointer(react, 'pointermove')
    await settle(root)

    pointer(react, 'pointerleave')
    await settle(root)

    expect(changes).toHaveLength(0)
    expect(list.getAttribute('aria-activedescendant')).toBe(null)
    expect(react.dataset.highlighted).toBe('false')
    expect(react.getAttribute('aria-selected')).toBe('false')
  })

  it('pressing an option selects it once and returns focus to the list', async () => {
    vi.useFakeTimers()

    let { container, root } = renderApp(renderStaticListbox())
    let changes: ListboxEvent[] = []
    container.addEventListener(listbox.change, (event) => {
      changes.push(event as ListboxEvent)
    })

    let list = getList(container)
    let react = getOptionByText(container, 'React')

    pointer(react, 'pointerdown')
    pointer(react, 'pointerup')
    pointer(react, 'click')
    await settle(root)

    expect(changes).toHaveLength(0)
    expect(react.dataset.flash).toBe('true')
    expect(react.getAttribute('aria-selected')).toBe('true')
    expect(list.getAttribute('aria-activedescendant')).toBe(react.id)
    expect(document.activeElement).toBe(list)

    await finishSelectionFlash(root)

    expect(changes).toHaveLength(1)
    expect(changes[0].value).toBe('react')
  })

  it('selects the option under pointerup after dragging from another option', async () => {
    vi.useFakeTimers()

    let { container, root } = renderApp(renderStaticListbox())
    let changes: ListboxEvent[] = []
    container.addEventListener(listbox.change, (event) => {
      changes.push(event as ListboxEvent)
    })

    let list = getList(container)
    let react = getOptionByText(container, 'React')
    let preact = getOptionByText(container, 'Preact')

    pointer(react, 'pointerdown')
    await settle(root)
    pointer(preact, 'pointermove')
    await settle(root)
    pointer(preact, 'pointerup')
    pointer(preact, 'click')
    await settle(root)

    expect(changes).toHaveLength(0)
    expect(preact.dataset.flash).toBe('true')
    expect(list.getAttribute('aria-activedescendant')).toBe(preact.id)
    expect(preact.getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(list)

    await finishSelectionFlash(root)

    expect(changes).toHaveLength(1)
    expect(changes[0].value).toBe('preact')
    expect(changes[0].values).toEqual(['preact'])
    expect(changes[0].focusValue).toBe('preact')
    expect(list.getAttribute('aria-activedescendant')).toBe(preact.id)
    expect(react.getAttribute('aria-selected')).toBe('false')
    expect(preact.getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(list)
  })

  it('keeps the selected option active when pointerleave fires during popover close', async () => {
    let { container, root } = renderApp(renderListboxInPopover())
    let trigger = container.querySelector('#trigger') as HTMLElement
    let surface = container.querySelector('#surface') as HTMLElement
    let list = getList(container)
    let react = getOptionByText(container, 'React')

    pointer(trigger, 'pointerdown')
    await settleFrames(root)

    expect(surface.matches(':popover-open')).toBe(true)

    vi.useFakeTimers()

    pointer(react, 'pointermove')
    await settle(root)
    pointer(react, 'pointerdown')
    pointer(react, 'pointerup')
    pointer(react, 'click')
    await settle(root)

    expect(surface.matches(':popover-open')).toBe(true)

    await finishSelectionFlash(root)

    expect(surface.matches(':popover-open')).toBe(false)

    vi.useRealTimers()

    pointer(react, 'pointerleave')
    await settle(root)

    expect(list.getAttribute('aria-activedescendant')).toBe(react.id)
    expect(react.dataset.highlighted).toBe('true')
    expect(react.getAttribute('aria-selected')).toBe('true')

    pointer(trigger, 'pointerdown')
    await settleFrames(root)

    expect(surface.matches(':popover-open')).toBe(true)
    expect(list.getAttribute('aria-activedescendant')).toBe(react.id)
    expect(react.dataset.highlighted).toBe('true')
  })

  it('restores the selected option highlight when a containing popover starts opening', async () => {
    let { container, root } = renderApp(renderListboxInPopover({ closeOnChange: false }))
    let trigger = container.querySelector('#trigger') as HTMLElement
    let outside = container.querySelector('#outside') as HTMLElement
    let surface = container.querySelector('#surface') as HTMLElement
    let list = getList(container)
    let react = getOptionByText(container, 'React')

    pointer(trigger, 'pointerdown')
    await settle(root)
    pointer(trigger, 'pointerup')
    pointer(trigger, 'click')
    await settleFrames(root)

    vi.useFakeTimers()

    pointer(react, 'pointerdown')
    pointer(react, 'pointerup')
    pointer(react, 'click')
    await settle(root)

    await finishSelectionFlash(root)

    expect(react.getAttribute('aria-selected')).toBe('true')
    expect(list.getAttribute('aria-activedescendant')).toBe(react.id)

    vi.useRealTimers()

    pointer(react, 'pointerleave')
    await settle(root)

    expect(list.getAttribute('aria-activedescendant')).toBe(null)
    expect(react.dataset.highlighted).toBe('false')

    pointer(outside, 'pointerdown')
    await settle(root)

    expect(surface.matches(':popover-open')).toBe(false)

    pointer(trigger, 'pointerdown')
    await settle(root)

    expect(surface.matches(':popover-open')).toBe(true)
    expect(list.getAttribute('aria-activedescendant')).toBe(react.id)
    expect(react.dataset.highlighted).toBe('true')
  })

  it('sets aria-multiselectable and toggles selections with Space in multiple mode', async () => {
    let { container, root } = renderApp(renderStaticMultiListbox())
    let changes: ListboxEvent[] = []
    container.addEventListener(listbox.change, (event) => {
      changes.push(event as ListboxEvent)
    })

    let list = getList(container)
    let remix = getOptionByText(container, 'Remix')
    let react = getOptionByText(container, 'React')

    list.focus()
    await settle(root)

    expect(list.getAttribute('aria-multiselectable')).toBe('true')

    key(list, 'ArrowDown')
    await settle(root)
    key(list, ' ')
    await settle(root)

    expect(changes).toHaveLength(1)
    expect(changes[0].value).toBe('remix')
    expect(changes[0].values).toEqual(['remix'])
    expect(changes[0].focusValue).toBe('remix')
    expect(remix.getAttribute('aria-selected')).toBe('true')

    key(list, 'ArrowDown')
    await settle(root)
    key(list, ' ')
    await settle(root)

    expect(changes).toHaveLength(2)
    expect(changes[1].value).toBe('react')
    expect(changes[1].values).toEqual(['remix', 'react'])
    expect(changes[1].focusValue).toBe('react')
    expect(remix.getAttribute('aria-selected')).toBe('true')
    expect(react.getAttribute('aria-selected')).toBe('true')

    key(list, ' ')
    await settle(root)

    expect(changes).toHaveLength(3)
    expect(changes[2].value).toBe('remix')
    expect(changes[2].values).toEqual(['remix'])
    expect(changes[2].focusValue).toBe('react')
    expect(remix.getAttribute('aria-selected')).toBe('true')
    expect(react.getAttribute('aria-selected')).toBe('false')
  })

  it('Enter replaces the selection with only the focused option in multiple mode', async () => {
    vi.useFakeTimers()

    let { container, root } = renderApp(renderStaticMultiListbox())
    let changes: ListboxEvent[] = []
    container.addEventListener(listbox.change, (event) => {
      changes.push(event as ListboxEvent)
    })

    let list = getList(container)
    let remix = getOptionByText(container, 'Remix')
    let react = getOptionByText(container, 'React')
    let preact = getOptionByText(container, 'Preact')

    list.focus()
    await settle(root)

    key(list, 'ArrowDown')
    await settle(root)
    key(list, ' ')
    await settle(root)
    key(list, 'ArrowDown')
    await settle(root)
    key(list, ' ')
    await settle(root)
    key(list, 'ArrowDown')
    await settle(root)
    key(list, 'Enter')
    await settle(root)

    expect(changes).toHaveLength(2)
    expect(preact.dataset.flash).toBe('true')
    expect(remix.getAttribute('aria-selected')).toBe('false')
    expect(react.getAttribute('aria-selected')).toBe('false')
    expect(preact.getAttribute('aria-selected')).toBe('true')

    await finishSelectionFlash(root)

    expect(changes).toHaveLength(3)
    expect(changes[2].value).toBe('preact')
    expect(changes[2].values).toEqual(['preact'])
    expect(changes[2].focusValue).toBe('preact')
    expect(remix.getAttribute('aria-selected')).toBe('false')
    expect(react.getAttribute('aria-selected')).toBe('false')
    expect(preact.getAttribute('aria-selected')).toBe('true')
  })

  it('press toggles options in multiple mode while preserving selection order', async () => {
    let { container, root } = renderApp(renderStaticMultiListbox())
    let changes: ListboxEvent[] = []
    container.addEventListener(listbox.change, (event) => {
      changes.push(event as ListboxEvent)
    })

    let react = getOptionByText(container, 'React')
    let preact = getOptionByText(container, 'Preact')

    pointer(react, 'pointerdown')
    pointer(react, 'pointerup')
    pointer(react, 'click')
    await settle(root)

    pointer(preact, 'pointerdown')
    pointer(preact, 'pointerup')
    pointer(preact, 'click')
    await settle(root)

    pointer(react, 'pointerdown')
    pointer(react, 'pointerup')
    pointer(react, 'click')
    await settle(root)

    expect(changes).toHaveLength(3)
    expect(changes[0].values).toEqual(['react'])
    expect(changes[1].values).toEqual(['react', 'preact'])
    expect(changes[2].value).toBe('preact')
    expect(changes[2].values).toEqual(['preact'])
    expect(react.getAttribute('aria-selected')).toBe('false')
    expect(preact.getAttribute('aria-selected')).toBe('true')
  })
})
