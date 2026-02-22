/**
 * settings.js — Mosque search via Mawaqit + Map with Leaflet + location settings
 */

import { searchMosques, searchMosquesByLocation } from './prayer-times.js'
import { loadPrefs, savePrefs, stopAdhan, previewAdhan } from './notifications.js'
import { enable as enableAutostart, disable as disableAutostart, isEnabled as isAutostartEnabled } from '@tauri-apps/plugin-autostart'
import storage from './storage.js'
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
const LAT_KEY = 'userLat'
const LON_KEY = 'userLon'
const CALC_METHOD_KEY = 'calculationMethod'
const DEFAULT_METHOD = 12 // UOIF

const VALID_METHODS = [1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15]

/**
 * Calculation methods list.
 * `angles` (optional): real Fajr/Isha angles to override Aladhan's incorrect values.
 * When angles are set, buildAladhanUrl() uses method=99 + methodSettings.
 */
const CALCULATION_METHODS = [
  { id: 12, name: 'UOIF', desc: 'Union des Organisations Islamiques de France (15°/15°)', angles: { fajr: 15, isha: 15 } },
  { id: 3, name: 'MWL', desc: 'Ligue Islamique Mondiale (18°/17°)' },
  { id: 2, name: 'ISNA', desc: "Societe Islamique d'Amerique du Nord (15°/15°)" },
  { id: 5, name: 'Egypte', desc: "Autorite Generale Egyptienne d'Arpentage (19.5°/17.5°)" },
  { id: 4, name: 'Umm Al-Qura', desc: 'Universite Umm Al-Qura, La Mecque (18.5°/90 min)' },
  { id: 1, name: 'Karachi', desc: 'Universite des Sciences Islamiques, Karachi (18°/18°)' },
  { id: 7, name: 'Teheran', desc: "Institut de Geophysique, Universite de Teheran (17.7°/14°)" },
  { id: 8, name: 'Golfe', desc: 'Region du Golfe (19.5°/90 min)' },
  { id: 9, name: 'Koweit', desc: 'Koweit (18°/17.5°)' },
  { id: 10, name: 'Qatar', desc: 'Qatar (18°/90 min)' },
  { id: 11, name: 'Singapour', desc: 'Majlis Ugama Islam Singapura (20°/18°)' },
  { id: 13, name: 'DIYANET', desc: 'Direction des Affaires Religieuses, Turquie (18°/17°)' },
  { id: 14, name: 'Russie', desc: 'Administration Spirituelle des Musulmans de Russie' },
  { id: 15, name: 'Moonsighting', desc: 'Comite Moonsighting International (18°/18°)' },
]

let debounceTimer = null

// ─── Map state (singleton) ──────────────────────────────────────
let mapInstance = null
let markersLayer = null
let userMarker = null
let userCoords = null // { lat, lon } cached after first geolocation

// ─── Getters ─────────────────────────────────────────────────────

/** Get saved mosque slug or null */
export function getMosqueSlug() {
  return storage.get(MOSQUE_SLUG_KEY)
}

/** Get saved mosque display name or null */
export function getMosqueName() {
  return storage.get(MOSQUE_NAME_KEY)
}

/** Get saved city (fallback for Aladhan) */
export function getCity() {
  return storage.get(CITY_KEY) || 'Paris'
}

/** Get saved country (fallback for Aladhan) */
export function getCountry() {
  return storage.get(COUNTRY_KEY) || 'France'
}

/** Get saved calculation method (default: UOIF = 12) */
export function getCalculationMethod() {
  const val = storage.get(CALC_METHOD_KEY)
  if (val !== null && VALID_METHODS.includes(val)) return val
  return DEFAULT_METHOD
}

/** Save calculation method */
export function saveCalculationMethod(method) {
  storage.set(CALC_METHOD_KEY, method)
}

/**
 * Get custom angle overrides for the current method, if any.
 * Returns { fajr, isha } or null if Aladhan's built-in angles are correct.
 */
export function getMethodAngles() {
  const method = getCalculationMethod()
  const entry = CALCULATION_METHODS.find((m) => m.id === method)
  return entry?.angles || null
}

/** Get saved GPS coordinates or null */
export function getUserCoords() {
  const lat = storage.get(LAT_KEY)
  const lon = storage.get(LON_KEY)
  if (lat !== null && lon !== null) return { lat, lon }
  return null
}

/** Save GPS coordinates to persistent storage */
export function saveUserCoords(lat, lon) {
  storage.set(LAT_KEY, lat)
  storage.set(LON_KEY, lon)
  userCoords = { lat, lon }
}

/**
 * Request geolocation from the browser.
 * Persists coordinates on success. Silent fallback on failure.
 * Reuses cached coords if already available.
 * @returns {Promise<{ lat: number, lon: number } | null>}
 */
