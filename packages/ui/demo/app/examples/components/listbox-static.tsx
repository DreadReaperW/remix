import { css } from 'remix/component'
import { theme } from 'remix/ui'

// import { Listbox, Option } from '../../../../../../reference/selectable-list/listbox.tsx'

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

let listboxCss = css({
  backgroundColor: theme.surface.lvl0,
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.lg,
  padding: theme.space.xs,
})

export default function example() {
  return () => (
    <div mix={exampleCss}>
      <p mix={helperTextCss}>
        Focus the listbox, use ArrowUp and ArrowDown, then press Space or Enter.
      </p>
      {/* <Listbox aria-label="Single framework listbox" mix={listboxCss}>
        <Option value="remix">Remix</Option>
        <Option disabled value="react-router">
          React Router
        </Option>
        <Option value="react">React</Option>
        <Option value="preact">Preact</Option>
        <Option value="solid">Solid</Option>
      </Listbox> */}
    </div>
  )
}
