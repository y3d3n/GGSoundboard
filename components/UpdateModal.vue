<script setup lang="ts">
import {
  Sparkles,
  Download,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowRight,
  RefreshCw,
  Clock,
  ExternalLink,
} from 'lucide-vue-next'

const updater = useUpdater()
const { state, downloadUpdate, installUpdate, closeModal, checkForUpdates, formatBytes, formatSpeed } = updater

const formattedReleaseNotes = computed(() => {
  if (!state.releaseNotes) return null
  return state.releaseNotes
})

const isDownloading = computed(() => state.status === 'downloading')
const isDownloaded = computed(() => state.status === 'downloaded')
const isAvailable = computed(() => state.status === 'available')
const isError = computed(() => state.status === 'error')
</script>

<template>
  <UiModal :open="state.modalOpen" title="Software Update" width="max-w-[500px]" @close="closeModal">
    <div class="space-y-5 p-6">
      <!-- Header Banner -->
      <div class="flex items-start gap-4">
        <div
          class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border transition-colors shadow-lg"
          :class="[
            isDownloaded
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 shadow-emerald-500/5'
              : isError
              ? 'border-rose-500/30 bg-rose-500/10 text-rose-400 shadow-rose-500/5'
              : 'border-accent/30 bg-accent/10 text-accent shadow-accent/5',
          ]"
        >
          <CheckCircle2 v-if="isDownloaded" :size="24" />
          <AlertCircle v-else-if="isError" :size="24" />
          <Sparkles v-else :size="24" />
        </div>

        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <h2 class="text-[16px] font-semibold text-ink-100">
              <span v-if="isDownloaded">Update Ready to Install</span>
              <span v-else-if="isDownloading">Downloading Update…</span>
              <span v-else-if="isError">Update Failed</span>
              <span v-else>New Version Available</span>
            </h2>
          </div>

          <!-- Version badges -->
          <div class="mt-1 flex items-center gap-2 text-[12px] text-ink-400">
            <span class="rounded bg-white/[0.06] px-2 py-0.5 font-mono text-[11px] text-ink-300">
              v{{ state.currentVersion }}
            </span>
            <ArrowRight :size="12" class="text-ink-500" />
            <span class="rounded bg-accent/20 border border-accent/30 px-2 py-0.5 font-mono text-[11px] font-semibold text-accent">
              v{{ state.availableVersion || 'Latest' }}
            </span>
          </div>
        </div>
      </div>

      <!-- State: Error Notification -->
      <div
        v-if="isError"
        class="rounded-xl border border-rose-500/20 bg-rose-500/[0.06] p-4 text-[12.5px] leading-relaxed text-rose-200"
      >
        <div class="flex items-start gap-2.5">
          <AlertCircle :size="16" class="mt-0.5 shrink-0 text-rose-400" />
          <div class="space-y-1">
            <p class="font-medium text-rose-100">Unable to complete update</p>
            <p class="text-[12px] text-rose-300/80">{{ state.errorMessage }}</p>
          </div>
        </div>
      </div>

      <!-- State: Downloading Progress Bar -->
      <div v-else-if="isDownloading" class="space-y-2.5 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
        <div class="flex items-center justify-between text-[12.5px]">
          <span class="font-medium text-ink-200">Downloading v{{ state.availableVersion }}…</span>
          <span class="font-mono text-[12px] tabular-nums font-semibold text-accent">
            {{ state.progress?.percent ?? 0 }}%
          </span>
        </div>

        <!-- Progress track & fill -->
        <div class="h-2 w-full overflow-hidden rounded-full bg-white/[0.08]">
          <div
            class="h-full rounded-full bg-accent transition-[width] duration-150 ease-out"
            :style="{ width: `${state.progress?.percent ?? 0}%` }"
          />
        </div>

        <div class="flex items-center justify-between font-mono text-[11px] tabular-nums text-ink-500">
          <span>
            {{ formatBytes(state.progress?.transferred ?? 0) }} / {{ formatBytes(state.progress?.total ?? 0) }}
          </span>
          <span v-if="state.progress?.bytesPerSecond">
            {{ formatSpeed(state.progress.bytesPerSecond) }}
          </span>
        </div>
      </div>

      <!-- State: Downloaded Notice -->
      <div
        v-else-if="isDownloaded"
        class="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4 text-[12.5px] leading-relaxed text-emerald-200"
      >
        <div class="flex items-start gap-2.5">
          <CheckCircle2 :size="16" class="mt-0.5 shrink-0 text-emerald-400" />
          <div class="space-y-1">
            <p class="font-medium text-emerald-100">GGSoundboard v{{ state.availableVersion }} has been downloaded</p>
            <p class="text-[12px] text-emerald-300/80">
              The application will restart to apply the update. Your sounds, settings, shortcuts, and collections are completely preserved.
            </p>
          </div>
        </div>
      </div>

      <!-- Release Notes (if available) -->
      <div v-if="formattedReleaseNotes" class="space-y-2">
        <p class="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Release Notes</p>
        <div class="max-h-48 overflow-y-auto rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 text-[12.5px] leading-relaxed text-ink-300 whitespace-pre-wrap font-sans">
          {{ formattedReleaseNotes }}
        </div>
      </div>
      <div v-else-if="isAvailable" class="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-[12px] text-ink-400">
        A new version of GGSoundboard with performance improvements, bug fixes, and stability enhancements is ready to download.
      </div>

      <!-- Audio Playback Safety Note -->
      <p class="text-[11px] text-ink-500 leading-snug">
        Updates will never interrupt playing sounds. You can download in the background and choose when to restart.
      </p>

      <!-- Action Buttons -->
      <div class="flex items-center justify-end gap-2.5 pt-2 border-t border-white/[0.06]">
        <!-- Later button -->
        <button
          type="button"
          class="btn-outline text-[12.5px] h-9 px-4"
          @click="closeModal"
        >
          {{ isDownloaded ? 'Later' : 'Dismiss' }}
        </button>

        <!-- Retry check if error -->
        <button
          v-if="isError"
          type="button"
          class="btn-primary text-[12.5px] h-9 px-4 gap-1.5"
          @click="checkForUpdates(true)"
        >
          <RefreshCw :size="14" /> Retry
        </button>

        <!-- Download button -->
        <button
          v-else-if="isAvailable"
          type="button"
          class="btn-primary text-[12.5px] h-9 px-4 gap-1.5"
          @click="downloadUpdate"
        >
          <Download :size="14" /> Download Update
        </button>

        <!-- Restart & Install button -->
        <button
          v-else-if="isDownloaded"
          type="button"
          class="btn-primary text-[12.5px] h-9 px-4 gap-1.5 !bg-emerald-600 hover:!bg-emerald-500"
          @click="installUpdate"
        >
          <RotateCcw :size="14" /> Restart & Install
        </button>
      </div>
    </div>
  </UiModal>
</template>
