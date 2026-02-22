/**
 * main.js — GuideME Ramadan Edition orchestrator
 *
 * Initializes all modules and manages the app lifecycle.
 * Primary source: Mawaqit API (mosque-specific times)
 * Fallback: Aladhan API (calculated times + Hijri date)
 */

import './style.css'
import storage from './modules/storage.js'
import { fetchMawaqitTimes, fetchPrayerTimes, fetchHijriDate } from './modules/prayer-times.js'
import { updateFasting } from './modules/fasting.js'
import { startCountdown, stopCountdown } from './modules/countdown.js'
import { renderPrayerSchedule } from './modules/schedule.js'
import { updateDates } from './modules/hijri-date.js'
import { updateDailyContent } from './modules/daily-content.js'
import { initTheme } from './modules/theme.js'
import { initSplash } from './modules/splash.js'
import { initOnboarding } from './modules/onboarding.js'
import { getMosqueSlug, getCity, getCountry, getCalculationMethod, getUserCoords, requestGeolocation, updateLocationDisplay, initSettings } from './modules/settings.js'
import { startNotifications, stopNotifications, isNotificationsEnabled, loadPrefs, savePrefs } from './modules/notifications.js'

// Intervals
let fastingInterval = null

/**
 * Load prayer data and refresh all dependent UI.
 * Strategy: Mawaqit (if mosque set) → Aladhan (fallback)
 * Hijri date: always from Aladhan (Mawaqit doesn't provide it)
 */
async function loadPrayerData(mosqueSlug) {
  let timings = null
  const method = getCalculationMethod()
  const coords = getUserCoords()
  const locationParams = {
    lat: coords?.lat,
    lon: coords?.lon,
    city: getCity(),
    country: getCountry(),
    method,
  }

  // 1. Try Mawaqit if a mosque is configured
  if (mosqueSlug) {
    const mawaqitData = await fetchMawaqitTimes(mosqueSlug)
    if (mawaqitData) {
      timings = mawaqitData.timings
    }
  }

  // 2. Fallback to Aladhan if no mosque or Mawaqit failed
  if (!timings) {
    const aladhanData = await fetchPrayerTimes(locationParams)
    if (aladhanData) {
      timings = aladhanData.timings
      // Aladhan also provides hijri date
      updateDates(aladhanData.hijriDate)
    }
  }

  // 3. Always fetch Hijri date from Aladhan (even if Mawaqit provided times)
  if (mosqueSlug) {
    const hijriDate = await fetchHijriDate(locationParams)
    if (hijriDate) {
      updateDates(hijriDate)
    }
  }

  if (!timings) {
    console.error('[main] No prayer data available from any source')
    return
  }

  // 4. Refresh all UI modules with timings
  renderPrayerSchedule(timings)

  updateFasting(timings.Fajr, timings.Maghrib)
  if (fastingInterval) clearInterval(fastingInterval)
  fastingInterval = setInterval(() => {
    updateFasting(timings.Fajr, timings.Maghrib)
  }, 60_000) // Every minute

  stopCountdown()
  startCountdown(timings)

  // 5. Start notification check loop
  stopNotifications()
  startNotifications(timings)
}

/**
 * Setup interactive effects (ripple on buttons).
 */
function setupInteractiveEffects() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.ripple-btn')
    if (!btn) return

    const ripple = document.createElement('span')
    ripple.classList.add('ripple')

    const rect = btn.getBoundingClientRect()
    ripple.style.left = `${e.clientX - rect.left}px`
    ripple.style.top = `${e.clientY - rect.top}px`

    btn.appendChild(ripple)
    setTimeout(() => ripple.remove(), 600)
  })
}

/**
 * Main initialization sequence.
 */
document.addEventListener('DOMContentLoaded', async () => {
  // 0. Initialize persistent storage (loads from disk into memory cache)
  await storage.init()

  // 1. Theme (restore before anything visual)
  initTheme()

  // 1.5. Request geolocation (must complete before loading prayer data)
  await requestGeolocation()

  // 2. Splash screen (waits for animation to complete)
  await initSplash()

  // 3. Display location in header
  updateLocationDisplay()

  // 4. Load prayer data (Mawaqit or Aladhan)
  const mosqueSlug = getMosqueSlug()
  await loadPrayerData(mosqueSlug)

  // 5. Daily verse/hadith
  updateDailyContent()

  // 6. Interactive effects
  setupInteractiveEffects()

  // 7. Onboarding tour (first visit only)
  setTimeout(() => initOnboarding(), 500)

  // 8. Settings modal (re-fetches data on mosque change)
  initSettings(async (newMosqueSlug) => {
    await loadPrayerData(newMosqueSlug)
  })

  // 9. Quick-toggle reminder button
  const reminderBtn = document.getElementById('reminder-btn')
  if (reminderBtn) {
    function updateReminderBtn() {
      if (isNotificationsEnabled()) {
        reminderBtn.classList.add('reminder-active')
        reminderBtn.innerHTML = '<i class="fa-solid fa-bell bell-icon"></i> Rappel active'
      } else {
        reminderBtn.classList.remove('reminder-active')
        reminderBtn.innerHTML = '<i class="fa-solid fa-bell bell-icon"></i> Activer le rappel'
      }
    }

    updateReminderBtn()

    reminderBtn.addEventListener('click', () => {
      const prefs = loadPrefs()
      prefs.enabled = !prefs.enabled
      savePrefs(prefs)
      updateReminderBtn()
    })
  }
})
