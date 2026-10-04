import { expect, test } from '@playwright/test'
import { MIN_MEAN_DIFF_INSIDE, isLocalhost, openSample, runMask } from './helpers'

const RECT = { x: 400, y: 300, w: 120, h: 120 }

test('works offline after the first visit and makes no model requests', async ({ page, context }) => {
  await openSample(page, 'ep=wasm')
  const first = await runMask(page, RECT)
  expect(first.changedOutside).toBe(0)

  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await expect(page.getByTestId('mask-canvas')).toBeVisible({ timeout: 30_000 })
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })

  const urls: string[] = []
  const failed: string[] = []
  context.on('request', (r) => urls.push(r.url()))
  context.on('requestfailed', (r) => failed.push(r.url()))
  await context.setOffline(true)

  await page.reload()
  await expect(page.getByTestId('mask-canvas')).toBeVisible({ timeout: 30_000 })
  if (isLocalhost()) expect(await page.evaluate(() => crossOriginIsolated)).toBe(true)

  const second = await runMask(page, RECT)
  expect(second.changedOutside).toBe(0)
  expect(second.changedInside).toBeGreaterThan(0)
  expect(second.meanDiffInside).toBeGreaterThan(MIN_MEAN_DIFF_INSIDE)
  expect(urls.filter((u) => /migan\.onnx|huggingface\.co/.test(u))).toEqual([])
  expect(failed).toEqual([])
  await context.setOffline(false)
})
