import { expect, test } from '@playwright/test'
import { openSample } from './helpers'

test('inference never blocks the main thread for more than 100 ms', async ({ page }) => {
  await openSample(page, 'ep=wasm')
  const result = await page.evaluate(async () => {
    const tasks: { start: number; duration: number; attribution: string }[] = []
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        const attr = ((e as unknown as { attribution?: { name: string; containerType?: string; containerSrc?: string }[] }).attribution ?? [])
          .map((a) => [a.name, a.containerType, a.containerSrc].filter(Boolean).join('/'))
          .join(',')
        tasks.push({ start: e.startTime, duration: e.duration, attribution: attr || 'none' })
      }
    }).observe({ type: 'longtask', buffered: true })
    window.__inpaint!.setMask([{ x: 400, y: 300, w: 120, h: 120 }])
    // the hook's own re-render and full-mask redraw run in later tasks: let them finish before t0 so they are not counted
    const frame = () => new Promise((res) => requestAnimationFrame(() => res(undefined)))
    await frame()
    await frame()
    const t0 = performance.now()
    const summary = await window.__inpaint!.run()
    const t1 = summary.receivedAt
    await new Promise((r) => setTimeout(r, 200))
    return { t0, t1, tasks }
  })
  const during = result.tasks.filter((t) => t.start >= result.t0 && t.start <= result.t1)
  const worst = Math.max(0, ...during.map((t) => t.duration))
  test.info().annotations.push({ type: 'worst-longtask-ms', description: String(Math.round(worst)) })
  const after = result.tasks.filter((t) => t.start > result.t1)
  test.info().annotations.push({ type: 'post-result-ui-longtask-ms', description: after.map((t) => String(Math.round(t.duration))).join(',') || 'none' })
  const detail = during.map((t) => `${Math.round(t.start - result.t0)}ms+${Math.round(t.duration)}ms`).join(' ')
  expect(worst, `long tasks (offset from run start, duration): ${detail}; run took ${Math.round(result.t1 - result.t0)}ms`).toBeLessThanOrEqual(100)
})
