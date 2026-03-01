import storage from './storage.js'

const JOURNAL_KEY = 'journal'
const PRUNE_DAYS = 365
const PLACEHOLDERS = [
  "Qu'est-ce qui t'a marque aujourd'hui ?",
  'Pour quoi es-tu reconnaissant ?',
  'Quelle intention pour demain ?',
  "Qu'as-tu appris aujourd'hui ?",
  'Quel moment t\'a rendu heureux ?'
]

let initialized = false
let autoSaveTimer = null

function getToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getJournal() {
  return storage.get(JOURNAL_KEY) || {}
}

function saveJournal(journal) {
  storage.set(JOURNAL_KEY, journal)
}

function pruneJournal() {
  const journal = getJournal()
  const keys = Object.keys(journal).sort()
  if (keys.length <= PRUNE_DAYS) return
  const toRemove = keys.slice(0, keys.length - PRUNE_DAYS)
  toRemove.forEach(k => delete journal[k])
  saveJournal(journal)
}

function saveEntry(text) {
  const journal = getJournal()
  const today = getToday()
  if (text.trim()) {
    journal[today] = text
  } else {
    delete journal[today]
  }
  saveJournal(journal)
  populateMonthFilter()
  renderHistory()
}

function getRandomPlaceholder() {
  return PLACEHOLDERS[Math.floor(Math.random() * PLACEHOLDERS.length)]
}

function formatDateLabel(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const today = getToday()
  if (dateStr === today) return "Aujourd'hui"

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`
  if (dateStr === yesterdayStr) return 'Hier'

  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function getAvailableMonths() {
  const journal = getJournal()
  const months = new Set()
  Object.keys(journal).forEach(dateStr => {
    months.add(dateStr.substring(0, 7)) // YYYY-MM
  })
  return Array.from(months).sort().reverse()
}

function formatMonthLabel(monthStr) {
  const [y, m] = monthStr.split('-').map(Number)
  const date = new Date(y, m - 1, 1)
  return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

export function getJournalEntryCount(monthStr) {
  const journal = getJournal()
  if (!monthStr) return Object.keys(journal).length
  return Object.keys(journal).filter(k => k.startsWith(monthStr)).length
}

// --- Rendering ---

function renderHistory() {
  const container = document.getElementById('journal-history')
  const filterSelect = document.getElementById('journal-month-filter')
  if (!container) return

  const journal = getJournal()
  const selectedMonth = filterSelect?.value || 'all'

  let entries = Object.entries(journal)
    .sort(([a], [b]) => b.localeCompare(a)) // DESC by date

  if (selectedMonth !== 'all') {
    entries = entries.filter(([dateStr]) => dateStr.startsWith(selectedMonth))
  }

  container.replaceChildren()

  if (entries.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'journal-empty'
    empty.textContent = selectedMonth === 'all'
      ? 'Aucune entree pour le moment. Commence a ecrire !'
      : 'Aucune entree ce mois-ci.'
    container.appendChild(empty)
    return
  }

  entries.forEach(([dateStr, text]) => {
    const entry = document.createElement('div')
    entry.className = 'journal-entry'

    const dateEl = document.createElement('h3')
    dateEl.className = 'journal-entry-date'
    dateEl.textContent = formatDateLabel(dateStr)

    const textEl = document.createElement('p')
    textEl.className = 'journal-entry-text'
    textEl.textContent = text // textContent, NEVER innerHTML

    entry.append(dateEl, textEl)
    container.appendChild(entry)
  })
}

function populateMonthFilter() {
  const select = document.getElementById('journal-month-filter')
  if (!select) return

  const currentValue = select.value || 'all'
  select.replaceChildren()

  const allOpt = document.createElement('option')
  allOpt.value = 'all'
  allOpt.textContent = 'Tous les mois'
  select.appendChild(allOpt)

  const months = getAvailableMonths()
  months.forEach(m => {
    const opt = document.createElement('option')
    opt.value = m
    opt.textContent = formatMonthLabel(m)
    opt.selected = m === currentValue
    select.appendChild(opt)
  })
}

export function initJournal() {
  if (initialized) return
  initialized = true

  pruneJournal()

  const textarea = document.getElementById('journal-textarea')
  const saveBtn = document.getElementById('journal-save-btn')
  const filterSelect = document.getElementById('journal-month-filter')

  if (textarea) {
    textarea.placeholder = getRandomPlaceholder()

    // Load today's entry
    const journal = getJournal()
    const today = getToday()
    if (journal[today]) textarea.value = journal[today]

    // Auto-save after 3s
    textarea.addEventListener('input', () => {
      if (autoSaveTimer) clearTimeout(autoSaveTimer)
      autoSaveTimer = setTimeout(() => {
        saveEntry(textarea.value)
        showSaveIndicator()
      }, 3000)
    })
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      if (autoSaveTimer) clearTimeout(autoSaveTimer)
      if (textarea) {
        saveEntry(textarea.value)
        showSaveIndicator()
      }
    })
  }

  if (filterSelect) {
    filterSelect.addEventListener('change', () => renderHistory())
  }

  populateMonthFilter()
  renderHistory()
}

function showSaveIndicator() {
  const indicator = document.getElementById('journal-save-indicator')
  if (!indicator) return
  indicator.textContent = 'Sauvegarde'
  indicator.classList.remove('hidden')
  setTimeout(() => indicator.classList.add('hidden'), 2000)
}