export function requestGeolocation() {
  // Reuse in-memory cache if available
  if (userCoords) return Promise.resolve(userCoords)

  // Reuse persisted coords
  const saved = getUserCoords()
  if (saved) {
    userCoords = saved
    return Promise.resolve(saved)
  }

  if (!navigator.geolocation) {
    console.warn('[settings] Geolocation not available')
    return Promise.resolve(null)
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude
        const lon = position.coords.longitude
        saveUserCoords(lat, lon)
        console.log(`[settings] Geolocation saved: ${lat}, ${lon}`)
        resolve({ lat, lon })
      },
      (error) => {
        console.warn('[settings] Geolocation denied:', error.message)
        resolve(null)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  })
}

// ─── Setters ─────────────────────────────────────────────────────

/** Save mosque selection */
export function saveMosque(slug, name) {
  storage.set(MOSQUE_SLUG_KEY, slug)
  storage.set(MOSQUE_NAME_KEY, name)
}

/** Save city/country (used for Aladhan hijri date fallback) */
export function saveLocation(city, country) {
  storage.set(CITY_KEY, city)
  storage.set(COUNTRY_KEY, country)
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
  const tabCalc = document.getElementById('tab-calc')

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabButtons.forEach((b) => b.classList.remove('active'))
      btn.classList.add('active')

      const tab = btn.dataset.tab
      if (tabList) tabList.classList.toggle('hidden', tab !== 'list')
      if (tabMap) tabMap.classList.toggle('hidden', tab !== 'map')
      if (tabNotifs) tabNotifs.classList.toggle('hidden', tab !== 'notifs')
      if (tabCalc) tabCalc.classList.toggle('hidden', tab !== 'calc')

      if (tab === 'map') initMap()
      if (tab === 'notifs') populateNotifSettings()
      if (tab === 'calc') populateCalcSettings()
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
    if (tabCalc) tabCalc.classList.add('hidden')

    // Pre-fill
    if (searchInput) searchInput.value = ''
    if (resultsContainer) resultsContainer.innerHTML = ''
    if (selectedLabel) {
      selectedLabel.textContent = pendingName || 'Aucune mosquée sélectionnée'
      selectedLabel.style.opacity = pendingName ? '1' : '0.5'
      selectedLabel.style.color = ''
    }

    // Clear mosque button visibility
    const clearMosqueBtn = document.getElementById('clear-mosque-btn')
    if (clearMosqueBtn) {
      clearMosqueBtn.style.display = pendingSlug ? 'inline-block' : 'none'
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

  // ── Clear mosque button ──
  const clearMosqueBtn = document.getElementById('clear-mosque-btn')
  if (clearMosqueBtn) {
    clearMosqueBtn.addEventListener('click', () => {
      pendingSlug = null
      pendingName = null
      storage.remove(MOSQUE_SLUG_KEY)
      storage.remove(MOSQUE_NAME_KEY)
      if (selectedLabel) {
        selectedLabel.textContent = 'Horaires calcules (aucune mosquee)'
        selectedLabel.style.opacity = '0.5'
        selectedLabel.style.color = ''
      }
      clearMosqueBtn.style.display = 'none'
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
        saveUserCoords(lat, lon)
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

    // Autostart toggle
    const autostartEl = document.getElementById('notif-autostart')
    if (autostartEl) {
      isAutostartEnabled().then((enabled) => {
        autostartEl.checked = enabled
      }).catch(() => {
        autostartEl.checked = false
      })

      autostartEl.onchange = async () => {
        try {
          if (autostartEl.checked) {
            await enableAutostart()
          } else {
            await disableAutostart()
          }
        } catch (err) {
          console.warn('[settings] Autostart toggle error:', err)
          autostartEl.checked = !autostartEl.checked
        }
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

  // ─── Calculation Method Settings (inside initSettings closure) ─────

  let calcSettingsPopulated = false

  function populateCalcSettings() {
    const methodSelect = document.getElementById('calc-method-select')
    const mosqueHint = document.getElementById('calc-mosque-hint')

    if (methodSelect) {
      // Populate options once
      if (!calcSettingsPopulated) {
        CALCULATION_METHODS.forEach((m) => {
          const opt = document.createElement('option')
          opt.value = m.id
          opt.textContent = `${m.name} — ${m.desc}`
          methodSelect.appendChild(opt)
        })
        calcSettingsPopulated = true
      }

      methodSelect.value = String(getCalculationMethod())

      methodSelect.onchange = () => {
        const newMethod = parseInt(methodSelect.value, 10)
        saveCalculationMethod(newMethod)
        // Invalidate Aladhan cache so next load fetches with new method
        storage.remove('prayerTimesCache')
      }
    }

    // Show/hide mosque hint
    if (mosqueHint) {
      mosqueHint.style.display = pendingSlug ? 'flex' : 'none'
    }
  }
}
