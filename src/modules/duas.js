/**
 * duas.js — Encyclopédie des Douas
 *
 * Full view accessible from the sidebar. Displays a searchable, categorized
 * collection of Islamic supplications with favorites, copy, and collapsible
 * subcategories.
 */

import duasData from '../data/duas.json'
import storage from './storage.js'

const FAVORITES_KEY = 'duaFavorites'

let initialized = false
let searchTimeout = null

function getFavorites() {
  return storage.get(FAVORITES_KEY) || []
}

function toggleFavorite(duaId) {
  const favs = getFavorites()
  const idx = favs.indexOf(duaId)
  if (idx === -1) favs.push(duaId)
  else favs.splice(idx, 1)
  storage.set(FAVORITES_KEY, favs)
  return idx === -1 // returns true if now favorited
}

function isFavorite(duaId) {
  return getFavorites().includes(duaId)
}

function getAllDuas() {
  const all = []
  duasData.categories.forEach(cat => {
    cat.subcategories.forEach(sub => {
      sub.duas.forEach(dua => {
        all.push({ ...dua, categoryName: cat.name, subcategoryName: sub.name })
      })
    })
  })
  return all
}

function copyDua(dua) {
  const parts = [dua.arabic, dua.transliteration, dua.translation, dua.reference]
  if (dua.context) parts.push(dua.context)
  const text = parts.filter(Boolean).join('\n\n')
  navigator.clipboard.writeText(text)
}

// ─── Rendering ───

function renderDuaItem(dua) {
  const item = document.createElement('div')
  item.className = 'dua-item'
  item.dataset.duaId = dua.id

  const arabic = document.createElement('p')
  arabic.className = 'dua-arabic'
  arabic.textContent = dua.arabic

  const translit = document.createElement('p')
  translit.className = 'dua-transliteration'
  translit.textContent = dua.transliteration

  const translation = document.createElement('p')
  translation.className = 'dua-translation'
  translation.textContent = dua.translation

  const meta = document.createElement('div')
  meta.className = 'dua-meta'

  const ref = document.createElement('span')
  ref.className = 'dua-reference'
  ref.textContent = dua.reference
  meta.appendChild(ref)

  if (dua.context) {
    const ctx = document.createElement('span')
    ctx.className = 'dua-context'
    ctx.textContent = dua.context
    meta.appendChild(ctx)
  }

  if (dua.repeat && dua.repeat > 1) {
    const rep = document.createElement('span')
    rep.className = 'dua-repeat'
    rep.textContent = `\u00d7 ${dua.repeat}`
    meta.appendChild(rep)
  }

  const actions = document.createElement('div')
  actions.className = 'dua-actions'

  const favBtn = document.createElement('button')
  favBtn.className = `dua-fav-btn ${isFavorite(dua.id) ? 'active' : ''}`
  favBtn.title = 'Ajouter aux favoris'
  favBtn.textContent = isFavorite(dua.id) ? '\u2605' : '\u2606'
  favBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    const nowFav = toggleFavorite(dua.id)
    favBtn.textContent = nowFav ? '\u2605' : '\u2606'
    favBtn.classList.toggle('active', nowFav)
    renderFavoritesSection()
  })
  actions.appendChild(favBtn)

  const copyBtn = document.createElement('button')
  copyBtn.className = 'dua-copy-btn btn-icon-small'
  copyBtn.title = 'Copier'
  const copyIcon = document.createElement('i')
  copyIcon.className = 'fa-regular fa-copy'
  copyBtn.appendChild(copyIcon)
  const copyText = document.createTextNode(' Copier')
  copyBtn.appendChild(copyText)
  copyBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    copyDua(dua)
    copyBtn.replaceChildren()
    copyBtn.textContent = 'Copie !'
    setTimeout(() => {
      copyBtn.replaceChildren()
      const icon = document.createElement('i')
      icon.className = 'fa-regular fa-copy'
      copyBtn.appendChild(icon)
      copyBtn.appendChild(document.createTextNode(' Copier'))
    }, 2000)
  })
  actions.appendChild(copyBtn)

  item.append(arabic, translit, translation, meta, actions)
  return item
}

