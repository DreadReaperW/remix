import { css, on, type Handle } from 'remix/component'
import { Glyph, ui } from 'remix/ui'

import { popover } from '../../../../src/lib/popover/popover.ts'

export default function Example(_handle: Handle) {
  return () => (
    <popover.context>
      <div mix={buttonRow}>
        <button mix={[ui.button.ghost, popover.button({ placement: 'bottom-start' })]}>
          <span mix={ui.button.label}>Open from left</span>
          <Glyph mix={ui.button.icon} name="chevronDown" />
        </button>
        <button mix={[ui.button.ghost, popover.button({ placement: 'bottom-end' })]}>
          <span mix={ui.button.label}>Open from right</span>
          <Glyph mix={ui.button.icon} name="chevronDown" />
        </button>
      </div>
      <div mix={[popover(), ui.popover, panel]}>
        <p mix={ui.text.bodySm}>
          Open from either side, then close it and focus will return to the opener for that
          session.
        </p>
        <div mix={actionRow}>
          <button mix={[ui.button.secondary, popover.openFocusTarget()]}>First action</button>
          <button
            mix={[
              ui.button.ghost,
              on('click', (event) => {
                let surface = event.currentTarget.closest('[popover]')
                if (!(surface instanceof HTMLElement)) {
                  return
                }

                surface.hidePopover()
              }),
            ]}
          >
            Close
          </button>
        </div>
      </div>
    </popover.context>
  )
}

let buttonRow = css({
  display: 'flex',
  gap: '12px',
})

let panel = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  width: '20rem',
})

let actionRow = css({
  display: 'flex',
  gap: '12px',
  justifyContent: 'flex-end',
})
