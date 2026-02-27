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
import { updateDailyContent, initDailyContentActions } from './modules/daily-content.js'
import { initTheme } from './modules/theme.js'
import { initSplash } from './modules/splash.js'
import { initOnboarding } from './modules/onboarding.js'
import { getMosqueSlug, getCity, getCountry, getCalculationMethod, getMethodAngles, getUserCoords, requestGeolocation, updateLocationDisplay, initSettings, autoSelectNearestMosque } from './modules/settings.js'
import { startNotifications, stopNotifications, isNotificationsEnabled, loadPrefs, savePrefs } from './modules/notifications.js'
import { getOffset, getOffsetDateForAladhan, initDateNavigation } from './modules/date-navigation.js'
import { initCalendar, refreshCalendar } from './modules/calendar.js'
import { initWindowControls } from './modules/window.js'
import { initSidebar } from './modules/sidebar.js'
import { initBugReport } from './modules/bug-report.js'
import { initSupport } from './modules/support.js'
import { initChangelog } from './modules/changelog.js'
import { initUpdater } from './modules/updater.js'
import { resolveMode, applyMode, getRamadanDay } from './modules/app-mode.js'
import { initTracker } from './modules/practice-tracker.js'
import { initDhikr } from './modules/dhikr.js'
import { initQibla } from './modules/qibla.js'
import { initDuas } from './modules/duas.js'
import { initJournal } from './modules/journal.js'
import { initStatistics } from './modules/statistics.js'
import { applyPlatformClass, isMobile } from './modules/platform.js'

// Intervals
let fastingInterval = null

/**
 * Initialize Sakura petal animations in the titlebar
 */
function initSakura() {
  const container = document.getElementById('sakura-container');
  if (!container) return;

  container.innerHTML = ''; // Clear any existing petals

  // Create 15 petals on the branches
  const numPetals = 15;

  for (let i = 0; i < numPetals; i++) {
    const petal = document.createElement('div');
    petal.classList.add('sakura-petal');

    // Size between 5px and 12px
    const size = Math.random() * 7 + 5;
    petal.style.width = `${size}px`;
    petal.style.height = `${size}px`;

    // Position on branches (left 0-35% or right 65-100%)
    const isLeft = Math.random() > 0.5;
    const leftPos = isLeft ? Math.random() * 35 : 65 + Math.random() * 35;
    const topPos = Math.random() * 30 + 5; // 5px to 35px from top

    petal.style.left = `${leftPos}%`;
    petal.style.top = `${topPos}px`;

    // Base rotation to look natural and target rotation for the subtle animation
    const baseRotation = Math.random() * 360;
    const targetRotation = baseRotation + (Math.random() > 0.5 ? 15 : -15);

    petal.style.setProperty('--base-rot', `${baseRotation}deg`);
    petal.style.setProperty('--target-rot', `${targetRotation}deg`);

    // Subtle breathing animation durations
    const breatheDuration = Math.random() * 2 + 3; // 3-5s
    const delay = Math.random() * 3;

    petal.style.animation = `breathe-sakura ${breatheDuration}s ease-in-out ${delay}s infinite alternate`;

    container.appendChild(petal);
  }
}


/**
 * Update the Ramadan progress bar with the current hijri day.
 * @param {number|null} day - Current day of Ramadan (1-30) or null if not Ramadan
 */
function updateRamadanProgress(day) {
  const bar = document.getElementById('ramadan-progress')
  if (!bar) return
  if (day === null) { bar.classList.add('hidden'); return }
  bar.classList.remove('hidden')
  const dayEl = document.getElementById('ramadan-day')
  const fillEl = document.getElementById('ramadan-progress-fill')
  if (dayEl) dayEl.textContent = `Jour ${day}/30 du Ramadan`
  if (fillEl) fillEl.style.width = `${(day / 30) * 100}%`
}

/**
 * Load prayer data and refresh all dependent UI.
 * Strategy: Mawaqit (if mosque set) → Aladhan (fallback)
 * Hijri date: always from Aladhan (Mawaqit doesn't provide it)
 */
