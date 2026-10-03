import type { EpName } from '../core/types'
import type { DeviceEvent } from '../worker/protocol'

export type LastRun = { ep: EpName; fallbackReason?: string; adapterInfo?: string }

export function badgeText(device: DeviceEvent | null, forceWasm: boolean, last: LastRun | null): string {
  if (!device) return 'Checking device'
  const wasm = `WASM · ${device.threads} thread${device.threads === 1 ? '' : 's'}${device.crossOriginIsolated ? '' : ' (not isolated)'}`
  const gpu = (name?: string) => `WebGPU · ${name ?? device.adapter ?? 'adapter'}`
  if (last) {
    const base = last.ep === 'webgpu' ? gpu(last.adapterInfo) : wasm
    return last.fallbackReason ? `${base} · ${last.fallbackReason}` : base
  }
  if (forceWasm || !device.webgpu) return wasm
  return gpu()
}

export function DeviceBadge({ device, forceWasm, last }: { device: DeviceEvent | null; forceWasm: boolean; last: LastRun | null }) {
  const text = badgeText(device, forceWasm, last)
  return (
    <span className="badge" data-testid="device-badge" title={last?.fallbackReason ?? text}>
      {text}
    </span>
  )
}
