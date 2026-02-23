/**
 * prayer-times.js — Fetch prayer times from Mawaqit (primary) or Aladhan (fallback)
 *
 * Mawaqit calls use Tauri's HTTP plugin (Rust-side fetch) to bypass CORS.
 * Aladhan calls use browser fetch (Aladhan has proper CORS headers).
 */

import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import storage from './storage.js'

const ALADHAN_BY_CITY = 'https://api.aladhan.com/v1/timingsByCity'
const ALADHAN_BY_COORDS = 'https://api.aladhan.com/v1/timings'
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
      latitude: m.latitude || null,
      longitude: m.longitude || null,
      proximity: m.proximity || null,
      times: m.times || null,
    }))
  } catch (err) {
    console.error('[prayer-times] Mawaqit search error:', err)
    return []
  }
}

/**
 * Search nearby mosques on Mawaqit by GPS coordinates.
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<Array<{ name, slug, localisation, uuid, latitude, longitude, proximity, times }>>}
 */
export async function searchMosquesByLocation(lat, lon) {
  try {
    const url = `${MAWAQIT_SEARCH}?lat=${lat}&lon=${lon}`
    const response = await tauriFetch(url, { method: 'GET' })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const results = await response.json()

    if (!Array.isArray(results)) return []

    return results.map((m) => ({
      name: m.name || m.label || '',
      slug: m.slug || '',
      localisation: m.localisation || '',
      uuid: m.uuid || '',
      latitude: m.latitude || null,
      longitude: m.longitude || null,
      proximity: m.proximity || null,
      times: m.times || null,
    }))
  } catch (err) {
    console.error('[prayer-times] Mawaqit geo search error:', err)
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
 * Build Aladhan URL: use coords if available, fallback to city/country.
 * When custom angles are provided, uses method=99 + methodSettings override
 * (fixes Aladhan's incorrect angles for UOIF: 12° instead of real 15°).
 */
const DATE_FORMAT_RE = /^\d{2}-\d{2}-\d{4}$/

function buildAladhanUrl({ lat, lon, city = 'Paris', country = 'France', method = 12, angles = null, dateStr = null }) {
  // Validate dateStr format before using in URL path
  const safeDate = (dateStr && DATE_FORMAT_RE.test(dateStr)) ? dateStr : null

  let base
  if (lat != null && lon != null) {
    const path = safeDate ? `${ALADHAN_BY_COORDS}/${safeDate}` : ALADHAN_BY_COORDS
    base = `${path}?latitude=${lat}&longitude=${lon}`
  } else {
    const path = safeDate ? `${ALADHAN_BY_CITY}/${safeDate}` : ALADHAN_BY_CITY
    base = `${path}?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}`
  }

  if (angles && typeof angles.fajr === 'number' && typeof angles.isha === 'number') {
    // Use custom method (99) with real angles override
    // methodSettings format: fajr_angle, maghrib (null = sunset default), isha_angle
    return `${base}&method=99&methodSettings=${angles.fajr},null,${angles.isha}`
  }
  return `${base}&method=${method}`
}

/** Build a cache fingerprint string for location params */
function locationCacheKey({ lat, lon, city, country, method, angles }) {
  const angleSuffix = angles ? `,${angles.fajr}/${angles.isha}` : ''
  if (lat != null && lon != null) return `${lat},${lon},${method}${angleSuffix}`
  return `${city},${country},${method}${angleSuffix}`
}

/**
 * Fetch Hijri date from Aladhan API.
 * @param {{ lat?, lon?, city?, country?, method? }} params
 * @returns {Promise<Object|null>} Hijri date object
 */
export async function fetchHijriDate(params = {}, dateStr = null) {
  try {
    const url = buildAladhanUrl({ ...params, dateStr })
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
 * Uses GPS coordinates if available, otherwise city/country.
 * @param {{ lat?, lon?, city?, country?, method? }} params
 * @returns {Promise<{ timings: Object, hijriDate: Object } | null>}
 */
export async function fetchPrayerTimes(params = {}, dateStr = null) {
  let targetDate
  if (dateStr && DATE_FORMAT_RE.test(dateStr)) {
    const [dd, mm, yyyy] = dateStr.split('-')
    targetDate = `${yyyy}-${mm}-${dd}` // DD-MM-YYYY → YYYY-MM-DD
  } else {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    targetDate = `${y}-${m}-${d}`
  }
  const locKey = locationCacheKey(params)

  // Multi-date cache: Record<YYYY-MM-DD, { locationKey, data }>
  const allCached = loadCache(ALADHAN_CACHE_KEY) || {}
  // Graceful migration: old flat format has a 'date' key — ignore it
  const cached = (typeof allCached === 'object' && !allCached.date)
    ? allCached[targetDate]
    : null

  if (cached && cached.locationKey === locKey) {
    return cached.data
  }

  try {
    const url = buildAladhanUrl({ ...params, dateStr })
    const response = await fetch(url)

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const json = await response.json()

    if (json.code !== 200 || !json.data) {
      throw new Error('Invalid API response')
    }

    const timings = json.data.timings
    const hijriDate = json.data.date.hijri

    const result = { timings, hijriDate }

    // Write into keyed cache, prune to 7 most recent dates
    const store = (typeof allCached === 'object' && !allCached.date) ? allCached : {}
    store[targetDate] = { locationKey: locKey, data: result }
    // ISO date strings (YYYY-MM-DD) sort lexicographically = chronologically
    const keys = Object.keys(store).sort().slice(-7)
    const pruned = {}
    keys.forEach(k => { pruned[k] = store[k] })
    saveCache(ALADHAN_CACHE_KEY, pruned)

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

/**
 * Fetch calendar for a specific month and year from Aladhan API.
 * @param {number} year 
 * @param {number} month (1-12)
 * @param {{ lat?, lon?, city?, country?, method?, angles? }} params 
 */
export async function fetchMonthCalendar(year, month, params = {}) {
  const { lat, lon, city = 'Paris', country = 'France', method = 12, angles = null } = params;

  let base;
  if (lat != null && lon != null) {
    base = `https://api.aladhan.com/v1/calendar/${year}/${month}?latitude=${lat}&longitude=${lon}`;
  } else {
    base = `https://api.aladhan.com/v1/calendarByCity/${year}/${month}?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}`;
  }

  let url;
  if (angles && typeof angles.fajr === 'number' && typeof angles.isha === 'number') {
    url = `${base}&method=99&methodSettings=${angles.fajr},null,${angles.isha}`;
  } else {
    url = `${base}&method=${method}`;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    if (json.code !== 200 || !json.data) throw new Error('Invalid API response');

    // Returns array of days
    return json.data;
  } catch (err) {
    console.error('[prayer-times] Aladhan calendar fetch error:', err);
    return null;
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
    storage.set(key, data)
  } catch (_) { /* ignore */ }
}

function loadCache(key) {
  try {
    return storage.get(key)
  } catch (_) {
    return null
  }
}
