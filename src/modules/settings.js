/**
 * settings.js — Mosque search via Mawaqit + location settings
 */

import { searchMosques } from './prayer-times.js'

const MOSQUE_SLUG_KEY = 'mosqueSlug'
const MOSQUE_NAME_KEY = 'mosqueName'
const CITY_KEY = 'userCity'
const COUNTRY_KEY = 'userCountry'

let debounceTimer = null

// ─── Getters ─────────────────────────────────────────────────────

/** Get saved mosque slug or null */
export function getMosqueSlug() {
  return localStorage.getItem(MOSQUE_SLUG_KEY) || null
}

/** Get saved mosque display name or null */
export function getMosqueName() {
  return localStorage.getItem(MOSQUE_NAME_KEY) || null
}

/** Get saved city (fallback for Aladhan) */
export function getCity() {
  return localStorage.getItem(CITY_KEY) || 'Paris'
}

/** Get saved country (fallback for Aladhan) */
export function getCountry() {
  return localStorage.getItem(COUNTRY_KEY) || 'France'
}

// ─── Setters ─────────────────────────────────────────────────────

/** Save mosque selection */
export function saveMosque(slug, name) {
  localStorage.setItem(MOSQUE_SLUG_KEY, slug)
  localStorage.setItem(MOSQUE_NAME_KEY, name)
}

/** Save city/country (used for Aladhan hijri date fallback) */
export function saveLocation(city, country) {
  localStorage.setItem(CITY_KEY, city)
  localStorage.setItem(COUNTRY_KEY, country)
}

// ─── Display ─────────────────────────────────────────────────────

/** Update location in header */
export function updateLocationDisplay() {
  const locationSpan = document.querySelector('.location span')
  if (!locationSpan) return

  const mosqueName = getMosqueName()
  if (mosqueName) {
    locationSpan.textContent = mosqueName
  } else {
    locationSpan.textContent = `${getCity()}, ${getCountry()}`
  }
}

// ─── Settings Modal ──────────────────────────────────────────────

/**
 * Initialize the settings modal.
 * @param {Function} onSave - (mosqueSlug|null) => void
 */
export function initSettings(onSave) {
  const settingsBtn = document.getElementById('settings-btn')
  const modal = document.getElementById('settings-modal')
  const searchInput = document.getElementById('settings-mosque-search')
  const resultsContainer = document.getElementById('mosque-results')
  const selectedLabel = document.getElementById('selected-mosque-name')
  const saveBtn = document.getElementById('settings-save')
  const cancelBtn = document.getElementById('settings-cancel')

  if (!settingsBtn || !modal) return

  let pendingSlug = getMosqueSlug()
  let pendingName = getMosqueName()

  // ── Open modal ──
  settingsBtn.addEventListener('click', (e) => {
    e.preventDefault()
    pendingSlug = getMosqueSlug()
    pendingName = getMosqueName()

    // Pre-fill
    if (searchInput) searchInput.value = ''
    if (resultsContainer) resultsContainer.innerHTML = ''
    if (selectedLabel) {
      selectedLabel.textContent = pendingName || 'Aucune mosquée sélectionnée'
      selectedLabel.style.opacity = pendingName ? '1' : '0.5'
    }

    modal.classList.remove('hidden')
  })

  // ── Mosque search with debounce ──
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const query = searchInput.value.trim()

      if (debounceTimer) clearTimeout(debounceTimer)

      if (query.length < 2) {
        if (resultsContainer) resultsContainer.innerHTML = ''
        return
      }

      debounceTimer = setTimeout(async () => {
        if (resultsContainer) {
          resultsContainer.innerHTML = '<p style="padding: 8px; opacity: 0.5; font-size: 0.85rem;">Recherche...</p>'
        }

        const mosques = await searchMosques(query)

        if (!resultsContainer) return

        if (mosques.length === 0) {
          resultsContainer.innerHTML = '<p style="padding: 8px; opacity: 0.5; font-size: 0.85rem;">Aucun résultat</p>'
          return
        }

        resultsContainer.innerHTML = ''
        mosques.slice(0, 8).forEach((mosque) => {
          const item = document.createElement('div')
          item.className = 'mosque-result-item'
          item.style.cssText = `
            padding: 10px 12px;
            cursor: pointer;
            border-radius: 6px;
            transition: background 0.2s;
            border-bottom: 1px solid var(--clr-sand-dark, rgba(255,255,255,0.1));
          `

          item.innerHTML = `
            <div style="font-weight: 600; font-size: 0.9rem; color: var(--text-main);">${mosque.name}</div>
            <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">${mosque.localisation || ''}</div>
          `

          // Hover effect
          item.addEventListener('mouseenter', () => {
            item.style.background = 'var(--clr-sand-dark, rgba(255,255,255,0.1))'
          })
          item.addEventListener('mouseleave', () => {
            item.style.background = 'transparent'
          })

          // Click → select mosque
          item.addEventListener('click', () => {
            pendingSlug = mosque.slug
            pendingName = mosque.name

            if (selectedLabel) {
              selectedLabel.textContent = `✓ ${mosque.name}`
              selectedLabel.style.opacity = '1'
              selectedLabel.style.color = 'var(--clr-emerald, #2ecc71)'
            }

            resultsContainer.innerHTML = ''
            searchInput.value = ''
          })

          resultsContainer.appendChild(item)
        })
      }, 400)
    })
  }

  // ── Cancel ──
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      modal.classList.add('hidden')
    })
  }

  // ── Save ──
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      if (pendingSlug && pendingName) {
        saveMosque(pendingSlug, pendingName)
      }

      updateLocationDisplay()
      modal.classList.add('hidden')

      if (typeof onSave === 'function') {
        onSave(pendingSlug)
      }
    })
  }

  // ── Close on overlay click ──
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.add('hidden')
    }
  })
}
