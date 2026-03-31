import { css, type Handle } from 'remix/component'
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
      <div mix={[popover.surface(), ui.popover]}>
        <div mix={panel}>
          <p mix={ui.text.bodySm}>
            Open from either side, then close it and focus will return to the opener for that
            session.
          </p>
          <div mix={actionRow}>
            <button mix={[ui.button.ghost, popover.dismiss()]}>Cancel</button>
            <button mix={[ui.button.primary, popover.initialFocus(), popover.dismiss()]}>
              Take Action
            </button>
          </div>
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
  padding: '12px',
})

let actionRow = css({
  display: 'flex',
  gap: '12px',
  justifyContent: 'flex-end',
})
