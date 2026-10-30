<script setup lang="ts">
const { ui } = useUi()
function confirm() {
  const c = ui.confirm
  ui.confirm = null
  c?.onConfirm()
}
</script>

<template>
  <UiModal :open="!!ui.confirm" width="max-w-[380px]" @close="ui.confirm = null">
    <div v-if="ui.confirm" class="p-5">
      <h2 class="text-[14px] font-semibold text-ink-100">{{ ui.confirm.title }}</h2>
      <p class="mt-1.5 text-[12.5px] leading-relaxed text-ink-400">{{ ui.confirm.message }}</p>
    </div>
    <template #footer>
      <button class="btn" @click="ui.confirm = null">Cancel</button>
      <button class="btn-danger" autofocus @click="confirm">{{ ui.confirm?.action }}</button>
    </template>
  </UiModal>
</template>
