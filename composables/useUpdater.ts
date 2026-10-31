import { reactive, computed } from 'vue'
import type { UpdateInfo, UpdateProgress, UpdateStatusEvent } from '~/lib/types'

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

interface UpdaterState {
  status: UpdateStatus
  currentVersion: string
  availableVersion: string | null
  releaseName: string | null
  releaseNotes: string | null
  releaseDate: string | null
  progress: UpdateProgress | null
  errorMessage: string | null
  modalOpen: boolean
  lastCheckedAt: number | null
  initialized: boolean
}

const state = reactive<UpdaterState>({
  status: 'idle',
  currentVersion: '1.2.0',
  availableVersion: null,
  releaseName: null,
  releaseNotes: null,
  releaseDate: null,
  progress: null,
  errorMessage: null,
  modalOpen: false,
  lastCheckedAt: null,
  initialized: false,
})

export function useUpdater() {
  const sb = useSoundboard()

  function formatBytes(bytes: number) {
    if (!bytes || bytes <= 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
  }

  function formatSpeed(bytesPerSec: number) {
    if (!bytesPerSec || bytesPerSec <= 0) return '0 KB/s'
    return `${formatBytes(bytesPerSec)}/s`
  }

  function handleStatus(event: UpdateStatusEvent) {
    state.lastCheckedAt = Date.now()

    switch (event.event) {
      case 'checking-for-update':
        state.status = 'checking'
        state.errorMessage = null
        break

      case 'update-available': {
        state.status = 'available'
        state.availableVersion = event.info?.version ?? null
        state.releaseName = event.info?.releaseName ?? null
        state.releaseDate = event.info?.releaseDate ?? null
        if (event.info?.currentVersion) state.currentVersion = event.info.currentVersion

        // Format release notes if array or string
        const rawNotes = event.info?.releaseNotes
        if (Array.isArray(rawNotes)) {
          state.releaseNotes = rawNotes.map((n: any) => n.note || String(n)).join('\n')
        } else if (typeof rawNotes === 'string') {
          state.releaseNotes = rawNotes
        } else {
          state.releaseNotes = null
        }

        // Open update modal automatically when update is found
        state.modalOpen = true
        break
      }

      case 'update-not-available':
        state.status = 'not-available'
        if (event.info?.currentVersion) state.currentVersion = event.info.currentVersion
        break

      case 'download-progress':
        state.status = 'downloading'
        state.progress = event.progress ?? null
        break

      case 'update-downloaded':
        state.status = 'downloaded'
        state.progress = null
        state.availableVersion = event.info?.version ?? state.availableVersion
        state.modalOpen = true
        break

      case 'update-error':
        state.status = 'error'
        state.errorMessage = event.error?.message ?? 'An error occurred during update.'
        break
    }
  }

  async function init() {
    if (state.initialized) return
    state.initialized = true

    if (sb.native) {
      try {
        if (sb.native.getAppVersion) {
          const v = await sb.native.getAppVersion()
          if (v) state.currentVersion = v
        }
      } catch {
        /* ignore */
      }

      if (sb.native.onUpdaterStatus) {
        sb.native.onUpdaterStatus((status) => {
          handleStatus(status)
        })
      }
    }
  }

  async function checkForUpdates(manual = false) {
    if (!sb.native?.checkForUpdates) return
    state.status = 'checking'
    state.errorMessage = null
    if (manual) {
      // If manual check, we can show feedback in the UI
      state.lastCheckedAt = Date.now()
    }
    try {
      await sb.native.checkForUpdates()
    } catch (e: any) {
      state.status = 'error'
      state.errorMessage = e?.message || 'Failed to check for updates'
    }
  }

  async function downloadUpdate() {
    if (!sb.native?.downloadUpdate) return
    state.status = 'downloading'
    state.errorMessage = null
    try {
      await sb.native.downloadUpdate()
    } catch (e: any) {
      state.status = 'error'
      state.errorMessage = e?.message || 'Failed to download update'
    }
  }

  function installUpdate() {
    if (!sb.native?.installUpdate) return
    sb.native.installUpdate()
  }

  function closeModal() {
    state.modalOpen = false
  }

  function openModal() {
    state.modalOpen = true
  }

  const hasNewUpdate = computed(() => state.status === 'available' || state.status === 'downloading' || state.status === 'downloaded')

  return {
    state,
    hasNewUpdate,
    init,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    closeModal,
    openModal,
    formatBytes,
    formatSpeed,
  }
}
