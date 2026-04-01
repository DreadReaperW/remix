import { afterEach, describe, expect, it, vi } from 'vitest'

import { createRoot, type RemixNode } from '@remix-run/component'

import { Option, Select } from './select.tsx'
import type { SelectChangeEvent } from './select.tsx'
import type { SelectProps } from './select.tsx'

let roots: ReturnType<typeof createRoot>[] = []

function renderApp(node: RemixNode) {
  let container = document.createElement('div')
  document.body.append(container)
  let root = createRoot(container)
  root.render(node)
  root.flush()
  roots.push(root)
  return { container, root }
}

function renderSelect(props: Partial<SelectProps> = {}) {
  return (
    <Select initialLabel="Select a framework" name="framework" {...props}>
      <Option label="Remix framework" value="remix">
        Remix
      </Option>
      <Option disabled label="React Router framework" value="react-router">
        React Router
      </Option>
      <Option label="React framework" value="react">
        React
      </Option>
    </Select>
  )
}

function getOptionByText(container: HTMLElement, text: string) {
  return Array.from(container.querySelectorAll<HTMLElement>('[role="option"]')).find(
    (option) => option.textContent?.trim() === text,
  ) as HTMLElement
}

function pointer(
  target: HTMLElement,
  type: 'click' | 'pointerdown' | 'pointerup',
  options: { button?: number } = {},
) {
  target.dispatchEvent(
    new MouseEvent(type, {
      bubbles: true,
      button: options.button ?? 0,
    }),
  )
}

async function openSelect(container: HTMLElement, root: ReturnType<typeof createRoot>) {
  let trigger = container.querySelector('button') as HTMLButtonElement
  pointer(trigger, 'pointerdown')
  await settle(root)
  pointer(trigger, 'pointerup')
  pointer(trigger, 'click')
  await settleFrames(root)
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

afterEach(() => {
  vi.useRealTimers()
  for (let root of roots) {
    root.render(null)
    root.flush()
  }
  roots = []
  document.body.innerHTML = ''
})

describe('Select', () => {
  it('applies defaultValue to the button label, hidden input, and listbox selection', async () => {
    let { container, root } = renderApp(renderSelect({ defaultValue: 'react' }))
    let trigger = container.querySelector('button') as HTMLButtonElement
    let hiddenInput = container.querySelector('input[type="hidden"]') as HTMLInputElement

    await settle(root)

    expect(trigger.textContent).toContain('React framework')
    expect(hiddenInput.value).toBe('react')

    await openSelect(container, root)

    let list = container.querySelector('[role="listbox"]') as HTMLElement
    let react = getOptionByText(container, 'React')

    expect(react.getAttribute('aria-selected')).toBe('true')
    expect(list.getAttribute('aria-activedescendant')).toBe(react.id)
  })

  it('keeps the initial label before selection and still registers options through indirection', async () => {
    function Indirection() {
      return () => (
        <>
          <Option label="Bug" value="bug" />
          <Option label="Feature" value="feature" />
        </>
      )
    }

    let { container, root } = renderApp(
      <Select initialLabel="Select a type" name="issue-type">
        <Indirection />
      </Select>,
    )
    let trigger = container.querySelector('button') as HTMLButtonElement
    let hiddenInput = container.querySelector('input[type="hidden"]') as HTMLInputElement

    expect(trigger.textContent).toContain('Select a type')
    expect(hiddenInput.value).toBe('')

    await openSelect(container, root)

    let feature = getOptionByText(container, 'Feature')
    pointer(feature, 'pointerdown')
    pointer(feature, 'pointerup')
    pointer(feature, 'click')
    await settle(root)

    expect(trigger.textContent).toContain('Feature')
    expect(hiddenInput.value).toBe('feature')
  })

  it('updates the trigger label and hidden input from Option.label after selection', async () => {
    let { container, root } = renderApp(renderSelect())
    let trigger = container.querySelector('button') as HTMLButtonElement
    let hiddenInput = container.querySelector('input[type="hidden"]') as HTMLInputElement
    let surface = container.querySelector('[popover]') as HTMLElement

    expect(trigger.textContent).toContain('Select a framework')
    expect(hiddenInput.value).toBe('')
    expect(surface.matches(':popover-open')).toBe(false)

    await openSelect(container, root)

    let react = getOptionByText(container, 'React')
    pointer(react, 'pointerdown')
    pointer(react, 'pointerup')
    pointer(react, 'click')
    await settle(root)

    expect(trigger.textContent).toContain('React framework')
    expect(trigger.textContent).not.toContain('React Router framework')
    expect(hiddenInput.value).toBe('react')
    expect(react.getAttribute('data-flash')).toBe('true')
    expect(surface.matches(':popover-open')).toBe(true)
  })

  it('sets the popover min-width from the trigger before opening', async () => {
    let { container, root } = renderApp(renderSelect())
    let trigger = container.querySelector('button') as HTMLButtonElement
    let surface = container.querySelector('[popover]') as HTMLElement

    Object.defineProperty(trigger, 'offsetWidth', {
      configurable: true,
      value: 212,
    })

    expect(surface.style.minWidth).toBe('')

    await openSelect(container, root)

    expect(surface.style.minWidth).toBe('212px')
    expect(surface.matches(':popover-open')).toBe(true)
  })

  it('bubbles Select.change and waits for the flash before closing', async () => {
    let changes: SelectChangeEvent[] = []
    let { container, root } = renderApp(renderSelect())
    container.addEventListener(Select.change, (event) => {
      changes.push(event as SelectChangeEvent)
    })

    await openSelect(container, root)

    vi.useFakeTimers()

    let react = getOptionByText(container, 'React')
    let surface = container.querySelector('[popover]') as HTMLElement
    pointer(react, 'pointerdown')
    pointer(react, 'pointerup')
    pointer(react, 'click')
    await settle(root)

    expect(changes).toHaveLength(1)
    expect(changes[0].value).toBe('react')
    expect(react.getAttribute('data-flash')).toBe('true')
    expect(surface.matches(':popover-open')).toBe(true)

    await vi.advanceTimersByTimeAsync(60)
    await settle(root)

    expect(react.getAttribute('data-flash')).toBe(null)
    expect(surface.matches(':popover-open')).toBe(false)
  })
})
