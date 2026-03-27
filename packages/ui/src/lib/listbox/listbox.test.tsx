import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createRoot, on, type Handle, type RemixNode } from '@remix-run/component'

import { Listbox, ListboxOption } from './listbox.tsx'

let SELECTION_FLASH_DELAY = 75

function renderApp(node: RemixNode) {
  let container = document.createElement('div')
  document.body.append(container)
  let root = createRoot(container)
  root.render(node)
  return { container, root }
}

function mockLayout(
  element: HTMLElement,
  rect: { top: number; left: number; width: number; height: number },
) {
  Object.defineProperty(element, 'offsetWidth', {
    configurable: true,
    get: () => rect.width,
  })

  Object.defineProperty(element, 'offsetHeight', {
    configurable: true,
    get: () => rect.height,
  })

  element.getBoundingClientRect = () => new DOMRect(rect.left, rect.top, rect.width, rect.height)
}

function renderExampleListbox() {
  return (
    <Listbox aria-label="Environment" initialLabel="Select an environment">
      <ListboxOption value="local">Local</ListboxOption>
      <ListboxOption textValue="Staging" value="staging">
        Staging
      </ListboxOption>
      <ListboxOption value="production">Production</ListboxOption>
      <ListboxOption disabled value="archived">
        Archived
      </ListboxOption>
    </Listbox>
  )
}

function renderExampleListboxForm() {
  return (
    <form>
      <Listbox aria-label="Environment" initialLabel="Select an environment" name="environment">
        <ListboxOption value="local">Local</ListboxOption>
        <ListboxOption textValue="Staging" value="staging">
          Staging
        </ListboxOption>
        <ListboxOption value="production">Production</ListboxOption>
      </Listbox>
    </form>
  )
}

function renderDefaultValueListbox() {
  return (
    <Listbox
      aria-label="Environment"
      defaultValue="staging"
      initialLabel="Select an environment"
      name="environment"
    >
      <ListboxOption value="local">Local</ListboxOption>
      <ListboxOption textValue="Staging" value="staging">
        Staging
      </ListboxOption>
      <ListboxOption value="production">Production</ListboxOption>
      <ListboxOption disabled value="archived">
        Archived
      </ListboxOption>
    </Listbox>
  )
}

function renderControlledValueListbox(value: string | null) {
  return (
    <Listbox
      aria-label="Environment"
      initialLabel="Select an environment"
      name="environment"
      value={value}
    >
      <ListboxOption value="local">Local</ListboxOption>
      <ListboxOption textValue="Staging" value="staging">
        Staging
      </ListboxOption>
      <ListboxOption value="production">Production</ListboxOption>
      <ListboxOption disabled value="archived">
        Archived
      </ListboxOption>
    </Listbox>
  )
}

function ControlledListboxExample(handle: Handle) {
  let value: string | null = 'local'

  return ({ acceptChanges = true }: { acceptChanges?: boolean } = {}) => (
    <Listbox
      aria-label="Environment"
      initialLabel="Select an environment"
      mix={on(Listbox.change, (event) => {
        if (!acceptChanges) {
          return
        }

        value = event.value
        void handle.update()
      })}
      name="environment"
      value={value}
    >
      <ListboxOption value="local">Local</ListboxOption>
      <ListboxOption textValue="Staging" value="staging">
        Staging
      </ListboxOption>
      <ListboxOption value="production">Production</ListboxOption>
      <ListboxOption disabled value="archived">
        Archived
      </ListboxOption>
    </Listbox>
  )
}

function getPopup(container: HTMLElement) {
  return container.querySelector('[popover="manual"]') as HTMLElement
}

function getTrigger(container: HTMLElement) {
  return container.querySelector('rmx-button[role="combobox"]') as HTMLElement
}

function getList(container: HTMLElement) {
  return container.querySelector('[role="listbox"]') as HTMLElement
}

function isPopoverOpen(element: HTMLElement) {
  return element.matches(':popover-open')
}

function press(target: HTMLElement, key: string) {
  target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key }))
}

function pointer(target: HTMLElement, type: 'pointerdown' | 'pointermove' | 'pointerup') {
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0 }))
}

async function advance(root: ReturnType<typeof createRoot>, ms: number) {
  await vi.advanceTimersByTimeAsync(ms)
  root.flush()
}

function finishClose(root: ReturnType<typeof createRoot>, popup: HTMLElement) {
  let event = new Event('transitionend')
  popup.dispatchEvent(event)
  root.flush()
}

