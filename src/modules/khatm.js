/**
 * khatm.js — Planificateur de Khatm (lecture complète du Coran)
 *
 * Transforme le suivi `quranPages` du practice-tracker en plan de complétion
 * du Coran avec objectif quotidien, progression par Juz' et indicateur de rythme.
 *
 * Stockage : clé `khatmPlan` (un seul plan actif à la fois).
 * Lecture seule sur le practiceLog via getPracticeLog().
 *
 * Pièges :
 * - Le practiceLog est pruné aux 90 jours les plus récents. rollupOldPages()
 *   absorbe les jours hors fenêtre dans rolledUpPages AVANT que le prune ne
 *   puisse les toucher → initKhatm() DOIT tourner avant initTracker() (main.js).
 * - Clés de date locales (getFullYear/getMonth/getDate), jamais toISOString().
 */

import storage from './storage.js'
import { getPracticeLog } from './practice-tracker.js'
import { getRamadanDay } from './app-mode.js'

const KHATM_KEY = 'khatmPlan'
const DEFAULT_TOTAL_PAGES = 604
const ROLLUP_SAFE_DAYS = 60
const DAILY_WARNING_THRESHOLD = 50 // clamp de pages/jour du tracker

// Contexte Hijri courant (mis à jour depuis main.loadPrayerData)
let currentHijriDate = null

