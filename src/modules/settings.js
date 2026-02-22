/**
 * settings.js — Mosque search via Mawaqit + Map with Leaflet + location settings
 */

import { searchMosques, searchMosquesByLocation } from './prayer-times.js'
import { loadPrefs, savePrefs, stopAdhan, previewAdhan } from './notifications.js'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Fix Leaflet default marker icon paths for Vite bundler
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
})

const MOSQUE_SLUG_KEY = 'mosqueSlug'
const MOSQUE_NAME_KEY = 'mosqueName'
const CITY_KEY = 'userCity'
const COUNTRY_KEY = 'userCountry'

let debounceTimer = null

// ─── Map state (singleton) ──────────────────────────────────────
let mapInstance = null
let markersLayer = null
let userMarker = null
let userCoords = null // { lat, lon } cached after first geolocation

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

  // Helper to update selection label (shared between list & map)
  function updateSelectionLabel(name) {
    if (selectedLabel) {
      selectedLabel.textContent = `✓ ${name}`
      selectedLabel.style.opacity = '1'
      selectedLabel.style.color = 'var(--clr-emerald, #2ecc71)'
    }
  }

  // ── Tab Switching ──
  const tabButtons = document.querySelectorAll('.settings-tab')
  const tabList = document.getElementById('tab-list')
  const tabMap = document.getElementById('tab-map')
  const tabNotifs = document.getElementById('tab-notifs')

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabButtons.forEach((b) => b.classList.remove('active'))
      btn.classList.add('active')

      const tab = btn.dataset.tab
      if (tabList) tabList.classList.toggle('hidden', tab !== 'list')
      if (tabMap) tabMap.classList.toggle('hidden', tab !== 'map')
      if (tabNotifs) tabNotifs.classList.toggle('hidden', tab !== 'notifs')

      if (tab === 'map') initMap()
      if (tab === 'notifs') populateNotifSettings()
    })
  })

  // ── Open modal ──
  settingsBtn.addEventListener('click', (e) => {
    e.preventDefault()
    pendingSlug = getMosqueSlug()
    pendingName = getMosqueName()

    // Reset to list tab
    tabButtons.forEach((b) => b.classList.remove('active'))
    tabButtons[0]?.classList.add('active')
    if (tabList) tabList.classList.remove('hidden')
    if (tabMap) tabMap.classList.add('hidden')
    if (tabNotifs) tabNotifs.classList.add('hidden')

    // Pre-fill
    if (searchInput) searchInput.value = ''
    if (resultsContainer) resultsContainer.innerHTML = ''
    if (selectedLabel) {
      selectedLabel.textContent = pendingName || 'Aucune mosquée sélectionnée'
      selectedLabel.style.opacity = pendingName ? '1' : '0.5'
      selectedLabel.style.color = ''
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

          item.addEventListener('mouseenter', () => {
            item.style.background = 'var(--clr-sand-dark, rgba(255,255,255,0.1))'
          })
          item.addEventListener('mouseleave', () => {
            item.style.background = 'transparent'
          })

          item.addEventListener('click', () => {
            pendingSlug = mosque.slug
            pendingName = mosque.name
            updateSelectionLabel(mosque.name)
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

  // ─── Map Functions (inside initSettings closure for pendingSlug/pendingName access) ───

  function initMap() {
    const container = document.getElementById('mosque-map')
    if (!container) return

    if (!mapInstance) {
      mapInstance = L.map('mosque-map', {
        zoomControl: true,
        attributionControl: false,
      }).setView([48.8566, 2.3522], 13)

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
      }).addTo(mapInstance)

      markersLayer = L.layerGroup().addTo(mapInstance)

      // Search-as-you-pan with debounce
      let mapSearchTimer = null
      mapInstance.on('moveend', () => {
        if (mapSearchTimer) clearTimeout(mapSearchTimer)
        mapSearchTimer = setTimeout(() => {
          const center = mapInstance.getCenter()
          loadNearbyMosques(center.lat, center.lng)
        }, 800)
      })
    }

    // Recalculate tiles when container becomes visible
    setTimeout(() => mapInstance.invalidateSize(), 150)

    // Get user position
    getUserLocation()
  }

  function getUserLocation() {
    if (userCoords) {
      centerMapOnUser(userCoords.lat, userCoords.lon)
      return
    }

    if (!navigator.geolocation) {
      console.warn('[settings] Geolocation not available')
      loadNearbyMosques(48.8566, 2.3522)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude
        const lon = position.coords.longitude
        userCoords = { lat, lon }
        centerMapOnUser(lat, lon)
      },
      (error) => {
        console.warn('[settings] Geolocation error:', error.message)
        loadNearbyMosques(48.8566, 2.3522)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  function centerMapOnUser(lat, lon) {
    if (!mapInstance) return

    mapInstance.setView([lat, lon], 14)

    // Remove old user marker
    if (userMarker) mapInstance.removeLayer(userMarker)

    // Blue pulsing dot for user location
    const userIcon = L.divIcon({
      className: 'user-location-marker',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    })

    userMarker = L.marker([lat, lon], { icon: userIcon, zIndexOffset: 1000 })
      .addTo(mapInstance)
      .bindPopup('<strong>Vous êtes ici</strong>')

    loadNearbyMosques(lat, lon)
  }

  async function loadNearbyMosques(lat, lon) {
    if (!markersLayer) return

    markersLayer.clearLayers()

    const mosques = await searchMosquesByLocation(lat, lon)

    if (mosques.length === 0) return

    mosques.forEach((mosque) => {
      if (!mosque.latitude || !mosque.longitude) return

      // Custom green mosque marker
      const mosqueIcon = L.divIcon({
        className: 'mosque-marker',
        html: '<i class="fa-solid fa-mosque"></i>',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      })

      const marker = L.marker([mosque.latitude, mosque.longitude], { icon: mosqueIcon })
        .addTo(markersLayer)

      const distanceText = mosque.proximity
        ? `<div style="font-size: 0.75rem; color: #D4AF37; font-weight: 600; margin-bottom: 8px;">
            <i class="fa-solid fa-route" style="margin-right: 4px;"></i>${(mosque.proximity / 1000).toFixed(1)} km
           </div>`
        : ''

      marker.bindPopup(`
        <div style="font-family: 'Outfit', sans-serif; min-width: 200px;">
          <div style="font-weight: 700; font-size: 0.95rem; margin-bottom: 4px; color: #1A4D2E;">${mosque.name}</div>
          <div style="font-size: 0.78rem; color: #666; margin-bottom: 6px;">${mosque.localisation || ''}</div>
          ${distanceText}
          <button class="map-select-btn" data-slug="${mosque.slug}" data-name="${mosque.name}"
            style="padding: 8px 14px; background: #1A4D2E; color: white; border: none;
                   border-radius: 8px; font-family: inherit; font-weight: 600;
                   font-size: 0.85rem; cursor: pointer; width: 100%; transition: background 0.2s;">
            <i class="fa-solid fa-check" style="margin-right: 4px;"></i>Sélectionner
          </button>
        </div>
      `, { maxWidth: 250 })

      // Handle "Sélectionner" click inside popup
      marker.on('popupopen', () => {
        setTimeout(() => {
          const selectBtn = document.querySelector('.map-select-btn')
          if (selectBtn) {
            selectBtn.addEventListener('click', () => {
              pendingSlug = selectBtn.dataset.slug
              pendingName = selectBtn.dataset.name
              updateSelectionLabel(selectBtn.dataset.name)
              marker.closePopup()
            })
          }
        }, 10)
      })
    })
  }

  // ─── Notification Settings (inside initSettings closure) ─────

  let notifSettingsInitialized = false

  function populateNotifSettings() {
    const prefs = loadPrefs()

    // Master toggle
    const enabledEl = document.getElementById('notif-enabled')
    if (enabledEl) {
      enabledEl.checked = prefs.enabled
      enabledEl.onchange = () => {
        prefs.enabled = enabledEl.checked
        savePrefs(prefs)
      }
    }

    // Advance minutes
    const advanceEl = document.getElementById('notif-advance')
    if (advanceEl) {
      advanceEl.value = String(prefs.advanceMinutes)
      advanceEl.onchange = () => {
        prefs.advanceMinutes = parseInt(advanceEl.value, 10)
        savePrefs(prefs)
      }
    }

    // Adhan regular
    const adhanRegularEl = document.getElementById('notif-adhan-regular')
    if (adhanRegularEl) {
      adhanRegularEl.value = prefs.adhanRegular
      adhanRegularEl.onchange = () => {
        prefs.adhanRegular = adhanRegularEl.value
        savePrefs(prefs)
      }
    }

    // Adhan Fajr
    const adhanFajrEl = document.getElementById('notif-adhan-fajr')
    if (adhanFajrEl) {
      adhanFajrEl.value = prefs.adhanFajr
      adhanFajrEl.onchange = () => {
        prefs.adhanFajr = adhanFajrEl.value
        savePrefs(prefs)
      }
    }

    // Iftar toggle
    const iftarEl = document.getElementById('notif-iftar')
    if (iftarEl) {
      iftarEl.checked = prefs.iftarNotification
      iftarEl.onchange = () => {
        prefs.iftarNotification = iftarEl.checked
        savePrefs(prefs)
      }
    }

    // Suhoor toggle
    const suhoorEl = document.getElementById('notif-suhoor')
    if (suhoorEl) {
      suhoorEl.checked = prefs.suhoorNotification
      suhoorEl.onchange = () => {
        prefs.suhoorNotification = suhoorEl.checked
        savePrefs(prefs)
      }
    }

    // Per-prayer toggles
    const gridEl = document.getElementById('notif-prayer-toggles')
    if (gridEl) {
      gridEl.innerHTML = ''
      const prayerNames = { Fajr: 'Fajr', Dhuhr: 'Dhuhr', Asr: 'Asr', Maghrib: 'Maghrib', Isha: 'Isha' }

      for (const [key, label] of Object.entries(prayerNames)) {
        const item = document.createElement('div')
        item.className = 'notif-prayer-item'
        item.innerHTML = `
          <span>${label}</span>
          <label class="notif-toggle">
            <input type="checkbox" ${prefs.perPrayer[key] ? 'checked' : ''} data-prayer="${key}">
            <span class="notif-toggle-slider"></span>
          </label>
        `
        item.querySelector('input').onchange = (e) => {
          prefs.perPrayer[key] = e.target.checked
          savePrefs(prefs)
        }
        gridEl.appendChild(item)
      }
    }

    // Test sound button (only bind once)
    if (!notifSettingsInitialized) {
      const testBtn = document.getElementById('notif-test')
      if (testBtn) {
        testBtn.addEventListener('click', () => {
          stopAdhan()
          const currentPrefs = loadPrefs()
          const key = currentPrefs.adhanRegular !== 'none' ? currentPrefs.adhanRegular : 'makkah'
          previewAdhan(key)
        })
      }
      notifSettingsInitialized = true
    }
  }
}
