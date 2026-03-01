// src/modules/platform.js — Détection de plateforme (Tauri desktop/mobile)

const ua = navigator.userAgent
const isTauriApp = '__TAURI_INTERNALS__' in window

export const isAndroid = /Android/i.test(ua) || (isTauriApp && /android/i.test(ua))
export const isMobile = isAndroid
export const isDesktop = !isMobile

/**
 * Applique la classe CSS de plateforme sur <html>.
 * À appeler une fois au démarrage (avant le rendu).
 */
export function applyPlatformClass() {
  if (isAndroid) {
    document.documentElement.classList.add('platform-android')
  } else {
    document.documentElement.classList.add('platform-desktop')
  }
}
