import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import type { Handle } from '../lib/component.ts'
import { clientEntry, isEntry } from '../lib/client-entries.ts'

describe('clientEntry', () => {
  describe('types', () => {
    it('keeps original types', () => {
      function Input(handle: Handle, props: { defaultValue?: string }) {
        let value = props.defaultValue ?? ''
        return ({ label }: { label: string }) => (
          <label>
            {label}: <input type="text" value={value} />
          </label>
        )
      }

      let HydratedInput = clientEntry('/js/test.js#Input', Input)

      // @ts-expect-error - should require default render prop
      let el = <Input />
      // @ts-expect-error - should require default render prop
      let el2 = <HydratedInput />

      assert.ok(true)
    })

    it('only allows serializable props', () => {
      function Input(handle: Handle, props: { defaultValue?: string; func: () => void }) {
        let value = props.defaultValue ?? ''
        return ({ label }: { label: string }) => (
          <label>
            {label}: <input type="text" value={value} />
          </label>
        )
      }

      // @ts-expect-error - should disallow non-serializable function prop
      let HydratedInput = clientEntry('/js/test.js#Input', Input)

      function Input2(handle: Handle, props: { defaultValue?: string }) {
        let value = props.defaultValue ?? ''
        return ({ label }: { label: string; func: () => void }) => (
          <label>
            {label}: <input type="text" value={value} />
          </label>
        )
      }

      // @ts-expect-error - should disallow non-serializable function prop
      let HydratedInput2 = clientEntry('/js/test.js#Input', Input2)

      assert.ok(true)
    })
  })

  describe('basic functionality', () => {
    it('marks a component as an entry', () => {
      function TestComponent(handle: Handle, props: { count: number }) {
        return () => <div>Count: {props.count}</div>
      }

      let EntryComponent = clientEntry('/js/test.js#TestComponent', TestComponent)

      assert.ok(EntryComponent.$entry)
      assert.equal(EntryComponent.$moduleUrl, '/js/test.js')
      assert.equal(EntryComponent.$exportName, 'TestComponent')
    })

    it('parses module URL and export name from href', () => {
      function MyComponent() {
        return () => <div>Hello</div>
      }

      let EntryComponent = clientEntry('/js/components.js#MyComponent', MyComponent)

      assert.equal(EntryComponent.$moduleUrl, '/js/components.js')
      assert.equal(EntryComponent.$exportName, 'MyComponent')
    })

    it('uses component name as fallback when no export name provided', () => {
      function NamedComponent() {
        return () => <div>Hello</div>
      }

      let EntryComponent = clientEntry('/js/components.js', NamedComponent)

      assert.equal(EntryComponent.$moduleUrl, '/js/components.js')
      assert.equal(EntryComponent.$exportName, 'NamedComponent')
    })

    it('preserves the original component functionality', () => {
      function TestComponent(handle: Handle, props: { initialCount: number }) {
        let count = props.initialCount

        return (props: { label: string }) => (
          <button>
            {props.label}: {count}
          </button>
        )
      }

      let EntryComponent = clientEntry('/js/test.js#TestComponent', TestComponent)

      // The entry component should still be callable
      assert.equal(typeof EntryComponent, 'function')

      // Mock Handle for testing
      let mockHandle = {} as Handle

      // Should work the same as the original component
      let renderFn = EntryComponent(mockHandle, { initialCount: 5 })
      assert.equal(typeof renderFn, 'function')

      if (typeof renderFn === 'function') {
        let element = renderFn({ label: 'Count' })
        assert.deepEqual(element, {
          $rmx: true,
          type: 'button',
          props: {
            children: ['Count', ': ', 5],
          },
          key: undefined,
        })
      }
    })
  })

  describe('error handling', () => {
    it('throws error when no module URL provided', () => {
      function TestComponent() {
        return () => <div>Test</div>
      }

      assert.throws(() => { clientEntry('', TestComponent) }, { message: 'clientEntry() requires a module URL' })
    })

    it('throws error when no export name and component is anonymous', () => {
      let anonymousComponent = function () {
        return () => <div>Test</div>
      }

      // Force the function name to be empty to simulate truly anonymous function
      Object.defineProperty(anonymousComponent, 'name', { value: '' })

      assert.throws(() => { clientEntry('/js/test.js', anonymousComponent) }, { message: 'clientEntry() requires either an export name in the href' })
    })

    it('throws error when no export name and component name is empty', () => {
      function TestComponent() {
        return () => <div>Test</div>
      }

      // Simulate unnamed function
      Object.defineProperty(TestComponent, 'name', { value: '' })

      assert.throws(() => { clientEntry('/js/test.js', TestComponent) }, { message: 'clientEntry() requires either an export name in the href' })
    })
  })

  describe('type constraints', () => {
    it('accepts components with serializable props', () => {
      // This should compile without errors
      function ValidComponent(
        handle: Handle,
        props: {
          str: string
          num: number
          bool: boolean
          obj: { nested: string }
          arr: number[]
          element: JSX.Element
        },
      ) {
        return () => <div>Valid</div>
      }

      let EntryComponent = clientEntry('/js/valid.js#ValidComponent', ValidComponent)
      assert.ok(EntryComponent.$entry)
    })

    // Type-level rejection: non-serializable props should be disallowed
    it('rejects components with non-serializable props', () => {
      function InvalidComponent(handle: Handle, props: { func: () => void }) {
        return () => <div>Invalid</div>
      }

      // @ts-expect-error - non-serializable function prop should be rejected
      let HydratedInvalid = clientEntry('/js/invalid.js#InvalidComponent', InvalidComponent)
      assert.ok(true)
    })

    it('accepts primitive setup types', () => {
      // Setup can be a primitive like number, string, boolean
      function Counter(handle: Handle, setup: number) {
        let count = setup ?? 0
        return () => <div>Count: {count}</div>
      }

      let EntryCounter = clientEntry('/js/counter.js#Counter', Counter)
      assert.ok(EntryCounter.$entry)
    })

    it('accepts null and undefined setup types', () => {
      function NullSetup(handle: Handle, setup: null) {
        return () => <div>Null setup</div>
      }

      function UndefinedSetup(handle: Handle, setup: undefined) {
        return () => <div>Undefined setup</div>
      }

      let EntryNull = clientEntry('/js/null.js#NullSetup', NullSetup)
      let EntryUndefined = clientEntry('/js/undefined.js#UndefinedSetup', UndefinedSetup)

      assert.ok(EntryNull.$entry)
      assert.ok(EntryUndefined.$entry)
    })

    it('accepts array setup types', () => {
      function ArraySetup(handle: Handle, setup: string[]) {
        return () => <div>{setup.join(', ')}</div>
      }

      let EntryArray = clientEntry('/js/array.js#ArraySetup', ArraySetup)
      assert.ok(EntryArray.$entry)
    })
  })

  describe('isEntry type guard', () => {
    it('returns true for entry components', () => {
      function TestComponent() {
        return () => <div>Test</div>
      }

      let EntryComponent = clientEntry('/js/test.js#TestComponent', TestComponent)
      assert.ok(isEntry(EntryComponent))
    })

    it('returns false for regular components', () => {
      function RegularComponent() {
        return () => <div>Regular</div>
      }

      assert.equal(isEntry(RegularComponent), false)
    })

    it('returns false for non-function values', () => {
      assert.equal(isEntry(null), false)
      assert.equal(isEntry(undefined), false)
      assert.equal(isEntry('string'), false)
      assert.equal(isEntry(123), false)
      assert.equal(isEntry({}), false)
    })

    it('returns false for functions without entry metadata', () => {
      function normalFunction() {}
      assert.equal(isEntry(normalFunction), false)
    })
  })

  describe('complex components', () => {
    it('handles stateful components with setup and render phases', () => {
      function Counter(handle: Handle, setupProps: { initialCount: number }) {
        let count = setupProps.initialCount

        return (renderProps: { label: string }) => (
          <button type="button">
            {renderProps.label} {count}
          </button>
        )
      }

      let EntryCounter = clientEntry('/js/counter.js#Counter', Counter)

      assert.ok(EntryCounter.$entry)
      assert.equal(EntryCounter.$moduleUrl, '/js/counter.js')
      assert.equal(EntryCounter.$exportName, 'Counter')
    })

    it('handles simple components that return JSX directly', () => {
      function SimpleComponent(handle: Handle, props: { message: string }) {
        return () => <div>{props.message}</div>
      }

      let EntrySimple = clientEntry('/js/simple.js#SimpleComponent', SimpleComponent)

      assert.ok(EntrySimple.$entry)
      assert.equal(EntrySimple.$moduleUrl, '/js/simple.js')
      assert.equal(EntrySimple.$exportName, 'SimpleComponent')
    })
  })
})
