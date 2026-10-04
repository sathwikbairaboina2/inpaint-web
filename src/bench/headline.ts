export type RoundLike = { webgpu: { run: { median: number } } | null; wasm: { run: { median: number } } }

const round2 = (n: number) => Math.round(n * 100) / 100

// Headline = the round whose speedup is the median of the per-round speedups (the lower median when the count is even,
// so the stated figure is never the flattering one). Returns that round's index and every round's speedup.
export function pickHeadline(rounds: RoundLike[]): { index: number; speedup: number | null; perRound: (number | null)[] } {
  const perRound = rounds.map((r) => (r.webgpu ? round2(r.wasm.run.median / r.webgpu.run.median) : null))
  const ranked = perRound.flatMap((s, i) => (s === null ? [] : [{ s, i }])).sort((a, b) => a.s - b.s || a.i - b.i)
  if (ranked.length === 0) return { index: 0, speedup: null, perRound }
  const pick = ranked[Math.floor((ranked.length - 1) / 2)]
  return { index: pick.i, speedup: pick.s, perRound }
}
