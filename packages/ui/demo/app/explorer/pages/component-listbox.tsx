import { ui } from 'remix/ui'

import { ExplorerExampleCard } from '../example-card.tsx'
import { exampleGridCss, noteListCss, PageSection, pageStackCss } from '../page-primitives.tsx'
import { EXAMPLES } from '../../examples/index.tsx'

let listboxExamples = [EXAMPLES.listboxStatic]

export function renderComponentListboxPage() {
  return (
    <div mix={pageStackCss}>
      <PageSection
        title="Listbox"
        description="Listbox starts with the static single-select foundation: list-root focus, aria-activedescendant navigation, and a bubbling change event. The popup trigger layer can build on top later."
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
              <li>Use `listbox.context`, `listbox.list()`, and `listbox.option()` for the current supported surface.</li>
              <li>Keep focus on the list root and let `aria-activedescendant` describe the active option.</li>
              <li>Handle selection with `on(listbox.change, ...)` on the list or any ancestor.</li>
            </ul>
          </div>
        </article>
      </PageSection>
    </div>
  )
}
