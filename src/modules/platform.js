// src/modules/platform.js — Détection de plateforme (Tauri desktop/mobile)

const ua = navigator.userAgent

export const isAndroid = /Android/i.test(ua)
export const isIOS = /iPhone|iPad|iPod/i.test(ua)
export const isMobile = isAndroid || isIOS
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
