import { describe, expect, it } from 'vitest'
import { JobQueue } from '../src/core/queue'

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('JobQueue', () => {
  it('cancels only the pending job; the running one finishes, then the newest runs', async () => {
    const gates: Record<string, ReturnType<typeof deferred<string>>> = { A: deferred(), B: deferred(), C: deferred() }
    const calls: string[] = []
    const q = new JobQueue<string, string>((job) => {
      calls.push(job)
      return gates[job].promise
    })
    const a = q.submit('a', 'A')
    expect(q.running).toBe('a')
    const b = q.submit('b', 'B')
    expect(q.pending).toBe('b')
    const bResult = b.then(
      () => 'resolved',
      (e: { code: string }) => e.code,
    )
    const c = q.submit('c', 'C')
    expect(await bResult).toBe('CANCELLED')
    expect(q.running).toBe('a')
    expect(q.pending).toBe('c')
    gates.A.resolve('done-A')
    expect(await a).toBe('done-A')
    await Promise.resolve()
    await Promise.resolve()
    expect(q.running).toBe('c')
    gates.C.resolve('done-C')
    expect(await c).toBe('done-C')
    expect(calls).toEqual(['A', 'C'])
  })

  it('a throwing job does not block the next', async () => {
    const q = new JobQueue<number, number>(async (n) => {
      if (n === 1) throw new Error('bad')
      return n * 2
    })
    const first = q.submit('1', 1)
    const second = q.submit('2', 2)
    await expect(first).rejects.toThrow('bad')
    expect(await second).toBe(4)
  })

  it('running is null when idle and run is called once per job', async () => {
    let count = 0
    const q = new JobQueue<number, number>(async (n) => {
      count++
      return n
    })
    expect(q.running).toBeNull()
    expect(q.pending).toBeNull()
    await q.submit('x', 1)
    expect(q.running).toBeNull()
    expect(count).toBe(1)
  })
})
