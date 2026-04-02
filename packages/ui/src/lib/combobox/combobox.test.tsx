import { afterEach, describe, expect, it, vi } from 'vitest'

import { createRoot, type RemixNode } from '@remix-run/component'

import { Combobox, Option, combobox } from './combobox.tsx'
import type { ComboboxChangeEvent } from './combobox.tsx'
import type { ComboboxProps } from './combobox.tsx'

let flashDurationMs = 60
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

function renderCombobox(props: Partial<ComboboxProps> = {}) {
  return (
    <Combobox inputId="framework" name="framework" placeholder="Search a framework" {...props}>
      <Option label="Remix framework" value="remix">
        Remix
      </Option>
      <Option disabled label="React Router framework" value="react-router">
        React Router
      </Option>
      <Option label="React framework" value="react">
        React
      </Option>
    </Combobox>
  )
}

function getOptionByText(container: HTMLElement, text: string) {
  return Array.from(container.querySelectorAll<HTMLElement>('[role="option"]')).find(
    (option) => option.textContent?.trim() === text,
  ) as HTMLElement
}

function key(target: HTMLElement, key: string, options: { repeat?: boolean } = {}) {
  target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key, repeat: options.repeat }))
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

function changeInputValue(input: HTMLInputElement, value: string) {
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

async function typeText(
  input: HTMLInputElement,
  root: ReturnType<typeof createRoot>,
  text: string,
) {
  for (let character of text) {
    key(input, character)
    input.value += character
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await settle(root)
  }
}

function blur(target: HTMLElement) {
  target.dispatchEvent(new FocusEvent('blur'))
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
  vi.useRealTimers()
  for (let root of roots) {
    root.render(null)
    root.flush()
  }

  roots = []
  document.body.innerHTML = ''
})

