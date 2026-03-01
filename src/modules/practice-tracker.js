/**
 * practice-tracker.js — Daily practice tracker
 *
 * Tracks prayers (5/5), fasting, Quran pages read, and dhikr count.
 * Shows on the dashboard as a compact card, expandable on click.
 * Data persisted via storage.js with 90-day pruning.
 */

import storage from './storage.js'

const PRACTICE_LOG_KEY = 'practiceLog'
const PRAYER_NAMES = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']
const PRUNE_DAYS = 90

function getToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getLog() {
  return storage.get(PRACTICE_LOG_KEY) || {}
}

function saveLog(log) {
  storage.set(PRACTICE_LOG_KEY, log)
}

function createEmptyEntry() {
  return { prayers: [false, false, false, false, false], fasting: false, quranPages: 0, dhikrCount: 0 }
}

function getTodayEntry() {
  const log = getLog()
  const today = getToday()
  if (!log[today]) {
    log[today] = createEmptyEntry()
    saveLog(log)
  }
  return log[today]
}

function pruneLog() {
  const log = getLog()
  const keys = Object.keys(log).sort()
  if (keys.length <= PRUNE_DAYS) return
  const toRemove = keys.slice(0, keys.length - PRUNE_DAYS)
  toRemove.forEach(k => delete log[k])
  saveLog(log)
}

export function togglePrayer(index) {
  const log = getLog()
  const today = getToday()
  const entry = log[today] || createEmptyEntry()
  entry.prayers[index] = !entry.prayers[index]
  log[today] = entry
  saveLog(log)
  renderTracker()
}

export function toggleFasting() {
  const log = getLog()
  const today = getToday()
  const entry = log[today] || createEmptyEntry()
  entry.fasting = !entry.fasting
  log[today] = entry
  saveLog(log)
  renderTracker()
}

export function setQuranPages(pages) {
  const log = getLog()
  const today = getToday()
  const entry = log[today] || createEmptyEntry()
  entry.quranPages = Math.max(0, Math.min(50, parseInt(pages) || 0))
  log[today] = entry
  saveLog(log)
  renderTracker()
}

export function addDhikrCount(count) {
  const log = getLog()
  const today = getToday()
  const entry = log[today] || createEmptyEntry()
  entry.dhikrCount = (entry.dhikrCount || 0) + count
  log[today] = entry
  saveLog(log)
}

function prevDateKey(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number)
  const prev = new Date(y, m - 1, d - 1)
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`
}

export function getStreak(field) {
  const log = getLog()
  let streak = 0
  let expectedDate = getToday()

  while (log[expectedDate]) {
    const entry = log[expectedDate]
    let active = false

    if (field === 'prayers') active = entry.prayers && entry.prayers.every(Boolean)
    else if (field === 'fasting') active = entry.fasting === true
    else if (field === 'quran') active = (entry.quranPages || 0) >= 1
    else if (field === 'dhikr') active = (entry.dhikrCount || 0) >= 1

    if (active) {
      streak++
      expectedDate = prevDateKey(expectedDate)
    } else {
      break
    }
  }
  return streak
}

export function getPracticeLog() {
  return getLog()
}

// ─── Rendering ───

let expanded = false

function renderTracker() {
  const container = document.getElementById('tracker-card')
  if (!container) return

  const entry = getTodayEntry()
  const prayerCount = entry.prayers.filter(Boolean).length
  const streak = getStreak('prayers')

  // Compact view — prayer dots
  const dotsContainer = document.getElementById('tracker-dots')
  if (dotsContainer) {
    dotsContainer.replaceChildren()
    entry.prayers.forEach((done, i) => {
      const dot = document.createElement('span')
      dot.className = `tracker-dot ${done ? 'done' : ''}`
      dot.dataset.prayer = i
      dot.title = PRAYER_NAMES[i]
      dot.addEventListener('click', (e) => {
        e.stopPropagation()
        togglePrayer(i)
      })
      dotsContainer.appendChild(dot)
    })
  }

  const summaryEl = document.getElementById('tracker-summary')
  if (summaryEl) summaryEl.textContent = `Prieres ${prayerCount}/5`

  const streakEl = document.getElementById('tracker-streak')
  if (streakEl) streakEl.textContent = streak > 0 ? `${streak} j.` : ''

  const fastingEl = document.getElementById('tracker-fasting-status')
  if (fastingEl) fastingEl.textContent = entry.fasting ? '\u2713' : '\u2014'

  const quranEl = document.getElementById('tracker-quran-count')
  if (quranEl) quranEl.textContent = `${entry.quranPages} pages`

  // Expanded view
  const expandedDiv = document.getElementById('tracker-expanded')
  if (expandedDiv) {
    expandedDiv.classList.toggle('hidden', !expanded)
    if (expanded) renderExpandedView(expandedDiv, entry)
  }
}

function renderExpandedView(container, entry) {
  container.replaceChildren()

  // Prayer checkboxes
  const prayerSection = document.createElement('div')
  prayerSection.className = 'tracker-prayer-list'

  entry.prayers.forEach((done, i) => {
    const row = document.createElement('label')
    row.className = 'tracker-prayer-row'

    const cb = document.createElement('input')
    cb.type = 'checkbox'
    cb.checked = done
    cb.addEventListener('change', () => togglePrayer(i))

    const name = document.createElement('span')
    name.textContent = PRAYER_NAMES[i]

    row.append(cb, name)
    prayerSection.appendChild(row)
  })
  container.appendChild(prayerSection)

  // Fasting toggle
  const fastingRow = document.createElement('div')
  fastingRow.className = 'tracker-fasting-row'
  const fastingLabel = document.createElement('span')
  fastingLabel.textContent = 'Jeune'
  const fastingToggle = document.createElement('button')
  fastingToggle.className = `tracker-toggle ${entry.fasting ? 'active' : ''}`
  fastingToggle.textContent = entry.fasting ? 'Oui' : 'Non'
  fastingToggle.addEventListener('click', () => toggleFasting())
  fastingRow.append(fastingLabel, fastingToggle)
  container.appendChild(fastingRow)

  // Quran pages
  const quranRow = document.createElement('div')
  quranRow.className = 'tracker-quran-row'
  const quranLabel = document.createElement('span')
  quranLabel.textContent = 'Pages Coran'
  const quranInput = document.createElement('input')
  quranInput.type = 'number'
  quranInput.min = '0'
  quranInput.max = '50'
  quranInput.value = entry.quranPages
  quranInput.className = 'tracker-quran-input'
  quranInput.addEventListener('change', (e) => setQuranPages(e.target.value))
  quranRow.append(quranLabel, quranInput)
  container.appendChild(quranRow)
}

export function initTracker() {
  pruneLog()
  getTodayEntry()
  renderTracker()

  const card = document.getElementById('tracker-card')
  if (card) {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.tracker-dot') || e.target.closest('input') || e.target.closest('button')) return
      expanded = !expanded
      renderTracker()
    })
  }
}
