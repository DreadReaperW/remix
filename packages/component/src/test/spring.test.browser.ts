import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { spring } from '../lib/spring.ts'

describe('spring', () => {
  describe('interface', () => {
    it('returns an iterator', () => {
      let s = spring()
      assert.equal(typeof s.next, 'function')
      let result = s.next()
      assert.ok('value' in result)
      assert.ok('done' in result)
    })
    it('has duration property', () => {
      let s = spring()
      assert.equal(typeof s.duration, 'number')
      assert.ok(s.duration > 0)
      assert.ok(s.duration < 20000)
    })
    it('has easing property', () => {
      let s = spring()
      assert.equal(typeof s.easing, 'string')
      assert.match(s.easing, /^linear\(/)
      assert.match(s.easing, /\)$/)
    })
    it('has toString that returns CSS value', () => {
      let s = spring()
      let str = s.toString()
      assert.match(str, /^\d+ms linear\(/)
      assert.match(str, /\)$/)
    })
    it('can be spread for WAAPI', () => {
      let s = spring()
      let spread = { ...s }
      assert.ok('duration' in spread)
      assert.ok('easing' in spread)
      assert.equal(typeof spread.duration, 'number')
      assert.equal(typeof spread.easing, 'string')
    })
    it('works in template literals', () => {
      let s = spring()
      let css = `transform ${s}`
      assert.match(css, /^transform \d+ms linear\(/)
    })
  })
  describe('presets', () => {
    it('accepts bouncy preset', () => {
      let s = spring('bouncy')
      assert.ok(s.duration > 0)
    })
    it('accepts snappy preset', () => {
      let s = spring('snappy')
      assert.ok(s.duration > 0)
    })
    it('accepts smooth preset', () => {
      let s = spring('smooth')
      assert.ok(s.duration > 0)
    })
    it('defaults to snappy when no args', () => {
      let defaultSpring = spring()
      let snappySpring = spring('snappy')
      assert.equal(defaultSpring.duration, snappySpring.duration)
    })
    it('allows duration override on presets', () => {
      let s = spring('bouncy', { duration: 1000 })
      assert.ok(s.duration > spring('bouncy').duration)
    })
    it('exposes preset defaults via spring.presets', () => {
      assert.ok('smooth' in spring.presets)
      assert.ok('snappy' in spring.presets)
      assert.ok('bouncy' in spring.presets)
      assert.deepEqual(spring.presets.bouncy, { duration: 400, bounce: 0.3 })
    })
  })
  describe('custom options', () => {
    it('accepts custom duration', () => {
      let short = spring({ duration: 100 })
      let long = spring({ duration: 500 })
      assert.ok(long.duration > short.duration)
    })
    it('accepts custom bounce', () => {
      let s = spring({ bounce: 0.5 })
      assert.ok(s.duration > 0)
    })
    it('accepts custom velocity', () => {
      let s = spring({ velocity: 5 })
      assert.ok(s.duration > 0)
    })
  })
  describe('physics invariants', () => {
    it('starts near 0', () => {
      let s = spring()
      let first = s.next().value
      assert.ok(Math.abs(first - 0) < 0.05)
    })
    it('ends at 1 when iteration completes', () => {
      let s = spring()
      let last = 0
      for (let value of s) { last = value }
      assert.equal(last, 1)
    })
    it('underdamped (bounce > 0) overshoots target', () => {
      let s = spring({ bounce: 0.5 })
      let maxValue = 0
      for (let value of s) { maxValue = Math.max(maxValue, value) }
      assert.ok(maxValue > 1)
    })
    it('critically damped (bounce = 0) never overshoots', () => {
      let s = spring({ bounce: 0 })
      for (let value of s) {
        assert.ok(value <= 1.001)
      }
    })
    it('overdamped (bounce < 0) never overshoots', () => {
      let s = spring({ bounce: -0.5 })
      for (let value of s) {
        assert.ok(value <= 1.001)
      }
    })
    it('higher bounce means longer settling time', () => {
      let low = spring({ duration: 300, bounce: 0.1 })
      let high = spring({ duration: 300, bounce: 0.7 })
      assert.ok(high.duration > low.duration)
    })
    it('positive velocity causes faster initial movement', () => {
      let noVelocity = spring({ duration: 300, bounce: 0 })
      let withVelocity = spring({ duration: 300, bounce: 0, velocity: 10 })
      noVelocity.next()
      withVelocity.next()
      let posNoVel = noVelocity.next().value
      let posWithVel = withVelocity.next().value
      assert.ok(posWithVel > posNoVel)
    })
  })
  describe('spring.transition helper', () => {
    it('formats single property', () => {
      let result = spring.transition('transform', 'bouncy')
      assert.match(result, /^transform \d+ms linear\(/)
    })
    it('formats multiple properties', () => {
      let result = spring.transition(['transform', 'opacity'], 'snappy')
      assert.match(result, /^transform \d+ms linear\(.+\), opacity \d+ms linear\(/)
    })
    it('accepts custom options', () => {
      let result = spring.transition('width', { duration: 500, bounce: 0.2 })
      assert.match(result, /^width \d+ms linear\(/)
    })
  })
})
