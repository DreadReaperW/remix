import { ui } from 'remix/ui'

import { ExplorerExampleCard } from '../example-card.tsx'
import { exampleGridCss, noteListCss, PageSection, pageStackCss } from '../page-primitives.tsx'
import { EXAMPLES } from '../../examples/index.tsx'

let listboxExamples = [EXAMPLES.listboxOverview, EXAMPLES.listboxControlled]

export function renderComponentListboxPage() {
  return (
    <div mix={pageStackCss}>
      <PageSection
        title="Listbox"
        description="Listbox is the first popup-backed value control in the library. The default API should stay small, while the lower-level UI tokens remain available when needed."
      >
        <div mix={exampleGridCss}>
          {listboxExamples.map((example) => (
            <ExplorerExampleCard key={example.id} example={example} />
          ))}
        </div>
      </PageSection>

      <PageSection title="What to remember">
        <article mix={ui.card.base}>
          <div mix={ui.card.body}>
            <ul mix={noteListCss}>
              <li>Use the default `Listbox` plus `ListboxOption` for the normal case.</li>
              <li>Use the `name` prop when the value should participate in form submission.</li>
              <li>Handle changes with `on(Listbox.change, ...)` instead of reaching into the component.</li>
            </ul>
          </div>
        </article>
      </PageSection>
    </div>
  )
}
