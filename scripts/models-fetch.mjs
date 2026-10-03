import { createHash } from 'node:crypto'
import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = join(import.meta.dirname, '..', 'public', 'models')
const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))
const sha = (buf) => createHash('sha256').update(buf).digest('hex')

let failed = false
for (const m of manifest.models) {
  const target = join(dir, m.file)
  if (existsSync(target) && sha(readFileSync(target)) === m.sha256) {
    console.log(`ok ${m.id} (cached)`)
    continue
  }
  const url = m.urls.find((u) => u.startsWith('https://'))
  if (!url) {
    console.error(`fail ${m.id}: no https url in manifest`)
    failed = true
    continue
  }
  const res = await fetch(url)
  if (!res.ok) {
    console.error(`fail ${m.id}: HTTP ${res.status} from ${url}`)
    failed = true
    continue
  }
  const buf = Buffer.from(await res.arrayBuffer())
  const tmp = `${target}.tmp`
  writeFileSync(tmp, buf)
  const actual = sha(buf)
  if (actual !== m.sha256) {
    unlinkSync(tmp)
    console.error(`fail ${m.id}: sha256 mismatch\n  expected ${m.sha256}\n  actual   ${actual}`)
    failed = true
    continue
  }
  renameSync(tmp, target)
  console.log(`ok ${m.id} ${buf.length} bytes`)
}
process.exit(failed ? 1 : 0)
