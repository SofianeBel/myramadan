/**
 * statistics.js — Statistics view with heatmap, streaks, and goals
 *
 * Provides a GitHub-style SVG heatmap (12 weeks), aggregate stats,
 * personal goals with progress bars, and time period filters.
 * Data sourced from practice-tracker.js and journal.js.
 */

import { getPracticeLog, getStreak } from './practice-tracker.js'
import { getJournalEntryCount } from './journal.js'
import storage from './storage.js'

let initialized = false
let currentPeriod = 'week'

const GOALS_KEY = 'goals'
const PRESET_GOALS = [
  { id: 'fajr-7', label: 'Prier Fajr 7 jours de suite', type: 'prayer-streak', prayer: 0, target: 7 },
  { id: 'prayers-30', label: 'Prier 5/5 pendant 30 jours', type: 'prayer-streak', prayer: 'all', target: 30 },
  { id: 'khatma', label: 'Khatma complete (604 pages)', type: 'quran-total', target: 604 },
  { id: 'dhikr-1000', label: '1000 dhikr ce mois', type: 'dhikr-monthly', target: 1000 },
  { id: 'fasting-4', label: 'Jeuner lundi/jeudi pendant 4 semaines', type: 'fasting-weeks', target: 4 }
]

// ─── Helpers ───

function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// ─── Stats computation ───

function computeStats(period) {
  const log = getPracticeLog()
  const now = new Date()
  let startDate = null

  if (period === 'week') {
    startDate = new Date(now)
    startDate.setDate(startDate.getDate() - 7)
  } else if (period === 'month') {
    startDate = new Date(now)
    startDate.setMonth(startDate.getMonth() - 1)
  }
  // 'all' = no filter

  const entries = Object.entries(log).filter(([dateStr]) => {
    if (!startDate) return true
    return dateStr >= formatDate(startDate)
  })

  const totalDays = entries.length || 1
  const totalPrayers = entries.reduce((sum, [, e]) => sum + (e.prayers?.filter(Boolean).length || 0), 0)
  const perfectDays = entries.filter(([, e]) => e.prayers?.every(Boolean)).length
  const totalQuranPages = entries.reduce((sum, [, e]) => sum + (e.quranPages || 0), 0)
  const totalDhikr = entries.reduce((sum, [, e]) => sum + (e.dhikrCount || 0), 0)
  const fastingDays = entries.filter(([, e]) => e.fasting).length

  return {
    prayerPercent: Math.round((totalPrayers / (totalDays * 5)) * 100),
    perfectDays,
    totalQuranPages,
    khatmaProgress: Math.round((totalQuranPages / 604) * 100),
    totalDhikr,
    fastingDays,
    totalDays
  }
}

// ─── Heatmap (SVG, 12 weeks) ───

function renderHeatmap(container) {
  const ns = 'http://www.w3.org/2000/svg'
  const log = getPracticeLog()
  const cellSize = 14
  const gap = 3
  const weeks = 12
  const days = 7
  const labelOffset = 20
  const topOffset = 16
  const width = weeks * (cellSize + gap) + labelOffset + 4
  const height = days * (cellSize + gap) + topOffset + 4

  const svg = document.createElementNS(ns, 'svg')
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
  svg.setAttribute('class', 'heatmap-svg')

  // Day labels — rotated so bottom row (d=6) always matches today's day
  const allDayLabels = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] // Mon=0 … Sun=6
  const todayDow = (new Date().getDay() + 6) % 7 // JS Sun=0 → Mon=0 based
  const dayLabels = [...allDayLabels.slice(todayDow + 1), ...allDayLabels.slice(0, todayDow + 1)]
  dayLabels.forEach((label, i) => {
    if (i % 2 === 0) {
      const t = document.createElementNS(ns, 'text')
      t.setAttribute('x', '0')
      t.setAttribute('y', topOffset + i * (cellSize + gap) + cellSize - 2)
      t.setAttribute('fill', 'var(--text-muted)')
      t.setAttribute('font-size', '10')
      t.setAttribute('font-family', 'var(--font-main)')
      t.textContent = label
      svg.appendChild(t)
    }
  })

  // Month labels across the top
  const today = new Date()
  const monthsSeen = new Map()
  for (let w = 0; w < weeks; w++) {
    const daysAgo = (weeks - 1 - w) * 7
    const date = new Date(today)
    date.setDate(date.getDate() - daysAgo)
    const monthKey = `${date.getFullYear()}-${date.getMonth()}`
    if (!monthsSeen.has(monthKey)) {
      monthsSeen.set(monthKey, { x: labelOffset + w * (cellSize + gap), date })
    }
  }

  monthsSeen.forEach(({ x, date }) => {
    const t = document.createElementNS(ns, 'text')
    t.setAttribute('x', String(x))
    t.setAttribute('y', '10')
    t.setAttribute('fill', 'var(--text-muted)')
    t.setAttribute('font-size', '9')
    t.setAttribute('font-family', 'var(--font-main)')
    t.textContent = date.toLocaleDateString('fr-FR', { month: 'short' })
    svg.appendChild(t)
  })

  // Cells
  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < days; d++) {
      const daysAgo = (weeks - 1 - w) * 7 + (6 - d)
      const date = new Date(today)
      date.setDate(date.getDate() - daysAgo)
      const dateStr = formatDate(date)
      const isFuture = date > today

      const entry = log[dateStr]
      const prayerCount = entry?.prayers?.filter(Boolean).length || 0

      let fillColor = 'var(--clr-glass-border)'
      if (isFuture) {
        fillColor = 'transparent'
      } else if (entry) {
        if (prayerCount === 5) fillColor = 'var(--clr-emerald, #2ecc71)'
        else if (prayerCount >= 3) fillColor = 'var(--clr-gold)'
        else if (prayerCount >= 1) fillColor = 'var(--clr-gold-dim)'
      }

      const rect = document.createElementNS(ns, 'rect')
      rect.setAttribute('x', String(labelOffset + w * (cellSize + gap)))
      rect.setAttribute('y', String(topOffset + d * (cellSize + gap)))
      rect.setAttribute('width', String(cellSize))
      rect.setAttribute('height', String(cellSize))
      rect.setAttribute('rx', '3')
      rect.setAttribute('fill', fillColor)

      if (!isFuture) {
        rect.setAttribute('stroke', 'var(--clr-glass-border)')
        rect.setAttribute('stroke-width', '0.5')
      }

      // Tooltip via title element
      if (!isFuture) {
        const title = document.createElementNS(ns, 'title')
        title.textContent = `${dateStr}: ${prayerCount}/5 prieres`
        rect.appendChild(title)
      }

      svg.appendChild(rect)
    }
  }

  container.replaceChildren()
  container.appendChild(svg)
}

