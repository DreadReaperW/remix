import { afterEach, describe, expect, it } from 'vitest'

import { createRoot, on } from '@remix-run/component'
import type { Handle, RemixNode } from '@remix-run/component'

import { Listbox, Option } from './listbox.tsx'
import type { ListboxChangeEvent, ListboxMultipleProps, ListboxSingleProps } from './listbox.tsx'

function renderApp(node: RemixNode) {
  let container = document.createElement('div')
  document.body.append(container)
  let root = createRoot(container)
  root.render(node)
  root.flush()
  return { container, root }
}

function press(target: HTMLElement, key: string, init: KeyboardEventInit = {}) {
  target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key, ...init }))
}

function pointer(target: HTMLElement, type: 'pointerdown' | 'pointermove', init: MouseEventInit = {}) {
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, ...init }))
}

function getListbox(container: HTMLElement) {
  return container.querySelector('[role="listbox"]') as HTMLElement
}

function getOptions(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>('[role="option"]'))
}

function renderSingleListbox(props: Partial<ListboxSingleProps> = {}) {
  return (
    <Listbox aria-label="Frameworks" {...props}>
      <Option value="remix">Remix</Option>
      <Option disabled value="react-router">
        React Router
      </Option>
      <Option value="react">React</Option>
      <Option value="preact">Preact</Option>
    </Listbox>
  )
}

function renderMultipleListbox(props: Partial<ListboxMultipleProps> = {}) {
  let { multiple: _multiple, ...listboxProps } = props

  return (
    <Listbox aria-label="Frameworks" multiple {...listboxProps}>
      <Option value="remix">Remix</Option>
      <Option disabled value="react-router">
        React Router
      </Option>
      <Option value="react">React</Option>
      <Option value="preact">Preact</Option>
    </Listbox>
  )
}

function ControlledSingleListboxExample(handle: Handle) {
  let value: string | null = 'remix'

  return ({ acceptChanges = true }: { acceptChanges?: boolean } = {}) => (
    <Listbox
      aria-label="Frameworks"
      mix={on(Listbox.change, (event) => {
        if (!acceptChanges || Array.isArray(event.value)) {
          return
        }

        value = event.value
        void handle.update()
      })}
      value={value}
    >
      <Option value="remix">Remix</Option>
      <Option disabled value="react-router">
        React Router
      </Option>
      <Option value="react">React</Option>
      <Option value="preact">Preact</Option>
    </Listbox>
  )
}