async function loadPrayerData(mosqueSlug, offset = 0) {
  let timings = null
  let currentHijriDate = null
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
      currentHijriDate = aladhanData.hijriDate
      updateDates(aladhanData.hijriDate, offset)
    }
  }

  // 3. Hijri date from Aladhan
  if (mosqueSlug && isToday && timings) {
    // Mawaqit provided times for today — fetch Hijri separately
    const hijriDate = await fetchHijriDate(locationParams)
    if (hijriDate) {
      currentHijriDate = hijriDate
      updateDates(hijriDate, 0)
    }
  } else if (mosqueSlug && !isToday && timings) {
    // Mosque set but non-today — Hijri needs date param
    const hijriDate = await fetchHijriDate(locationParams, aladhanDate)
    if (hijriDate) {
      currentHijriDate = hijriDate
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

  // Apply app mode based on hijri date
  const mode = resolveMode(currentHijriDate)
  applyMode(mode)
  updateRamadanProgress(getRamadanDay(currentHijriDate))
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
 * Setup navigation between Dashboard and Horaires
 */
function setupNavigation() {
  const navTabs = {
    dashboard: { btn: document.getElementById('nav-dashboard'), view: document.getElementById('view-dashboard') },
    horaires: { btn: document.getElementById('nav-horaires'), view: document.getElementById('view-horaires') },
    duas: { btn: document.getElementById('nav-duas'), view: document.getElementById('view-duas') },
    journal: { btn: document.getElementById('nav-journal'), view: document.getElementById('view-journal') },
    stats: { btn: document.getElementById('nav-stats'), view: document.getElementById('view-stats') }
  };

  Object.values(navTabs).forEach(tab => {
    if (tab.btn) {
      tab.btn.addEventListener('click', (e) => {
        e.preventDefault();

        // Remove active class from all
        Object.values(navTabs).forEach(t => {
          if (t.btn) t.btn.classList.remove('active');
          if (t.view) t.view.classList.remove('active-view');
        });

        // Add to current
        tab.btn.classList.add('active');
        if (tab.view) {
          tab.view.classList.remove('hidden');
          tab.view.classList.add('active-view');
        }

        // Initialize calendar on first visit
        if (tab.btn === navTabs.horaires.btn) {
          initCalendar();
        }

        // Initialize duas on first visit
        if (tab.btn === navTabs.duas?.btn) {
          initDuas()
        }

        // Initialize journal on first visit
        if (tab.btn === navTabs.journal?.btn) {
          initJournal()
        }

        // Initialize statistics on first visit
        if (tab.btn === navTabs.stats?.btn) {
          initStatistics()
        }
      });
    }
  });
}

/**
 * Main initialization sequence.
 */
document.addEventListener('DOMContentLoaded', async () => {
  // 0. Initialize persistent storage (loads from disk into memory cache)
  await storage.init()

  // 0.5. Platform detection (adds CSS class before any rendering)
  applyPlatformClass()

  // Window controls
  if (!isMobile) initWindowControls()

  // 1. Theme (restore before anything visual)
  initTheme()

  // 1.5. Request geolocation (must complete before loading prayer data)
  await requestGeolocation()

  // 2. Splash + auto-détection mosquée en parallèle (zéro délai perçu)
  let autoDetectResult = null
  await Promise.all([
    initSplash(),
    autoSelectNearestMosque().then(result => { autoDetectResult = result })
  ])

  // 3. Display location in header
  updateLocationDisplay()

  // 3.5. Setup navigation
  setupNavigation()

  // 3.6 Setup sidebar
  initSidebar()

  // 3.7 Setup bug report modal
  initBugReport()

  // 3.8 Initialize Sakura Titlebar Effects
  if (!isMobile) initSakura()

  // 3.9 Initialize Support / Ads Feature
  await initSupport()

  // 3.10 Initialize Changelog / Quoi de neuf
  await initChangelog()

  // 3.11 Initialize Auto-updater
  if (!isMobile) await initUpdater()

  // 4. Load prayer data (Mawaqit or Aladhan)
  const mosqueSlug = getMosqueSlug()
  await loadPrayerData(mosqueSlug)

  // 5. Date navigation (arrows to browse past/future prayer times)
  initDateNavigation(async (offset) => {
    const slug = getMosqueSlug()
    await loadPrayerData(slug, offset)
  })

  // 6. Daily verse/hadith (Ramadan mode detected via body class set by applyMode)
  const isRamadanMode = document.body.classList.contains('mode-ramadan')
  updateDailyContent(isRamadanMode)
  initDailyContentActions()

  // 6.5. Practice tracker (dashboard card)
  initTracker()

  // 6.6. Dhikr counter (dashboard card)
  initDhikr()

  // 6.7. Qibla compass (dashboard card)
  initQibla()

  // 7. Interactive effects
  setupInteractiveEffects()

  // 8. Onboarding tour (first visit only)
  setTimeout(() => initOnboarding(), 500)

  // Dev util: Expose resetTour explicitement pour tester
  if (import.meta.env.DEV) {
    window.resetTour = async () => {
      await storage.set('tourCompleted', false)
      await storage.flush()
      window.location.reload()
    }
  }

  // 9. Settings modal (re-fetches data on mosque change, preserves date offset)
  initSettings(async (newMosqueSlug) => {
    await loadPrayerData(newMosqueSlug, getOffset())
    await refreshCalendar()
  })

  // 9.5. Toast auto-détection (après que l'app soit entièrement chargée)
  if (autoDetectResult) {
    showAutoSelectToast(autoDetectResult.name, autoDetectResult.distance)
  }

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
      if (prefs.enabled) {
        prefs.perPrayer = {
          Fajr: true,
          Dhuhr: true,
          Asr: true,
          Maghrib: true,
          Isha: true,
        }
      }
      savePrefs(prefs)
      updateReminderBtn()
    })
  }
})