// ─── Utilitaires de date (clés locales YYYY-MM-DD) ───

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dateFromKey(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function keyFromDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function shiftKey(key, offsetDays) {
  const d = dateFromKey(key)
  d.setDate(d.getDate() + offsetDays)
  return keyFromDate(d)
}

// Nombre de jours entiers entre deux clés (toKey - fromKey)
function diffDays(fromKey, toKey) {
  const ms = dateFromKey(toKey).getTime() - dateFromKey(fromKey).getTime()
  return Math.round(ms / 86_400_000)
}

// ─── Contexte Hijri ───

export function setHijriContext(hijriDate) {
  currentHijriDate = hijriDate
}

// ─── Date cible par défaut ───

/**
 * Date cible préremplie du formulaire.
 * En Ramadan : +(30 − jour) jours pour finir avec le mois (min +1).
 * Sinon : +30 jours.
 */
export function defaultTargetDate(hijriDate, today = todayKey()) {
  const ramadanDay = getRamadanDay(hijriDate)
  let offset = 30
  if (ramadanDay !== null) {
    offset = Math.max(1, 30 - ramadanDay)
  }
  return shiftKey(today, offset)
}

// ─── Calcul de progression (pur, testé) ───

/**
 * Calcule l'état d'avancement d'un plan de khatm.
 * pagesRead = startOffset + rolledUpPages + Σ log[d].quranPages
 *             pour startDate ≤ d ≤ today et d > rolledUpThrough.
 */
export function computeKhatmProgress(plan, log, today = todayKey()) {
  const totalPages = plan.totalPages || DEFAULT_TOTAL_PAGES

  // Somme des pages dans la fenêtre live (jours non absorbés)
  let liveSum = 0
  let pagesToday = 0
  Object.entries(log).forEach(([dateKey, entry]) => {
    if (dateKey < plan.startDate) return
    if (dateKey > today) return
    if (plan.rolledUpThrough && dateKey <= plan.rolledUpThrough) return
    const pages = entry.quranPages || 0
    liveSum += pages
    if (dateKey === today) pagesToday = pages
  })

  const pagesRead = Math.min(
    totalPages,
    (plan.startOffset || 0) + (plan.rolledUpPages || 0) + liveSum
  )
  const remaining = Math.max(0, totalPages - pagesRead)
  const percent = Math.min(100, Math.round((pagesRead / totalPages) * 100))
  const done = pagesRead >= totalPages

  // Jours restants : aujourd'hui inclus, minimum 1 (cible passée → rattrapage total)
  const daysRemaining = Math.max(1, diffDays(today, plan.targetDate) + 1)

  // Objectif du jour : on calcule le reste en DÉBUT de journée (today exclu)
  // pour que l'objectif ne rétrécisse pas pendant la saisie des pages.
  const readBeforeToday = pagesRead - pagesToday
  const remainderStartOfDay = Math.max(0, totalPages - readBeforeToday)
  const dailyTarget = Math.ceil(remainderStartOfDay / daysRemaining)

  // Juz' : 1..30
  const juz = Math.min(30, Math.floor(pagesRead / (totalPages / 30)) + 1)

  // Rythme : comparaison au rythme attendu sur la durée du plan
  const duration = Math.max(1, diffDays(plan.startDate, plan.targetDate))
  const elapsed = Math.max(0, Math.min(duration, diffDays(plan.startDate, today)))
  const expected = (totalPages * elapsed) / duration
  let pace = 'ontrack'
  if (pagesRead >= expected) {
    pace = 'ahead'
  } else if (expected - pagesRead > dailyTarget) {
    pace = 'behind'
  }

  return { pagesRead, pagesToday, remaining, daysRemaining, dailyTarget, percent, juz, pace, done }
}

// ─── Rollup des jours hors fenêtre live ───

/**
 * Absorbe dans rolledUpPages tous les jours plus vieux que safeDays,
 * et avance rolledUpThrough jusqu'à la limite. Idempotent.
 * @returns {{ plan: object, changed: boolean }}
 */
export function rollupOldPages(plan, log, today = todayKey(), safeDays = ROLLUP_SAFE_DAYS) {
  if (!plan || !plan.active) return { plan, changed: false }

  // Limite : toute date strictement antérieure à (today − safeDays) est absorbée.
  const cutoff = shiftKey(today, -safeDays - 1) // dernière date incluse dans le rollup

  // Rien à absorber si on a déjà couvert cette limite
  if (plan.rolledUpThrough && plan.rolledUpThrough >= cutoff) {
    return { plan, changed: false }
  }

  const fromExclusive = plan.rolledUpThrough // jours > rolledUpThrough seulement
  let absorbed = 0
  let hasEntryToAbsorb = false
  Object.entries(log).forEach(([dateKey, entry]) => {
    if (dateKey < plan.startDate) return
    if (dateKey > cutoff) return
    if (fromExclusive && dateKey <= fromExclusive) return
    hasEntryToAbsorb = true
    absorbed += entry.quranPages || 0
  })

  // Rien à absorber : ne pas avancer rolledUpThrough inutilement (laisse la
  // fenêtre live intacte tant qu'aucune entrée n'en sort).
  if (!hasEntryToAbsorb) {
    return { plan, changed: false }
  }

  const updated = {
    ...plan,
    rolledUpPages: (plan.rolledUpPages || 0) + absorbed,
    rolledUpThrough: cutoff,
  }
  return { plan: updated, changed: true }
}

// ─── Persistance ───

function getPlan() {
  return storage.get(KHATM_KEY) || null
}

function savePlan(plan) {
  storage.set(KHATM_KEY, plan)
}

function clearPlan() {
  storage.remove(KHATM_KEY)
}

function createPlan({ targetDate, totalPages, startOffset }) {
  const today = todayKey()
  return {
    active: true,
    startDate: today,
    targetDate,
    totalPages: totalPages || DEFAULT_TOTAL_PAGES,
    startOffset: startOffset || 0,
    rolledUpPages: 0,
    rolledUpThrough: null,
    completedAt: null,
  }
}

// ─── Rendu de la carte ───

function formatDateFr(key) {
  return dateFromKey(key).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}

function renderEmpty(body) {
  body.replaceChildren()

  const intro = document.createElement('p')
  intro.className = 'khatm-intro'
  intro.textContent = 'Planifiez une lecture complète du Coran à votre rythme.'
  body.appendChild(intro)

  const form = document.createElement('div')
  form.className = 'khatm-form'

  // Date cible
  const targetLabel = document.createElement('label')
  targetLabel.className = 'khatm-field'
  const targetText = document.createElement('span')
  targetText.textContent = 'Date cible'
  const targetInput = document.createElement('input')
  targetInput.type = 'date'
  targetInput.className = 'khatm-input'
  targetInput.value = defaultTargetDate(currentHijriDate)
  targetInput.min = todayKey()
  targetLabel.append(targetText, targetInput)
  form.appendChild(targetLabel)

  // Pages totales
  const totalLabel = document.createElement('label')
  totalLabel.className = 'khatm-field'
  const totalText = document.createElement('span')
  totalText.textContent = 'Pages totales'
  const totalInput = document.createElement('input')
  totalInput.type = 'number'
  totalInput.className = 'khatm-input'
  totalInput.min = '1'
  totalInput.value = String(DEFAULT_TOTAL_PAGES)
  totalLabel.append(totalText, totalInput)
  form.appendChild(totalLabel)

  // Pages déjà lues
  const offsetLabel = document.createElement('label')
  offsetLabel.className = 'khatm-field'
  const offsetText = document.createElement('span')
  offsetText.textContent = 'Pages déjà lues'
  const offsetInput = document.createElement('input')
  offsetInput.type = 'number'
  offsetInput.className = 'khatm-input'
  offsetInput.min = '0'
  offsetInput.value = '0'
  offsetLabel.append(offsetText, offsetInput)
  form.appendChild(offsetLabel)

  const startBtn = document.createElement('button')
  startBtn.className = 'khatm-btn-primary'
  startBtn.textContent = 'Démarrer'
  startBtn.addEventListener('click', () => {
    const targetDate = targetInput.value || defaultTargetDate(currentHijriDate)
    const totalPages = Math.max(1, parseInt(totalInput.value, 10) || DEFAULT_TOTAL_PAGES)
    const startOffset = Math.max(0, parseInt(offsetInput.value, 10) || 0)
    savePlan(createPlan({ targetDate, totalPages, startOffset }))
    renderKhatm()
  })
  form.appendChild(startBtn)

  body.appendChild(form)
}

function renderActive(body, plan, progress) {
  body.replaceChildren()

  // Barre de progression
  const bar = document.createElement('div')
  bar.className = 'khatm-progress-bar'
  const fill = document.createElement('div')
  fill.className = 'khatm-progress-fill'
  fill.style.width = `${progress.percent}%`
  bar.appendChild(fill)
  body.appendChild(bar)

  const pagesLine = document.createElement('div')
  pagesLine.className = 'khatm-pages-line'
  pagesLine.textContent = `${progress.pagesRead} / ${plan.totalPages} pages (${progress.percent}%)`
  body.appendChild(pagesLine)

  // Juz' + badge de rythme
  const meta = document.createElement('div')
  meta.className = 'khatm-meta'

  const juzEl = document.createElement('span')
  juzEl.className = 'khatm-juz'
  juzEl.textContent = `Juz' ${progress.juz}/30`
  meta.appendChild(juzEl)

  const paceEl = document.createElement('span')
  paceEl.className = `khatm-pace ${progress.pace}`
  paceEl.textContent = paceLabel(progress.pace)
  meta.appendChild(paceEl)

  body.appendChild(meta)

  // Objectif du jour + lu aujourd'hui
  const targetEl = document.createElement('div')
  targetEl.className = 'khatm-daily-target'
  targetEl.textContent = `Objectif du jour : ${progress.dailyTarget} pages`
  body.appendChild(targetEl)

  const todayEl = document.createElement('div')
  todayEl.className = 'khatm-today'
  todayEl.textContent = `Lu aujourd'hui : ${progress.pagesToday} pages`
  // Renvoi vers l'input du tracker (chemin d'écriture unique)
  const hint = document.createElement('span')
  hint.className = 'khatm-hint'
  hint.textContent = ' — à saisir dans Aujourd\'hui'
  todayEl.appendChild(hint)
  body.appendChild(todayEl)

  // Avertissement si l'objectif dépasse le clamp du tracker
  if (progress.dailyTarget > DAILY_WARNING_THRESHOLD) {
    const warn = document.createElement('div')
    warn.className = 'khatm-warning'
    warn.textContent = `Objectif > ${DAILY_WARNING_THRESHOLD} pages/jour — repoussez la date cible`
    body.appendChild(warn)
  }

  // Date cible
  const dateEl = document.createElement('div')
  dateEl.className = 'khatm-date-cible'
  dateEl.textContent = `Cible : ${formatDateFr(plan.targetDate)}`
  body.appendChild(dateEl)

  // Bouton abandonner
  const abandonBtn = document.createElement('button')
  abandonBtn.className = 'khatm-btn-text'
  abandonBtn.textContent = 'Abandonner'
  abandonBtn.addEventListener('click', () => {
    clearPlan()
    renderKhatm()
  })
  body.appendChild(abandonBtn)
}

function renderCompleted(body, plan) {
  body.replaceChildren()

  const icon = document.createElement('div')
  icon.className = 'khatm-done-icon'
  const i = document.createElement('i')
  i.className = 'fa-solid fa-circle-check'
  icon.appendChild(i)
  body.appendChild(icon)

  const msg = document.createElement('p')
  msg.className = 'khatm-done-msg'
  msg.textContent = 'Khatm complété, mabrouk ! Qu\'Allah accepte votre lecture.'
  body.appendChild(msg)

  const restartBtn = document.createElement('button')
  restartBtn.className = 'khatm-btn-primary'
  restartBtn.textContent = 'Recommencer'
  restartBtn.addEventListener('click', () => {
    clearPlan()
    renderKhatm()
  })
  body.appendChild(restartBtn)
}

function paceLabel(pace) {
  if (pace === 'ahead') return 'En avance'
  if (pace === 'behind') return 'En retard'
  return 'Dans les temps'
}

function renderKhatm() {
  const card = document.getElementById('khatm-card')
  const body = document.getElementById('khatm-body')
  if (!card || !body) return

  const plan = getPlan()

  if (!plan || !plan.active) {
    renderEmpty(body)
    return
  }

  const progress = computeKhatmProgress(plan, getPracticeLog())

  // Marque la complétion une seule fois
  if (progress.done && !plan.completedAt) {
    savePlan({ ...plan, completedAt: todayKey() })
  }

  if (progress.done) {
    renderCompleted(body, plan)
  } else {
    renderActive(body, plan, progress)
  }
}

// ─── Rendu de la ligne Stats ───

/**
 * Remplit #stats-khatm avec une ligne de progression (vide si aucun plan actif).
 */
export function renderKhatmStats() {
  const container = document.getElementById('stats-khatm')
  if (!container) return
  container.replaceChildren()

  const plan = getPlan()
  if (!plan || !plan.active) return

  const progress = computeKhatmProgress(plan, getPracticeLog())

  const row = document.createElement('div')
  row.className = 'khatm-stat-row'

  const label = document.createElement('span')
  label.className = 'khatm-stat-label'
  label.textContent = `Khatm — Juz' ${progress.juz}/30`
  row.appendChild(label)

  const value = document.createElement('span')
  value.className = 'khatm-stat-value'
  value.textContent = `${progress.percent}%`
  row.appendChild(value)

  container.appendChild(row)

  const bar = document.createElement('div')
  bar.className = 'khatm-progress-bar'
  const fill = document.createElement('div')
  fill.className = 'khatm-progress-fill'
  fill.style.width = `${progress.percent}%`
  bar.appendChild(fill)
  container.appendChild(bar)
}

// ─── Init ───

/**
 * Initialise le planificateur de khatm.
 * IMPORTANT : appeler AVANT initTracker() (rollup avant prune des 90 jours).
 */
export function initKhatm() {
  // Rollup des jours hors fenêtre live avant tout prune du practiceLog
  const plan = getPlan()
  if (plan && plan.active) {
    const { plan: rolled, changed } = rollupOldPages(plan, getPracticeLog(), todayKey())
    if (changed) savePlan(rolled)
  }

  renderKhatm()

  // Re-rendu en direct quand le tracker enregistre des pages
  document.addEventListener('khatm-refresh', renderKhatm)
}
