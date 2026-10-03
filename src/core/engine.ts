import { checkImageBudget } from './budget'
import { compositeMasked } from './composite'
import { planCrop } from './crop'
import { selectProvider, wasmThreads, type GpuLike, type Selection } from './ep'
import { getModel, type Manifest, type ModelEntry } from './manifest'
import { cropMask, dilateMask, maskBBox, resizeMaskAny } from './mask'
import { cropRGBA, resizeBilinear } from './resize'
import { maskToNCHW, nchwToRGBA, rgbaToNCHW } from './tensor'
import { InpaintError, type EpName, type Mask, type Progress, type RGBAImage, type Timings } from './types'

export interface OrtTensorLike {
  getData(): Promise<ArrayLike<number>>
  dims: readonly number[]
}
export interface OrtSessionLike {
  run(feeds: Record<string, unknown>): Promise<Record<string, OrtTensorLike>>
  release(): Promise<void>
}
export interface OrtLike {
  env: { wasm: { numThreads?: number; wasmPaths?: unknown } }
  Tensor: new (type: string, data: ArrayLike<number>, dims: readonly number[]) => unknown
  InferenceSession: {
    create(
      bytes: Uint8Array,
      opts: { executionProviders: string[]; graphOptimizationLevel: 'all' },
    ): Promise<OrtSessionLike>
  }
}

export type EngineDeps = {
  ort: OrtLike
  manifest: Manifest
  modelId?: string
  loadModel: (model: ModelEntry, onProgress?: (p: Progress) => void) => Promise<Uint8Array>
  gpu: GpuLike | undefined
  crossOriginIsolated: boolean
  hardwareConcurrency: number
  now?: () => number
}

export type InpaintOptions = {
  forceWasm?: boolean
  onProgress?: (p: Progress) => void
  feather?: number
}

export type InpaintResult = {
  image: RGBAImage
  ep: EpName
  fallbackReason?: string
  adapterInfo?: string
  timings: Timings
}

export type Engine = {
  inpaint(image: RGBAImage, mask: Mask, opts: InpaintOptions): Promise<InpaintResult>
  dispose(): Promise<void>
}

const MASK_DILATE = 3

function toInpaintError(e: unknown): InpaintError {
  if (e instanceof InpaintError) return e
  const msg = e instanceof Error ? e.message : String(e)
  if (/out of memory|allocation/i.test(msg)) return new InpaintError('OOM', msg)
  return new InpaintError('INTERNAL', msg)
}

export function createEngine(deps: EngineDeps): Engine {
  const { ort } = deps
  const model = getModel(deps.manifest, deps.modelId ?? 'migan-512')
  const now = deps.now ?? (() => performance.now())

  let bytes: Promise<Uint8Array> | null = null
  const sessionsByEp = new Map<EpName, Promise<OrtSessionLike>>()
  const selections = new Map<boolean, Promise<Selection<OrtSessionLike>>>()

  const createSession = (ep: EpName): Promise<OrtSessionLike> => {
    const existing = sessionsByEp.get(ep)
    if (existing) return existing
    const p = (async () => {
      if (ep === 'wasm') ort.env.wasm.numThreads = wasmThreads(deps.crossOriginIsolated, deps.hardwareConcurrency)
      return ort.InferenceSession.create(await bytes!, { executionProviders: [ep], graphOptimizationLevel: 'all' })
    })()
    sessionsByEp.set(ep, p)
    p.catch(() => sessionsByEp.delete(ep))
    return p
  }

  const getSelection = (forceWasm: boolean): Promise<Selection<OrtSessionLike>> => {
    const existing = selections.get(forceWasm)
    if (existing) return existing
    const p = selectProvider({
      gpu: deps.gpu,
      forceWasm,
      minBufferBytes: model.minBufferBytes,
      createSession,
    })
    selections.set(forceWasm, p)
    p.catch(() => selections.delete(forceWasm))
    return p
  }

  async function inpaint(image: RGBAImage, mask: Mask, opts: InpaintOptions): Promise<InpaintResult> {
    const report = (phase: Progress['phase'], done: number) => opts.onProgress?.({ phase, done, total: 1 })
    const t0 = now()

    checkImageBudget(image.width, image.height)
    if (image.data.length !== image.width * image.height * 4)
      throw new InpaintError('BAD_INPUT', 'image buffer length does not match its size')
    if (mask.width !== image.width || mask.height !== image.height || mask.data.length !== image.width * image.height)
      throw new InpaintError('BAD_INPUT', 'mask size must equal image size')
    const bbox = maskBBox(mask)
    if (!bbox) throw new InpaintError('EMPTY_MASK', 'the mask has no pixels to remove')

    bytes ??= deps.loadModel(model, opts.onProgress)
    try {
      await bytes
    } catch (e) {
      bytes = null
      throw e
    }
    const t1 = now()

    report('session', 0)
    const selection = await getSelection(opts.forceWasm ?? false)
    report('session', 1)
    const t2 = now()

    report('pre', 0)
    const rect = planCrop(bbox, image.width, image.height)
    const S = model.size
    const crop = resizeBilinear(cropRGBA(image, rect), S, S)
    const holeMask = dilateMask(resizeMaskAny(cropMask(mask, rect), S, S), MASK_DILATE)
    const { io } = model
    const imageTensor = new ort.Tensor(io.dtype, rgbaToNCHW(crop, io.dtype, io.imageScale), [1, 3, S, S])
    const maskTensor = new ort.Tensor(io.dtype, maskToNCHW(holeMask, io.dtype, io.maskKeep, io.maskHole), [1, 1, S, S])
    report('pre', 1)
    const t3 = now()

    report('run', 0)
    const outputs = await selection.session.run({ [io.inputs.image]: imageTensor, [io.inputs.mask]: maskTensor })
    const out = outputs[io.output]
    if (!out) throw new InpaintError('INTERNAL', `model output ${io.output} missing`)
    const outData = await out.getData()
    report('run', 1)
    const t4 = now()

    report('post', 0)
    const patch = resizeBilinear(nchwToRGBA(outData, S, S, io.outputScale), rect.w, rect.h)
    const result = compositeMasked(image, patch, rect, mask, { feather: opts.feather ?? 2 })
    report('post', 1)
    const t5 = now()

    return {
      image: result,
      ep: selection.ep,
      fallbackReason: selection.reason,
      adapterInfo: selection.adapterInfo,
      timings: {
        loadMs: t1 - t0,
        sessionMs: t2 - t1,
        preMs: t3 - t2,
        runMs: t4 - t3,
        postMs: t5 - t4,
        totalMs: t5 - t0,
      },
    }
  }

  return {
    async inpaint(image, mask, opts) {
      try {
        return await inpaint(image, mask, opts)
      } catch (e) {
        throw toInpaintError(e)
      }
    },
    async dispose() {
      const all = [...sessionsByEp.values()]
      sessionsByEp.clear()
      selections.clear()
      for (const p of all) await (await p).release()
    },
  }
}
