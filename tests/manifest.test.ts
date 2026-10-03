import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { getModel, parseManifest } from '../src/core/manifest'

const raw = () => JSON.parse(readFileSync('public/models/manifest.json', 'utf8'))
const SHA = '593eba0b7e04730f1b61c0a3cbca68d97d8d6a7ff5c6a44a7b9d7fcd880fc5ae'

function code(fn: () => unknown): string {
  try {
    fn()
  } catch (e) {
    return (e as { code: string }).code
  }
  return 'none'
}

describe('manifest', () => {
  it('parses the committed manifest', () => {
    const m = parseManifest(raw())
    expect(getModel(m, 'migan-512').sha256).toBe(SHA)
  })

  const mutate = (fn: (j: any) => void) => () => {
    const j = raw()
    fn(j)
    return parseManifest(j)
  }
  it.each([
    ['version 2', (j: any) => (j.version = 2)],
    ['sha256 63 chars', (j: any) => (j.models[0].sha256 = SHA.slice(1))],
    ['sha256 with g', (j: any) => (j.models[0].sha256 = 'g' + SHA.slice(1))],
    ['empty urls', (j: any) => (j.models[0].urls = [])],
    ['size 500', (j: any) => (j.models[0].size = 500)],
    ['size 0', (j: any) => (j.models[0].size = 0)],
    ['missing io', (j: any) => delete j.models[0].io],
  ])('rejects %s', (_n, fn) => {
    expect(code(mutate(fn))).toBe('BAD_INPUT')
  })

  it('rejects an unknown model id', () => {
    expect(code(() => getModel(parseManifest(raw()), 'nope'))).toBe('BAD_INPUT')
  })
})
