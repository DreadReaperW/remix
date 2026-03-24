import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { processStyleClass } from '../lib/style/lib/style.ts'

describe('processStyleClass', () => {
  it('returns class selectors and css text', () => {
    let cache = new Map<string, { selector: string; css: string }>()
    let result = processStyleClass({ color: 'red', fontSize: '16px' }, cache)

    assert.match(result.selector, /^rmxc-/)
    assert.ok(result.css.includes(`.${result.selector}`))
    assert.ok(result.css.includes('color: red'))
    assert.ok(result.css.includes('font-size: 16px'))
  })

  it('deduplicates identical style objects', () => {
    let cache = new Map<string, { selector: string; css: string }>()
    let first = processStyleClass({ color: 'red', '&:hover': { color: 'blue' } }, cache)
    let second = processStyleClass({ color: 'red', '&:hover': { color: 'blue' } }, cache)

    assert.equal(first.selector, second.selector)
    assert.equal(first.css, second.css)
  })

  it('returns empty selector/css for empty objects', () => {
    let cache = new Map<string, { selector: string; css: string }>()
    let result = processStyleClass({}, cache)
    assert.equal(result.selector, '')
    assert.equal(result.css, '')
  })

  it('keeps nested selectors and media queries', () => {
    let cache = new Map<string, { selector: string; css: string }>()
    let result = processStyleClass(
      {
        color: 'black',
        ':hover': { color: 'red' },
        '@media (min-width: 768px)': {
          fontSize: '16px',
        },
      },
      cache,
    )

    assert.ok(result.css.includes(':hover'))
    assert.ok(result.css.includes('@media (min-width: 768px)'))
    assert.ok(result.css.includes('font-size: 16px'))
  })
})
