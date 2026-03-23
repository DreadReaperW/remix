// @jsxRuntime classic
// @jsx createElement
import { createElement, createMixin, on, ref, type ElementProps } from '@remix-run/component'
import { flashAttribute } from './flash-attribute.ts'
import { waitForCssTransition } from './wait-for-css-transition.ts'

export type MenuPhase = 'idle' | 'open' | 'closing'
export type MenuOpenSource = 'pointer' | 'enter' | 'space' | 'arrowDown' | 'arrowUp'
export type MenuOpenStrategy = 'none' | 'first' | 'last' | 'selectedOrFirst'
export type MenuCloseReason = 'trigger' | 'escape' | 'outsidePointerdown' | 'focusout'
export type MenuHighlightSource = 'keyboard' | 'pointer' | 'open'
export type MenuSelectSource = 'keyboard' | 'pointer'

type MenuTriggerOptions = {
  controls?: string
  disabled?: boolean
}

type MenuListOptions = {
  itemSelector?: string
  pointerUpDelay?: number
  selectedItemSelector?: string
  selectionFlashDelay?: number
  selectionReturnFocus?: boolean
  typeaheadTimeout?: number
}

type MenuSession = {
  highlightedItemId: string | null
  opener: HTMLElement | null
  openedAt: number | null
  openedBy: MenuOpenSource | null
  phase: MenuPhase
  pointerDownStartedInside: boolean
}

let MENU_POINTER_UP_DELAY = 200
let SELECTION_FLASH_DELAY = 75
let MENU_TYPEAHEAD_TIMEOUT = 750
let defaultItemSelector =
  '[role="menuitem"]:not([aria-disabled="true"]), [role="option"]:not([aria-disabled="true"])'
let defaultSelectedItemSelector = '[aria-selected="true"]'

export let menuOpenRequestEventType = 'rmx:menu-open-request' as const
export let menuCloseRequestEventType = 'rmx:menu-close-request' as const
export let menuHighlightRequestEventType = 'rmx:menu-highlight-request' as const
export let menuSelectRequestEventType = 'rmx:menu-select-request' as const
export let menuOpenEventType = 'rmx:menu-open' as const
export let menuClosingEventType = 'rmx:menu-closing' as const
export let menuCloseEventType = 'rmx:menu-close' as const
export let menuHighlightEventType = 'rmx:menu-highlight' as const
export let menuSelectEventType = 'rmx:menu-select' as const

declare global {
  interface HTMLElementEventMap {
    [menuOpenRequestEventType]: MenuOpenRequestEvent
    [menuCloseRequestEventType]: MenuCloseRequestEvent
    [menuHighlightRequestEventType]: MenuHighlightRequestEvent
    [menuSelectRequestEventType]: MenuSelectRequestEvent
    [menuOpenEventType]: MenuOpenEvent
    [menuClosingEventType]: MenuClosingEvent
    [menuCloseEventType]: MenuCloseEvent
    [menuHighlightEventType]: MenuHighlightEvent
    [menuSelectEventType]: MenuSelectEvent
  }
}

type MenuOpenEventInit = {
  opener: HTMLElement
  requestedAt?: number
  source: MenuOpenSource
  strategy: MenuOpenStrategy
}

type MenuCloseEventInit = {
  reason: MenuCloseReason | `select:${string}`
  returnFocus: boolean
}

type MenuHighlightEventInit = {
  item: HTMLElement | null
  source: MenuHighlightSource
}

export class MenuOpenRequestEvent extends Event {
  opener: HTMLElement
  requestedAt: number
  source: MenuOpenSource
  strategy: MenuOpenStrategy

  constructor({ opener, requestedAt = Date.now(), source, strategy }: MenuOpenEventInit) {
    super(menuOpenRequestEventType)
    this.opener = opener
    this.requestedAt = requestedAt
    this.source = source
    this.strategy = strategy
  }
}

export class MenuOpenEvent extends Event {
  opener: HTMLElement
  requestedAt: number
  source: MenuOpenSource
  strategy: MenuOpenStrategy

  constructor({ opener, requestedAt = Date.now(), source, strategy }: MenuOpenEventInit) {
    super(menuOpenEventType, { bubbles: true })
    this.opener = opener
    this.requestedAt = requestedAt
    this.source = source
    this.strategy = strategy
  }
}

