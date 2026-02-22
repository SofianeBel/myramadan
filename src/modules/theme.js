/**
 * theme.js — Dark/Light theme toggle with localStorage persistence
 */

/**
 * Initialize theme from saved preference and set up toggle.
 */
export function initTheme() {
  const themeToggle = document.getElementById('theme-toggle')
  const rootElement = document.documentElement

  // Restore saved theme (default: dark)
  const savedTheme = localStorage.getItem('theme') || 'dark'
  rootElement.setAttribute('data-theme', savedTheme)
  updateThemeIcon(savedTheme === 'dark')

  if (themeToggle) {
    themeToggle.addEventListener('click', (e) => {
      e.preventDefault()
      const currentTheme = rootElement.getAttribute('data-theme')
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark'

      rootElement.setAttribute('data-theme', newTheme)
      localStorage.setItem('theme', newTheme)
      updateThemeIcon(newTheme === 'dark')
    })
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
