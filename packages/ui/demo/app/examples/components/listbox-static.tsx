import { css, on, type Handle } from 'remix/component'
import { Glyph, listbox, theme, ui } from 'remix/ui'

let frameworkOptions = [
  { label: 'Remix', value: 'remix' },
  { disabled: true, label: 'React Router', value: 'react-router' },
  { label: 'React', value: 'react' },
  { label: 'Preact', value: 'preact' },
  { label: 'Solid', value: 'solid' },
] as const

let exampleCss = css({
  display: 'grid',
  gap: theme.space.xs,
  width: '16rem',
})

let helperTextCss = css({
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.sm,
  margin: '0',
})

let statusCss = css({
  color: theme.colors.text.secondary,
  fontFamily: theme.fontFamily.mono,
  fontSize: theme.fontSize.xs,
  margin: '0',
})

let listWidthCss = css({
  width: '100%',
})

export default function Example(handle: Handle) {
  let lastChange = 'No selection yet'

  return () => (
    <div mix={exampleCss}>
      <p mix={helperTextCss}>
        Focus the list, move with ArrowUp and ArrowDown, then press Enter, Space, or click an
        option.
      </p>

      <listbox.context>
        <div
          aria-label="Frameworks"
          mix={[
            listWidthCss,
            ui.listbox.root,
            listbox.list(),
            on(listbox.change, (event) => {
              lastChange = `value=${event.value} values=[${event.values.join(', ')}] focus=${event.focusValue}`
              void handle.update()
            }),
          ]}
        >
          {frameworkOptions.map((option) => (
            <div key={option.value} mix={[ui.listbox.option, listbox.option(option)]}>
              <Glyph mix={ui.listbox.glyph} name="check" />
              <span mix={ui.listbox.label}>{option.label}</span>
            </div>
          ))}
        </div>
      </listbox.context>

      <p mix={statusCss}>{lastChange}</p>
    </div>
  )
}
