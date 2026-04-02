import { css } from 'remix/component'
import { Option, Select } from 'remix/ui'

let selectExampleCss = css({
  width: '16rem',
})

export default function Example() {
  return () => (
    <Select initialLabel="Local" defaultValue="local" name="environment" mix={selectExampleCss}>
      <Option label="Local" value="local" />
      <Option label="Staging" value="staging" />
      <Option label="Production" value="production" />
      <Option label="Staging Backup" value="staging-backup" />
      <Option disabled label="Archived" value="archived" />
    </Select>
  )
}
