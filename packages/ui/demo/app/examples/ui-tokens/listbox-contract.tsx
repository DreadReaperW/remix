import { css } from 'remix/component'
import { Glyph, popover, theme, ui } from 'remix/ui'

export default function Example() {
  return () => (
    <div mix={frameCss}>
      <button type="button" mix={ui.listbox.button}>
        <span mix={ui.listbox.value}>Active workspace</span>
        <Glyph mix={ui.listbox.indicator} name="chevronDown" />
      </button>
      <div id="listbox-contract-preview" mix={[popover(), ui.listbox.popover, staticPopoverCss]}>
        <div role="listbox" aria-label="Workspaces" mix={ui.listbox.list}>
          <div aria-selected="true" role="option" mix={ui.listbox.option}>
            <Glyph mix={ui.listbox.optionIndicator} name="check" />
            <span mix={ui.listbox.optionLabel}>Active workspace</span>
          </div>
          <div aria-selected="false" role="option" mix={ui.listbox.option}>
            <Glyph mix={ui.listbox.optionIndicator} name="check" />
            <span mix={ui.listbox.optionLabel}>Archive workspace</span>
          </div>
        </div>
      </div>
    </div>
  )
}

let frameCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.sm,
  width: '100%',
})

let staticPopoverCss = css({
  position: 'relative',
  inset: 'auto',
  opacity: 1,
})