function renderDisabledListbox() {
  return (
    <Listbox aria-label="Disabled frameworks">
      <Option disabled value="remix">
        Remix
      </Option>
      <Option disabled value="react-router">
        React Router
      </Option>
    </Listbox>
  )
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('Listbox', () => {
  it('highlights the first enabled option when the listbox receives focus', () => {
    let { container, root } = renderApp(renderSingleListbox())
    let listbox = getListbox(container)
    let [remixOption] = getOptions(container)

    listbox.focus()
    root.flush()

    expect(document.activeElement).toBe(listbox)
    expect(listbox.getAttribute('aria-activedescendant')).toBe(remixOption.id)
    expect(remixOption.dataset.highlighted).toBe('true')
  })

  it('skips disabled options while moving down', () => {
    let { container, root } = renderApp(renderSingleListbox())
    let listbox = getListbox(container)
    let options = getOptions(container)

    listbox.focus()
    root.flush()
    press(listbox, 'ArrowDown')
    root.flush()

    expect(listbox.getAttribute('aria-activedescendant')).toBe(options[2].id)
    expect(options[1].dataset.highlighted).toBe('false')
    expect(options[2].dataset.highlighted).toBe('true')
  })

  it('keeps the first enabled option highlighted when ArrowUp is pressed from the initial focus state', () => {
    let { container, root } = renderApp(renderSingleListbox())
    let listbox = getListbox(container)
    let options = getOptions(container)

    listbox.focus()
    root.flush()
    press(listbox, 'ArrowUp')
    root.flush()

    expect(listbox.getAttribute('aria-activedescendant')).toBe(options[0].id)
    expect(options[0].dataset.highlighted).toBe('true')
  })

  it('keeps the active descendant on blur and refocuses without reseeding', () => {
    let { container, root } = renderApp(renderSingleListbox())
    let listbox = getListbox(container)
    let options = getOptions(container)
    let outside = document.createElement('button')
    document.body.append(outside)

    listbox.focus()
    root.flush()
    press(listbox, 'ArrowDown')
    root.flush()

    expect(listbox.getAttribute('aria-activedescendant')).toBe(options[2].id)

    outside.focus()
    root.flush()

    expect(listbox.getAttribute('aria-activedescendant')).toBe(options[2].id)
    expect(options[2].dataset.highlighted).toBe('true')

    listbox.focus()
    root.flush()

    expect(listbox.getAttribute('aria-activedescendant')).toBe(options[2].id)
    expect(options[2].dataset.highlighted).toBe('true')
  })

  it('renders a controlled single value from semantic option values', () => {
    let { container, root } = renderApp(renderSingleListbox({ value: 'react' }))
    let options = getOptions(container)

    expect(options[2].getAttribute('aria-selected')).toBe('true')
    expect(options[0].getAttribute('aria-selected')).toBe('false')

    root.render(renderSingleListbox({ value: 'preact' }))
    root.flush()
    options = getOptions(container)

    expect(options[3].getAttribute('aria-selected')).toBe('true')
    expect(options[2].getAttribute('aria-selected')).toBe('false')
  })

  it('renders multiple default values and marks the listbox aria-multiselectable', () => {
    let { container } = renderApp(renderMultipleListbox({ defaultValue: ['react', 'preact'] }))
    let listbox = getListbox(container)
    let options = getOptions(container)

    expect(listbox.getAttribute('aria-multiselectable')).toBe('true')
    expect(options[2].getAttribute('aria-selected')).toBe('true')
    expect(options[3].getAttribute('aria-selected')).toBe('true')
    expect(options[0].getAttribute('aria-selected')).toBe('false')
  })

  it('leaves aria-activedescendant empty when all options are disabled', () => {
    let { container, root } = renderApp(renderDisabledListbox())
    let listbox = getListbox(container)

    listbox.focus()
    press(listbox, 'ArrowDown')
    root.flush()

    expect(listbox.getAttribute('aria-activedescendant')).toBe(null)
    expect(container.querySelector('[data-highlighted="true"]')).toBe(null)
  })

  it('does not highlight an enabled option on pointermove', () => {
    let { container, root } = renderApp(renderSingleListbox())
    let listbox = getListbox(container)
    let options = getOptions(container)

    pointer(options[2], 'pointermove')
    root.flush()

    expect(listbox.getAttribute('aria-activedescendant')).toBe(null)
    expect(options[2].dataset.highlighted).toBe('false')
  })

  it('does not highlight a disabled option on pointermove', () => {
    let { container, root } = renderApp(renderSingleListbox())
    let listbox = getListbox(container)
    let options = getOptions(container)

    pointer(options[1], 'pointermove')
    root.flush()

    expect(listbox.getAttribute('aria-activedescendant')).toBe(null)
    expect(options[1].dataset.highlighted).toBe('false')
  })

  it('keeps the controlled value until the parent accepts the change', () => {
    let { container, root } = renderApp(<ControlledSingleListboxExample acceptChanges={false} />)
    let options = getOptions(container)

    pointer(options[2], 'pointerdown')
    root.flush()
    options = getOptions(container)

    expect(options[0].getAttribute('aria-selected')).toBe('true')
    expect(options[2].getAttribute('aria-selected')).toBe('false')
  })

  it('updates when the parent accepts a controlled change', () => {
    let { container, root } = renderApp(<ControlledSingleListboxExample />)
    let options = getOptions(container)

    pointer(options[2], 'pointerdown')
    root.flush()
    options = getOptions(container)

    expect(options[0].getAttribute('aria-selected')).toBe('false')
    expect(options[2].getAttribute('aria-selected')).toBe('true')
  })

  it('dispatches a scalar change value in single mode', () => {
    let { container, root } = renderApp(renderSingleListbox())
    let listbox = getListbox(container)
    let receivedEvent: ListboxChangeEvent | null = null

    listbox.addEventListener(Listbox.change, (event) => {
      receivedEvent = event as ListboxChangeEvent
    })

    listbox.focus()
    root.flush()
    press(listbox, 'Enter')
    root.flush()

    expect(receivedEvent).not.toBe(null)
    expect(receivedEvent!.multiple).toBe(false)
    expect(receivedEvent!.optionValue).toBe('remix')
    expect(receivedEvent!.value).toBe('remix')
    expect(receivedEvent!.values).toEqual(['remix'])
    expect(receivedEvent!.target).toBe(listbox)
  })

  it('selects the active option with Space and marks it aria-selected', () => {
    let { container, root } = renderApp(renderSingleListbox())
    let listbox = getListbox(container)
    let options = getOptions(container)

    listbox.focus()
    root.flush()
    press(listbox, ' ')
    root.flush()

    expect(options[0].getAttribute('aria-selected')).toBe('true')
  })

  it('dispatches array change values in multiple mode', () => {
    let { container, root } = renderApp(renderMultipleListbox())
    let listbox = getListbox(container)
    let options = getOptions(container)
    let receivedEvents: ListboxChangeEvent[] = []

    listbox.addEventListener(Listbox.change, (event) => {
      receivedEvents.push(event as ListboxChangeEvent)
    })

    pointer(options[0], 'pointerdown')
    root.flush()
    pointer(options[2], 'pointerdown', { metaKey: true })
    root.flush()

    expect(receivedEvents).toHaveLength(2)
    expect(receivedEvents[0].value).toEqual(['remix'])
    expect(receivedEvents[1].value).toEqual(['remix', 'react'])
    expect(receivedEvents[1].values).toEqual(['remix', 'react'])
    expect(receivedEvents[0].target).toBe(listbox)
    expect(receivedEvents[1].target).toBe(listbox)
  })

  it('selects only the active option with Enter in multiple mode', () => {
    let { container, root } = renderApp(renderMultipleListbox({ defaultValue: ['react', 'preact'] }))
    let listbox = getListbox(container)
    let options = getOptions(container)

    listbox.focus()
    root.flush()
    press(listbox, 'ArrowUp')
    root.flush()
    press(listbox, 'Enter')
    root.flush()

    expect(listbox.getAttribute('aria-activedescendant')).toBe(options[2].id)
    expect(options[0].getAttribute('aria-selected')).toBe('false')
    expect(options[2].getAttribute('aria-selected')).toBe('true')
    expect(options[3].getAttribute('aria-selected')).toBe('false')
  })

  it('selects only the clicked option on plain click in multiple mode', () => {
    let { container, root } = renderApp(renderMultipleListbox({ defaultValue: ['react'] }))
    let listbox = getListbox(container)
    let options = getOptions(container)

    pointer(options[3], 'pointerdown')
    root.flush()

    expect(document.activeElement).toBe(listbox)
    expect(options[0].getAttribute('aria-selected')).toBe('false')
    expect(options[2].getAttribute('aria-selected')).toBe('false')
    expect(options[3].getAttribute('aria-selected')).toBe('true')
  })

  it('continues keyboard navigation after pointer selection', () => {
    let { container, root } = renderApp(renderSingleListbox())
    let listbox = getListbox(container)
    let options = getOptions(container)

    pointer(options[2], 'pointerdown')
    root.flush()
    press(listbox, 'ArrowDown')
    root.flush()

    expect(document.activeElement).toBe(listbox)
    expect(listbox.getAttribute('aria-activedescendant')).toBe(options[3].id)
    expect(options[3].dataset.highlighted).toBe('true')
  })

  it('toggles additional options with modifier click in multiple mode', () => {
    let { container, root } = renderApp(renderMultipleListbox())
    let options = getOptions(container)

    pointer(options[0], 'pointerdown')
    root.flush()
    pointer(options[2], 'pointerdown', { metaKey: true })
    root.flush()

    expect(options[0].getAttribute('aria-selected')).toBe('true')
    expect(options[2].getAttribute('aria-selected')).toBe('true')
    expect(options[3].getAttribute('aria-selected')).toBe('false')
  })

  it('extends a range from the anchor on shift click in multiple mode', () => {
    let { container, root } = renderApp(renderMultipleListbox())
    let options = getOptions(container)

    pointer(options[0], 'pointerdown')
    root.flush()
    pointer(options[3], 'pointerdown', { shiftKey: true })
    root.flush()

    expect(options[0].getAttribute('aria-selected')).toBe('true')
    expect(options[1].getAttribute('aria-selected')).toBe('false')
    expect(options[2].getAttribute('aria-selected')).toBe('true')
    expect(options[3].getAttribute('aria-selected')).toBe('true')
  })

  it('preserves existing selection on modifier shift click in multiple mode', () => {
    let { container, root } = renderApp(renderMultipleListbox())
    let options = getOptions(container)

    pointer(options[0], 'pointerdown')
    root.flush()
    pointer(options[3], 'pointerdown', { metaKey: true })
    root.flush()
    pointer(options[2], 'pointerdown', { metaKey: true, shiftKey: true })
    root.flush()

    expect(options[0].getAttribute('aria-selected')).toBe('true')
    expect(options[2].getAttribute('aria-selected')).toBe('true')
    expect(options[3].getAttribute('aria-selected')).toBe('true')
  })

  it('extends selection with shift arrow in multiple mode', () => {
    let { container, root } = renderApp(renderMultipleListbox())
    let listbox = getListbox(container)
    let options = getOptions(container)

    listbox.focus()
    root.flush()
    press(listbox, ' ')
    root.flush()
    press(listbox, 'ArrowDown', { shiftKey: true })
    root.flush()

    expect(listbox.getAttribute('aria-activedescendant')).toBe(options[2].id)
    expect(options[0].getAttribute('aria-selected')).toBe('true')
    expect(options[2].getAttribute('aria-selected')).toBe('true')
  })

  it('toggles the active option with Space in multiple mode', () => {
    let { container, root } = renderApp(renderMultipleListbox())
    let listbox = getListbox(container)
    let options = getOptions(container)

    listbox.focus()
    root.flush()
    press(listbox, ' ')
    root.flush()

    expect(options[0].getAttribute('aria-selected')).toBe('true')
    expect(options[2].getAttribute('aria-selected')).toBe('false')

    press(listbox, 'ArrowDown')
    root.flush()
    press(listbox, ' ')
    root.flush()

    expect(options[0].getAttribute('aria-selected')).toBe('true')
    expect(options[2].getAttribute('aria-selected')).toBe('true')

    press(listbox, ' ')
    root.flush()

    expect(options[0].getAttribute('aria-selected')).toBe('true')
    expect(options[2].getAttribute('aria-selected')).toBe('false')
  })

  it('does not select disabled options on click', () => {
    let { container, root } = renderApp(renderSingleListbox())
    let options = getOptions(container)

    pointer(options[1], 'pointerdown')
    root.flush()

    expect(options[1].getAttribute('aria-selected')).toBe('false')
    expect(container.querySelector('[aria-selected="true"]')).toBe(null)
  })

  it('starts from a pointer-selected option when the listbox receives focus', () => {
    let { container, root } = renderApp(renderSingleListbox())
    let listbox = getListbox(container)
    let options = getOptions(container)

    pointer(options[2], 'pointerdown')
    root.flush()
    listbox.focus()
    root.flush()

    expect(listbox.getAttribute('aria-activedescendant')).toBe(options[2].id)
    expect(options[2].dataset.highlighted).toBe('true')
    expect(options[2].getAttribute('data-keyboard-active')).toBe(null)
  })

  it('only marks a selected option keyboard-active after arrow navigation returns to it', () => {
    let { container, root } = renderApp(renderSingleListbox())
    let listbox = getListbox(container)
    let options = getOptions(container)

    pointer(options[2], 'pointerdown')
    root.flush()
    listbox.focus()
    root.flush()

    expect(options[2].getAttribute('data-keyboard-active')).toBe(null)

    press(listbox, 'ArrowDown')
    root.flush()

    expect(listbox.getAttribute('aria-activedescendant')).toBe(options[3].id)
    expect(options[3].getAttribute('data-keyboard-active')).toBe('true')
    expect(options[2].getAttribute('data-keyboard-active')).toBe(null)

    press(listbox, 'ArrowUp')
    root.flush()

    expect(listbox.getAttribute('aria-activedescendant')).toBe(options[2].id)
    expect(options[2].getAttribute('aria-selected')).toBe('true')
    expect(options[2].getAttribute('data-keyboard-active')).toBe('true')
  })

  it('does not render a check glyph for static options', () => {
    let { container } = renderApp(renderSingleListbox())

    expect(container.querySelector('svg')).toBe(null)
  })

  it('styles active and selected options based on listbox focus state', () => {
    renderApp(renderMultipleListbox())

    let cssText = document.adoptedStyleSheets
      .flatMap((sheet) => Array.from(sheet.cssRules, (rule) => rule.cssText))
      .join('\n')

    expect(cssText).toContain(':focus-within [role="option"][data-highlighted="true"]:not([aria-selected="true"])')
    expect(cssText).toContain(':focus-within [role="option"][aria-selected="true"]')
    expect(cssText).toContain(
      ':focus-within [role="option"][data-highlighted="true"][aria-selected="true"][data-keyboard-active="true"]',
    )
    expect(cssText).toContain(':not(:focus-within) [role="option"][aria-selected="true"]')
    expect(cssText).toContain(
      ':not(:focus-within) [role="option"][data-highlighted="true"]:not([aria-selected="true"])',
    )
    expect(cssText).toContain(':hover:not([aria-disabled="true"]):not([aria-selected="true"])')
  })
})
