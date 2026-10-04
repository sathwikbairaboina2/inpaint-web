import { execFileSync, spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium, type Page } from '@playwright/test'

const URL_ = 'http://localhost:5421'
// the gold foil on the right edge of the sample photo (960x966), chosen by looking at the image
const OBJECT = { x: 868, y: 636, w: 92, h: 300 }

async function waitFor(url: string): Promise<void> {
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(url)).ok) return
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('preview did not start')
}

async function pngOf(page: Page, which: 'getOriginal' | 'getResult', width: number): Promise<Buffer> {
  const b64 = await page.evaluate(
    async ([fn, w]) => {
      const img = (window.__inpaint as unknown as Record<string, () => { data: Uint8ClampedArray<ArrayBuffer>; width: number; height: number }>)[fn as string]()
      const src = new OffscreenCanvas(img.width, img.height)
      src.getContext('2d')!.putImageData(new ImageData(img.data, img.width, img.height), 0, 0)
      const h = Math.round((img.height * (w as number)) / img.width)
      const out = new OffscreenCanvas(w as number, h)
      const ctx = out.getContext('2d')!
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(src, 0, 0, w as number, h)
      const blob = await out.convertToBlob({ type: 'image/png' })
      let s = ''
      for (const byte of new Uint8Array(await blob.arrayBuffer())) s += String.fromCharCode(byte)
      return btoa(s)
    },
    [which, width] as const,
  )
  return Buffer.from(b64, 'base64')
}

async function main(): Promise<void> {
  mkdirSync('docs/media', { recursive: true })
  const preview = spawn('pnpm', ['preview'], { shell: true, stdio: 'ignore' })
  try {
    await waitFor(URL_)
    const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu'] })
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
    await page.goto(`${URL_}/?sample=1`)
    await page.getByTestId('mask-canvas').waitFor({ timeout: 30_000 })
    await page.evaluate((r) => {
      window.__inpaint!.setMask([r])
    }, OBJECT)
    await page.screenshot({ path: 'docs/media/ui-mask.png' })
    await page.evaluate(() => window.__inpaint!.run())
    writeFileSync('docs/media/before.png', await pngOf(page, 'getOriginal', 720))
    writeFileSync('docs/media/after.png', await pngOf(page, 'getResult', 720))
    await page.getByTestId('compare-slider').focus()
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowLeft')
    await page.screenshot({ path: 'docs/media/ui.png' })
    await browser.close()
  } finally {
    if (preview.pid) {
      if (process.platform === 'win32') {
        try {
          execFileSync('taskkill', ['/PID', String(preview.pid), '/T', '/F'], { stdio: 'ignore' })
        } catch {
          /* gone */
        }
      } else preview.kill('SIGTERM')
    }
  }
}

void main()