export class MenuCloseRequestEvent extends Event {
  reason: MenuCloseReason | `select:${string}`
  returnFocus: boolean

  constructor({ reason, returnFocus }: MenuCloseEventInit) {
    super(menuCloseRequestEventType)
    this.reason = reason
    this.returnFocus = returnFocus
  }
}

export class MenuClosingEvent extends Event {
  reason: MenuCloseReason | `select:${string}`
  returnFocus: boolean

  constructor({ reason, returnFocus }: MenuCloseEventInit) {
    super(menuClosingEventType, { bubbles: true })
    this.reason = reason
    this.returnFocus = returnFocus
  }
}

export class MenuCloseEvent extends Event {
  reason: MenuCloseReason | `select:${string}`
  returnFocus: boolean

  constructor({ reason, returnFocus }: MenuCloseEventInit) {
    super(menuCloseEventType, { bubbles: true })
    this.reason = reason
    this.returnFocus = returnFocus
  }
}

export class MenuHighlightRequestEvent extends Event {
  item: HTMLElement | null
  itemId: string | null
  source: MenuHighlightSource

  constructor({ item, source }: MenuHighlightEventInit) {
    super(menuHighlightRequestEventType)
    this.item = item
    this.itemId = item?.id ?? null
    this.source = source
  }
}

export class MenuHighlightEvent extends Event {
  item: HTMLElement | null
  itemId: string | null
  source: MenuHighlightSource

  constructor({ item, source }: MenuHighlightEventInit) {
    super(menuHighlightEventType, { bubbles: true })
    this.item = item
    this.itemId = item?.id ?? null
    this.source = source
  }
}

export class MenuSelectRequestEvent extends Event {
  item: HTMLElement
  itemId: string
  source: MenuSelectSource

  constructor({ item, source }: { item: HTMLElement; source: MenuSelectSource }) {
    super(menuSelectRequestEventType)
    this.item = item
    this.itemId = item.id
    this.source = source
  }
}

export class MenuSelectEvent extends Event {
  item: HTMLElement
  itemId: string
  source: MenuSelectSource

  constructor({ item, source }: { item: HTMLElement; source: MenuSelectSource }) {
    super(menuSelectEventType, { bubbles: true })
    this.item = item
    this.itemId = item.id
    this.source = source
  }
}

function getNodeById(id: string | null | undefined) {
  if (!id) {
    return null
  }

  let node = document.getElementById(id)
  return node instanceof HTMLElement ? node : null
}

function getMenuNode(trigger: HTMLElement, controls?: string) {
  let resolvedControls =
    controls ?? trigger.getAttribute('popovertarget') ?? trigger.getAttribute('aria-controls')

  return getNodeById(resolvedControls)
}

function getMenuPhase(node: HTMLElement | null) {
  let phase = node?.dataset.menuPhase

  if (phase === 'open' || phase === 'closing') {
    return phase
  }

  return 'idle'
}

function getPopoverHost(node: HTMLElement) {
  let host = node.closest('[popover]')
  return host instanceof HTMLElement ? host : null
}

function getEnabledItems(node: HTMLElement, itemSelector: string) {
  return Array.from(node.querySelectorAll(itemSelector)).filter(
    (item): item is HTMLElement => item instanceof HTMLElement && item.id !== '',
  )
}

function getItemById(node: HTMLElement, itemSelector: string, id: string | null | undefined) {
  if (!id) {
    return null
  }

  return getEnabledItems(node, itemSelector).find((item) => item.id === id) ?? null
}

function getItemFromTarget(target: EventTarget | null, itemSelector: string) {
  if (!(target instanceof Element)) {
    return null
  }

  let item = target.closest(itemSelector)
  return item instanceof HTMLElement && item.id !== '' ? item : null
}

function clearHighlight(node: HTMLElement, itemSelector: string, highlightedItemId: string | null) {
  let item = getItemById(node, itemSelector, highlightedItemId)
  delete item?.dataset.highlighted
  node.removeAttribute('aria-activedescendant')
}

