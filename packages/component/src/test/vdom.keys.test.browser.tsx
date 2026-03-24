import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { invariant } from '../lib/invariant.ts'
import { Fragment } from '../lib/component.ts'

describe('vnode rendering (keys)', () => {
  describe('keyed list with non-keyed sibling', () => {
    it('appends keyed component before non-keyed sibling', (t) => {
      type CardData = { id: string; title: string }

      function Card() {
        return ({ card }: { card: CardData }) => <div data-id={card.id}>{card.title}</div>
      }

      function Column() {
        return ({ cards, isAddingCard }: { cards: CardData[]; isAddingCard: boolean }) => (
          <div>
            {cards.map((card) => (
              <Card key={card.id} card={card} />
            ))}
            {isAddingCard ? <div id="form">Form</div> : <button>Add</button>}
          </div>
        )
      }

      let cards: CardData[] = [
        { id: '1', title: 'Card 1' },
        { id: '2', title: 'Card 2' },
      ]
      let { container, root } = t.render(<Column cards={cards} isAddingCard={false} />)

      let col = container.querySelector('div')
      invariant(col)
      assert.equal(
        col.innerHTML,
        '<div data-id="1">Card 1</div><div data-id="2">Card 2</div><button>Add</button>',
      )

      root.render(<Column cards={cards} isAddingCard={true} />)
      assert.equal(
        col.innerHTML,
        '<div data-id="1">Card 1</div><div data-id="2">Card 2</div><div id="form">Form</div>',
      )

      cards = [...cards, { id: '3', title: 'Card 3' }]
      root.render(<Column cards={cards} isAddingCard={true} />)

      assert.equal(
        col.innerHTML,
        '<div data-id="1">Card 1</div><div data-id="2">Card 2</div><div data-id="3">Card 3</div><div id="form">Form</div>',
      )
    })
  })

  describe('basic keyed list operations', () => {
    it('handles prepending items with keys', (t) => {
      function List() {
        return ({ values }: { values: (string | number)[] }) => (
          <ul>
            {values.map((value) => (
              <li key={value} data-id={value}>
                {value}
              </li>
            ))}
          </ul>
        )
      }

      let values: (string | number)[] = ['b', 'c']
      let { container, root } = t.render(<List values={values} />)
      assert.equal(container.textContent, 'bc')

      values = ['a', ...values]
      root.render(<List values={values} />)
      assert.equal(container.textContent, 'abc')

      let items = Array.from(container.querySelectorAll('li'))
      assert.deepEqual(
        items.map((el) => el.getAttribute('data-id')),
        ['a', 'b', 'c'],
      )
    })

    it('handles appending items with keys', (t) => {
      function List() {
        return ({ values }: { values: string[] }) => (
          <ol>
            {values.map((value) => (
              <li key={value} data-id={value}>
                {value}
              </li>
            ))}
          </ol>
        )
      }

      let values = ['a', 'b']
      let { container, root } = t.render(<List values={values} />)
      assert.equal(container.textContent, 'ab')

      let a = container.querySelector('[data-id="a"]')
      let b = container.querySelector('[data-id="b"]')
      assert.ok(a instanceof HTMLLIElement)
      assert.ok(b instanceof HTMLLIElement)

      values = [...values, 'c']
      root.render(<List values={values} />)
      assert.equal(container.textContent, 'abc')

      let items = Array.from(container.querySelectorAll('li'))
      assert.equal(items[0], a)
      assert.equal(items[1], b)
      assert.equal(items[2]!.getAttribute('data-id'), 'c')
    })

    it('handles removing items with keys', (t) => {
      function List() {
        return ({ values }: { values: string[] }) => (
          <ul>
            {values.map((value) => (
              <li key={value} data-id={value}>
                {value}
              </li>
            ))}
          </ul>
        )
      }

      let values = ['a', 'b', 'c', 'd']
      let { container, root } = t.render(<List values={values} />)
      assert.equal(container.textContent, 'abcd')

      let a = container.querySelector('[data-id="a"]')
      let d = container.querySelector('[data-id="d"]')
      assert.ok(a instanceof HTMLLIElement)
      assert.ok(d instanceof HTMLLIElement)

      values = ['a', 'c', 'd']
      root.render(<List values={values} />)
      assert.equal(container.textContent, 'acd')

      let items = Array.from(container.querySelectorAll('li'))
      assert.equal(items[0], a)
      assert.equal(items[1]!.getAttribute('data-id'), 'c')
      assert.equal(items[2], d)
      assert.equal(container.querySelector('[data-id="b"]'), null)
    })

    it('handles inserting items with keys', (t) => {
      function List() {
        return ({ values }: { values: string[] }) => (
          <ul>
            {values.map((value) => (
              <li key={value} data-id={value}>
                {value}
              </li>
            ))}
          </ul>
        )
      }

      let values = ['a', 'c']
      let { container, root } = t.render(<List values={values} />)
      assert.equal(container.textContent, 'ac')

      let a = container.querySelector('[data-id="a"]')
      let c = container.querySelector('[data-id="c"]')
      assert.ok(a instanceof HTMLLIElement)
      assert.ok(c instanceof HTMLLIElement)

      values = ['a', 'b', 'c']
      root.render(<List values={values} />)
      assert.equal(container.textContent, 'abc')

      let items = Array.from(container.querySelectorAll('li'))
      assert.equal(items[0], a)
      assert.equal(items[1]!.getAttribute('data-id'), 'b')
      assert.equal(items[2], c)
    })

    it('handles swapping adjacent items with keys', (t) => {
      function List() {
        return ({ values }: { values: string[] }) => (
          <ul>
            {values.map((value) => (
              <li key={value} data-id={value}>
                {value}
              </li>
            ))}
          </ul>
        )
      }

      let values = ['a', 'b']
      let { container, root } = t.render(<List values={values} />)
      assert.equal(container.textContent, 'ab')

      let a = container.querySelector('[data-id="a"]')
      let b = container.querySelector('[data-id="b"]')
      assert.ok(a instanceof HTMLLIElement)
      assert.ok(b instanceof HTMLLIElement)

      values = ['b', 'a']
      root.render(<List values={values} />)
      assert.equal(container.textContent, 'ba')

      let items = Array.from(container.querySelectorAll('li'))
      assert.equal(items[0], b)
      assert.equal(items[1], a)
    })

    it('handles reversing list order with keys', (t) => {
      function List() {
        return ({ values }: { values: string[] }) => (
          <ul>
            {values.map((value) => (
              <li key={value} data-id={value}>
                {value}
              </li>
            ))}
          </ul>
        )
      }

      let values = ['a', 'b', 'c', 'd']
      let { container, root } = t.render(<List values={values} />)
      assert.equal(container.textContent, 'abcd')

      let nodes = values.map((value) => {
        let el = container.querySelector(`[data-id="${value}"]`)
        invariant(el instanceof HTMLLIElement)
        return el
      })

      values = [...values].reverse()
      root.render(<List values={values} />)
      assert.equal(container.textContent, 'dcba')

      let items = Array.from(container.querySelectorAll('li'))
      assert.equal(items[0], nodes[3])
      assert.equal(items[1], nodes[2])
      assert.equal(items[2], nodes[1])
      assert.equal(items[3], nodes[0])
    })

    it('handles complex reordering with keys', (t) => {
      function List() {
        return ({ values }: { values: string[] }) => (
          <ul>
            {values.map((value) => (
              <li key={value} data-id={value}>
                {value}
              </li>
            ))}
          </ul>
        )
      }

      let values = ['a', 'b', 'c', 'd', 'e', 'f']
      let { container, root } = t.render(<List values={values} />)
      assert.equal(container.textContent, 'abcdef')

      let nodes = values.map((value) => {
        let el = container.querySelector(`[data-id="${value}"]`)
        invariant(el instanceof HTMLLIElement)
        return el
      })

      values = ['a', 'e', 'b', 'f', 'c', 'd']
      root.render(<List values={values} />)
      assert.equal(container.textContent, 'aebfcd')

      let items = Array.from(container.querySelectorAll('li'))
      assert.equal(items[0], nodes[0]) // a
      assert.equal(items[1], nodes[4]) // e
      assert.equal(items[2], nodes[1]) // b
      assert.equal(items[3], nodes[5]) // f
      assert.equal(items[4], nodes[2]) // c
      assert.equal(items[5], nodes[3]) // d
    })
  })

  describe('key semantics', () => {
    it('replaces nodes when keys match but type differs', (t) => {
      let { container, root } = t.render(
        <div>
          <span key="x" id="x">
            X
          </span>
        </div>,
      )
      let first = container.querySelector('#x')
      invariant(first instanceof HTMLSpanElement)
      assert.equal(container.innerHTML, '<div><span id="x">X</span></div>')

      root.render(
        <div>
          <p key="x" id="x">
            Y
          </p>
        </div>,
      )
      let second = container.querySelector('#x')
      invariant(second instanceof HTMLParagraphElement)
      assert.equal(container.innerHTML, '<div><p id="x">Y</p></div>')
      assert.notEqual(second, first)
    })

    it('handles mixed keyed and unkeyed children', (t) => {
      function Item() {
        return ({ label }: { label: string }) => <li>{label}</li>
      }

      let { container, root } = t.render(
        <ul>
          <Item key="a" label="A" />
          <Item label="unkeyed-1" />
          <Item key="b" label="B" />
          <Item label="unkeyed-2" />
        </ul>,
      )

      assert.equal(container.textContent, 'Aunkeyed-1Bunkeyed-2')

      root.render(
        <ul>
          <Item label="unkeyed-1" />
          <Item key="b" label="B" />
          <Item label="unkeyed-2" />
          <Item key="a" label="A" />
        </ul>,
      )

      assert.equal(container.textContent, 'unkeyed-1Bunkeyed-2A')
    })

    it('handles duplicate keys (last one wins)', (t) => {
      let warnSpy = t.spyOn(console, 'warn', () => {})

      function List() {
        return ({ labels }: { labels: string[] }) => (
          <ul>
            {labels.map((label, index) => (
              <li key="dup" data-index={index}>
                {label}
              </li>
            ))}
          </ul>
        )
      }

      let { container, root } = t.render(<List labels={['first', 'second']} />)
      assert.equal(container.textContent, 'firstsecond')

      root.render(<List labels={['only']} />)
      assert.equal(container.textContent, 'only')

      let items = Array.from(container.querySelectorAll('li'))
      assert.equal(items.length, 1)
      assert.equal(items[0]!.getAttribute('data-index'), '0')
      assert.equal(warnSpy.mock.calls.length, 1)
      let warning = String(warnSpy.mock.calls[0]!.arguments[0] ?? '')
      assert.match(warning, /Duplicate keys detected in siblings/)
      assert.match(warning, /"dup"/)
    })

    it('allows any type to be a key', (t) => {
      let objKey = {}
      let symKey = Symbol('k')

      let { container, root } = t.render(
        <ul>
          <li key={1}>one</li>
          <li key="two">two</li>
          <li key={objKey}>obj</li>
          <li key={symKey}>sym</li>
        </ul>,
      )

      assert.equal(container.textContent, 'onetwoobjsym')

      root.render(
        <ul>
          <li key={symKey}>sym*</li>
          <li key={1}>one*</li>
          <li key={objKey}>obj*</li>
          <li key="two">two*</li>
        </ul>,
      )

      assert.equal(container.textContent, 'sym*one*obj*two*')
    })

    it('reorders keyed fragments correctly (moves entire DOM range)', (t) => {
      let { container, root } = t.render(
        <div>
          {['a', 'b', 'c'].map((id) => (
            <Fragment key={id}>
              <span>{id}</span>
              <button>{id}-btn</button>
            </Fragment>
          ))}
        </div>,
      )

      assert.equal(
        container.innerHTML,
        '<div><span>a</span><button>a-btn</button><span>b</span><button>b-btn</button><span>c</span><button>c-btn</button></div>',
      )

      root.render(
        <div>
          {['c', 'b', 'a'].map((id) => (
            <Fragment key={id}>
              <span>{id}</span>
              <button>{id}-btn</button>
            </Fragment>
          ))}
        </div>,
      )

      assert.equal(
        container.innerHTML,
        '<div><span>c</span><button>c-btn</button><span>b</span><button>b-btn</button><span>a</span><button>a-btn</button></div>',
      )

      let spans = container.querySelectorAll('span')
      let buttons = container.querySelectorAll('button')
      assert.equal(spans.length, 3)
      assert.equal(buttons.length, 3)
    })

    it('handles keys in fragments without breaking updates', (t) => {
      function Item() {
        return ({ id, label }: { id: string; label: string }) => (
          <>
            <span key={id + '-label'} data-id={id}>
              {label}
            </span>
            <button key={id + '-button'} data-id={id + '-btn'}>
              click
            </button>
          </>
        )
      }

      let { container, root } = t.render(
        <div>
          <Item id="a" label="A" />
          <Item id="b" label="B" />
        </div>,
      )

      assert.equal(container.textContent, 'AclickBclick')

      root.render(
        <div>
          <Item id="b" label="B" />
          <Item id="a" label="A" />
        </div>,
      )

      assert.ok(
        container.textContent === 'BclickAclick' || container.textContent === 'AclickBclick',
      )

      let labels = Array.from(container.querySelectorAll('span'))
      let buttons = Array.from(container.querySelectorAll('button'))
      assert.equal(labels.length, 2)
      assert.equal(buttons.length, 2)
    })
  })
})
