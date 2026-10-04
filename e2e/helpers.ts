import { existsSync } from 'node:fs'
import { expect, type Page } from '@playwright/test'

if (!process.env.BASE_URL && !existsSync('public/models/migan.onnx')) {
  throw new Error('public/models/migan.onnx is missing: run `pnpm models:fetch` first')
}

export type Rect = { x: number; y: number; w: number; h: number }
export type RunReport = {
  ep: string
  fallbackReason?: string
  changedOutside: number
  changedInside: number
  meanDiffInside: number
  timings: Record<string, number>
}

// the hole must really be re-synthesised, not just resampled: with an inverted mask convention the bilinear round trip alone
// would still change pixels, so assert a mean RGB difference well above that
export const MIN_MEAN_DIFF_INSIDE = 8

export const isLocalhost = () => new URL(process.env.BASE_URL ?? 'http://localhost:5421').hostname === 'localhost'

export async function openSample(page: Page, query = 'ep=wasm'): Promise<void> {
  await page.goto(`/?sample=1${query ? `&${query}` : ''}`)
  await expect(page.getByTestId('mask-canvas')).toBeVisible({ timeout: 30_000 })
}

export async function runMask(page: Page, rect: Rect): Promise<RunReport> {
  return page.evaluate(async (r) => {
    const hook = window.__inpaint!
    hook.setMask([r])
    const summary = await hook.run()
    const a = hook.getOriginal()
    const c = hook.getResult()!
    let changedOutside = 0
    let changedInside = 0
    let sumInside = 0
    for (let y = 0; y < a.height; y++) {
      for (let x = 0; x < a.width; x++) {
        const inMask = x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h
        for (let k = 0; k < 4; k++) {
          const d = Math.abs(a.data[(y * a.width + x) * 4 + k] - c.data[(y * a.width + x) * 4 + k])
          if (d !== 0) inMask ? changedInside++ : changedOutside++
          if (inMask && k < 3) sumInside += d
        }
      }
    }
    return { ep: summary.ep, fallbackReason: summary.fallbackReason, timings: summary.timings as unknown as Record<string, number>, changedOutside, changedInside, meanDiffInside: sumInside / (r.w * r.h * 3) }
  }, rect)
}

export async function hasWebGpu(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    try {
      return !!(await navigator.gpu?.requestAdapter())
    } catch {
      return false
    }
  })
}
