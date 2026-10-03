import { describe, expect, it } from 'vitest'
import * as core from '../src/core/index'

describe('library surface', () => {
  it.each([
    'createEngine',
    'InpaintError',
    'parseManifest',
    'loadModel',
    'memoryCache',
    'selectProvider',
    'wasmThreads',
    'compositeMasked',
    'planCrop',
    'checkImageBudget',
    'summarize',
  ])('exports %s', (name) => {
    expect(name in core).toBe(true)
  })
})
