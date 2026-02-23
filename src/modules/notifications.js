/**
 * notifications.js — Prayer notification system
 *
 * Manages:
 * - Pre-prayer notifications (X minutes before)
 * - At-prayer-time Adhan playback
 * - Iftar/Suhoor special notifications
 * - User preferences (persistent storage via storage.js)
 */

import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification'
import { timeToMinutes } from './prayer-times.js'
import storage from './storage.js'

// ─── Constants ──────────────────────────────────────────────────

const STORAGE_KEY = 'notificationPrefs'
const SECONDS_IN_DAY = 86400
const DETECTION_WINDOW = 30 // seconds — must be > check interval (15s)

const PRAYER_KEYS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']

const DEFAULT_PREFS = {
  enabled: false,
  advanceMinutes: 10,
  adhanRegular: 'makkah',
  adhanFajr: 'fajr',
  iftarNotification: true,
  suhoorNotification: true,
  perPrayer: {
    Fajr: true,
    Dhuhr: true,
    Asr: true,
    Maghrib: true,
    Isha: true,
  },
}

const ADHAN_FILES = {
  makkah: '/audio/adhan-makkah.mp3',
  madina: '/audio/adhan-madina.mp3',
  fajr: '/audio/adhan-fajr.mp3',
}

// ─── State ──────────────────────────────────────────────────────

let checkInterval = null
let currentTimings = null
let firedToday = new Set()
let currentAudio = null
let lastDateStr = ''

// ─── Preferences ────────────────────────────────────────────────

