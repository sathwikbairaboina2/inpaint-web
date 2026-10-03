import { expect, test } from '@playwright/test'
import { openSample } from './helpers'

test('inference never blocks the main thread for more than 100 ms', async ({ page }) => {
  await openSample(page, 'ep=wasm')
  const result = await page.evaluate(async () => {
    const tasks: { start: number; duration: number }[] = []
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) tasks.push({ start: e.startTime, duration: e.duration })
    }).observe({ type: 'longtask', buffered: true })
    window.__inpaint!.setMask([{ x: 400, y: 300, w: 120, h: 120 }])
    const t0 = performance.now()
    await window.__inpaint!.run()
    const t1 = performance.now()
    await new Promise((r) => setTimeout(r, 200))
    return { t0, t1, tasks }
  })
  const during = result.tasks.filter((t) => t.start >= result.t0 && t.start <= result.t1)
  const worst = Math.max(0, ...during.map((t) => t.duration))
  test.info().annotations.push({ type: 'worst-longtask-ms', description: String(Math.round(worst)) })
  expect(worst).toBeLessThanOrEqual(100)
})
