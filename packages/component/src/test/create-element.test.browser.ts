import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { createElement } from '../lib/create-element.ts'

describe('createElement', () => {
  it('creates an element', () => {
    let element = createElement('div', {}, 'Hello, world!')
    assert.equal(element.type, 'div')
    assert.deepEqual(element.props.children, ['Hello, world!'])
  })
})
