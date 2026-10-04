import { readFileSync } from 'node:fs'

const j = JSON.parse(readFileSync(process.argv[2] ?? 'bench/results/latest.json', 'utf8'))
const f = (n) => n.toFixed(1)
const row = (r, device) =>
  `| ${r.ep} | ${r.threads} | ${device} | ${f(r.run.median)} | ${f(r.run.p90)} | ${f(r.sessionMs)} |`
console.log('| EP | Threads | Device | Run median (ms) | Run p90 (ms) | Session create (ms) |')
console.log('|---|---|---|---|---|---|')
if (j.webgpu) console.log(row(j.webgpu, j.adapter ?? 'unknown GPU'))
console.log(row(j.wasm, j.machine.cpu))
console.log('')
console.log(`Speedup: ${j.speedup}x, the median of ${j.rounds.length} per-round speedups (${j.speedupRounds.join(', ')}); the row values above are that round. Each round runs webgpu and wasm back to back. ${j.runs} timed runs per EP per round after 1 warm-up, ${j.image.width}x${j.image.height} image, ${j.hole.w}x${j.hole.h} hole.`)
console.log(`Chrome ${j.chrome}, commit ${j.gitSha} (dirty: ${j.dirty}), ${j.date.slice(0, 10)}.`)
