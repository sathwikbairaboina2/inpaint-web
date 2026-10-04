import { spawn, execFileSync, type ChildProcess } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { cpus, totalmem } from 'node:os'
import { dirname } from 'node:path'
import { chromium } from '@playwright/test'
import { pickHeadline } from '../src/bench/headline'

const URL_ = 'http://localhost:5421'
const DEFAULT_OUT = 'bench/results/latest.json'

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const git = (...a: string[]) => execFileSync('git', a, { encoding: 'utf8' }).trim()

function kill(child: ChildProcess): void {
  if (!child.pid) return
  if (process.platform === 'win32') {
    try {
      execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
    } catch {
      /* already gone */
    }
  } else child.kill('SIGTERM')
}

async function waitFor(url: string, ms: number): Promise<void> {
  const end = Date.now() + ms
  while (Date.now() < end) {
    try {
      if ((await fetch(url)).ok) return
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`preview server did not come up at ${url}`)
}

async function main(): Promise<number> {
  const runs = Number(arg('runs', '20'))
  const rounds = Number(arg('rounds', '5'))
  if (!(rounds >= 3)) throw new Error('--rounds must be at least 3: a single pass is skewed by host load')
  const out = arg('out', DEFAULT_OUT)
  const dirty = git('status', '--porcelain').length > 0
  const sha = git('rev-parse', '--short', 'HEAD')

  await new Promise<void>((resolve, reject) => {
    const b = spawn('pnpm', ['build'], { shell: true, stdio: 'inherit' })
    b.on('exit', (c) => (c === 0 ? resolve() : reject(new Error(`pnpm build exited ${c}`))))
  })

  const preview = spawn('pnpm', ['preview'], { shell: true, stdio: 'ignore' })
  try {
    await waitFor(URL_, 60_000)
    const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu'] })
    try {
      const page = await browser.newPage()
      await page.goto(`${URL_}/bench.html?runs=${runs}&rounds=${rounds}`)
      await page.waitForFunction(
        () => (window as unknown as { __benchResult?: unknown; __benchError?: string }).__benchResult || (window as unknown as { __benchError?: string }).__benchError,
        undefined,
        { timeout: 15 * 60_000, polling: 1000 },
      )
      const err = await page.evaluate(() => (window as unknown as { __benchError?: string }).__benchError)
      if (err) throw new Error(err)
      const page_ = (await page.evaluate(() => (window as unknown as { __benchResult: unknown }).__benchResult)) as {
        rounds: { webgpu: { run: { median: number } } | null; wasm: { run: { median: number } } }[]
      }
      const head = pickHeadline(page_.rounds)
      const picked = page_.rounds[head.index]
      const speedup = head.speedup
      const result = {
        ...page_,
        rounds: page_.rounds.map((r, i) => ({ ...r, speedup: head.perRound[i] })),
        webgpu: picked.webgpu,
        wasm: picked.wasm,
        speedup,
        speedupMethod: 'median of the per-round speedups (lower median if even); webgpu and wasm above are that round',
        speedupRounds: head.perRound,
        date: new Date().toISOString(),
        gitSha: sha,
        dirty,
        chrome: browser.version(),
        machine: { cpu: cpus()[0]?.model.trim(), logicalCores: cpus().length, totalMemGB: Math.round(totalmem() / 2 ** 30), platform: process.platform },
      }
      mkdirSync(dirname(out), { recursive: true })
      const json = JSON.stringify(result, null, 2) + '\n'
      writeFileSync(out, json)
      if (out === DEFAULT_OUT) writeFileSync(`bench/results/${result.date.slice(0, 10)}-${sha}.json`, json)
      const g = picked.webgpu?.run.median
      console.log(`bench: ${rounds} rounds, per-round speedups ${head.perRound.join(', ')}; headline round webgpu ${g?.toFixed(1) ?? 'n/a'} ms, wasm ${picked.wasm.run.median.toFixed(1)} ms, speedup ${speedup ?? 'n/a'}x -> ${out}`)
      return picked.webgpu ? 0 : 2
    } finally {
      await browser.close()
    }
  } finally {
    kill(preview)
  }
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error(e)
    process.exit(1)
  },
)
