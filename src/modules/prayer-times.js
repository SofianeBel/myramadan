/**
 * prayer-times.js — Fetch prayer times from Mawaqit (primary) or Aladhan (fallback)
 *
 * Mawaqit calls use Tauri's HTTP plugin (Rust-side fetch) to bypass CORS.
 * Aladhan calls use browser fetch (Aladhan has proper CORS headers).
 */

import { fetch as tauriFetch } from '@tauri-apps/plugin-http'

const ALADHAN_BASE = 'https://api.aladhan.com/v1/timingsByCity'
const MAWAQIT_SEARCH = 'https://mawaqit.net/api/2.0/mosque/search'
const MAWAQIT_CACHE_KEY = 'mawaqitCache'
const ALADHAN_CACHE_KEY = 'prayerTimesCache'

// ─── Utility functions ───────────────────────────────────────────

/** Parse "HH:MM" → { hours, minutes } */
export function parseTime(str) {
  const [h, m] = str.split(':').map(Number)
  return { hours: h, minutes: m }
}

/** Convert "HH:MM" string to total minutes since midnight */
export function timeToMinutes(str) {
  const { hours, minutes } = parseTime(str)
  return hours * 60 + minutes
}

/** Get current time as total minutes since midnight */
export function getCurrentMinutes() {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}

/** Format minutes to "HH:MM" */
export function minutesToTime(totalMinutes) {
  const h = Math.floor(totalMinutes / 60) % 24
  const m = totalMinutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// ─── Mawaqit API ─────────────────────────────────────────────────

/**
 * Search mosques on Mawaqit.
 * @param {string} query - Mosque name or city
 * @returns {Promise<Array<{ name, slug, localisation, uuid }>>}
 */
export async function searchMosques(query) {
  if (!query || query.trim().length < 2) return []

  try {
    const url = `${MAWAQIT_SEARCH}?word=${encodeURIComponent(query.trim())}`
    // Use Tauri HTTP plugin (Rust-side) to bypass CORS
    const response = await tauriFetch(url, { method: 'GET' })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const results = await response.json()

    if (!Array.isArray(results)) return []

    return results.map((m) => ({
      name: m.name || m.label || '',
      slug: m.slug || '',
      localisation: m.localisation || '',
      uuid: m.uuid || '',
      times: m.times || null,
    }))
  } catch (err) {
    console.error('[prayer-times] Mawaqit search error:', err)
    return []
  }
}

/**
 * Fetch prayer times from Mawaqit for a specific mosque.
 * @param {string} mosqueSlug - Mawaqit mosque slug
 * @returns {Promise<{ timings: Object } | null>}
 */
export async function fetchMawaqitTimes(mosqueSlug) {
  if (!mosqueSlug) return null

  // Check cache
  const cached = loadCache(MAWAQIT_CACHE_KEY)
  const today = new Date().toISOString().slice(0, 10)

  if (cached && cached.date === today && cached.mosqueSlug === mosqueSlug) {
    return cached.data
  }

  try {
    const url = `${MAWAQIT_SEARCH}?word=${encodeURIComponent(mosqueSlug)}`
    // Use Tauri HTTP plugin (Rust-side) to bypass CORS
    const response = await tauriFetch(url, { method: 'GET' })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const results = await response.json()

    if (!Array.isArray(results) || results.length === 0) {
      throw new Error('No results from Mawaqit')
    }

    // Find exact match or take first result
    const mosque = results.find((m) => m.slug === mosqueSlug) || results[0]

    if (!mosque.times || mosque.times.length < 6) {
      throw new Error('Invalid times array from Mawaqit')
    }

    // Map Mawaqit times[] → standard timings object
    // times[] = [Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha]
    const timings = {
      Fajr: mosque.times[0],
      Sunrise: mosque.times[1],
      Dhuhr: mosque.times[2],
      Asr: mosque.times[3],
      Maghrib: mosque.times[4],
      Isha: mosque.times[5],
    }

    const result = { timings }

    // Save to cache
    saveCache(MAWAQIT_CACHE_KEY, {
      date: today,
      mosqueSlug,
      data: result,
    })

    return result
  } catch (err) {
    console.error('[prayer-times] Mawaqit fetch error:', err)

    // Fallback to cache
    if (cached && cached.data) {
      console.warn('[prayer-times] Using cached Mawaqit data')
      return cached.data
    }

    return null
  }
}

// ─── Aladhan API (fallback + Hijri date) ─────────────────────────

/**
 * Fetch Hijri date from Aladhan API.
 * @param {string} city
 * @param {string} country
 * @returns {Promise<Object|null>} Hijri date object
 */
export async function fetchHijriDate(city = 'Paris', country = 'France') {
  try {
    const url = `${ALADHAN_BASE}?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=2`
    const response = await fetch(url)

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const json = await response.json()

    if (json.code !== 200 || !json.data) {
      throw new Error('Invalid Aladhan response')
    }

    return json.data.date.hijri
  } catch (err) {
    console.error('[prayer-times] Aladhan hijri fetch error:', err)
    return null
  }
}

/**
 * Fetch prayer times from Aladhan API (fallback when no mosque is set).
 * @param {string} city
 * @param {string} country
 * @returns {Promise<{ timings: Object, hijriDate: Object } | null>}
 */
export async function fetchPrayerTimes(city = 'Paris', country = 'France') {
  const cached = loadCache(ALADHAN_CACHE_KEY)
  const today = new Date().toISOString().slice(0, 10)

  if (cached && cached.date === today && cached.city === city && cached.country === country) {
    return cached.data
  }

  try {
    const url = `${ALADHAN_BASE}?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=2`
    const response = await fetch(url)

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const json = await response.json()

    if (json.code !== 200 || !json.data) {
      throw new Error('Invalid API response')
    }

    const timings = json.data.timings
    const hijriDate = json.data.date.hijri

    const result = { timings, hijriDate }

    saveCache(ALADHAN_CACHE_KEY, {
      date: today,
      city,
      country,
      data: result,
    })

    return result
  } catch (err) {
    console.error('[prayer-times] Aladhan fetch error:', err)

    if (cached && cached.data) {
      console.warn('[prayer-times] Using cached Aladhan data')
      return cached.data
    }

    return null
  }
}

// ─── Shared helpers ──────────────────────────────────────────────

/**
 * Extract the 6 main prayer names & times we display.
 * @param {Object} timings - Timings object (from Mawaqit or Aladhan)
 * @returns {Array<{ name: string, nameFr: string, time: string, icon: string }>}
 */
export function getPrayerList(timings) {
  return [
    { name: 'Fajr', nameFr: 'Fajr', time: timings.Fajr, icon: 'fa-cloud-moon' },
    { name: 'Sunrise', nameFr: 'Shurûq', time: timings.Sunrise, icon: 'fa-sun' },
    { name: 'Dhuhr', nameFr: 'Dhuhr', time: timings.Dhuhr, icon: 'fa-sun' },
    { name: 'Asr', nameFr: 'Asr', time: timings.Asr, icon: 'fa-cloud-sun' },
    { name: 'Maghrib', nameFr: 'Maghrib', time: timings.Maghrib, icon: 'fa-moon' },
    { name: 'Isha', nameFr: 'Isha', time: timings.Isha, icon: 'fa-star' },
  ]
}

function saveCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch (_) { /* ignore */ }
}

function loadCache(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch (_) {
    return null
  }
}
