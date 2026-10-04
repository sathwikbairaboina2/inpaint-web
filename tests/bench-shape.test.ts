import { existsSync, readFileSync } from 'node:fs'
import { pickHeadline } from '../src/bench/headline'
import { describe, expect, it } from 'vitest'

const FILE = 'bench/results/latest.json'
const round2 = (n: number) => Math.round(n * 100) / 100

describe('bench results', () => {
  it.skipIf(!existsSync(FILE))('latest.json is internally consistent (no hand-edited numbers)', () => {
    const j = JSON.parse(readFileSync(FILE, 'utf8'))
    expect(j.runs).toBeGreaterThanOrEqual(20)
    expect(j.wasm.run.median).toBeGreaterThan(0)
    expect(j.webgpu.run.median).toBeGreaterThan(0)
    expect(j.speedup).toBe(round2(j.wasm.run.median / j.webgpu.run.median))
    expect(j.rounds.length).toBeGreaterThanOrEqual(3)
    const head = pickHeadline(j.rounds)
    expect(j.speedup).toBe(head.speedup)
    expect(j.speedupRounds).toEqual(head.perRound)
    expect(j.wasm).toEqual(j.rounds[head.index].wasm)
    expect(j.wasm.run.n).toBe(j.runs)
    expect(j.webgpu.run.n).toBe(j.runs)
    for (const k of ['userAgent', 'hardwareConcurrency', 'gitSha', 'date', 'chrome', 'machine']) expect(j[k]).toBeTruthy()
  })
})