function applyHighlight(
  node: HTMLElement,
  itemSelector: string,
  currentItemId: string | null,
  nextItem: HTMLElement | null,
) {
  let currentItem = getItemById(node, itemSelector, currentItemId)
  delete currentItem?.dataset.highlighted

  if (!(nextItem instanceof HTMLElement)) {
    node.removeAttribute('aria-activedescendant')
    return null
  }

  nextItem.dataset.highlighted = 'true'
  node.setAttribute('aria-activedescendant', nextItem.id)
  return nextItem.id
}

function resolveInitialHighlight(
  node: HTMLElement,
  options: MenuListOptions,
  strategy: MenuOpenStrategy,
) {
  let items = getEnabledItems(node, options.itemSelector ?? defaultItemSelector)
  if (items.length === 0 || strategy === 'none') {
    return null
  }

  if (strategy === 'first') {
    return items[0] ?? null
  }

  if (strategy === 'last') {
    return items.at(-1) ?? null
  }

  let selectedItem = node.querySelector(options.selectedItemSelector ?? defaultSelectedItemSelector)
  if (
    selectedItem instanceof HTMLElement &&
    selectedItem.matches(options.itemSelector ?? defaultItemSelector)
  ) {
    return selectedItem
  }

  return items[0] ?? null
}

function moveHighlight(
  node: HTMLElement,
  options: MenuListOptions,
  highlightedItemId: string | null,
  direction: 'next' | 'previous' | 'first' | 'last',
) {
  let itemSelector = options.itemSelector ?? defaultItemSelector
  let items = getEnabledItems(node, itemSelector)
  if (items.length === 0) {
    return null
  }

  if (direction === 'first') {
    return items[0] ?? null
  }

  if (direction === 'last') {
    return items.at(-1) ?? null
  }

  let currentIndex = items.findIndex((item) => item.id === highlightedItemId)
  if (currentIndex === -1) {
    return direction === 'next' ? (items[0] ?? null) : (items.at(-1) ?? null)
  }

  let nextIndex = currentIndex + (direction === 'next' ? 1 : -1)
  nextIndex = Math.max(0, Math.min(items.length - 1, nextIndex))

  return items[nextIndex] ?? null
}

function getItemTextValue(item: HTMLElement) {
  return item.dataset.label?.toLowerCase() ?? item.textContent?.trim().toLowerCase() ?? ''
}

function moveHighlightByText(
  node: HTMLElement,
  options: MenuListOptions,
  highlightedItemId: string | null,
  text: string,
) {
  if (text === '') {
    return null
  }

  let itemSelector = options.itemSelector ?? defaultItemSelector
  let items = getEnabledItems(node, itemSelector)
  if (items.length === 0) {
    return null
  }

  let normalizedText = text.toLowerCase()
  let currentIndex = items.findIndex((item) => item.id === highlightedItemId)

  for (let offset = 1; offset <= items.length; offset++) {
    let item = items[(currentIndex + offset + items.length) % items.length]
    if (!(item instanceof HTMLElement)) {
      continue
    }

    if (getItemTextValue(item).startsWith(normalizedText)) {
      return item
    }
  }

  return null
}

function dispatchOpenRequest(
  opener: HTMLElement,
  options: MenuTriggerOptions,
  source: MenuOpenSource,
  strategy: MenuOpenStrategy,
) {
  let node = getMenuNode(opener, options.controls)
  if (!(node instanceof HTMLElement)) {
    return
  }

  node.dispatchEvent(
    new MenuOpenRequestEvent({
      opener,
      source,
      strategy,
    }),
  )
}

function dispatchCloseRequest(
  opener: HTMLElement,
  options: MenuTriggerOptions,
  reason: MenuCloseReason,
  returnFocus: boolean,
) {
  let node = getMenuNode(opener, options.controls)
  if (!(node instanceof HTMLElement)) {
    return
  }

  node.dispatchEvent(
    new MenuCloseRequestEvent({
      reason,
      returnFocus,
    }),
  )
}

