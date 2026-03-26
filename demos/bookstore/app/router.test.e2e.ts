import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import { router } from './router.ts'

describe('bookstore e2e', () => {
  it('adds to cart', async (t) => {
    let page = await t.serve(router.fetch)

    // Load the homepage
    await page.goto('/', { waitUntil: 'networkidle' })

    // Add an item to cart
    await page.locator('.book-card:nth-child(1) button:has-text("Add to Cart")').click()
    await page.waitForSelector('.book-card:nth-child(1) button:has-text("Remove from Cart")')

    // Navigate to cart and validate
    await page.locator('a[href="/cart"]').click()
    await page.waitForSelector('h1:has-text("Shopping Cart")')
    assert.equal(await page.locator('table a').innerText(), 'Ash & Smoke')
    assert.equal(await page.locator('input[name=quantity]').getAttribute('defaultValue'), '1')
  })
})
