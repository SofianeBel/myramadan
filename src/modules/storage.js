/**
 * storage.js — Persistent storage wrapper using tauri-plugin-store
 *
 * Replaces localStorage with Tauri's plugin-store (persists to disk as JSON).
 * Uses an in-memory cache for synchronous reads, writes through to the store async.
 *
 * Usage:
 *   await storage.init()          // Call once at app startup
 *   storage.get('key')            // Synchronous read from cache
 *   storage.set('key', value)     // Sync cache update + async disk write
 */

import { LazyStore } from '@tauri-apps/plugin-store'

const STORE_FILE = 'guideme-settings.json'
const MIGRATED_KEY = '__migrated_from_localstorage__'

// Keys that were previously in localStorage
const LEGACY_KEYS = [
  'mosqueSlug',
  'mosqueName',
  'userCity',
  'userCountry',
  'userLat',
  'userLon',
  'calculationMethod',
  'mawaqitCache',
  'prayerTimesCache',
  'notificationPrefs',
  'theme',
  'tourCompleted',
]

// In-memory cache for synchronous reads
const cache = new Map()
let initialized = false

// LazyStore instance (deferred init, safe at module level)
const store = new LazyStore(STORE_FILE)

/**
 * Initialize storage: load all keys from disk into memory cache.
 * Also migrates data from localStorage on first run.
 * Must be called once before any get/set operations.
 */
export async function init() {
  try {
    // Check if we need to migrate from localStorage
    const migrated = await store.get(MIGRATED_KEY)

    if (!migrated) {
      await migrateFromLocalStorage()
    }

    // Load all entries into the in-memory cache
    const entries = await store.entries()
    for (const [key, value] of entries) {
      cache.set(key, value)
    }

    initialized = true
    console.log('[storage] Initialized with', cache.size, 'entries')
  } catch (err) {
    console.error('[storage] Init error, falling back to localStorage:', err)
    // Fallback: load from localStorage into cache
    for (const key of LEGACY_KEYS) {
      const raw = localStorage.getItem(key)
      if (raw !== null) {
        try {
          cache.set(key, JSON.parse(raw))
        } catch {
          cache.set(key, raw)
        }
      }
    }
    initialized = true
  }
}

/**
 * Migrate existing localStorage data to the store.
 */
async function migrateFromLocalStorage() {
  console.log('[storage] Migrating from localStorage...')

  for (const key of LEGACY_KEYS) {
    const raw = localStorage.getItem(key)
    if (raw === null) continue

    try {
      // Try parsing JSON (for objects like notificationPrefs, caches)
      const parsed = JSON.parse(raw)
      await store.set(key, parsed)
      cache.set(key, parsed)
    } catch {
      // Plain string value
      await store.set(key, raw)
      cache.set(key, raw)
    }
  }

  await store.set(MIGRATED_KEY, true)
  await store.save()

  console.log('[storage] Migration complete')
}

/**
 * Get a value from storage (synchronous, reads from cache).
 * @param {string} key
 * @returns {*} The stored value or null
 */
export function get(key) {
  const value = cache.get(key)
  return value !== undefined ? value : null
}

/**
 * Set a value in storage (updates cache immediately, persists async).
 * @param {string} key
 * @param {*} value
 */
export function set(key, value) {
  if (!initialized) {
    console.warn('[storage] set() called before init() — data may not persist:', key)
  }
  cache.set(key, value)

  // Write-through to disk (async, fire-and-forget with autoSave)
  store.set(key, value).catch((err) => {
    console.warn('[storage] Write error for key', key, ':', err)
  })
}

/**
 * Remove a key from storage.
 * @param {string} key
 */
export function remove(key) {
  cache.delete(key)

  store.delete(key).catch((err) => {
    console.warn('[storage] Delete error for key', key, ':', err)
  })
}

/**
 * Force flush all pending writes to disk.
 */
export async function flush() {
  try {
    await store.save()
  } catch (err) {
    console.warn('[storage] Flush error:', err)
  }
}

export default { init, get, set, remove, flush }
