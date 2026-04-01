import { css, type Handle } from 'remix/component'
import { Glyph, ui } from 'remix/ui'

import { popover } from '../../../../src/lib/popover/popover.ts'

export default function Example(_handle: Handle) {
  return () => (
    <popover.context>
      <div mix={buttonRow}>
        <button mix={[popover.button({ placement: 'bottom-start' }), ui.popover.button]}>
          <span mix={ui.button.label}>View options</span>
          <Glyph mix={ui.button.icon} name="chevronDown" />
        </button>
        <button mix={[popover.button({ placement: 'bottom-end' }), ui.popover.button]}>
          <span mix={ui.button.label}>View options (bottom-end)</span>
          <Glyph mix={ui.button.icon} name="chevronDown" />
        </button>
      </div>

      <div mix={[popover.surface(), ui.popover.surface]}>
        <div mix={panel}>
          <div mix={field}>
            <label mix={ui.text.label} htmlFor="grouping">
              Grouping
            </label>
            <select id="grouping" mix={[control, popover.initialFocus()]}>
              <option>No grouping</option>
              <option>Status</option>
              <option>Priority</option>
            </select>
          </div>

          <div mix={field}>
            <label mix={ui.text.label} htmlFor="ordering">
              Ordering
            </label>
            <select id="ordering" mix={control}>
              <option>Manual</option>
              <option>Newest first</option>
              <option>Oldest first</option>
            </select>
          </div>

          <div mix={field}>
            <label mix={ui.text.label} htmlFor="closed-projects">
              Show closed projects
            </label>
            <select id="closed-projects" mix={control}>
              <option>All</option>
              <option>Open only</option>
              <option>Closed only</option>
            </select>
          </div>

          <div mix={actions}>
            <button mix={[ui.button.ghost, popover.dismiss()]}>Done</button>
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
  display: 'grid',
  gridTemplateColumns: 'max-content minmax(0, 1fr)',
  columnGap: '12px',
  rowGap: '12px',
  alignItems: 'center',
  width: '24rem',
  padding: '12px',
})

let field = css({
  display: 'contents',
})

let control = css({
  width: '100%',
})

let actions = css({
  display: 'flex',
  gap: '8px',
  justifyContent: 'flex-end',
  gridColumn: '1 / -1',
})