function cancelClose(root: ReturnType<typeof createRoot>, popup: HTMLElement) {
  let event = new Event('transitioncancel')
  popup.dispatchEvent(event)
  root.flush()
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('Listbox', () => {
  it('styles the flash state with the current data attribute', () => {
    renderApp(renderExampleListbox())

    let cssText = document.adoptedStyleSheets
      .flatMap((sheet) => Array.from(sheet.cssRules, (rule) => rule.cssText))
      .join('\n')

    expect(cssText).toContain('[data-flash="true"]')
  })

  it('opens as a select-only combobox and highlights the first enabled option', async () => {
    let showPopover = vi.spyOn(HTMLElement.prototype, 'showPopover')
    let { container, root } = renderApp(renderExampleListbox())
    let popup = getPopup(container)
    let trigger = getTrigger(container)

    expect(isPopoverOpen(popup)).toBe(false)

    trigger.focus()
    press(trigger, 'ArrowDown')
    root.flush()

    let list = getList(container)
    let highlighted = container.querySelector('[data-highlighted="true"]') as HTMLElement

    expect(trigger.getAttribute('role')).toBe('combobox')
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(document.activeElement).toBe(list)
    expect(list.getAttribute('aria-activedescendant')).toBe(highlighted.id)
    expect(highlighted.dataset.value).toBe('local')
    expect(showPopover).toHaveBeenCalledTimes(1)
    expect(isPopoverOpen(popup)).toBe(true)
  })

  it('opens from ArrowUp with the last enabled option highlighted', async () => {
    let { container, root } = renderApp(renderExampleListbox())
    let trigger = getTrigger(container)

    trigger.focus()
    press(trigger, 'ArrowUp')
    root.flush()

    let highlighted = container.querySelector('[data-highlighted="true"]') as HTMLElement
    expect(highlighted.dataset.value).toBe('production')
  })

  it('moves highlight with keyboard navigation and skips disabled options', async () => {
    let { container, root } = renderApp(renderExampleListbox())
    let trigger = getTrigger(container)

    trigger.focus()
    press(trigger, 'ArrowDown')
    root.flush()

    let list = getList(container)

    press(list, 'ArrowDown')
    root.flush()

    let highlighted = container.querySelector('[data-highlighted="true"]') as HTMLElement
    expect(highlighted.dataset.value).toBe('staging')

    press(list, 'End')
    root.flush()
    highlighted = container.querySelector('[data-highlighted="true"]') as HTMLElement
    expect(highlighted.dataset.value).toBe('production')

    press(list, 'ArrowDown')
    root.flush()
    highlighted = container.querySelector('[data-highlighted="true"]') as HTMLElement
    expect(highlighted.dataset.value).toBe('production')

    press(list, 'Home')
    root.flush()
    highlighted = container.querySelector('[data-highlighted="true"]') as HTMLElement
    expect(highlighted.dataset.value).toBe('local')
  })

  it('selects a matching option from typed text while closed', async () => {
    let { container, root } = renderApp(renderExampleListbox())
    let trigger = getTrigger(container)

    trigger.focus()
    press(trigger, 's')
    root.flush()

    expect(trigger.textContent).toContain('Staging')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('selects a matching option from typed text while open', async () => {
    let { container, root } = renderApp(renderExampleListbox())
    let trigger = getTrigger(container)

    trigger.focus()
    press(trigger, 'ArrowDown')
    root.flush()

    let list = getList(container)

    press(list, 'p')
    root.flush()

    expect(trigger.textContent).toContain('Production')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('renders defaultValue on first render', () => {
    let { container } = renderApp(renderDefaultValueListbox())
    let trigger = getTrigger(container)
    let hiddenInput = container.querySelector(
      'input[type="hidden"][name="environment"]',
    ) as HTMLInputElement

    expect(trigger.textContent).toContain('Staging')
    expect(hiddenInput.value).toBe('staging')
  })

  it('renders a controlled value', () => {
    let { container } = renderApp(renderControlledValueListbox('production'))
    let trigger = getTrigger(container)
    let hiddenInput = container.querySelector(
      'input[type="hidden"][name="environment"]',
    ) as HTMLInputElement

    expect(trigger.textContent).toContain('Production')
    expect(hiddenInput.value).toBe('production')
  })

  it('participates in FormData when submitted inside a form', async () => {
    let { container, root } = renderApp(renderExampleListboxForm())
    let popup = getPopup(container)
    let trigger = getTrigger(container)
    let form = container.querySelector('form') as HTMLFormElement
    let hiddenInput = container.querySelector(
      'input[type="hidden"][name="environment"]',
    ) as HTMLInputElement
    let submittedFormData: FormData | null = null

    form.addEventListener('submit', (event) => {
      event.preventDefault()
      submittedFormData = new FormData(form)
    })

    trigger.focus()
    press(trigger, 'ArrowDown')
    root.flush()

    press(trigger, 'ArrowDown')
    root.flush()

    press(trigger, 'Enter')
    root.flush()
    await Promise.resolve()
    root.flush()

    await advance(root, SELECTION_FLASH_DELAY * 2)
    finishClose(root, popup)
    await Promise.resolve()
    root.flush()

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))

    expect(hiddenInput.value).toBe('staging')
    expect(submittedFormData).not.toBeNull()
    expect(submittedFormData!.get('environment')).toBe('staging')
  })

  it('keeps the controlled value until the parent accepts the change', async () => {
    let { container, root } = renderApp(<ControlledListboxExample acceptChanges={false} />)
    let popup = getPopup(container)
    let trigger = getTrigger(container)
    let hiddenInput = container.querySelector(
      'input[type="hidden"][name="environment"]',
    ) as HTMLInputElement

    trigger.focus()
    press(trigger, 'ArrowDown')
    root.flush()

    press(trigger, 'ArrowDown')
    root.flush()

    press(trigger, 'Enter')
    root.flush()

    await advance(root, SELECTION_FLASH_DELAY * 2)
    finishClose(root, popup)

    expect(trigger.textContent).toContain('Local')
    expect(hiddenInput.value).toBe('local')
  })

  it('updates when the parent rerenders a controlled value in response to change', async () => {
    let { container, root } = renderApp(<ControlledListboxExample />)
    let popup = getPopup(container)
    let trigger = getTrigger(container)
    let hiddenInput = container.querySelector(
      'input[type="hidden"][name="environment"]',
    ) as HTMLInputElement

    trigger.focus()
    press(trigger, 'ArrowDown')
    root.flush()

    press(trigger, 'ArrowDown')
    root.flush()

    press(trigger, 'Enter')
    root.flush()

    await advance(root, SELECTION_FLASH_DELAY * 2)
    finishClose(root, popup)
    await Promise.resolve()
    root.flush()

    expect(trigger.textContent).toContain('Staging')
    expect(hiddenInput.value).toBe('staging')
  })

  it('selects the highlighted option on Enter and updates the trigger label', async () => {
    let { container, root } = renderApp(renderExampleListbox())
    let popup = getPopup(container)
    let trigger = getTrigger(container)

    trigger.focus()
    press(trigger, 'ArrowDown')
    root.flush()

    let list = getList(container)

    press(list, 'ArrowDown')
    root.flush()

    press(list, 'Enter')
    root.flush()

    await advance(root, SELECTION_FLASH_DELAY * 2)
    finishClose(root, popup)

    expect(trigger.textContent).toContain('Staging')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('closes on Escape without changing the current label', async () => {
    let hidePopover = vi.spyOn(HTMLElement.prototype, 'hidePopover')
    let { container, root } = renderApp(renderExampleListbox())
    let popup = getPopup(container)
    let trigger = getTrigger(container)

    trigger.focus()
    press(trigger, 'ArrowDown')
    root.flush()

    let list = getList(container)

    press(list, 'ArrowDown')
    root.flush()

    press(list, 'Escape')
    root.flush()

    expect(trigger.textContent).toContain('Select an environment')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(hidePopover).toHaveBeenCalledTimes(1)
    expect(isPopoverOpen(popup)).toBe(false)
  })

  it('closes on focusout without changing the current label', async () => {
    let { container, root } = renderApp(renderExampleListbox())
    let trigger = getTrigger(container)
    let outside = document.createElement('button')
    document.body.append(outside)

    trigger.focus()
    press(trigger, 'ArrowDown')
    root.flush()

    let list = getList(container)

    press(list, 'ArrowDown')
    root.flush()

    list.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: outside }))
    root.flush()

    expect(trigger.textContent).toContain('Select an environment')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('keeps focus on the trigger when dismissing with an outside click', async () => {
    let { container, root } = renderApp(renderExampleListbox())
    let trigger = getTrigger(container)
    let outside = document.createElement('button')
    document.body.append(outside)

    trigger.focus()
    press(trigger, 'ArrowDown')
    root.flush()

    let event = new MouseEvent('pointerdown', {
      bubbles: true,
      button: 0,
      cancelable: true,
    })
    outside.dispatchEvent(event)
    if (!event.defaultPrevented) {
      outside.focus()
    }
    root.flush()

    expect(event.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('ignores outside clicks while selection feedback is running', async () => {
    let { container, root } = renderApp(renderExampleListbox())
    let popup = getPopup(container)
    let trigger = getTrigger(container)
    let list = getList(container)
    let outside = document.createElement('button')
    document.body.append(outside)

    trigger.focus()
    press(trigger, 'ArrowDown')
    root.flush()

    press(list, 'ArrowDown')
    root.flush()

    press(list, 'Enter')
    root.flush()

    let event = new MouseEvent('pointerdown', {
      bubbles: true,
      button: 0,
      cancelable: true,
    })
    outside.dispatchEvent(event)
    if (!event.defaultPrevented) {
      outside.focus()
    }
    root.flush()

    expect(event.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(list)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')

    await advance(root, SELECTION_FLASH_DELAY * 2)
    finishClose(root, popup)

    expect(trigger.textContent).toContain('Staging')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('commits selection if the close transition is cancelled', async () => {
    let { container, root } = renderApp(renderExampleListbox())
    let popup = getPopup(container)
    let trigger = getTrigger(container)

    trigger.focus()
    press(trigger, 'ArrowDown')
    root.flush()

    press(trigger, 'ArrowDown')
    root.flush()

    press(trigger, 'Enter')
    root.flush()

    await advance(root, SELECTION_FLASH_DELAY * 2)
    cancelClose(root, popup)

    expect(trigger.textContent).toContain('Staging')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')

    press(trigger, 'ArrowDown')
    root.flush()

    expect(trigger.getAttribute('aria-expanded')).toBe('true')
  })

  it('highlights the first enabled option on Tab', async () => {
    let { container, root } = renderApp(renderExampleListbox())
    let trigger = getTrigger(container)

    trigger.focus()
    press(trigger, 'ArrowUp')
    root.flush()

    let highlighted = container.querySelector('[data-highlighted="true"]') as HTMLElement
    expect(highlighted.dataset.value).toBe('production')

    press(trigger, 'Tab')
    root.flush()

    highlighted = container.querySelector('[data-highlighted="true"]') as HTMLElement

    expect(highlighted.dataset.value).toBe('local')
    expect(trigger.textContent).toContain('Select an environment')
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
  })

  it('matches popup width to the trigger when open', async () => {
    let { container, root } = renderApp(renderExampleListbox())
    let trigger = getTrigger(container)

    mockLayout(trigger, { top: 40, left: 200, width: 180, height: 28 })

    trigger.focus()
    press(trigger, 'ArrowDown')
    root.flush()

    let popup = getPopup(container)
    expect(popup.style.minWidth).toBe('180px')
  })

  it('delegates pointer interactions from the list root', async () => {
    let { container, root } = renderApp(renderExampleListbox())
    let popup = getPopup(container)
    let trigger = getTrigger(container)

    pointer(trigger, 'pointerdown')
    root.flush()

    let production = container.querySelector('[data-value="production"]') as HTMLElement
    let archived = container.querySelector('[data-value="archived"]') as HTMLElement

    pointer(production, 'pointermove')
    root.flush()

    expect(production.dataset.highlighted).toBe('true')

    pointer(archived, 'pointermove')
    root.flush()

    expect(container.querySelector('[data-highlighted="true"]')).toBe(null)

    pointer(production, 'pointerdown')
    pointer(production, 'pointerup')
    root.flush()

    await advance(root, SELECTION_FLASH_DELAY * 2)
    finishClose(root, popup)

    expect(trigger.textContent).toContain('Production')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('does not select from the same click that opens the popup', async () => {
    let { container, root } = renderApp(renderExampleListbox())
    let popup = getPopup(container)
    let trigger = getTrigger(container)

    pointer(trigger, 'pointerdown')
    root.flush()

    let production = container.querySelector('[data-value="production"]') as HTMLElement
    pointer(production, 'pointerup')
    root.flush()

    expect(trigger.textContent).toContain('Select an environment')
    expect(trigger.getAttribute('aria-expanded')).toBe('true')

    pointer(production, 'pointerdown')
    pointer(production, 'pointerup')
    root.flush()

    await advance(root, SELECTION_FLASH_DELAY * 2)
    finishClose(root, popup)

    expect(trigger.textContent).toContain('Production')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })
})
