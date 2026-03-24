import * as assert from '@remix-run/assert'
import { describe, it, beforeEach, afterEach } from '@remix-run/test'
import { createDocumentState } from '../lib/document-state.ts'

describe('document-state', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    document.body.removeChild(container)
  })

  describe('capture and restore after DOM moves', () => {
    it('restores focus and selection after moving a text input', () => {
      let input = document.createElement('input')
      input.type = 'text'
      input.value = 'Hello World'
      container.appendChild(input)
      input.focus()
      input.setSelectionRange(6, 11)

      let state = createDocumentState()
      state.capture()

      // Move the node (simulating what happens during DOM updates)
      // This causes focus/selection to be lost
      container.removeChild(input)
      container.appendChild(input)
      assert.equal(document.activeElement, document.body)

      state.restore()

      assert.equal(document.activeElement, input)
      assert.equal(input.selectionStart, 6)
      assert.equal(input.selectionEnd, 11)
    })

    it('restores focus and selection after reordering nodes', () => {
      let input1 = document.createElement('input')
      input1.type = 'text'
      input1.value = 'First'
      container.appendChild(input1)

      let input2 = document.createElement('input')
      input2.type = 'text'
      input2.value = 'Second'
      container.appendChild(input2)

      let input3 = document.createElement('input')
      input3.type = 'text'
      input3.value = 'Third'
      container.appendChild(input3)

      // Focus the middle input with selection
      input2.focus()
      input2.setSelectionRange(0, 6)

      let state = createDocumentState()
      state.capture()

      // Reorder: move input2 to the end (simulating keyed list reordering)
      container.removeChild(input2)
      container.appendChild(input2)

      state.restore()

      assert.equal(document.activeElement, input2)
      assert.equal(input2.selectionStart, 0)
      assert.equal(input2.selectionEnd, 6)
    })

    it('restores focus and selection after moving textarea', () => {
      let textarea = document.createElement('textarea')
      textarea.value = 'Hello\nWorld\nTest'
      container.appendChild(textarea)
      textarea.focus()
      textarea.setSelectionRange(6, 11)

      let state = createDocumentState()
      state.capture()

      // Move the textarea
      container.removeChild(textarea)
      container.appendChild(textarea)

      state.restore()

      assert.equal(document.activeElement, textarea)
      assert.equal(textarea.selectionStart, 6)
      assert.equal(textarea.selectionEnd, 11)
    })

    it('restores focus and selection for different input types after move', () => {
      let types = ['text', 'search', 'tel', 'url', 'password'] as const
      for (let type of types) {
        let input = document.createElement('input')
        input.type = type
        input.value = 'test value'
        container.appendChild(input)
        input.focus()
        input.setSelectionRange(0, 4)

        let state = createDocumentState()
        state.capture()

        // Move the input
        container.removeChild(input)
        container.appendChild(input)

        state.restore()

        assert.equal(document.activeElement, input)
        assert.equal(input.selectionStart, 0)
        assert.equal(input.selectionEnd, 4)

        container.removeChild(input)
      }
    })

    it('restores focus without selection when element had no selection', () => {
      let input = document.createElement('input')
      input.type = 'text'
      input.value = 'Hello World'
      container.appendChild(input)
      input.focus()
      // No selection set

      let state = createDocumentState()
      state.capture()

      // Move the input
      container.removeChild(input)
      container.appendChild(input)

      state.restore()

      assert.equal(document.activeElement, input)
    })

    it('restores focus after moving element (scroll preservation is handled internally)', () => {
      let scrollable = document.createElement('div')
      scrollable.style.width = '100px'
      scrollable.style.height = '100px'
      scrollable.style.overflow = 'auto'
      let inner = document.createElement('div')
      inner.style.width = '200px'
      inner.style.height = '200px'
      scrollable.appendChild(inner)
      container.appendChild(scrollable)

      let input = document.createElement('input')
      input.type = 'text'
      scrollable.appendChild(input)
      input.focus()

      let state = createDocumentState()
      state.capture()

      // Move the input (which would normally lose focus)
      scrollable.removeChild(input)
      scrollable.appendChild(input)

      state.restore()

      // Focus should be restored to the moved element
      assert.equal(document.activeElement, input)
    })

    it('restores focus for non-selectable element after move', () => {
      let div = document.createElement('div')
      div.tabIndex = -1
      container.appendChild(div)
      div.focus()

      let state = createDocumentState()
      state.capture()

      // Move the div
      container.removeChild(div)
      container.appendChild(div)

      state.restore()

      assert.equal(document.activeElement, div)
    })

    it('restores focus for contentEditable element after move', () => {
      let div = document.createElement('div')
      div.contentEditable = 'true'
      div.textContent = 'Hello World'
      container.appendChild(div)
      div.focus()

      let state = createDocumentState()
      state.capture()

      // Move the div
      container.removeChild(div)
      container.appendChild(div)

      state.restore()

      assert.equal(document.activeElement, div)
    })

    it('does not restore if element is removed from document', () => {
      let input = document.createElement('input')
      input.type = 'text'
      input.value = 'Hello World'
      container.appendChild(input)
      input.focus()
      input.setSelectionRange(0, 5)

      let state = createDocumentState()
      state.capture()

      // Remove element from document (not just moved)
      container.removeChild(input)

      // Should not throw
      state.restore()

      // Element should not be focused since it's not in document
      assert.notEqual(document.activeElement, input)
    })

    it('handles selection end beyond value length after move', () => {
      let input = document.createElement('input')
      input.type = 'text'
      input.value = 'Hello'
      container.appendChild(input)
      input.focus()
      input.setSelectionRange(0, 10) // Beyond length

      let state = createDocumentState()
      state.capture()

      // Move the input
      container.removeChild(input)
      container.appendChild(input)

      state.restore()

      assert.equal(document.activeElement, input)
      // Should clamp to value length
      assert.ok(input.selectionEnd! <= input.value.length)
    })

    it('restores focus when element is moved to different parent', () => {
      let parent1 = document.createElement('div')
      let parent2 = document.createElement('div')
      container.appendChild(parent1)
      container.appendChild(parent2)

      let input = document.createElement('input')
      input.type = 'text'
      input.value = 'Hello World'
      parent1.appendChild(input)
      input.focus()
      input.setSelectionRange(0, 5)

      let state = createDocumentState()
      state.capture()

      // Move to different parent
      parent1.removeChild(input)
      parent2.appendChild(input)

      state.restore()

      assert.equal(document.activeElement, input)
      assert.equal(input.selectionStart, 0)
      assert.equal(input.selectionEnd, 5)
    })
  })
})
