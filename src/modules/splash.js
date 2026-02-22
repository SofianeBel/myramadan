/**
 * splash.js — Splash screen with timed transition
 */

/**
 * Initialize splash screen. Hides after 2.5s and reveals the app.
 * @returns {Promise<void>} Resolves when splash is hidden and app is ready.
 */
export function initSplash() {
  return new Promise((resolve) => {
    const splashScreen = document.getElementById('splash-screen')
    const appContainer = document.querySelector('.app-container')

    if (!splashScreen) {
      resolve()
      return
    }

    setTimeout(() => {
      splashScreen.classList.add('hidden')

      setTimeout(() => {
        if (appContainer) appContainer.classList.add('app-ready')
        resolve()
      }, 300)
    }, 2500)
  })
}
