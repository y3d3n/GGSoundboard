/**
 * Audio device discovery + virtual-driver detection (BlackHole / VB-CABLE / others).
 */

export interface AudioDevice {
  deviceId: string
  label: string
  kind: 'audioinput' | 'audiooutput'
  isVirtual: boolean
  isDefault: boolean
}

export type Platform = 'mac' | 'windows' | 'linux' | 'unknown'

// Virtual audio drivers commonly used as a "virtual microphone".
const VIRTUAL_PATTERNS = [
  /blackhole/i,
  /\bcable\b.*(input|output)/i,
  /vb-audio/i,
  /voicemeeter/i,
  /loopback audio/i,
  /soundflower/i,
  /eqmac/i,
  /virtual/i,
]

export function isVirtualLabel(label: string) {
  return VIRTUAL_PATTERNS.some((re) => re.test(label))
}

export function detectPlatform(): Platform {
  const ua = navigator.userAgent
  if (/Mac/i.test(ua)) return 'mac'
  if (/Win/i.test(ua)) return 'windows'
  if (/Linux/i.test(ua)) return 'linux'
  return 'unknown'
}

export async function listDevices(): Promise<{ inputs: AudioDevice[]; outputs: AudioDevice[]; labelsAvailable: boolean }> {
  if (!navigator.mediaDevices?.enumerateDevices) return { inputs: [], outputs: [], labelsAvailable: false }
  const all = await navigator.mediaDevices.enumerateDevices()
  const labelsAvailable = all.some((d) => d.label)
  const map = (d: MediaDeviceInfo): AudioDevice => ({
    deviceId: d.deviceId,
    label: d.label || (d.kind === 'audioinput' ? 'Microphone' : 'Output device'),
    kind: d.kind as AudioDevice['kind'],
    isVirtual: isVirtualLabel(d.label),
    isDefault: d.deviceId === 'default',
  })
  // Chrome lists "default"/"communications" aliases; keep "default" only.
  const keep = (d: MediaDeviceInfo) => d.deviceId !== 'communications'
  return {
    inputs: all.filter((d) => d.kind === 'audioinput' && keep(d)).map(map),
    outputs: all.filter((d) => d.kind === 'audiooutput' && keep(d)).map(map),
    labelsAvailable,
  }
}

/**
 * Pick the best output device to act as the virtual microphone.
 * macOS: BlackHole. Windows: "CABLE Input (VB-Audio Virtual Cable)".
 */
export function findVirtualOutput(outputs: AudioDevice[]): AudioDevice | null {
  const real = outputs.filter((d) => !d.isDefault)
  return (
    real.find((d) => /blackhole/i.test(d.label)) ??
    real.find((d) => /cable input/i.test(d.label)) ??
    real.find((d) => /vb-audio|voicemeeter input/i.test(d.label)) ??
    real.find((d) => d.isVirtual) ??
    null
  )
}

/** The name the user should select as the microphone in Discord etc. */
export function virtualMicNameFor(outputLabel: string | null | undefined, platform: Platform): string {
  if (outputLabel) {
    if (/blackhole/i.test(outputLabel)) return outputLabel.replace(/\s*\(.*\)\s*$/, '')
    if (/cable input/i.test(outputLabel)) return 'CABLE Output (VB-Audio Virtual Cable)'
    if (/voicemeeter input/i.test(outputLabel)) return 'Voicemeeter Output'
  }
  return platform === 'windows' ? 'CABLE Output (VB-Audio Virtual Cable)' : 'BlackHole 2ch'
}