function renderSubcategory(sub, isOpen = false) {
  const section = document.createElement('div')
  section.className = 'dua-subcategory'

  const header = document.createElement('div')
  header.className = `dua-subcategory-header ${isOpen ? 'open' : ''}`

  const title = document.createElement('span')
  title.textContent = `${sub.name} (${sub.duas.length})`

  const chevron = document.createElement('i')
  chevron.className = `fa-solid fa-chevron-right dua-chevron ${isOpen ? 'open' : ''}`

  header.append(chevron, title)

  const content = document.createElement('div')
  content.className = `dua-subcategory-content ${isOpen ? '' : 'hidden'}`

  sub.duas.forEach(dua => {
    content.appendChild(renderDuaItem(dua))
  })

  header.addEventListener('click', () => {
    const isNowHidden = content.classList.toggle('hidden')
    chevron.classList.toggle('open', !isNowHidden)
    header.classList.toggle('open', !isNowHidden)
  })

  section.append(header, content)
  return section
}

function renderCategory(cat) {
  const section = document.createElement('div')
  section.className = 'dua-category'

  const header = document.createElement('div')
  header.className = 'dua-category-header'

  const icon = document.createElement('i')
  icon.className = `fa-solid ${cat.icon}`

  const title = document.createElement('h3')
  title.textContent = cat.name

  const count = document.createElement('span')
  count.className = 'dua-category-count'
  const total = cat.subcategories.reduce((sum, s) => sum + s.duas.length, 0)
  count.textContent = `${total} douas`

  header.append(icon, title, count)
  section.appendChild(header)

  cat.subcategories.forEach(sub => {
    section.appendChild(renderSubcategory(sub))
  })

  return section
}

let favoritesSection = null

function renderFavoritesSection() {
  const container = document.getElementById('duas-container')
  if (!container) return

  const favs = getFavorites()

  // Remove old favorites section
  if (favoritesSection && favoritesSection.parentNode) {
    favoritesSection.remove()
  }

  if (favs.length === 0) {
    favoritesSection = null
    return
  }

  const allDuas = getAllDuas()
  const favDuas = allDuas.filter(d => favs.includes(d.id))

  favoritesSection = document.createElement('div')
  favoritesSection.className = 'dua-category dua-favorites-section'

  const header = document.createElement('div')
  header.className = 'dua-category-header'
  const icon = document.createElement('i')
  icon.className = 'fa-solid fa-star'
  const title = document.createElement('h3')
  title.textContent = 'Mes favoris'
  const count = document.createElement('span')
  count.className = 'dua-category-count'
  count.textContent = `${favDuas.length} douas`
  header.append(icon, title, count)
  favoritesSection.appendChild(header)

  const content = document.createElement('div')
  content.className = 'dua-favorites-content'
  favDuas.forEach(dua => content.appendChild(renderDuaItem(dua)))
  favoritesSection.appendChild(content)

  // Insert at top
  container.insertBefore(favoritesSection, container.firstChild)
}

function renderAllCategories() {
  const container = document.getElementById('duas-container')
  if (!container) return

  container.replaceChildren()

  // Render favorites first
  renderFavoritesSection()

  // Render all categories
  duasData.categories.forEach(cat => {
    container.appendChild(renderCategory(cat))
  })
}

function handleSearch(query) {
  const container = document.getElementById('duas-container')
  if (!container) return

  if (!query || query.trim().length < 2) {
    renderAllCategories()
    return
  }

  const q = query.toLowerCase().trim()
  const allDuas = getAllDuas()
  const results = allDuas.filter(d =>
    (d.translation && d.translation.toLowerCase().includes(q)) ||
    (d.transliteration && d.transliteration.toLowerCase().includes(q)) ||
    (d.reference && d.reference.toLowerCase().includes(q)) ||
    (d.context && d.context.toLowerCase().includes(q))
  )

  container.replaceChildren()

  if (results.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'duas-empty'
    empty.textContent = `Aucune doua trouvee pour "${query}"`
    container.appendChild(empty)
    return
  }

  const resultHeader = document.createElement('p')
  resultHeader.className = 'duas-result-count'
  resultHeader.textContent = `${results.length} resultat${results.length > 1 ? 's' : ''}`
  container.appendChild(resultHeader)

  results.forEach(dua => container.appendChild(renderDuaItem(dua)))
}

export function initDuas() {
  if (initialized) return
  initialized = true

  const searchInput = document.getElementById('duas-search')
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      if (searchTimeout) clearTimeout(searchTimeout)
      searchTimeout = setTimeout(() => handleSearch(e.target.value), 300)
    })
  }

  renderAllCategories()
}
