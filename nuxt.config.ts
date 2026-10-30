// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  // The app is a local, client-only SPA. It runs inside Electron (preferred, gives
  // global hotkeys + file storage) or in any Chromium browser as a fallback.
  ssr: false,
  devtools: { enabled: false },
  modules: ['@nuxtjs/tailwindcss'],
  css: ['~/assets/css/main.css'],
  tailwindcss: { cssPath: '~/assets/css/main.css', viewer: false },
  app: {
    baseURL: '/',
    buildAssetsDir: '/_nuxt/',
    head: {
      title: 'GGSoundboard',
      htmlAttrs: { lang: 'en', class: 'dark' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'color-scheme', content: 'dark' },
      ],
    },
  },
  typescript: { strict: true },
})