export let menuTrigger = createMixin<HTMLElement, [options?: MenuTriggerOptions], ElementProps>(
  (handle) => {
    type MenuTriggerMixinArgs =
      | [props: ElementProps]
      | [options: MenuTriggerOptions | undefined, props: ElementProps]

    return (...args: MenuTriggerMixinArgs) => {
      let options = args.length === 2 ? (args[0] ?? {}) : {}
      let props = args.length === 2 ? args[1] : args[0]
      let disabled =
        options.disabled ?? (props['aria-disabled'] === true || props['aria-disabled'] === 'true')

      return (
        <handle.element
          {...props}
          mix={[
            on('pointerdown', (event) => {
              if (disabled || event.button !== 0) {
                return
              }

              let node = getMenuNode(event.currentTarget, options.controls)
              let phase = getMenuPhase(node)
              if (phase === 'closing') {
                return
              }

              event.preventDefault()
              event.currentTarget.focus()

              if (phase === 'open') {
                dispatchCloseRequest(event.currentTarget, options, 'trigger', true)
                return
              }

              dispatchOpenRequest(event.currentTarget, options, 'pointer', 'none')
            }),
            on('keydown', (event) => {
              if (disabled) {
                return
              }

              let node = getMenuNode(event.currentTarget, options.controls)
              let phase = getMenuPhase(node)
              if (phase === 'closing') {
                return
              }

              switch (event.key) {
                case ' ':
                  if (phase !== 'idle') {
                    return
                  }

                  event.preventDefault()
                  dispatchOpenRequest(event.currentTarget, options, 'space', 'none')
                  break
                case 'Enter':
                  if (phase !== 'idle') {
                    return
                  }

                  event.preventDefault()
                  dispatchOpenRequest(event.currentTarget, options, 'enter', 'none')
                  break
                case 'ArrowDown':
                  if (phase !== 'idle') {
                    return
                  }

                  event.preventDefault()
                  dispatchOpenRequest(event.currentTarget, options, 'arrowDown', 'first')
                  break
                case 'ArrowUp':
                  if (phase !== 'idle') {
                    return
                  }

                  event.preventDefault()
                  dispatchOpenRequest(event.currentTarget, options, 'arrowUp', 'last')
                  break
                case 'Escape':
                  if (phase !== 'open') {
                    return
                  }

                  event.preventDefault()
                  dispatchCloseRequest(event.currentTarget, options, 'escape', true)
                  break
              }
            }),
          ]}
        />
      )
    }
  },
)

