<script setup lang="ts">
import { Cast, Check, ExternalLink, RefreshCw, Smartphone, Tablet, Monitor, Shield, Trash2, Wifi, WifiOff } from 'lucide-vue-next'
import type { ConnectedDevice } from '~/lib/types'

const sb = useSoundboard()
const { state } = sb
const { ui } = useUi()

const copied = ref(false)

const halfUrl = computed(() => {
  const url = state.remoteUrl || ''
  if (!url) return ''
  const halfLen = Math.ceil(url.length / 2)
  return url.slice(0, halfLen) + '…'
})

async function copyUrl() {
  if (!state.remoteUrl) return
  try {
    await navigator.clipboard.writeText(state.remoteUrl)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    // ignore
  }
}

function openUrl() {
  if (state.remoteUrl) {
    if (sb.native) void sb.native.openExternal(state.remoteUrl)
    else window.open(state.remoteUrl, '_blank')
  }
}

function getDeviceIcon(ua: string) {
  const l = (ua || '').toLowerCase()
  if (l.includes('ipad') || l.includes('tablet')) return Tablet
  if (l.includes('iphone') || l.includes('android') || l.includes('mobile')) return Smartphone
  return Monitor
}

function fmtTimeAgo(ts: number) {
  if (!ts) return 'just now'
  const diff = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (diff < 60) return `${diff}s ago`
  const m = Math.floor(diff / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return `${h}h ago`
}
</script>

<template>
  <UiModal :open="ui.remoteOpen" title="Remote Controller" width="max-w-[580px]" @close="ui.remoteOpen = false">
    <div class="space-y-5 p-5">
      <!-- Status Card -->
      <div class="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
        <div class="flex items-center gap-3">
          <div
            class="flex h-10 w-10 items-center justify-center rounded-xl"
            :class="state.remoteRunning ? 'bg-emerald-400/10 text-emerald-400' : 'bg-white/[0.05] text-ink-500'"
          >
            <Wifi v-if="state.remoteRunning" :size="20" />
            <WifiOff v-else :size="20" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-[13.5px] font-semibold text-ink-100">Local Remote Server</span>
              <span
                class="rounded-full px-2 py-0.5 text-2xs font-medium"
                :class="state.remoteRunning ? 'bg-emerald-400/15 text-emerald-300' : 'bg-white/[0.06] text-ink-400'"
              >
                {{ state.remoteRunning ? 'Active' : 'Stopped' }}
              </span>
            </div>
            <p class="text-[12px] text-ink-400">
              {{ state.remoteRunning ? 'Ready for phones, tablets & laptops on your Wi-Fi' : 'Enable to control sounds from mobile devices' }}
            </p>
          </div>
        </div>
        <UiToggle :model-value="state.settings.remoteEnabled" @update:model-value="sb.toggleRemoteServer" />
      </div>

      <!-- Connection Details (When Running) -->
      <div v-if="state.remoteRunning" class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <!-- URL & QR Code -->
        <div class="space-y-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 flex flex-col justify-between">
          <label class="label mb-0">Scan or Visit URL</label>
          <div class="flex flex-col items-center justify-center gap-3 py-1">
            <div class="overflow-hidden rounded-xl border border-white/[0.1] bg-ink-950 p-2.5 shadow-inner">
              <img
                v-if="state.remoteQr"
                :src="state.remoteQr"
                alt="QR Code"
                class="h-44 w-44 rounded-lg"
              >
              <div v-else class="flex h-44 w-44 items-center justify-center text-xs text-ink-500">
                Generating…
              </div>
            </div>
            <div class="flex w-full items-center gap-1.5">
              <button
                type="button"
                class="group relative flex flex-1 items-center justify-between truncate rounded-lg border px-2.5 py-1.5 font-mono text-[11px] transition-all cursor-pointer text-left"
                :class="copied
                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                  : 'border-white/[0.08] bg-white/[0.04] text-ink-200 hover:border-white/20 hover:bg-white/[0.07] hover:text-ink-100'"
                :title="copied ? 'Copied to clipboard!' : `Click to copy: ${state.remoteUrl}`"
                @click="copyUrl"
              >
                <span class="truncate">
                  {{ copied ? 'Copied!' : halfUrl }}
                </span>
                <span class="ml-1.5 shrink-0 text-2xs text-ink-500 group-hover:text-ink-300">
                  <Check v-if="copied" :size="12" class="text-emerald-400" />
                  <span v-else class="text-[10px] font-sans uppercase tracking-wider text-ink-400 group-hover:text-ink-200">Copy</span>
                </span>
              </button>
              <button class="btn-outline h-7 px-2 text-ink-400 hover:text-ink-100" title="Open in browser" @click="openUrl">
                <ExternalLink :size="13" />
              </button>
            </div>
          </div>
        </div>

        <!-- Pairing PIN -->
        <div class="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
          <div>
            <div class="flex items-center justify-between">
              <label class="label mb-0">Pairing PIN</label>
              <button
                class="inline-flex items-center gap-1 text-2xs text-ink-400 hover:text-ink-200"
                title="Generate new PIN"
                @click="sb.regenerateRemotePin()"
              >
                <RefreshCw :size="11" /> Regenerate
              </button>
            </div>
            <p class="mt-1 text-[11.5px] text-ink-400">Enter this PIN on your remote device to pair:</p>
            <div class="my-6 flex items-center justify-center gap-2">
              <span
                v-for="(digit, idx) in (state.remotePin || '4829').split('')"
                :key="idx"
                class="flex h-12 w-11 items-center justify-center rounded-xl border border-accent/40 bg-accent-soft font-mono text-2xl font-bold text-ink-100 shadow-sm"
              >
                {{ digit }}
              </span>
            </div>
          </div>

          <div class="flex items-start gap-2 rounded-lg bg-white/[0.03] p-2.5 text-[11.5px] text-ink-400">
            <Shield :size="14" class="mt-0.5 shrink-0 text-accent" />
            <span>Strict controller permissions: Remotes can only trigger sounds and cannot alter files or settings.</span>
          </div>
        </div>
      </div>

      <!-- Connected Controllers List -->
      <div>
        <div class="mb-2 flex items-center justify-between px-1">
          <label class="label mb-0">Connected Controllers ({{ state.remoteDevices.length }})</label>
        </div>

        <div v-if="state.remoteDevices.length" class="space-y-2">
          <div
            v-for="d in state.remoteDevices"
            :key="d.id"
            class="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.025] px-3.5 py-2.5"
          >
            <div class="flex items-center gap-3 min-w-0">
              <component :is="getDeviceIcon(d.userAgent)" :size="18" class="text-ink-400 shrink-0" />
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <p class="truncate text-[13px] font-medium text-ink-100">{{ d.name }}</p>
                  <span
                    class="h-1.5 w-1.5 rounded-full shrink-0"
                    :class="(d as any).isLive ? 'bg-emerald-400' : 'bg-ink-500'"
                    :title="(d as any).isLive ? 'Active connection' : 'Idle'"
                  />
                </div>
                <p class="text-[11px] text-ink-500">
                  {{ d.ip }} · Active {{ fmtTimeAgo(d.lastSeen) }}
                </p>
              </div>
            </div>

            <button
              class="btn h-7 px-2.5 text-[11.5px] text-red-300 hover:bg-red-500/10 hover:text-red-200"
              title="Revoke and disconnect device"
              @click="sb.revokeRemoteDevice(d.id)"
            >
              <Trash2 :size="12" /> Revoke
            </button>
          </div>
        </div>

        <div
          v-else
          class="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.08] py-8 text-center"
        >
          <Smartphone :size="20" class="text-ink-500 mb-2" />
          <p class="text-[12.5px] font-medium text-ink-300">No controllers connected</p>
          <p class="mt-1 text-[11.5px] text-ink-500">
            Open the link above on your phone or tablet on the same Wi-Fi.
          </p>
        </div>
      </div>
    </div>

    <template #footer>
      <button class="btn-primary" @click="ui.remoteOpen = false">Done</button>
    </template>
  </UiModal>
</template>
