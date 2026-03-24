import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { invariant } from '../lib/invariant.ts'
import { on } from '../index.ts'
import type { Handle, RemixNode } from '../lib/component.ts'

describe('vnode rendering', () => {
  describe('svg', () => {
    it('renders SVG root and children with SVG namespace and attributes', (t) => {
      let { container } = t.render(
        <svg viewBox="0 0 24 24" fill="none">
          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>,
      )

      let svg = container.querySelector('svg')
      let path = container.querySelector('path')
      invariant(svg instanceof SVGSVGElement)
      invariant(path instanceof SVGPathElement)

      assert.equal(svg.namespaceURI, 'http://www.w3.org/2000/svg')
      assert.equal(path.namespaceURI, 'http://www.w3.org/2000/svg')

      // Attribute casing: preserve exceptions and kebab-case general SVG attrs
      assert.equal(svg.getAttribute('viewBox'), '0 0 24 24')
      assert.equal(path.getAttribute('stroke-linecap'), 'round')
      assert.equal(path.getAttribute('stroke-linejoin'), 'round')
    })

    it('supports xlinkHref -> xlink:href on SVG elements', (t) => {
      let { container } = t.render(
        <svg>
          <use xlinkHref="#my-id" />
        </svg>,
      )

      let useEl = container.querySelector('use')
      invariant(useEl instanceof SVGUseElement)

      assert.equal(useEl.getAttribute('xlink:href'), '#my-id')
    })

    it('updates and removes namespaced SVG attributes', (t) => {
      let { container, root } = t.render(
        <svg>
          <use id="u" xlinkHref="#one" />
          <text id="t" xmlLang="en">
            Hi
          </text>
        </svg>,
      )

      let useEl = container.querySelector('#u')
      invariant(useEl instanceof SVGUseElement)
      assert.equal(useEl.getAttributeNS('http://www.w3.org/1999/xlink', 'href'), '#one')

      let textEl = container.querySelector('#t')
      invariant(textEl instanceof SVGTextElement)
      assert.equal(textEl.getAttributeNS('http://www.w3.org/XML/1998/namespace', 'lang'), 'en')

      root.render(
        <svg>
          <use id="u" xlinkHref="#two" />
          <text id="t" xmlLang="fr">
            Hi
          </text>
        </svg>,
      )

      let updatedUseEl = container.querySelector('#u')
      invariant(updatedUseEl instanceof SVGUseElement)
      assert.equal(updatedUseEl.getAttributeNS('http://www.w3.org/1999/xlink', 'href'), '#two')

      let updatedTextEl = container.querySelector('#t')
      invariant(updatedTextEl instanceof SVGTextElement)
      assert.equal(updatedTextEl.getAttributeNS('http://www.w3.org/XML/1998/namespace', 'lang'), 'fr')

      root.render(
        <svg>
          <use id="u" />
          <text id="t">Hi</text>
        </svg>,
      )

      let removedUseEl = container.querySelector('#u')
      invariant(removedUseEl instanceof SVGUseElement)
      assert.equal(removedUseEl.getAttributeNS('http://www.w3.org/1999/xlink', 'href'), null)
      assert.equal(removedUseEl.getAttribute('xlink:href'), null)

      let removedTextEl = container.querySelector('#t')
      invariant(removedTextEl instanceof SVGTextElement)
      assert.equal(removedTextEl.getAttributeNS('http://www.w3.org/XML/1998/namespace', 'lang'), null)
      assert.equal(removedTextEl.getAttribute('xml:lang'), null)
    })

    it('renders HTML subtree inside foreignObject with HTML namespace', (t) => {
      let { container } = t.render(
        <svg>
          <foreignObject>
            <div id="x">Hello</div>
          </foreignObject>
        </svg>,
      )

      let div = container.querySelector('#x')
      invariant(div)
      assert.ok(div instanceof HTMLDivElement)
      assert.equal(div.namespaceURI, 'http://www.w3.org/1999/xhtml')
    })

    it('updates and removes SVG attributes', (t) => {
      let { container, root } = t.render(
        <svg>
          <path id="p" strokeLinecap="round" />
        </svg>,
      )
      let path = container.querySelector('#p')
      invariant(path instanceof SVGPathElement)

      // Update value
      root.render(
        <svg>
          <path id="p" strokeLinecap="square" />
        </svg>,
      )
      let updated = container.querySelector('#p')
      invariant(updated instanceof SVGPathElement)
      assert.equal(updated, path)
      assert.equal(updated.getAttribute('stroke-linecap'), 'square')

      // Remove attribute
      root.render(
        <svg>
          <path id="p" />
        </svg>,
      )
      let removed = container.querySelector('#p')
      invariant(removed instanceof SVGPathElement)
      assert.equal(removed.hasAttribute('stroke-linecap'), false)
    })

    it('uses canonical semantics for critical SVG attributes', (t) => {
      let { container } = t.render(
        <svg>
          <defs>
            <filter id="f" filterUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
              <feGaussianBlur id="blur" stdDeviation="2.5" />
            </filter>
            <linearGradient id="g" gradientUnits="userSpaceOnUse" />
            <mask id="m" maskUnits="userSpaceOnUse" />
            <clipPath id="c" clipPathUnits="objectBoundingBox" />
          </defs>
        </svg>,
      )

      let filter = container.querySelector('#f')
      invariant(filter instanceof SVGFilterElement)
      assert.equal(filter.getAttribute('filterUnits'), 'userSpaceOnUse')
      assert.equal(filter.getAttribute('filter-units'), null)
      assert.equal(filter.filterUnits.baseVal, 1)

      let blur = container.querySelector('#blur')
      invariant(blur instanceof SVGFEGaussianBlurElement)
      assert.equal(blur.getAttribute('stdDeviation'), '2.5')
      assert.equal(blur.getAttribute('std-deviation'), null)

      let gradient = container.querySelector('#g')
      invariant(gradient instanceof SVGLinearGradientElement)
      assert.equal(gradient.getAttribute('gradientUnits'), 'userSpaceOnUse')
      assert.equal(gradient.getAttribute('gradient-units'), null)
      assert.equal(gradient.gradientUnits.baseVal, 1)

      let mask = container.querySelector('#m')
      invariant(mask instanceof SVGMaskElement)
      assert.equal(mask.getAttribute('maskUnits'), 'userSpaceOnUse')
      assert.equal(mask.getAttribute('mask-units'), null)
      assert.equal(mask.maskUnits.baseVal, 1)

      let clipPath = container.querySelector('#c')
      invariant(clipPath instanceof SVGClipPathElement)
      assert.equal(clipPath.getAttribute('clipPathUnits'), 'objectBoundingBox')
      assert.equal(clipPath.getAttribute('clip-path-units'), null)
      assert.equal(clipPath.clipPathUnits.baseVal, 2)
    })

    it('attaches events on SVG elements', (t) => {
      let clicked = false
      let { container } = t.render(
        <svg>
          <circle
            id="c"
            mix={[
              on('click', () => {
                clicked = true
              }),
            ]}
          />
        </svg>,
      )

      let circle = container.querySelector('#c')
      invariant(circle instanceof SVGCircleElement)
      circle.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      assert.ok(clicked)
    })

    it('propagates SVG namespace through components', (t) => {
      function SvgGroup() {
        return ({ href, children }: { href: string; children?: RemixNode }) => (
          <g href={href}>{children}</g>
        )
      }

      let { container } = t.render(
        <svg width="100" height="100">
          <SvgGroup href="/test">
            <path id="p" />
          </SvgGroup>
        </svg>,
      )

      let svg = container.querySelector('svg')
      let group = container.querySelector('g')
      let path = container.querySelector('path')

      invariant(svg instanceof SVGSVGElement)
      invariant(group instanceof SVGGElement)
      invariant(path instanceof SVGPathElement)

      // All elements should have SVG namespace
      assert.equal(svg.namespaceURI, 'http://www.w3.org/2000/svg')
      assert.equal(group.namespaceURI, 'http://www.w3.org/2000/svg')
      assert.equal(path.namespaceURI, 'http://www.w3.org/2000/svg')
    })
  })
})
