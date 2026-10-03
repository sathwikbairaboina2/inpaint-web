import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const URL_ = 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Aldrin_Apollo_11_original.jpg/960px-Aldrin_Apollo_11_original.jpg'
const SHA = '7ea66a1e0632c564bd1beb4733abe5ef26d70de0561d5fd000b8f7bb92e6bd38'
const dir = join(import.meta.dirname, '..', 'public', 'samples')
const target = join(dir, 'aldrin.jpg')
const sha = (b) => createHash('sha256').update(b).digest('hex')

if (existsSync(target) && sha(readFileSync(target)) === SHA) {
  console.log('ok aldrin.jpg (cached)')
  process.exit(0)
}
const res = await fetch(URL_, {
  headers: { 'User-Agent': 'inpaint-web/0.1 (https://github.com/sathwikbairaboina2/inpaint-web)' },
})
if (!res.ok) {
  console.error(`fail: HTTP ${res.status}`)
  process.exit(1)
}
const buf = Buffer.from(await res.arrayBuffer())
if (sha(buf) !== SHA) {
  console.error(`fail: sha256 mismatch, got ${sha(buf)}`)
  process.exit(1)
}
mkdirSync(dir, { recursive: true })
writeFileSync(target, buf)
console.log(`ok aldrin.jpg ${buf.length} bytes`)
