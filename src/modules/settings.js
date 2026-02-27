/**
 * settings.js — Mosque search via Mawaqit + Map with Leaflet + location settings
 */

import { searchMosques, searchMosquesByLocation } from './prayer-times.js'
import { loadPrefs, savePrefs, stopAdhan, previewAdhan } from './notifications.js'
import { enable as enableAutostart, disable as disableAutostart, isEnabled as isAutostartEnabled } from '@tauri-apps/plugin-autostart'
import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import { open } from '@tauri-apps/plugin-shell'
import storage from './storage.js'
import { setAppMode } from './app-mode.js'
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

/**
 * Search cities via Nominatim (OpenStreetMap) for autocomplete.
 * @param {string} query
 * @returns {Promise<Array<{ name: string, display: string, lat: number, lon: number }>>}
 */
async function searchCities(query) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&accept-language=fr&addressdetails=1`
    const res = await tauriFetch(url, { method: 'GET' })
    if (!res.ok) return []
    const data = await res.json()
    if (!data || data.length === 0) return []
    return data.map((item) => {
      const addr = item.address || {}
      const city = addr.city || addr.town || addr.village || addr.municipality || ''
      const state = addr.state || ''
      const country = addr.country || ''
      const parts = [city, state, country].filter(Boolean)
      return {
        name: city || item.display_name.split(',')[0],
        display: parts.join(', ') || item.display_name,
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
      }
    })
  } catch (err) {
    console.warn('[settings] City search failed:', err.message)
    return []
  }
}

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
 * Affiche un bandeau d'avertissement sur la localisation.
 * @param {'approximate' | 'missing'} type
 */
function showLocationWarning(type) {
  const warning = document.getElementById('location-warning')
  const text = document.getElementById('location-warning-text')
  const btn = document.getElementById('location-warning-btn')
  if (!warning || !text) return

  if (type === 'approximate') {
    text.textContent = 'Position approximative (dernière localisation connue)'
  } else if (type === 'missing') {
    text.textContent = 'Position non détectée — sélectionnez une mosquée ou ville'
  }

  warning.classList.remove('hidden')

  if (btn) {
    btn.addEventListener('click', () => {
      document.getElementById('settings-btn')?.click()
    }, { once: true })
  }
}

/** Cache le bandeau d'avertissement sur la localisation */
function hideLocationWarning() {
  const warning = document.getElementById('location-warning')
  if (warning) warning.classList.add('hidden')
}

/**
 * Request geolocation from the browser.
 * Persists coordinates on success. Shows warning on failure.
 * Reuses cached coords if already available.
 * @returns {Promise<{ lat: number, lon: number } | null>}
 */
export function requestGeolocation() {
  // Reuse in-memory cache if available
  if (userCoords) return Promise.resolve(userCoords)

  // Reuse persisted coords (scenario 2 — position approximative)
  const saved = getUserCoords()
  if (saved) {
    userCoords = saved
    // N'afficher le warning que si aucune mosquée n'est configurée
    if (!getMosqueSlug()) showLocationWarning('approximate')
    return Promise.resolve(saved)
  }

  if (!navigator.geolocation) {
    console.warn('[settings] Geolocation not available')
    if (!getMosqueSlug()) showLocationWarning('missing')
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
        // Scenario 3 — pas de coords sauvegardées et pas de mosquée
        if (!getMosqueSlug()) showLocationWarning('missing')
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

// ─── Auto-detection mosquée au premier lancement ────────────────

const MOSQUE_AUTO_DETECTED_KEY = 'mosqueAutoDetected'
const AUTO_SELECT_MAX_DISTANCE = 20_000 // 20 km en mètres

/**
 * Auto-detect and select the nearest mosque on first launch.
 * Returns { slug, name, distance } if a mosque was selected, null otherwise.
 */
export async function autoSelectNearestMosque() {
  // Déjà une mosquée configurée → skip
  if (getMosqueSlug()) return null

  // Auto-détection déjà tentée (même si rien trouvé) → skip
  if (storage.get(MOSQUE_AUTO_DETECTED_KEY)) return null

  // Marquer comme tenté immédiatement (empêche les re-runs)
  storage.set(MOSQUE_AUTO_DETECTED_KEY, true)

  const coords = getUserCoords()
  if (!coords) return null

  try {
    // Timeout 4s pour ne pas bloquer le démarrage
    const mosques = await Promise.race([
      searchMosquesByLocation(coords.lat, coords.lon),
      new Promise(resolve => setTimeout(() => resolve([]), 4000))
    ])

    if (!mosques || mosques.length === 0) return null

    const nearest = mosques[0] // Déjà trié par proximité

    if (nearest.proximity && nearest.proximity > AUTO_SELECT_MAX_DISTANCE) return null

    saveMosque(nearest.slug, nearest.name)

    return {
      slug: nearest.slug,
      name: nearest.name,
      distance: nearest.proximity || null,
    }
  } catch {
    return null
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

      if (tab === 'map') {
        shouldFlyToSelected = true
        initMap()
      }
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

  // ── Render mosque results list (shared between text search and geo fallback) ──
  function renderMosqueResults(mosques, container, { showDistance = false } = {}) {
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

      const nameDiv = document.createElement('div')
      nameDiv.style.cssText = 'font-weight: 600; font-size: 0.9rem; color: var(--text-main);'
      nameDiv.textContent = mosque.name

      const locDiv = document.createElement('div')
      locDiv.style.cssText = 'font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;'
      const locText = mosque.localisation || ''
      if (showDistance && mosque.proximity) {
        const distKm = (mosque.proximity / 1000).toFixed(1)
        locDiv.textContent = locText ? `${locText} — ${distKm} km` : `${distKm} km`
      } else {
        locDiv.textContent = locText
      }

      item.appendChild(nameDiv)
      item.appendChild(locDiv)

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
        container.textContent = ''
        if (searchInput) searchInput.value = ''
      })

      container.appendChild(item)
    })
  }

  // ── Render city suggestions (Nominatim autocomplete fallback) ──
  function renderCitySuggestions(cities, container) {
    cities.forEach((city) => {
      const item = document.createElement('div')
      item.className = 'mosque-result-item'
      item.style.cssText = `
        padding: 10px 12px;
        cursor: pointer;
        border-radius: 6px;
        transition: background 0.2s;
        border-bottom: 1px solid var(--clr-sand-dark, rgba(255,255,255,0.1));
        display: flex;
        align-items: center;
        gap: 10px;
      `

      const icon = document.createElement('i')
      icon.className = 'fa-solid fa-location-dot'
      icon.style.cssText = 'color: var(--clr-emerald, #2ecc71); font-size: 1rem; flex-shrink: 0;'

      const textWrap = document.createElement('div')

      const nameDiv = document.createElement('div')
      nameDiv.style.cssText = 'font-weight: 600; font-size: 0.9rem; color: var(--text-main);'
      nameDiv.textContent = city.name

      const displayDiv = document.createElement('div')
      displayDiv.style.cssText = 'font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;'
      displayDiv.textContent = city.display

      textWrap.appendChild(nameDiv)
      textWrap.appendChild(displayDiv)

      item.appendChild(icon)
      item.appendChild(textWrap)

      item.addEventListener('mouseenter', () => {
        item.style.background = 'var(--clr-sand-dark, rgba(255,255,255,0.1))'
      })
      item.addEventListener('mouseleave', () => {
        item.style.background = 'transparent'
      })

      item.addEventListener('click', async () => {
        // Chercher les mosquées proches de cette ville
        container.textContent = ''
        const loading = document.createElement('p')
        loading.style.cssText = 'padding: 8px; opacity: 0.5; font-size: 0.85rem;'
        loading.textContent = `Recherche près de ${city.name}...`
        container.appendChild(loading)

        const nearby = await searchMosquesByLocation(city.lat, city.lon)

        container.textContent = ''

        if (nearby.length > 0) {
          const hint = document.createElement('p')
          hint.style.cssText = 'padding: 8px 8px 4px; font-size: 0.82rem; color: var(--text-muted);'
          hint.textContent = `Mosquées proches de ${city.name} :`
          container.appendChild(hint)
          renderMosqueResults(nearby, container, { showDistance: true })
        } else {
          const noResult = document.createElement('p')
          noResult.style.cssText = 'padding: 8px; opacity: 0.5; font-size: 0.85rem;'
          noResult.textContent = `Aucune mosquée trouvée près de ${city.name}`
          container.appendChild(noResult)
        }
      })

      container.appendChild(item)
    })
  }

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
          resultsContainer.textContent = ''
          const loadingMsg = document.createElement('p')
          loadingMsg.style.cssText = 'padding: 8px; opacity: 0.5; font-size: 0.85rem;'
          loadingMsg.textContent = 'Recherche...'
          resultsContainer.appendChild(loadingMsg)
        }

        // Lancer Mawaqit + Nominatim en parallèle
        const [mosques, cities] = await Promise.all([
          searchMosques(query),
          searchCities(query),
        ])

        if (!resultsContainer) return
        resultsContainer.textContent = ''

        // 1) Mosquées Mawaqit
        if (mosques.length > 0) {
          renderMosqueResults(mosques, resultsContainer, { showDistance: false })
        }

        // 2) Suggestions de villes (toujours affichées si trouvées)
        if (cities.length > 0) {
          if (mosques.length > 0) {
            // Séparateur visuel
            const divider = document.createElement('div')
            divider.style.cssText = 'border-top: 1px solid var(--clr-sand-dark, rgba(255,255,255,0.1)); margin: 8px 0;'
            resultsContainer.appendChild(divider)

            const hint = document.createElement('p')
            hint.style.cssText = 'padding: 4px 8px; font-size: 0.82rem; color: var(--text-muted);'
            hint.textContent = 'Ou rechercher par ville :'
            resultsContainer.appendChild(hint)
          } else {
            const hint = document.createElement('p')
            hint.style.cssText = 'padding: 4px 8px; font-size: 0.82rem; color: var(--text-muted);'
            hint.textContent = 'Rechercher par ville :'
            resultsContainer.appendChild(hint)
          }
          renderCitySuggestions(cities, resultsContainer)
        }

        // 3) Aucun résultat des deux côtés
        if (mosques.length === 0 && cities.length === 0) {
          const noResult = document.createElement('p')
          noResult.style.cssText = 'padding: 8px; opacity: 0.5; font-size: 0.85rem;'
          noResult.textContent = 'Aucun résultat'
          resultsContainer.appendChild(noResult)
        }
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
      } else if (!pendingSlug) {
        storage.remove(MOSQUE_SLUG_KEY)
        storage.remove(MOSQUE_NAME_KEY)
      }

      hideLocationWarning()
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

  const mosquesCache = new Map() // slug → L.Marker
  let shouldFlyToSelected = false

  function initMap() {
    const container = document.getElementById('mosque-map')
    if (!container) return

    if (!mapInstance) {
      // Vue initiale : coords sauvegardées ou vue monde
      const savedCoords = getUserCoords()
      const initCenter = savedCoords ? [savedCoords.lat, savedCoords.lon] : [30, 10]
      const initZoom = savedCoords ? 13 : 3

      mapInstance = L.map('mosque-map', {
        zoomControl: true,
        attributionControl: false,
      }).setView(initCenter, initZoom)

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
      }).addTo(mapInstance)

      markersLayer = L.layerGroup().addTo(mapInstance)

      // Search-as-you-pan with debounce
      let mapSearchTimer = null
      let lastSearchCenter = null

      mapInstance.on('moveend', () => {
        if (mapSearchTimer) clearTimeout(mapSearchTimer)
        mapSearchTimer = setTimeout(() => {
          const center = mapInstance.getCenter()

          if (lastSearchCenter) {
            // Seuil proportionnel : re-fetch si le centre a bougé de >30% de la largeur visible
            const bounds = mapInstance.getBounds()
            const viewWidth = bounds.getNorthEast().distanceTo(bounds.getNorthWest())
            const dist = mapInstance.distance(lastSearchCenter, center)
            if (dist < viewWidth * 0.3) return
          }
          lastSearchCenter = center
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

    // Essayer les coords sauvegardées
    const saved = getUserCoords()
    if (saved) {
      centerMapOnUser(saved.lat, saved.lon)
      return
    }

    if (!navigator.geolocation) {
      console.warn('[settings] Geolocation not available — carte en vue monde')
      // Pas de fallback Paris : la carte reste en vue monde
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
        // Pas de fallback Paris : la carte reste en vue monde
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

    const mosques = await searchMosquesByLocation(lat, lon)

    if (mosques.length === 0) return

    mosques.forEach((mosque) => {
      if (!mosque.latitude || !mosque.longitude) return

      // Skip si déjà affiché
      if (mosquesCache.has(mosque.slug)) return

      // Custom green mosque marker
      const mosqueIcon = L.divIcon({
        className: 'mosque-marker',
        html: '<i class="fa-solid fa-mosque"></i>',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -16],
      })

      const marker = L.marker([mosque.latitude, mosque.longitude], { icon: mosqueIcon })
        .addTo(markersLayer)

      // Ajouter au cache
      mosquesCache.set(mosque.slug, marker)

      // Construction DOM du popup (pas de HTML brut avec donnees API)
      const popupEl = document.createElement('div')
      popupEl.style.cssText = "font-family: 'Outfit', sans-serif; min-width: 200px;"

      const popupName = document.createElement('div')
      popupName.className = 'popup-mosque-name'
      popupName.style.cssText = 'font-weight: 700; font-size: 0.95rem; margin-bottom: 4px;'
      popupName.textContent = mosque.name
      popupEl.appendChild(popupName)

      const popupLoc = document.createElement('div')
      popupLoc.className = 'popup-mosque-location'
      popupLoc.style.cssText = 'font-size: 0.78rem; margin-bottom: 6px;'
      popupLoc.textContent = mosque.localisation || ''
      popupEl.appendChild(popupLoc)

      if (mosque.proximity) {
        const distEl = document.createElement('div')
        distEl.className = 'popup-mosque-distance'
        distEl.style.cssText = 'font-size: 0.75rem; font-weight: 600; margin-bottom: 8px;'
        const routeIcon = document.createElement('i')
        routeIcon.className = 'fa-solid fa-route'
        routeIcon.style.marginRight = '4px'
        distEl.appendChild(routeIcon)
        distEl.appendChild(document.createTextNode(`${(mosque.proximity / 1000).toFixed(1)} km`))
        popupEl.appendChild(distEl)
      }

      const selectBtn = document.createElement('button')
      selectBtn.className = 'map-select-btn'
      selectBtn.dataset.slug = mosque.slug
      selectBtn.dataset.name = mosque.name
      selectBtn.style.cssText = 'padding: 8px 14px; border: none; border-radius: 8px; font-family: inherit; font-weight: 600; font-size: 0.85rem; cursor: pointer; width: 100%; transition: background 0.2s;'
      const checkIcon = document.createElement('i')
      checkIcon.className = 'fa-solid fa-check'
      checkIcon.style.marginRight = '4px'
      selectBtn.appendChild(checkIcon)
      selectBtn.appendChild(document.createTextNode('Sélectionner'))
      popupEl.appendChild(selectBtn)

      selectBtn.addEventListener('click', () => {
        pendingSlug = mosque.slug
        pendingName = mosque.name
        updateSelectionLabel(mosque.name)
        marker.closePopup()
      })

      marker.bindPopup(popupEl, { maxWidth: 250 })
    })

    // Nettoyer les marqueurs très éloignés (bounds élargi ×3)
    if (mapInstance) {
      const bounds = mapInstance.getBounds().pad(2)
      for (const [slug, marker] of mosquesCache) {
        if (!bounds.contains(marker.getLatLng())) {
          markersLayer.removeLayer(marker)
          mosquesCache.delete(slug)
        }
      }
    }

    // Auto-fly vers la mosquée sélectionnée à l'ouverture de la carte
    if (shouldFlyToSelected && pendingSlug && mosquesCache.has(pendingSlug)) {
      shouldFlyToSelected = false
      const selectedMarker = mosquesCache.get(pendingSlug)
      const targetLatLng = selectedMarker.getLatLng()
      mapInstance.flyTo(targetLatLng, 16, { duration: 1.2 })
      setTimeout(() => selectedMarker.openPopup(), 1400)
    }
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
        const val = parseInt(advanceEl.value, 10)
        if ([5, 10, 15, 30].includes(val)) {
          prefs.advanceMinutes = val
          savePrefs(prefs)
        } else {
          advanceEl.value = String(prefs.advanceMinutes)
        }
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

        const labelSpan = document.createElement('span')
        labelSpan.textContent = label
        item.appendChild(labelSpan)

        const toggleLabel = document.createElement('label')
        toggleLabel.className = 'notif-toggle'

        const checkbox = document.createElement('input')
        checkbox.type = 'checkbox'
        checkbox.checked = !!prefs.perPrayer[key]
        checkbox.dataset.prayer = key
        toggleLabel.appendChild(checkbox)

        const slider = document.createElement('span')
        slider.className = 'notif-toggle-slider'
        toggleLabel.appendChild(slider)

        item.appendChild(toggleLabel)

        checkbox.onchange = (e) => {
          prefs.perPrayer[key] = e.target.checked
          savePrefs(prefs)
        }
        gridEl.appendChild(item)
      }
    }

    // Autostart toggle (desktop installed app only — not in dev mode)
    const autostartEl = document.getElementById('notif-autostart')
    if (autostartEl) {
      if (import.meta.env.DEV) {
        // Mode dev : désactiver le toggle et afficher un tooltip
        autostartEl.disabled = true
        autostartEl.closest('.notif-toggle')?.setAttribute('title',
          'Autostart disponible uniquement dans l\'app installée')
      } else {
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
    }

    // Reset Tour button
    const btnResetTour = document.getElementById('btn-reset-tour')
    if (btnResetTour && typeof window.resetTour === 'function') {
      btnResetTour.onclick = () => window.resetTour()
    }

    // Legal Documents
    const btnPrivacy = document.getElementById('btn-open-privacy')
    if (btnPrivacy) {
      btnPrivacy.onclick = (e) => {
        e.preventDefault()
        open('https://github.com/SofianeBel/myramadan/blob/main/PRIVACY.md').catch(err => console.error('Failed to open PRIVACY.md:', err))
      }
    }

    const btnCgu = document.getElementById('btn-open-cgu')
    if (btnCgu) {
      btnCgu.onclick = (e) => {
        e.preventDefault()
        open('https://github.com/SofianeBel/myramadan/blob/main/CGU.md').catch(err => console.error('Failed to open CGU.md:', err))
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
    // App mode selector
    const modeSelect = document.getElementById('app-mode-select')
    if (modeSelect) {
      modeSelect.value = storage.get('appMode') || 'auto'
      modeSelect.onchange = () => setAppMode(modeSelect.value)
    }

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