describe('Combobox', () => {
  it('applies the raw defaultValue to the input text while keeping the hidden input committed', async () => {
    let { container, root } = renderApp(renderCombobox({ defaultValue: 'react' }))
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let hiddenInput = container.querySelector('input[type="hidden"]') as HTMLInputElement

    await settle(root)

    expect(input.value).toBe('react')
    expect(hiddenInput.value).toBe('react')
  })

  it('typing matching text opens the popover, filters visible options, and keeps focus on the input', async () => {
    let { container, root } = renderApp(renderCombobox())
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let surface = container.querySelector('[popover]') as HTMLElement
    let list = container.querySelector('[role="listbox"]') as HTMLElement
    let remix = getOptionByText(container, 'Remix')
    let reactRouter = getOptionByText(container, 'React Router')
    let react = getOptionByText(container, 'React')
    input.focus()

    changeInputValue(input, 'rea')
    await settle(root)

    expect(surface.matches(':popover-open')).toBe(true)
    expect(document.activeElement).toBe(input)
    expect(input.getAttribute('aria-activedescendant')).toBe(react.id)
    expect(remix.hidden).toBe(true)
    expect(remix.style.display).toBe('none')
    expect(reactRouter.hidden).toBe(false)
    expect(reactRouter.style.display).toBe('')
    expect(react.hidden).toBe(false)
    expect(react.style.display).toBe('')
    expect(list.id).toBe(input.getAttribute('aria-controls'))
  })

  it('allows real typing without resetting the input value between characters', async () => {
    let { container, root } = renderApp(renderCombobox())
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let surface = container.querySelector('[popover]') as HTMLElement
    let react = getOptionByText(container, 'React')
    input.focus()

    await typeText(input, root, 'rea')

    expect(input.value).toBe('rea')
    expect(surface.matches(':popover-open')).toBe(true)
    expect(document.activeElement).toBe(input)
    expect(input.getAttribute('aria-activedescendant')).toBe(react.id)
  })

  it('hides the popover when the input is empty or there are no matches', async () => {
    let { container, root } = renderApp(renderCombobox())
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let surface = container.querySelector('[popover]') as HTMLElement

    input.focus()
    changeInputValue(input, 're')
    await settle(root)
    expect(surface.matches(':popover-open')).toBe(true)

    changeInputValue(input, '')
    await settle(root)
    expect(surface.matches(':popover-open')).toBe(false)

    changeInputValue(input, 'zzz')
    await settle(root)
    expect(surface.matches(':popover-open')).toBe(false)
  })

  it('ArrowDown on an exact-match closed input opens an unfiltered list while keeping focus on the input', async () => {
    let { container, root } = renderApp(renderCombobox())
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let surface = container.querySelector('[popover]') as HTMLElement
    let remix = getOptionByText(container, 'Remix')
    let reactRouter = getOptionByText(container, 'React Router')
    let react = getOptionByText(container, 'React')
    input.focus()

    changeInputValue(input, 'react framework')
    await settle(root)

    key(input, 'Escape')
    await settle(root)

    key(input, 'ArrowDown')
    await settleFrames(root)

    expect(surface.matches(':popover-open')).toBe(true)
    expect(document.activeElement).toBe(input)
    expect(remix.hidden).toBe(false)
    expect(reactRouter.hidden).toBe(false)
    expect(react.hidden).toBe(false)
    expect(input.getAttribute('aria-activedescendant')).toBe(react.id)
  })

  it('ArrowUp and ArrowDown navigate the active descendant while the input stays focused', async () => {
    let { container, root } = renderApp(renderCombobox())
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let remix = getOptionByText(container, 'Remix')
    let react = getOptionByText(container, 'React')
    input.focus()

    key(input, 'ArrowDown')
    await settleFrames(root)

    expect(document.activeElement).toBe(input)
    expect(input.getAttribute('aria-activedescendant')).toBe(remix.id)

    key(input, 'ArrowDown')
    await settle(root)

    expect(document.activeElement).toBe(input)
    expect(input.getAttribute('aria-activedescendant')).toBe(react.id)

    key(input, 'ArrowUp')
    await settle(root)

    expect(input.getAttribute('aria-activedescendant')).toBe(remix.id)
  })

  it('Enter does not open from the closed input and Space does not select from the open input', async () => {
    let { container, root } = renderApp(renderCombobox())
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let hiddenInput = container.querySelector('input[type="hidden"]') as HTMLInputElement
    let surface = container.querySelector('[popover]') as HTMLElement
    input.focus()

    key(input, 'Enter')
    await settle(root)
    expect(surface.matches(':popover-open')).toBe(false)

    key(input, 'ArrowDown')
    await settleFrames(root)
    expect(surface.matches(':popover-open')).toBe(true)

    key(input, ' ')
    await settle(root)
    expect(surface.matches(':popover-open')).toBe(true)
    expect(hiddenInput.value).toBe('')
  })

  it('Enter selects the active option, flashes it, then closes the popover and emits Combobox.change', async () => {
    vi.useFakeTimers()
    let changes: ComboboxChangeEvent[] = []
    let { container, root } = renderApp(renderCombobox())
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let hiddenInput = container.querySelector('input[type="hidden"]') as HTMLInputElement
    let surface = container.querySelector('[popover]') as HTMLElement
    let react = getOptionByText(container, 'React')

    container.addEventListener(Combobox.change, (event) => {
      changes.push(event as ComboboxChangeEvent)
    })

    input.focus()
    changeInputValue(input, 'rea')
    await settle(root)

    key(input, 'Enter')
    await settle(root)

    expect(react.getAttribute('data-flash')).toBe('true')
    expect(surface.matches(':popover-open')).toBe(true)
    expect(changes).toHaveLength(0)
    expect(input.value).toBe('React framework')
    expect(hiddenInput.value).toBe('react')

    await finishSelectionFlash(root)

    expect(surface.matches(':popover-open')).toBe(false)
    expect(document.activeElement).toBe(input)
    expect(input.value).toBe('React framework')
    expect(hiddenInput.value).toBe('react')
    expect(react.getAttribute('data-flash')).toBe(null)
    expect(changes).toHaveLength(1)
    expect(changes[0].value).toBe('react')
  })

  it('Escape with a non-matching value clears the input and selection', async () => {
    let changes: ComboboxChangeEvent[] = []
    let { container, root } = renderApp(renderCombobox({ defaultValue: 'react' }))
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let hiddenInput = container.querySelector('input[type="hidden"]') as HTMLInputElement

    container.addEventListener(Combobox.change, (event) => {
      changes.push(event as ComboboxChangeEvent)
    })

    input.focus()
    changeInputValue(input, 'zzz')
    await settle(root)

    key(input, 'Escape')
    await settle(root)

    expect(input.value).toBe('')
    expect(hiddenInput.value).toBe('')
    expect(changes).toHaveLength(1)
    expect(changes[0].value).toBe(null)
  })

  it('blur commits an exact input match without rewriting the visible input text', async () => {
    let changes: ComboboxChangeEvent[] = []
    let { container, root } = renderApp(
      <Combobox inputId="environment" name="environment" placeholder="Search an environment">
        <Option label="Production" value="production" />
        <Option label="Staging" searchValue={['staging', 'beta']} value="staging" />
        <Option label="Local" searchValue={['local', 'dev', 'workbench']} value="local" />
      </Combobox>,
    )
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let hiddenInput = container.querySelector('input[type="hidden"]') as HTMLInputElement
    let surface = container.querySelector('[popover]') as HTMLElement

    container.addEventListener(Combobox.change, (event) => {
      changes.push(event as ComboboxChangeEvent)
    })

    input.focus()
    changeInputValue(input, 'beta')
    await settle(root)

    blur(input)
    await settle(root)

    expect(surface.matches(':popover-open')).toBe(false)
    expect(input.value).toBe('beta')
    expect(hiddenInput.value).toBe('staging')
    expect(changes).toHaveLength(1)
    expect(changes[0].value).toBe('staging')
  })

  it('blur with a non-matching value clears the input and selection', async () => {
    let changes: ComboboxChangeEvent[] = []
    let { container, root } = renderApp(renderCombobox({ defaultValue: 'remix' }))
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let hiddenInput = container.querySelector('input[type="hidden"]') as HTMLInputElement

    container.addEventListener(Combobox.change, (event) => {
      changes.push(event as ComboboxChangeEvent)
    })

    input.focus()
    changeInputValue(input, 'zzz')
    await settle(root)

    blur(input)
    await settle(root)

    expect(input.value).toBe('')
    expect(hiddenInput.value).toBe('')
    expect(changes).toHaveLength(1)
    expect(changes[0].value).toBe(null)
  })

  it('skips disabled options and supports searchValue string and array filtering', async () => {
    let { container, root } = renderApp(
      <Combobox inputId="environment" name="environment" placeholder="Search an environment">
        <Option label="Production" value="production" />
        <Option label="Staging" searchValue={['staging', 'beta']} value="staging" />
        <Option disabled label="Dev Null" searchValue="dev" value="dev-null" />
        <Option label="Local" searchValue={['local', 'dev', 'workbench']} value="local" />
      </Combobox>,
    )
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let production = getOptionByText(container, 'Production')
    let staging = getOptionByText(container, 'Staging')
    let devNull = getOptionByText(container, 'Dev Null')
    let local = getOptionByText(container, 'Local')
    input.focus()

    changeInputValue(input, 'bet')
    await settle(root)

    expect(staging.hidden).toBe(false)
    expect(staging.style.display).toBe('')
    expect(local.hidden).toBe(true)
    expect(local.style.display).toBe('none')
    expect(input.getAttribute('aria-activedescendant')).toBe(staging.id)

    changeInputValue(input, 'dev')
    await settle(root)

    expect(production.hidden).toBe(true)
    expect(production.style.display).toBe('none')
    expect(staging.hidden).toBe(true)
    expect(staging.style.display).toBe('none')
    expect(devNull.hidden).toBe(false)
    expect(devNull.style.display).toBe('')
    expect(local.hidden).toBe(false)
    expect(local.style.display).toBe('')
    expect(input.getAttribute('aria-activedescendant')).toBe(local.id)
  })

  it('pointer selection keeps focus on the input', async () => {
    vi.useFakeTimers()
    let { container, root } = renderApp(renderCombobox())
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let hiddenInput = container.querySelector('input[type="hidden"]') as HTMLInputElement
    let surface = container.querySelector('[popover]') as HTMLElement
    input.focus()

    changeInputValue(input, 'rea')
    await settle(root)

    let react = getOptionByText(container, 'React')
    pointer(react, 'pointerdown')
    pointer(react, 'pointerup')
    pointer(react, 'click')
    await settle(root)

    expect(react.getAttribute('data-flash')).toBe('true')
    expect(surface.matches(':popover-open')).toBe(true)
    expect(document.activeElement).toBe(input)
    expect(input.value).toBe('React framework')
    expect(hiddenInput.value).toBe('react')

    await finishSelectionFlash(root)

    expect(surface.matches(':popover-open')).toBe(false)
    expect(document.activeElement).toBe(input)
    expect(input.value).toBe('React framework')
    expect(hiddenInput.value).toBe('react')
    expect(react.getAttribute('data-flash')).toBe(null)
  })
})
