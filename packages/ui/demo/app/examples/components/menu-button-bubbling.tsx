import { on } from 'remix/component'
import { MenuButton, MenuItem, type MenuActionEvent } from 'remix/ui'

export default function example() {
  return () => (
    <MenuButton
      label="Project"
      mix={on(MenuButton.action, (event: MenuActionEvent) => {
        console.log('MenuButton handler:', event.action)
      })}
    >
      <MenuItem action="open" glyph="open">
        Open project
      </MenuItem>
      <MenuItem
        action="rename"
        glyph="edit"
        mix={on(MenuButton.action, (event: MenuActionEvent) => {
          console.log('MenuItem handler:', event.action)
        })}
      >
        Rename project
      </MenuItem>
      <MenuItem action="duplicate" glyph="copy">
        Duplicate project
      </MenuItem>
    </MenuButton>
  )
}