/**
 * Show a toast notification when a mosque was auto-detected.
 */
function showAutoSelectToast(mosqueName, distanceMeters) {
  const toast = document.createElement('div')
  toast.id = 'auto-select-toast'
  toast.className = 'auto-select-toast'

  // Icône mosquée
  const icon = document.createElement('i')
  icon.className = 'fa-solid fa-mosque'
  toast.appendChild(icon)

  // Texte
  const textContainer = document.createElement('div')
  textContainer.className = 'auto-select-toast-text'

  const title = document.createElement('div')
  title.className = 'auto-select-toast-title'
  title.textContent = 'Mosquée détectée automatiquement'
  textContainer.appendChild(title)

  const subtitle = document.createElement('div')
  subtitle.className = 'auto-select-toast-subtitle'
  const distanceText = distanceMeters ? ` (${(distanceMeters / 1000).toFixed(1)} km)` : ''
  subtitle.textContent = `${mosqueName}${distanceText}`
  textContainer.appendChild(subtitle)

  toast.appendChild(textContainer)

  // Bouton "Modifier"
  const changeBtn = document.createElement('button')
  changeBtn.className = 'auto-select-toast-btn'
  changeBtn.textContent = 'Modifier'
  changeBtn.addEventListener('click', () => {
    toast.remove()
    document.getElementById('settings-btn')?.click()
  })
  toast.appendChild(changeBtn)

  // Bouton fermer
  const closeBtn = document.createElement('button')
  closeBtn.className = 'auto-select-toast-close'
  const closeIcon = document.createElement('i')
  closeIcon.className = 'fa-solid fa-xmark'
  closeBtn.appendChild(closeIcon)
  closeBtn.addEventListener('click', () => {
    toast.classList.add('toast-exit')
    setTimeout(() => toast.remove(), 300)
  })
  toast.appendChild(closeBtn)

  document.body.appendChild(toast)

  // Animation d'entrée
  requestAnimationFrame(() => toast.classList.add('toast-visible'))

  // Auto-dismiss après 6s
  setTimeout(() => {
    if (toast.parentNode) {
      toast.classList.add('toast-exit')
      setTimeout(() => toast.remove(), 300)
    }
  }, 6000)
}
