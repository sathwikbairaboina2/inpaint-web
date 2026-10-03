import { expect, test, type Page } from '@playwright/test'
import { openSample } from './helpers'

async function scribble(page: Page) {
  const box = (await page.getByTestId('mask-canvas').boundingBox())!
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.4)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5, { steps: 8 })
  await page.mouse.up()
}

test('drawing enables remove, undo disables it, clear works', async ({ page }) => {
  await openSample(page, 'ep=wasm')
  const remove = page.getByTestId('remove-button')
  await expect(remove).toBeDisabled()
  await scribble(page)
  await expect(remove).toBeEnabled()
  await page.getByTestId('undo').click()
  await expect(remove).toBeDisabled()
  await scribble(page)
  await expect(remove).toBeEnabled()
  await page.getByTestId('clear-mask').click()
  await expect(remove).toBeDisabled()
})

test('download saves inpaint-*.png after a run', async ({ page }) => {
  await openSample(page, 'ep=wasm')
  await scribble(page)
  await page.getByTestId('remove-button').click()
  await expect(page.getByTestId('compare-slider')).toBeVisible({ timeout: 100_000 })
  const download = page.waitForEvent('download')
  await page.getByTestId('download').click()
  expect((await download).suggestedFilename()).toMatch(/^inpaint-.*\.png$/)
})

test('compare slider moves with arrow keys', async ({ page }) => {
  await openSample(page, 'ep=wasm')
  await scribble(page)
  await page.getByTestId('remove-button').click()
  const slider = page.getByTestId('compare-slider')
  await expect(slider).toBeVisible({ timeout: 100_000 })
  await slider.focus()
  await expect(slider).toHaveAttribute('aria-valuenow', '50')
  await page.keyboard.press('ArrowRight')
  await expect(slider).toHaveAttribute('aria-valuenow', '55')
})

test('no horizontal scroll at 375px width', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await openSample(page, 'ep=wasm')
  const w = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: window.innerWidth }))
  expect(w.sw).toBeLessThanOrEqual(w.cw)
})

test('oversized image offers a downscale', async ({ page }) => {
  await page.goto('/')
  const png = await page.evaluate(async () => {
    const c = new OffscreenCanvas(5000, 100)
    c.getContext('2d')
    const b = await c.convertToBlob({ type: 'image/png' })
    return Array.from(new Uint8Array(await b.arrayBuffer()))
  })
  await page.getByTestId('file-input').setInputFiles({ name: 'wide.png', mimeType: 'image/png', buffer: Buffer.from(png) })
  await expect(page.getByTestId('error')).toContainText('TOO_LARGE')
  await page.getByRole('button', { name: /Downscale to 4096x82/ }).click()
  await expect(page.getByTestId('mask-canvas')).toBeVisible()
})
