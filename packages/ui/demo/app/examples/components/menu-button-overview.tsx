import { css, on, ref, type Handle } from 'remix/component'
import { MenuList, MenuItem, Menu, MenuButton } from '../../../../src/lib/menu/menu.tsx'

export default function Example(handle: Handle) {
  return () => (
    <Menu
      label="File actions"
      mix={on(Menu.select, (event) => {
        console.log('select', event.item)
      })}
    >
      <MenuButton>File</MenuButton>
      <MenuList>
        <MenuItem name="rename" value="rename-file">
          Rename
        </MenuItem>
        <MenuItem name="delete" value="delete-file">
          Delete
        </MenuItem>
        <MenuItem name="archive" value="archive-file">
          Archive
        </MenuItem>
      </MenuList>
    </Menu>
  )
}
