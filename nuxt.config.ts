// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  ssr: false,
  app: {
    head: {
      title: 'Vertex Horizon - Desktop & Mobile App',
      meta: [
        { name: 'description', content: 'Aplicación multiplataforma premium construida con Nuxt, PrimeVue y Tauri.' }
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap' }
      ]
    }
  },
  router: {
    options: {
      hashMode: true
    }
  },
  css: [
    'primeicons/primeicons.css',
    'leaflet/dist/leaflet.css',
    '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'
  ],
  modules: [
    '@primevue/nuxt-module'
  ],
  primevue: {
    options: {
      ripple: true,
      theme: {
        preset: 'Aura',
        options: {
          darkModeSelector: '.dark-mode'
        }
      }
    }
  }
})


