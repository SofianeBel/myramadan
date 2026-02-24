/**
 * schedule.js — Render the daily prayer schedule dynamically
 */

import { timeToMinutes, getCurrentMinutes, getPrayerList } from './prayer-times.js'
import { findNextPrayer } from './countdown.js'
import { loadPrefs, savePrefs } from './notifications.js'

// Keep last render args for re-render on prefs change
let lastTimings = null
let lastIsToday = true

/**
 * Determine the correct bell icon classes for a prayer.
 * @param {string} name - Prayer name (Fajr, Sunrise, etc.)
 * @param {boolean} isPassed - Has this prayer time passed?
 * @param {boolean} isActive - Is this the currently active prayer period?
 * @param {boolean} isNext - Is this the next upcoming prayer?
 * @param {boolean} notifEnabled - Is notification enabled for this prayer?
 */
function getBellState(name, isPassed, isActive, isNext, notifEnabled) {
  // Sunrise never has a toggleable bell
  if (name === 'Sunrise') return { icon: 'fa-solid fa-bell-slash', clickable: false, disabled: true }

  // Passed prayers always show checkmark
  if (isPassed && !isActive) return { icon: 'fa-solid fa-check', clickable: false, disabled: false }

  if (!notifEnabled) {
    return { icon: 'fa-solid fa-bell-slash', clickable: true, disabled: true }
  }

  if (isNext) {
    return { icon: 'fa-solid fa-bell icon-gold bell-ringing', clickable: true, disabled: false }
  }

  if (isActive) {
    return { icon: 'fa-solid fa-bell', clickable: true, disabled: false }
  }

  // Future prayer
  return { icon: 'fa-regular fa-bell', clickable: true, disabled: false }
}

/**
 * Render the prayer schedule into the prayer-list container.
 * @param {Object} timings - Raw timings from API
 */
export function renderPrayerSchedule(timings, isToday = true) {
  const container = document.getElementById('prayer-list')
  if (!container) return

  // Store for re-render
  lastTimings = timings
  lastIsToday = isToday

  const prayers = getPrayerList(timings)
  const nowMin = isToday ? getCurrentMinutes() : -1
  const nextPrayer = isToday ? findNextPrayer(timings) : null
  const prefs = loadPrefs()

  container.innerHTML = ''

  prayers.forEach((prayer, index) => {
    const prayerMin = timeToMinutes(prayer.time)
    const isPassed = isToday && prayerMin <= nowMin
    const isFajr = prayer.name === 'Fajr'
    const isMaghrib = prayer.name === 'Maghrib'
    const isNext = isToday && nextPrayer && nextPrayer.name === prayer.name

    // Determine if this is the "active" (currently in-progress) prayer
    let isActive = false
    if (isToday) {
      if (index < prayers.length - 1) {
        const nextPrayerMin = timeToMinutes(prayers[index + 1].time)
        isActive = nowMin >= prayerMin && nowMin < nextPrayerMin
      } else {
        isActive = nowMin >= prayerMin
      }
    }

    // Build CSS classes
    const classes = ['prayer-item']
    if (isPassed && !isActive) classes.push('completed')
    if (isActive) classes.push('active-time')
    if (isFajr) classes.push('highlight-suhoor')
    if (isMaghrib) classes.push('highlight-iftar')
    if (isNext) classes.push('selected')

    const item = document.createElement('div')
    item.className = classes.join(' ')
    item.style.cssText = `--anim-delay: ${0.1 * (index + 1)}s`

    // Bell icon state based on notification prefs
    const notifEnabled = prefs.perPrayer[prayer.name] !== false
    const bell = getBellState(prayer.name, isPassed, isActive, isNext, notifEnabled)

    // Build bell element via DOM (no innerHTML for the icon)
    const infoDiv = document.createElement('div')
    infoDiv.className = 'prayer-info'

    const prayerIcon = document.createElement('i')
    prayerIcon.className = `fa-solid ${prayer.icon} prayer-icon`
    infoDiv.appendChild(prayerIcon)

    const nameSpan = document.createElement('span')
    nameSpan.className = 'prayer-name'
    nameSpan.textContent = prayer.nameFr
    infoDiv.appendChild(nameSpan)

    const timeDiv = document.createElement('div')
    timeDiv.className = 'prayer-time-info'

    const timeSpan = document.createElement('span')
    timeSpan.className = 'prayer-time'
    timeSpan.textContent = prayer.time
    timeDiv.appendChild(timeSpan)

    if (bell.icon) {
      const bellEl = document.createElement('i')
      bellEl.className = bell.icon
      if (bell.clickable) {
        bellEl.classList.add('notif-bell')
        bellEl.dataset.prayer = prayer.name
      }
      if (bell.disabled) bellEl.classList.add('notif-disabled')
      timeDiv.appendChild(bellEl)

      // Click handler on the bell icon (toggle notification)
      if (bell.clickable) {
        bellEl.addEventListener('click', (e) => {
          e.stopPropagation()
          const prayerName = bellEl.dataset.prayer
          const currentPrefs = loadPrefs()
          currentPrefs.perPrayer[prayerName] = !currentPrefs.perPrayer[prayerName]
          savePrefs(currentPrefs)
        })
      }
    }

    item.appendChild(infoDiv)
    item.appendChild(timeDiv)

    // Click handler for selection (visual only, does not affect bell)
    item.addEventListener('click', () => {
      container.querySelectorAll('.prayer-item').forEach(el => {
        el.classList.remove('selected')
      })
      item.classList.add('selected')
    })

    container.appendChild(item)
  })
}

// Re-render schedule when notification prefs change (from settings or bell click)
window.addEventListener('notificationPrefsChanged', () => {
  if (lastTimings) {
    renderPrayerSchedule(lastTimings, lastIsToday)
  }
})
