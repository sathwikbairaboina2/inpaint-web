import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ORT_FILES, ortDistDir } from '../vite/ort-assets'

describe('ort assets', () => {
  it.each(ORT_FILES)('%s exists in onnxruntime-web dist', (f) => {
    expect(existsSync(join(ortDistDir(), f))).toBe(true)
  })
})
