/**
 * theme.js — Dark/Light theme toggle with persistent storage
 */

import storage from './storage.js'

/**
 * Initialize theme from saved preference and set up toggle.
 */
export function initTheme() {
  const themeToggle = document.getElementById('theme-toggle')
  const rootElement = document.documentElement

  // Restore saved theme (default: dark)
  const savedTheme = storage.get('theme') || 'dark'
  rootElement.setAttribute('data-theme', savedTheme)
  updateThemeIcon(savedTheme === 'dark')
  syncStatusBar(savedTheme)

  if (themeToggle) {
    themeToggle.addEventListener('click', (e) => {
      e.preventDefault()
      const currentTheme = rootElement.getAttribute('data-theme')
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark'

      rootElement.setAttribute('data-theme', newTheme)
      storage.set('theme', newTheme)
      updateThemeIcon(newTheme === 'dark')
      syncStatusBar(newTheme)
    })
  }
}

/**
 * Update Android status bar icon colors to match the app theme.
 * Uses the JavascriptInterface bridge injected by MainActivity.
 */
function syncStatusBar(theme) {
  if (typeof window.AndroidStatusBar !== 'undefined') {
    window.AndroidStatusBar.setTheme(theme)
  }
}

function updateThemeIcon(isDark) {
  const themeToggle = document.getElementById('theme-toggle')
  if (!themeToggle) return

  const icon = themeToggle.querySelector('i')
  const text = themeToggle.querySelector('span')

  if (isDark) {
    icon.classList.remove('fa-moon')
    icon.classList.add('fa-sun')
    text.textContent = 'Mode Clair'
  } else {
    icon.classList.remove('fa-sun')
    icon.classList.add('fa-moon')
    text.textContent = 'Mode Sombre'
  }
}
