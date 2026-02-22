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
import { updateFasting, updateFastingReference } from './modules/fasting.js'
import { startCountdown, stopCountdown } from './modules/countdown.js'
import { renderPrayerSchedule } from './modules/schedule.js'
import { updateDates } from './modules/hijri-date.js'
import { updateDailyContent } from './modules/daily-content.js'
import { initTheme } from './modules/theme.js'
import { initSplash } from './modules/splash.js'
import { initOnboarding } from './modules/onboarding.js'
import { getMosqueSlug, getCity, getCountry, getCalculationMethod, getMethodAngles, getUserCoords, requestGeolocation, updateLocationDisplay, initSettings } from './modules/settings.js'
import { startNotifications, stopNotifications, isNotificationsEnabled, loadPrefs, savePrefs } from './modules/notifications.js'
import { getOffset, getOffsetDateForAladhan, initDateNavigation } from './modules/date-navigation.js'

// Intervals
let fastingInterval = null

/**
 * Load prayer data and refresh all dependent UI.
 * Strategy: Mawaqit (if mosque set) → Aladhan (fallback)
 * Hijri date: always from Aladhan (Mawaqit doesn't provide it)
 */
async function loadPrayerData(mosqueSlug, offset = 0) {
  let timings = null
  const isToday = offset === 0
  const method = getCalculationMethod()
  const angles = getMethodAngles()
  const coords = getUserCoords()
  const locationParams = {
    lat: coords?.lat,
    lon: coords?.lon,
    city: getCity(),
    country: getCountry(),
    method,
    angles,
  }

  // For non-today dates, Mawaqit doesn't support date queries → use Aladhan only
  const aladhanDate = isToday ? null : getOffsetDateForAladhan()

  // 1. Try Mawaqit only for today
  if (mosqueSlug && isToday) {
    const mawaqitData = await fetchMawaqitTimes(mosqueSlug)
    if (mawaqitData) {
      timings = mawaqitData.timings
    }
  }

  // 2. Fallback (or non-today): Aladhan with optional date
  if (!timings) {
    const aladhanData = await fetchPrayerTimes(locationParams, aladhanDate)
    if (aladhanData) {
      timings = aladhanData.timings
      updateDates(aladhanData.hijriDate, offset)
    }
  }

  // 3. Hijri date from Aladhan
  if (mosqueSlug && isToday && timings) {
    // Mawaqit provided times for today — fetch Hijri separately
    const hijriDate = await fetchHijriDate(locationParams)
    if (hijriDate) {
      updateDates(hijriDate, 0)
    }
  } else if (mosqueSlug && !isToday) {
    // Mosque set but non-today — Hijri needs date param
    const hijriDate = await fetchHijriDate(locationParams, aladhanDate)
    if (hijriDate) {
      updateDates(hijriDate, offset)
    }
  }

  if (!timings) {
    console.error('[main] No prayer data available from any source')
    return
  }

  // 4. Render prayer schedule (mode-aware)
  renderPrayerSchedule(timings, isToday)

  // 5. Today-only widgets
  setTodayOnlyWidgetsVisible(isToday)

  if (isToday) {
    updateFasting(timings.Fajr, timings.Maghrib)
    if (fastingInterval) clearInterval(fastingInterval)
    fastingInterval = setInterval(() => {
      updateFasting(timings.Fajr, timings.Maghrib)
    }, 60_000)

    stopCountdown()
    startCountdown(timings)

    stopNotifications()
    startNotifications(timings)
  } else {
    // Show times as reference, no live progress
    updateFastingReference(timings.Fajr, timings.Maghrib)
    if (fastingInterval) { clearInterval(fastingInterval); fastingInterval = null }
    stopCountdown()
    stopNotifications()
  }
}

/**
 * Show/hide today-only widgets (countdown, fasting progress).
 */
function setTodayOnlyWidgetsVisible(isToday) {
  const countdownCard = document.querySelector('.countdown-card')
  if (countdownCard) {
    countdownCard.style.opacity = isToday ? '' : '0.4'
    countdownCard.style.pointerEvents = isToday ? '' : 'none'
  }
  const progressContainer = document.querySelector('.progress-container')
  if (progressContainer) progressContainer.style.display = isToday ? '' : 'none'
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

  // 5. Date navigation (arrows to browse past/future prayer times)
  initDateNavigation(async (offset) => {
    const slug = getMosqueSlug()
    await loadPrayerData(slug, offset)
  })

  // 6. Daily verse/hadith
  updateDailyContent()

  // 7. Interactive effects
  setupInteractiveEffects()

  // 8. Onboarding tour (first visit only)
  setTimeout(() => initOnboarding(), 500)

  // 9. Settings modal (re-fetches data on mosque change, preserves date offset)
  initSettings(async (newMosqueSlug) => {
    await loadPrayerData(newMosqueSlug, getOffset())
  })

  // 10. Quick-toggle reminder button
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