/** Load notification preferences from persistent storage */
export function loadPrefs() {
  try {
    const saved = storage.get(STORAGE_KEY)
    if (!saved) return { ...DEFAULT_PREFS }
    return {
      ...DEFAULT_PREFS,
      ...saved,
      perPrayer: { ...DEFAULT_PREFS.perPrayer, ...(saved.perPrayer || {}) },
    }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

/** Save notification preferences to persistent storage */
export function savePrefs(prefs) {
  try {
    storage.set(STORAGE_KEY, prefs)
    window.dispatchEvent(new CustomEvent('notificationPrefsChanged'))
  } catch { /* ignore */ }
}

// ─── Permission ─────────────────────────────────────────────────

async function ensurePermission() {
  try {
    let granted = await isPermissionGranted()
    if (!granted) {
      const result = await requestPermission()
      granted = result === 'granted'
    }
    return granted
  } catch (err) {
    console.warn('[notifications] Permission check error:', err)
    return false
  }
}

// ─── Notification sending ───────────────────────────────────────

async function notify(title, body) {
  const granted = await ensurePermission()
  if (!granted) return

  try {
    sendNotification({ title, body })
  } catch (err) {
    console.warn('[notifications] Send error:', err)
  }
}

// ─── Audio playback ─────────────────────────────────────────────

function playAdhan(prayerName) {
  const prefs = loadPrefs()
  const key = prayerName === 'Fajr' ? prefs.adhanFajr : prefs.adhanRegular

  if (key === 'none' || !ADHAN_FILES[key]) return

  stopAdhan()

  currentAudio = new Audio(ADHAN_FILES[key])
  currentAudio.volume = 1.0
  currentAudio.play().catch((err) => {
    console.warn('[notifications] Audio play error:', err)
  })
}

/** Play the short notification chime */
function playChime() {
  try {
    const chime = new Audio('/audio/notification.mp3')
    chime.volume = 0.8
    chime.play().catch((err) => {
      console.warn('[notifications] Chime play error:', err)
    })
  } catch (err) {
    console.warn('[notifications] Chime creation error:', err)
  }
}

/** Stop any currently playing Adhan audio */
export function stopAdhan() {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.currentTime = 0
    currentAudio = null
  }
}

// ─── Helpers ────────────────────────────────────────────────────

/**
 * Check if nowSec falls within a detection window around targetSec.
 * Handles midnight wraparound (e.g. target at 23:45 = 85500s, now at 0:00 = 0s).
 */
function isInWindow(nowSec, targetSec) {
  // Normalize target to [0, SECONDS_IN_DAY)
  const t = ((targetSec % SECONDS_IN_DAY) + SECONDS_IN_DAY) % SECONDS_IN_DAY
  const end = t + DETECTION_WINDOW

  if (end < SECONDS_IN_DAY) {
    return nowSec >= t && nowSec < end
  }
  // Window wraps past midnight
  return nowSec >= t || nowSec < (end - SECONDS_IN_DAY)
}

// ─── Core check loop ────────────────────────────────────────────

function checkNotifications() {
  if (!currentTimings) return

  const prefs = loadPrefs()
  if (!prefs.enabled) return

  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)

  // Reset fired set on day change
  if (todayStr !== lastDateStr) {
    firedToday.clear()
    lastDateStr = todayStr
  }

  const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()

  for (const name of PRAYER_KEYS) {
    if (!prefs.perPrayer[name]) continue

    const timeStr = currentTimings[name]
    if (!timeStr) continue

    const prayerMin = timeToMinutes(timeStr)
    const prayerSec = prayerMin * 60
    const preTargetSec = (prayerMin - prefs.advanceMinutes) * 60

    // 1. Pre-prayer notification (X minutes before)
    // Skip Fajr pre-notification if Suhoor notification is enabled (avoid double)
    const skipFajrPre = name === 'Fajr' && prefs.suhoorNotification
    const preKey = `${name}-pre`

    if (!skipFajrPre && !firedToday.has(preKey)) {
      if (isInWindow(nowSec, preTargetSec)) {
        firedToday.add(preKey)
        playChime()

        if (name === 'Maghrib' && prefs.iftarNotification) {
          notify('Rappel Iftar', `Maghrib dans ${prefs.advanceMinutes} min — Preparez l'Iftar !`)
        } else {
          notify('Rappel de priere', `${name} dans ${prefs.advanceMinutes} min`)
        }
      }
    }

    // 2. At-prayer-time Adhan
    const adhanKey = `${name}-adhan`
    if (!firedToday.has(adhanKey)) {
      if (isInWindow(nowSec, prayerSec)) {
        firedToday.add(adhanKey)
        playAdhan(name)
        notify(`C'est l'heure de ${name}`, `${timeStr} — Adhan`)
      }
    }
  }

  // 3. Suhoor notification (before Fajr — replaces Fajr pre-notification)
  if (prefs.suhoorNotification && currentTimings.Fajr) {
    const suhoorKey = 'suhoor-pre'
    if (!firedToday.has(suhoorKey)) {
      const fajrMin = timeToMinutes(currentTimings.Fajr)
      const suhoorTargetSec = (fajrMin - prefs.advanceMinutes) * 60

      if (isInWindow(nowSec, suhoorTargetSec)) {
        firedToday.add(suhoorKey)
        playChime()
        notify(
          'Fin du Suhoor',
          `Le Fajr approche dans ${prefs.advanceMinutes} min. Dernieres minutes pour manger !`
        )
      }
    }
  }
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Start the notification check loop.
 * @param {Object} timings - { Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha }
 */
export function startNotifications(timings) {
  currentTimings = timings
  stopNotifications()
  checkInterval = setInterval(checkNotifications, 15_000)
  checkNotifications()
}

/** Stop the notification loop. */
export function stopNotifications() {
  if (checkInterval) {
    clearInterval(checkInterval)
    checkInterval = null
  }
}

/** Check if notifications are currently enabled. */
export function isNotificationsEnabled() {
  return loadPrefs().enabled
}

/**
 * Preview an Adhan sound for testing.
 * @param {string} key - 'makkah', 'madina', or 'fajr'
 * @param {number} duration - Duration in ms before auto-stop (default 10s)
 */
export function previewAdhan(key, duration = 10000) {
  stopAdhan()
  if (!ADHAN_FILES[key]) {
    console.warn('[notifications] No adhan file for key:', key)
    return
  }

  const src = ADHAN_FILES[key]
  console.log('[notifications] Preview adhan:', key, src)

  currentAudio = new Audio(src)
  currentAudio.volume = 1.0
  currentAudio.play().catch((err) => {
    console.error('[notifications] Preview play error:', err)
  })

  setTimeout(() => stopAdhan(), duration)
}
