import { on } from 'remix/component'
import { MenuButton, MenuItem, MenuSeparator, type MenuActionEvent } from 'remix/ui'

export default function example() {
  return () => (
    <MenuButton
      label="File"
      mix={on(MenuButton.action, (event: MenuActionEvent) => {
        console.log('MenuButton action:', event.action)
      })}
    >
      <MenuItem action="new" glyph="add">
        New File
      </MenuItem>
      <MenuItem action="rename" glyph="edit">
        Rename
      </MenuItem>
      <MenuSeparator />
      <MenuItem action="delete" glyph="trash">
        Delete
      </MenuItem>
      <MenuItem disabled action="archive">
        Archive
      </MenuItem>
    </MenuButton>
  )
}