// ─── Stats grid rendering ───

function renderStats(stats) {
  const grid = document.getElementById('stats-grid')
  if (!grid) return

  const items = [
    { label: 'Prieres', value: `${stats.prayerPercent}%`, icon: 'fa-mosque' },
    { label: 'Jours parfaits', value: stats.perfectDays, icon: 'fa-star' },
    { label: 'Pages Coran', value: stats.totalQuranPages, icon: 'fa-book-quran' },
    { label: 'Khatma', value: `${stats.khatmaProgress}%`, icon: 'fa-bookmark' },
    { label: 'Dhikr total', value: stats.totalDhikr, icon: 'fa-circle-notch' },
    { label: 'Jours jeune', value: stats.fastingDays, icon: 'fa-utensils' }
  ]

  grid.replaceChildren()

  items.forEach(item => {
    const card = document.createElement('div')
    card.className = 'stat-card'

    const icon = document.createElement('i')
    icon.className = `fa-solid ${item.icon} stat-card-icon`
    card.appendChild(icon)

    const value = document.createElement('span')
    value.className = 'stat-card-value'
    value.textContent = String(item.value)
    card.appendChild(value)

    const label = document.createElement('span')
    label.className = 'stat-card-label'
    label.textContent = item.label
    card.appendChild(label)

    grid.appendChild(card)
  })
}

// ─── Streaks rendering ───

function renderStreaks() {
  const container = document.getElementById('stats-streaks')
  if (!container) return

  const streaks = [
    { label: 'Prieres 5/5', value: getStreak('prayers'), icon: 'fa-mosque' },
    { label: 'Jeune', value: getStreak('fasting'), icon: 'fa-utensils' },
    { label: 'Coran', value: getStreak('quran'), icon: 'fa-book-quran' },
    { label: 'Dhikr', value: getStreak('dhikr'), icon: 'fa-circle-notch' }
  ]

  container.replaceChildren()

  streaks.forEach(s => {
    const item = document.createElement('div')
    item.className = 'streak-item'

    const icon = document.createElement('i')
    icon.className = `fa-solid ${s.icon}`
    icon.style.color = 'var(--text-muted)'
    item.appendChild(icon)

    const val = document.createElement('span')
    val.className = 'streak-value'
    val.textContent = `${s.value}j`
    item.appendChild(val)

    const lbl = document.createElement('span')
    lbl.textContent = s.label
    lbl.style.color = 'var(--text-muted)'
    lbl.style.fontSize = '0.85rem'
    item.appendChild(lbl)

    container.appendChild(item)
  })
}

// ─── Journal count ───

function renderJournalCount() {
  const el = document.getElementById('stats-journal-count')
  if (!el) return
  const count = getJournalEntryCount()
  el.textContent = `${count} entree${count !== 1 ? 's' : ''} au total`
}

// ─── Goals system ───

function getGoals() {
  return storage.get(GOALS_KEY) || []
}

function saveGoals(goals) {
  storage.set(GOALS_KEY, goals)
}

