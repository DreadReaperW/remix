import * as assert from '@remix-run/assert'
import { afterEach, describe, it } from '@remix-run/test'
import { render as _render } from '@remix-run/test/browser'
import { invariant } from '../invariant.ts'
import { css } from './css-mixin.tsx'

describe('css mixin', () => {
  let cleanup: (() => void) | undefined

  function render(node: Parameters<typeof _render>[0]) {
    let result = _render(node)
    cleanup = result.cleanup
    return result
  }

  afterEach(() => {
    if (cleanup) {
      cleanup()
      cleanup = undefined
    }
  })

  it('concatenates generated classes with existing className', (t) => {
    let { $ } = t.render(
      <div
        className="base"
        mix={[
          css({ color: 'red' }),
          css({
            backgroundColor: 'blue',
          }),
        ]}
      />,
    )

    let div = $('div')
    invariant(div)
    let classNames = div.className.split(/\s+/).filter(Boolean)
    let generated = classNames.filter((name) => name.startsWith('rmxc-'))
    assert.ok(classNames.includes('base'))
    assert.equal(generated.length, 2)
    assert.equal(new Set(generated).size, 2)
  })

  it('coexists with existing class/className props', () => {
    let { $ } = render(
      <div
        class="from-class"
        className="from-classname"
        mix={[
          css({
            borderColor: 'black',
            borderStyle: 'solid',
            borderWidth: 1,
          }),
        ]}
      />,
    )

    let div = $('div')
    invariant(div)
    let classNames = div.className.split(/\s+/).filter(Boolean)
    assert.ok(classNames.includes('from-class'))
    assert.ok(classNames.includes('from-classname'))
    assert.ok(classNames.some((name) => name.startsWith('rmxc-')))
  })

  it('supports keyframes and nested media rules', () => {
    let { $ } = render(
      <div
        mix={[
          css({
            animationName: 'fade-in',
            animationDuration: '1s',
            '@keyframes fade-in': {
              from: {
                opacity: 0,
                transform: 'translateY(8px)',
                '&:hover': { color: 'red' } as any,
              },
              to: {
                opacity: 1,
              },
              skipped: null as any,
            },
            '@media (min-width: 1px)': {
              color: 'rgb(1, 2, 3)',
              '&:hover': {
                color: 'rgb(4, 5, 6)',
              },
            },
          }),
        ]}
      >
        Animated
      </div>,
    )

    let div = $('div')
    invariant(div)
    assert.match(div.className, /rmxc-/)
    let cssTexts = readAdoptedCssTexts()
    assert.ok(cssTexts.some((text) => text.includes('@keyframes fade-in')))
    assert.ok(cssTexts.some((text) => text.includes('@media (min-width: 1px)')))
  })

  it('skips undefined conditional selectors and at-rules', () => {
    let { $ } = render(
      <div
        mix={[
          css({
            color: 'rgb(10, 20, 30)',
            '@supports (display: grid)': undefined,
            '&[data-active="true"]': undefined,
            '&:focus': {
              outlineWidth: 2,
              outlineStyle: 'solid',
            },
          }),
        ]}
      >
        Conditional rules
      </div>,
    )

    let div = $('div')
    invariant(div)
    assert.match(div.className, /rmxc-/)
  })

  it('handles empty keyframe steps and at-rule bodies', () => {
    let { $ } = render(
      <div
        mix={[
          css({
            animationName: 'empty-frames',
            animationDuration: '1s',
            '@keyframes empty-frames': {
              from: {
                '&:hover': { color: 'red' } as any,
              },
              to: {},
            },
            '@media (min-width: 1px)': {},
          }),
        ]}
      >
        Empty blocks
      </div>,
    )

    let div = $('div')
    invariant(div)
    assert.match(div.className, /rmxc-/)

    let cssTexts = readAdoptedCssTexts()
    assert.ok(cssTexts.some((text) => text.includes('@keyframes empty-frames')))
  })
})

function readAdoptedCssTexts(): string[] {
  let texts: string[] = []
  for (let sheet of document.adoptedStyleSheets) {
    let rules = Array.from(sheet.cssRules).map((rule) => rule.cssText)
    texts.push(rules.join('\n'))
  }
  return texts
}
