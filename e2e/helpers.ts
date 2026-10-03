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
  timings: Record<string, number>
}

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
    for (let y = 0; y < a.height; y++) {
      for (let x = 0; x < a.width; x++) {
        const inMask = x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h
        for (let k = 0; k < 4; k++) {
          if (a.data[(y * a.width + x) * 4 + k] !== c.data[(y * a.width + x) * 4 + k]) inMask ? changedInside++ : changedOutside++
        }
      }
    }
    return { ep: summary.ep, fallbackReason: summary.fallbackReason, timings: summary.timings as unknown as Record<string, number>, changedOutside, changedInside }
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
