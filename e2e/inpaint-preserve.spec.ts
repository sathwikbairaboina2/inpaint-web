import { expect, test } from '@playwright/test'
import { MIN_MEAN_DIFF_INSIDE, isLocalhost, openSample, runMask } from './helpers'

const RECT = { x: 400, y: 300, w: 120, h: 120 }

test('wasm: pixels outside the mask are byte-identical, pixels inside change', async ({ page }) => {
  await openSample(page, 'ep=wasm')
  if (isLocalhost()) expect(await page.evaluate(() => crossOriginIsolated)).toBe(true)
  const r = await runMask(page, RECT)
  expect(r.ep).toBe('wasm')
  expect(r.changedOutside).toBe(0)
  expect(r.changedInside).toBeGreaterThan(0)
  expect(r.meanDiffInside).toBeGreaterThan(MIN_MEAN_DIFF_INSIDE)
})

test('default provider: same invariant on whichever EP was chosen', async ({ page }) => {
  await openSample(page, '')
  const r = await runMask(page, RECT)
  test.info().annotations.push({ type: 'ep', description: `${r.ep} ${r.fallbackReason ?? ''}`.trim() })
  expect(r.changedOutside).toBe(0)
  expect(r.changedInside).toBeGreaterThan(0)
  expect(r.meanDiffInside).toBeGreaterThan(MIN_MEAN_DIFF_INSIDE)
})