export let menuList = createMixin<HTMLElement, [options?: MenuListOptions], ElementProps>(
  (handle) => {
    let node: HTMLElement
    let popoverHost: HTMLElement | null = null
    let currentOptions: MenuListOptions = {}
    let typeaheadText = ''
    let typeaheadTimeoutId = 0
    let session: MenuSession = {
      highlightedItemId: null,
      opener: null,
      openedAt: null,
      openedBy: null,
      phase: 'idle',
      pointerDownStartedInside: false,
    }

    function clearTypeahead() {
      clearTimeout(typeaheadTimeoutId)
      typeaheadTimeoutId = 0
      typeaheadText = ''
    }

    function updateTypeahead(text: string) {
      typeaheadText = text
      requestHighlight(
        moveHighlightByText(node, currentOptions, session.highlightedItemId, typeaheadText),
        'keyboard',
      )

      clearTimeout(typeaheadTimeoutId)
      typeaheadTimeoutId = window.setTimeout(clearTypeahead, currentOptions.typeaheadTimeout ?? MENU_TYPEAHEAD_TIMEOUT)
    }

    function requestHighlight(item: HTMLElement | null, source: MenuHighlightSource) {
      if (item?.id === session.highlightedItemId) {
        return
      }

      node.dispatchEvent(
        new MenuHighlightRequestEvent({
          item,
          source,
        }),
      )
    }

    function requestClose(reason: MenuCloseReason, returnFocus: boolean) {
      node.dispatchEvent(
        new MenuCloseRequestEvent({
          reason,
          returnFocus,
        }),
      )
    }

    function emitHighlight(item: HTMLElement | null, source: MenuHighlightSource) {
      if (session.phase !== 'open') {
        return
      }

      if (item?.id === session.highlightedItemId) {
        return
      }

      session.highlightedItemId = applyHighlight(
        node,
        currentOptions.itemSelector ?? defaultItemSelector,
        session.highlightedItemId,
        item,
      )
      item?.scrollIntoView({ block: 'nearest' })

      node.dispatchEvent(
        new MenuHighlightEvent({
          item,
          source,
        }),
      )
    }

    function emitOpen(event: MenuOpenRequestEvent) {
      if (session.phase !== 'idle') {
        return
      }

      session.phase = 'open'
      session.opener = event.opener
      session.openedAt = event.requestedAt
      session.openedBy = event.source
      session.pointerDownStartedInside = false

      clearTypeahead()
      node.dataset.menuPhase = 'open'
      popoverHost?.showPopover()
      node.focus()
      node.dispatchEvent(
        new MenuOpenEvent({
          opener: event.opener,
          requestedAt: event.requestedAt,
          source: event.source,
          strategy: event.strategy,
        }),
      )

      let item = resolveInitialHighlight(node, currentOptions, event.strategy)
      if (item instanceof HTMLElement) {
        emitHighlight(item, 'open')
      }
    }

    function emitClose({ reason, returnFocus }: MenuCloseEventInit) {
      let opener = session.opener

      clearTypeahead()
      clearHighlight(node, currentOptions.itemSelector ?? defaultItemSelector, session.highlightedItemId)

      session = {
        highlightedItemId: null,
        opener: null,
        openedAt: null,
        openedBy: null,
        phase: 'idle',
        pointerDownStartedInside: false,
      }

      delete node.dataset.menuPhase
      popoverHost?.hidePopover()

      if (returnFocus) {
        opener?.focus()
      }

      node.dispatchEvent(
        new MenuCloseEvent({
          reason,
          returnFocus,
        }),
      )
    }

    async function emitSelect(item: HTMLElement, source: MenuSelectSource) {
      if (
        session.phase !== 'open' ||
        item.getAttribute('aria-disabled') === 'true' ||
        !item.id
      ) {
        return
      }

      session.phase = 'closing'
      session.pointerDownStartedInside = false
      clearHighlight(node, currentOptions.itemSelector ?? defaultItemSelector, session.highlightedItemId)
      session.highlightedItemId = null
      node.dataset.menuPhase = 'closing'

      await flashAttribute(
        item,
        'data-flash',
        currentOptions.selectionFlashDelay ?? SELECTION_FLASH_DELAY,
      )
      if (handle.signal.aborted) return

      await waitForCssTransition(popoverHost ?? node, handle.signal, () => {
        emitClose({
          reason: `select:${item.id}`,
          returnFocus: currentOptions.selectionReturnFocus ?? true,
        })
      })
      if (handle.signal.aborted) return

      node.dispatchEvent(
        new MenuSelectEvent({
          item,
          source,
        }),
      )
    }

    handle.queueTask(() => {
      document.addEventListener(
        'pointerdown',
        (event) => {
          if (session.phase !== 'open' || event.button !== 0) {
            return
          }

          if (!(event.target instanceof Node)) {
            return
          }

          if ((popoverHost?.contains(event.target) ?? node.contains(event.target)) || session.opener?.contains(event.target)) {
            return
          }

          event.preventDefault()
          emitClose({ reason: 'outsidePointerdown', returnFocus: true })
        },
        {
          capture: true,
          signal: handle.signal,
        },
      )
    })

    type MenuListMixinArgs =
      | [props: ElementProps]
      | [options: MenuListOptions | undefined, props: ElementProps]

    return (...args: MenuListMixinArgs) => {
      let options = args.length === 2 ? (args[0] ?? {}) : {}
      let props = args.length === 2 ? args[1] : args[0]

      currentOptions = options

      return (
        <handle.element
          {...props}
          mix={[
            ref((value: HTMLElement) => {
              node = value
              popoverHost = getPopoverHost(value)
            }),
            on(menuOpenRequestEventType, (event) => {
              emitOpen(event)
            }),
            on(menuCloseRequestEventType, (event) => {
              if (session.phase !== 'open') {
                return
              }

              emitClose({
                reason: event.reason,
                returnFocus: event.returnFocus,
              })
            }),
            on(menuHighlightRequestEventType, (event) => {
              if (session.phase !== 'open') {
                return
              }

              emitHighlight(event.item, event.source)
            }),
            on('keydown', (event) => {
              if (session.phase !== 'open') {
                return
              }

              event.stopPropagation()

              if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
                updateTypeahead(typeaheadText + event.key.toLowerCase())
                return
              }

              if (event.key === 'Backspace' && typeaheadText.length > 0) {
                updateTypeahead(typeaheadText.slice(0, -1))
                return
              }

              switch (event.key) {
                case 'ArrowDown':
                  event.preventDefault()
                  clearTypeahead()
                  requestHighlight(
                    moveHighlight(
                      node,
                      currentOptions,
                      session.highlightedItemId,
                      'next',
                    ),
                    'keyboard',
                  )
                  break
                case 'ArrowUp':
                  event.preventDefault()
                  clearTypeahead()
                  requestHighlight(
                    moveHighlight(
                      node,
                      currentOptions,
                      session.highlightedItemId,
                      'previous',
                    ),
                    'keyboard',
                  )
                  break
                case 'Home':
                  event.preventDefault()
                  clearTypeahead()
                  requestHighlight(
                    moveHighlight(
                      node,
                      currentOptions,
                      session.highlightedItemId,
                      'first',
                    ),
                    'keyboard',
                  )
                  break
                case 'End':
                  event.preventDefault()
                  clearTypeahead()
                  requestHighlight(
                    moveHighlight(
                      node,
                      currentOptions,
                      session.highlightedItemId,
                      'last',
                    ),
                    'keyboard',
                  )
                  break
                case 'Enter':
                case ' ':
                  event.preventDefault()
                  clearTypeahead()

                  {
                    let item = getItemById(
                      node,
                      currentOptions.itemSelector ?? defaultItemSelector,
                      session.highlightedItemId,
                    )

                    if (item instanceof HTMLElement) {
                      void emitSelect(item, 'keyboard')
                    }
                  }
                  break
                case 'Escape':
                  event.preventDefault()
                  emitClose({ reason: 'escape', returnFocus: true })
                  break
              }
            }),
            on('focusout', (event) => {
              if (session.phase !== 'open') {
                return
              }

              let nextTarget = event.relatedTarget
              if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
                return
              }

              emitClose({ reason: 'focusout', returnFocus: false })
            }),
            on('pointermove', (event) => {
              if (session.phase !== 'open') {
                return
              }

              requestHighlight(
                getItemFromTarget(event.target, currentOptions.itemSelector ?? defaultItemSelector),
                'pointer',
              )
            }),
            on('pointerdown', (event) => {
              if (session.phase !== 'open' || event.button !== 0) {
                return
              }

              session.pointerDownStartedInside = true
              event.stopPropagation()
            }),
            on('pointerleave', () => {
              if (session.phase !== 'open') {
                return
              }

              requestHighlight(null, 'pointer')
            }),
            on('pointerup', (event) => {
              if (session.phase !== 'open' || event.button !== 0) {
                return
              }

              if (
                !session.pointerDownStartedInside &&
                session.openedBy === 'pointer' &&
                session.openedAt !== null &&
                Date.now() - session.openedAt < (currentOptions.pointerUpDelay ?? MENU_POINTER_UP_DELAY)
              ) {
                return
              }

              session.pointerDownStartedInside = false

              let item = getItemFromTarget(
                event.target,
                currentOptions.itemSelector ?? defaultItemSelector,
              )
              if (!(item instanceof HTMLElement)) {
                return
              }

              event.stopPropagation()
              void emitSelect(item, 'pointer')
            }),
          ]}
        />
      )
    }
  },
)

type MenuMixinApi = {
  readonly close: typeof menuCloseEventType
  readonly closeRequest: typeof menuCloseRequestEventType
  readonly highlight: typeof menuHighlightEventType
  readonly highlightRequest: typeof menuHighlightRequestEventType
  readonly list: typeof menuList
  readonly open: typeof menuOpenEventType
  readonly openRequest: typeof menuOpenRequestEventType
  readonly select: typeof menuSelectEventType
  readonly trigger: typeof menuTrigger
}

export let menu = {
  close: menuCloseEventType,
  closeRequest: menuCloseRequestEventType,
  highlight: menuHighlightEventType,
  highlightRequest: menuHighlightRequestEventType,
  list: menuList,
  open: menuOpenEventType,
  openRequest: menuOpenRequestEventType,
  select: menuSelectEventType,
  trigger: menuTrigger,
} as MenuMixinApi
