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
      <MenuItem action="open">Open project</MenuItem>
      <MenuItem
        action="rename"
        mix={on(MenuButton.action, (event: MenuActionEvent) => {
          console.log('MenuItem handler:', event.action)
        })}
      >
        Rename project
      </MenuItem>
      <MenuItem action="duplicate">Duplicate project</MenuItem>
    </MenuButton>
  )
}