function calculateGoalProgress(goal) {
  const log = getPracticeLog()

  if (goal.type === 'prayer-streak') {
    if (goal.prayer === 'all') return getStreak('prayers')
    // specific prayer streak — check consecutive calendar days
    let streak = 0
    const today = formatDate(new Date())
    let expected = today
    while (log[expected]) {
      if (log[expected]?.prayers?.[goal.prayer]) {
        streak++
        const [y, m, d] = expected.split('-').map(Number)
        const prev = new Date(y, m - 1, d - 1)
        expected = formatDate(prev)
      } else {
        break
      }
    }
    return streak
  }

  if (goal.type === 'quran-total') {
    return Object.values(log).reduce((s, e) => s + (e.quranPages || 0), 0)
  }

  if (goal.type === 'dhikr-monthly') {
    const now = new Date()
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    return Object.entries(log)
      .filter(([k]) => k.startsWith(monthPrefix))
      .reduce((s, [, e]) => s + (e.dhikrCount || 0), 0)
  }

  if (goal.type === 'fasting-weeks') {
    return Object.values(log).filter(e => e.fasting).length
  }

  return 0
}

function addGoal(presetId) {
  const preset = PRESET_GOALS.find(p => p.id === presetId)
  if (!preset) return
  const goals = getGoals()
  if (goals.find(g => g.id === preset.id)) return
  goals.push({ ...preset, completed: false })
  saveGoals(goals)
  renderGoals()
}

function removeGoal(goalId) {
  const goals = getGoals().filter(g => g.id !== goalId)
  saveGoals(goals)
  renderGoals()
}

function renderGoals() {
  const container = document.getElementById('stats-goals')
  const select = document.getElementById('stats-goal-select')
  if (!container) return

  const goals = getGoals()
  container.replaceChildren()

  if (goals.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'stats-journal-count'
    empty.textContent = 'Aucun objectif defini. Ajoutez-en un ci-dessous !'
    container.appendChild(empty)
  }

  goals.forEach(goal => {
    const progress = calculateGoalProgress(goal)
    const percent = Math.min(100, Math.round((progress / goal.target) * 100))
    const isCompleted = percent >= 100

    // Update completed status in storage
    if (isCompleted && !goal.completed) {
      goal.completed = true
      saveGoals(goals)
    }

    const item = document.createElement('div')
    item.className = `goal-item${isCompleted ? ' goal-completed' : ''}`

    const header = document.createElement('div')
    header.className = 'goal-header'

    const label = document.createElement('span')
    label.className = 'goal-label'
    label.textContent = goal.label
    header.appendChild(label)

    const right = document.createElement('div')
    right.style.display = 'flex'
    right.style.alignItems = 'center'
    right.style.gap = '8px'

    const progressText = document.createElement('span')
    progressText.className = 'goal-progress-text'
    progressText.textContent = `${progress}/${goal.target}`
    right.appendChild(progressText)

    const removeBtn = document.createElement('button')
    removeBtn.className = 'goal-remove-btn'
    const removeIcon = document.createElement('i')
    removeIcon.className = 'fa-solid fa-xmark'
    removeBtn.appendChild(removeIcon)
    removeBtn.addEventListener('click', () => removeGoal(goal.id))
    right.appendChild(removeBtn)

    header.appendChild(right)
    item.appendChild(header)

    const bar = document.createElement('div')
    bar.className = 'goal-bar'

    const fill = document.createElement('div')
    fill.className = 'goal-bar-fill'
    fill.style.width = `${percent}%`
    bar.appendChild(fill)

    item.appendChild(bar)
    container.appendChild(item)
  })

  // Populate preset select
  if (select) {
    const existingIds = new Set(goals.map(g => g.id))
    select.replaceChildren()

    const defaultOpt = document.createElement('option')
    defaultOpt.value = ''
    defaultOpt.textContent = 'Ajouter un objectif...'
    select.appendChild(defaultOpt)

    PRESET_GOALS.filter(p => !existingIds.has(p.id)).forEach(preset => {
      const opt = document.createElement('option')
      opt.value = preset.id
      opt.textContent = preset.label
      select.appendChild(opt)
    })
  }
}

// ─── Period filter handlers ───

function setupPeriodButtons() {
  const btns = document.querySelectorAll('.stats-period-btn')
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      currentPeriod = btn.dataset.period
      refreshStats()
    })
  })
}

// ─── Refresh all stats ───

function refreshStats() {
  const stats = computeStats(currentPeriod)
  renderStats(stats)
  renderHeatmap(document.getElementById('stats-heatmap'))
  renderStreaks()
  renderJournalCount()
  renderGoals()
}

// ─── Init ───

export function initStatistics() {
  if (initialized) return
  initialized = true

  setupPeriodButtons()

  // Add goal button
  const addBtn = document.getElementById('stats-add-goal-btn')
  const select = document.getElementById('stats-goal-select')
  if (addBtn && select) {
    addBtn.addEventListener('click', () => {
      const val = select.value
      if (val) {
        addGoal(val)
        select.value = ''
      }
    })
  }

  refreshStats()
}
