import { expect, test } from '@playwright/test'
import { MIN_MEAN_DIFF_INSIDE, hasWebGpu, openSample, runMask } from './helpers'

const RECT = { x: 400, y: 300, w: 120, h: 120 }

test('?ep=wasm forces WASM and the badge says why', async ({ page }) => {
  await openSample(page, 'ep=wasm')
  const r = await runMask(page, RECT)
  expect(r.ep).toBe('wasm')
  expect(r.fallbackReason).toBe('forced')
  const badge = page.getByTestId('device-badge')
  await expect(badge).toContainText('WASM')
  await expect(badge).toContainText('forced')
})

test('without WebGPU the job still completes on WASM with a real reason', async ({ page }) => {
  await openSample(page, '')
  test.skip(await hasWebGpu(page), 'host has WebGPU (tests/ep.test.ts covers every fallback reason)')
  const r = await runMask(page, RECT)
  expect(r.ep).toBe('wasm')
  expect(r.meanDiffInside).toBeGreaterThan(MIN_MEAN_DIFF_INSIDE)
  expect(['no-webgpu-api', 'no-adapter']).toContain(r.fallbackReason)
  await expect(page.getByTestId('device-badge')).toContainText(r.fallbackReason!)
})
