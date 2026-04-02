import { css, on, type Handle } from 'remix/component'
import { Combobox, ComboboxOption, ui } from 'remix/ui'

let comboboxExampleCss = css({
  width: '16rem',
})

export default function Example(handle: Handle) {
  let value: string | null = null

  return () => (
    <div mix={[ui.stack, ui.gap.sm]}>
      <div mix={[ui.stack, ui.gap.xs]}>
        <label for="environment-combobox" mix={ui.fieldText.label}>
          City
        </label>

        <Combobox
          inputId="environment-combobox"
          mix={[
            comboboxExampleCss,
            on(Combobox.change, (event) => {
              value = event.value
              void handle.update()
            }),
          ]}
          name="city"
          placeholder="Search cities"
        >
          <ComboboxOption label="Berlin" value="berlin" />
          <ComboboxOption label="Boston" value="boston" />
          <ComboboxOption searchValue={['lisbon', 'lx']} label="Lisbon" value="lisbon" />
          <ComboboxOption label="London" value="london" />
          <ComboboxOption label="Los Angeles" value="los-angeles" />
          <ComboboxOption label="New Orleans" value="new-orleans" />
          <ComboboxOption label="New York" value="new-york" />
          <ComboboxOption label="San Diego" value="san-diego" />
          <ComboboxOption label="San Francisco" value="san-francisco" />
          <ComboboxOption disabled label="San Jose" value="san-jose" />
        </Combobox>

        <div mix={ui.fieldText.help}>
          Try typing `san`, `new`, `lo`, or `lx`, then use ArrowDown and Enter.
        </div>
      </div>

      <p mix={ui.text.supporting}>{`value=${value ?? 'null'}`}</p>
    </div>
  )
}
