# GuideME Ramadan v2 — Plan d'implémentation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transformer GuideME Ramadan d'un outil Ramadan en compagnon spirituel quotidien toute l'année — 7 features, 7 nouveaux modules, 0 nouvelles dépendances.

**Architecture:** Chaque feature = 1 module ES autonome (`src/modules/`), exportant des fonctions nommées. Persistance via `storage.js` (Tauri store). DOM via `getElementById`/`querySelector` avec null guards. CSS via variables `--clr-{component}-{purpose}`. Nouvelles vues ajoutées au système `navTabs` existant dans `main.js`.

**Tech Stack:** Vanilla JS (ES modules), Tauri v2 store, CSS variables, SVG (heatmap/qibla), JSON statique (douas/contenu).

**Design document:** `docs/plans/2026-02-27-guideme-v2-design.md`

**Sécurité XSS:** Tout contenu dynamique injecté dans le DOM doit utiliser `textContent` pour le texte brut, ou `escapeHtml()` de `src/modules/sanitize.js` si du HTML est nécessaire. Ne jamais injecter de contenu utilisateur non sanitisé via des méthodes d'insertion HTML.

---

## Phase 1 : Fondation — Mode système + Géolocalisation

### Task 1 : Module app-mode.js

**Files:**
- Create: `src/modules/app-mode.js`

**Step 1: Créer le module**

```js
// src/modules/app-mode.js
import storage from './storage.js'

const APP_MODE_KEY = 'appMode'

function isRamadanPeriod(hijriDate) {
  if (!hijriDate) return false
  return hijriDate.month === 9
}

export function getRamadanDay(hijriDate) {
  if (!isRamadanPeriod(hijriDate)) return null
  return hijriDate.day
}

export function resolveMode(hijriDate) {
  const setting = storage.get(APP_MODE_KEY) || 'auto'
  if (setting === 'ramadan') return 'ramadan'
  if (setting === 'normal') return 'normal'
  return isRamadanPeriod(hijriDate) ? 'ramadan' : 'normal'
}

export function applyMode(mode) {
  document.body.classList.toggle('mode-ramadan', mode === 'ramadan')
  document.body.classList.toggle('mode-normal', mode === 'normal')
}

export function setAppMode(mode) {
  storage.set(APP_MODE_KEY, mode)
}

export function isRamadanEve(hijriDate) {
  if (!hijriDate) return false
  return hijriDate.month === 8 && hijriDate.day >= 29
}
```

**Step 2:** Run `npm run dev` — vérifier que le build ne casse pas.

**Step 3: Commit**

```bash
git add src/modules/app-mode.js
git commit -m "feat: add app-mode module (ramadan/normal/auto detection)"
```

---

### Task 2 : Géolocalisation honnête — supprimer le fallback Paris

**Files:**
- Modify: `src/main.js` (fonctions `requestGeolocation`, `updateLocationDisplay`)
- Modify: `src/index.html` (bandeau avertissement)
- Modify: `src/style.css`

**Step 1:** Lire `requestGeolocation()` et `updateLocationDisplay()` dans `main.js`.

**Step 2: Ajouter le bandeau dans index.html**

Dans `<header class="top-header">`, après `<div class="location">` :

```html
<div id="location-warning" class="location-warning hidden">
  <i class="fa-solid fa-triangle-exclamation"></i>
  <span id="location-warning-text">Position non détectée</span>
  <button id="location-warning-btn" class="btn-link">Paramètres</button>
</div>
```

**Step 3: Modifier requestGeolocation() dans main.js**

Supprimer le fallback silencieux vers Paris. Remplacer par :

```js
async function requestGeolocation() {
  try {
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        timeout: 10000, enableHighAccuracy: false
      })
    })
    storage.set('userLat', position.coords.latitude)
    storage.set('userLon', position.coords.longitude)
    return true
  } catch (err) {
    console.warn('[geo] Geolocation failed:', err.message)
    const savedLat = storage.get('userLat')
    const savedLon = storage.get('userLon')
    if (savedLat && savedLon) {
      showLocationWarning('approximate')
      return true
    }
    const mosqueSlug = storage.get('mosqueSlug')
    if (mosqueSlug) return true
    showLocationWarning('missing')
    return false
  }
}

function showLocationWarning(type) {
  const warning = document.getElementById('location-warning')
  const text = document.getElementById('location-warning-text')
  const btn = document.getElementById('location-warning-btn')
  if (!warning || !text) return
  if (type === 'approximate') {
    text.textContent = 'Position approximative (dernière localisation connue)'
  } else if (type === 'missing') {
    text.textContent = 'Position non détectée — sélectionnez une mosquée ou ville'
  }
  warning.classList.remove('hidden')
  if (btn) {
    btn.addEventListener('click', () => {
      document.getElementById('settings-btn')?.click()
    }, { once: true })
  }
}
```

**Step 4: CSS**

```css
.location-warning {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 16px; background: var(--clr-gold-dim);
  border: 1px solid var(--clr-gold); border-radius: var(--radius-md);
  color: var(--clr-gold); font-size: 0.85rem; margin-bottom: 12px;
}
.location-warning .btn-link {
  background: none; border: none; color: var(--clr-gold-light);
  cursor: pointer; text-decoration: underline; font-size: 0.85rem;
}
.location-warning.hidden { display: none; }
[data-theme="dark"] .location-warning { background: rgba(212, 175, 55, 0.1); }
```

**Step 5:** Run `npm run tauri:dev` — couper GPS → bandeau visible. Avec GPS → pas de bandeau.

**Step 6: Commit**

```bash
git add src/main.js src/index.html src/style.css
git commit -m "fix: replace silent Paris fallback with honest location warnings"
```

---

### Task 3 : Intégrer app-mode dans main.js + settings

**Files:**
- Modify: `src/main.js`
- Modify: `src/modules/settings.js`
- Modify: `src/index.html` (sélecteur mode + barre progression Ramadan)
- Modify: `src/style.css`

**Step 1: Import et intégration dans main.js**

```js
import { resolveMode, applyMode, getRamadanDay, isRamadanEve } from './modules/app-mode.js'
```

Après récupération hijriDate dans `loadPrayerData()` :

```js
const mode = resolveMode(hijriDate)
applyMode(mode)
updateRamadanProgress(getRamadanDay(hijriDate))
```

Fonction `updateRamadanProgress()` :

```js
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
```

**Step 2: HTML barre progression Ramadan** (après header, avant view-dashboard) :

```html
<div id="ramadan-progress" class="ramadan-progress hidden">
  <span id="ramadan-day">Jour 1/30 du Ramadan</span>
  <div class="ramadan-progress-bar">
    <div id="ramadan-progress-fill" class="ramadan-progress-fill"></div>
  </div>
</div>
```

**Step 3: Sélecteur mode dans settings** (dans onglet `tab-calc`, en haut) :

```html
<div class="settings-group">
  <label class="settings-label">Mode de l'application</label>
  <select id="app-mode-select" class="settings-select">
    <option value="auto">Automatique (détection Ramadan)</option>
    <option value="ramadan">Ramadan (forcé)</option>
    <option value="normal">Normal (forcé)</option>
  </select>
  <p class="settings-hint">En mode automatique, l'app détecte le Ramadan via la date Hijri.</p>
</div>
```

Dans `settings.js`, importer et connecter :

```js
import { setAppMode } from './app-mode.js'
// Ouverture modal : modeSelect.value = storage.get('appMode') || 'auto'
// Sauvegarde : setAppMode(modeSelect.value)
```

**Step 4: CSS**

```css
.ramadan-progress {
  display: flex; align-items: center; gap: 12px;
  padding: 8px 20px; font-size: 0.85rem; color: var(--clr-gold);
}
.ramadan-progress.hidden { display: none; }
.ramadan-progress-bar {
  flex: 1; height: 6px; background: var(--clr-gold-dim);
  border-radius: var(--radius-full); overflow: hidden;
}
.ramadan-progress-fill {
  height: 100%; background: var(--clr-gold);
  border-radius: var(--radius-full); transition: width 0.5s ease;
}
body.mode-normal .fasting-card { display: none; }
body.mode-normal .ramadan-progress { display: none; }
```

**Step 5:** Tester mode forcé Ramadan/Normal dans settings.

**Step 6: Commit**

```bash
git add src/main.js src/modules/settings.js src/modules/app-mode.js src/index.html src/style.css
git commit -m "feat: integrate app mode with settings and Ramadan progress bar"
```

---

## Phase 2 : Données — Fichiers JSON

### Task 4 : Créer src/data/duas.json

**Files:**
- Create: `src/data/duas.json`

Créer le fichier avec la structure catégorisée décrite dans le design document. Minimum ~80 douas réparties dans les catégories. Chaque doua : `{ id, arabic, transliteration, translation, reference, context?, repeat? }`. Catégories groupées par `parent`/`parentName`.

Contenu vérifié depuis des sources fiables (Sahih Bukhari, Muslim, Coran).

```bash
git add src/data/duas.json
git commit -m "feat: add duas encyclopedia data (~80+ duas, 25 categories)"
```

---

### Task 5 : Enrichir daily-content.json

**Files:**
- Modify: `src/data/daily-content.json` (enrichir structure + ajouter entrées)
- Modify: `src/modules/daily-content.js` (nouveaux champs)
- Modify: `src/index.html` (translittération, badge, bouton copier)

**Step 1:** Enrichir chaque entrée existante avec `transliteration`, `category`, `ramadan`. Ajouter 40+ nouvelles entrées (objectif : 60 minimum).

**Step 2:** Modifier `daily-content.js` pour utiliser les nouveaux champs et accepter le paramètre `isRamadanMode`. Filtrer les contenus `ramadan: true` en mode Ramadan. Utiliser `textContent` pour tous les éléments texte.

**Step 3:** Ajouter dans la quote-card du HTML : `<span id="daily-category">`, `<p id="daily-transliteration">`, bouton copier.

**Step 4:** Ajouter `initDailyContentActions()` pour le bouton copier (via `navigator.clipboard.writeText`).

```bash
git add src/data/daily-content.json src/modules/daily-content.js src/index.html
git commit -m "feat: enrich daily content with transliteration, categories, and copy"
```

---

## Phase 3 : Features Dashboard — Tracker, Dhikr, Qibla

### Task 6 : Module practice-tracker.js

**Files:**
- Create: `src/modules/practice-tracker.js`
- Modify: `src/index.html` (carte tracker)
- Modify: `src/style.css`
- Modify: `src/main.js`

Le module gère le `practiceLog` dans le store (pruning 90 jours). Fonctions exportées : `initTracker()`, `togglePrayer(i)`, `toggleFasting()`, `setQuranPages(n)`, `addDhikrCount(n)`, `getStreak(field)`, `getPracticeLog()`.

**DOM** : utiliser `textContent` pour tous les textes. Pour les dots de prière, créer les éléments via `document.createElement` au lieu d'insertion HTML :

```js
function renderDots(container, prayers) {
  container.replaceChildren()
  prayers.forEach((done, i) => {
    const dot = document.createElement('span')
    dot.className = `tracker-dot ${done ? 'done' : ''}`
    dot.dataset.prayer = i
    dot.title = PRAYER_NAMES[i]
    container.appendChild(dot)
  })
}
```

Vue compacte (dots cliquables + résumé) + vue expandée (checkboxes, slider Coran, toggle jeûne).

```bash
git add src/modules/practice-tracker.js src/index.html src/style.css src/main.js
git commit -m "feat: add daily practice tracker (prayers, fasting, quran) with streaks"
```

---

### Task 7 : Module dhikr.js

**Files:**
- Create: `src/modules/dhikr.js`
- Modify: `src/index.html`
- Modify: `src/style.css`
- Modify: `src/main.js`

Presets définis en JS (SubhanAllah 33, Alhamdulillah 33, Allahu Akbar 34, etc.). Compteur avec `textContent`, bouton +, raccourci Espace, flash animation CSS au step complet. Appelle `addDhikrCount()` du tracker au cycle complet.

Select des presets via `document.createElement('option')` :

```js
function renderPresetOptions(select, presets, currentId) {
  select.replaceChildren()
  presets.forEach(p => {
    const opt = document.createElement('option')
    opt.value = p.id
    opt.textContent = p.name
    opt.selected = p.id === currentId
    select.appendChild(opt)
  })
}
```

```bash
git add src/modules/dhikr.js src/index.html src/style.css src/main.js
git commit -m "feat: add dhikr/tasbih counter with presets and keyboard shortcut"
```

---

### Task 8 : Module qibla.js

**Files:**
- Create: `src/modules/qibla.js`
- Modify: `src/index.html`
- Modify: `src/style.css`
- Modify: `src/main.js`

Calcul great-circle bearing via `Math.atan2`. Boussole SVG rendue via `document.createElementNS` (pas d'insertion HTML). Si pas de coordonnées, afficher message via `textContent` + bouton vers settings.

```js
function renderCompass(svgEl, angle) {
  const ns = 'http://www.w3.org/2000/svg'
  svgEl.replaceChildren()

  const circle = document.createElementNS(ns, 'circle')
  circle.setAttribute('cx', '60')
  circle.setAttribute('cy', '60')
  circle.setAttribute('r', '55')
  circle.setAttribute('fill', 'none')
  circle.setAttribute('stroke', 'var(--clr-glass-border)')
  circle.setAttribute('stroke-width', '2')
  svgEl.appendChild(circle)

  // ... cardinals, line, kaaba icon via createElementNS
}
```

```bash
git add src/modules/qibla.js src/index.html src/style.css src/main.js
git commit -m "feat: add Qibla compass with trigonometric calculation"
```

---

## Phase 4 : Nouvelles vues — Douas et Journal

### Task 9 : Module duas.js (encyclopédie)

**Files:**
- Create: `src/modules/duas.js`
- Modify: `src/index.html` (sidebar + view)
- Modify: `src/main.js` (navTabs)
- Modify: `src/style.css`

**Important sécurité XSS** : importer `escapeHtml` de `sanitize.js`. Tous les textes issus de `duas.json` doivent passer par `escapeHtml()` avant insertion. Construire le DOM via `document.createElement` ou utiliser `escapeHtml()` systématiquement :

```js
import { escapeHtml } from './sanitize.js'

function renderDuaItem(container, dua, isFav) {
  const item = document.createElement('div')
  item.className = 'dua-item'

  const arabic = document.createElement('p')
  arabic.className = 'dua-arabic'
  arabic.textContent = dua.arabic

  const translit = document.createElement('p')
  translit.className = 'dua-transliteration'
  translit.textContent = dua.transliteration

  const translation = document.createElement('p')
  translation.className = 'dua-translation'
  translation.textContent = dua.translation

  const ref = document.createElement('span')
  ref.className = 'dua-reference'
  ref.textContent = dua.reference

  // ... assembler et appender
  item.append(arabic, translit, translation, ref)
  container.appendChild(item)
}
```

Features : recherche temps réel (debounce 300ms), favoris (store), copier (clipboard), catégories collapsibles, groupement par parent.

Sidebar entry : `<a id="nav-duas">` avec icône `fa-hands-praying`.
Vue : `<div id="view-duas">` avec barre de recherche + container catégories.
navTabs : `duas: { btn, view }` avec lazy init `initDuas()`.

```bash
git add src/modules/duas.js src/index.html src/style.css src/main.js
git commit -m "feat: add duas encyclopedia view with search and favorites"
```

---

### Task 10 : Module journal.js

**Files:**
- Create: `src/modules/journal.js`
- Modify: `src/index.html` (sidebar + view)
- Modify: `src/main.js`
- Modify: `src/style.css`

**Important sécurité XSS** : le contenu du journal est saisi par l'utilisateur. Afficher via `textContent` exclusivement, jamais via des méthodes d'insertion HTML :

```js
function renderEntry(container, date, text) {
  const entry = document.createElement('div')
  entry.className = 'journal-entry'

  const dateEl = document.createElement('h3')
  dateEl.className = 'journal-entry-date'
  dateEl.textContent = formatDateLabel(date)

  const textEl = document.createElement('p')
  textEl.className = 'journal-entry-text'
  textEl.textContent = text  // textContent, PAS innerHTML

  entry.append(dateEl, textEl)
  container.appendChild(entry)
}
```

Features : textarea + placeholder rotatif, auto-save 3s, bouton sauvegarder, historique scrollable (DOM pur), filtre par mois, pruning 365 jours.

```bash
git add src/modules/journal.js src/index.html src/style.css src/main.js
git commit -m "feat: add gratitude journal with auto-save and month filtering"
```

---

## Phase 5 : Statistiques et gamification

### Task 11 : Module statistics.js

**Files:**
- Create: `src/modules/statistics.js`
- Modify: `src/index.html` (sidebar + vue)
- Modify: `src/main.js`
- Modify: `src/style.css`

Dépend de : `practice-tracker.js` (`getPracticeLog`, `getStreak`) et `journal.js` (`getJournalEntryCount`).

**Heatmap** : SVG pur via `document.createElementNS`. 12 semaines, couleur par nombre de prières (vert=5/5, gold=1-4, glass=0).

**Stats** : lecture du `practiceLog`, calculs agrégés par période (semaine/mois/tout), affichage via `textContent`.

**Objectifs** : presets + custom, progression calculée depuis le log. DOM construit via `createElement` :

```js
function renderGoalItem(container, goal, index) {
  const current = calculateGoalProgress(goal)
  const percent = Math.min(100, Math.round((current / goal.target) * 100))

  const item = document.createElement('div')
  item.className = `goal-item ${current >= goal.target ? 'goal-completed' : ''}`

  const info = document.createElement('div')
  info.className = 'goal-info'
  info.textContent = `${current >= goal.target ? '✓' : '○'} ${goal.label} — ${current}/${goal.target}`

  const bar = document.createElement('div')
  bar.className = 'goal-bar'
  const fill = document.createElement('div')
  fill.className = 'goal-bar-fill'
  fill.style.width = `${percent}%`
  bar.appendChild(fill)

  item.append(info, bar)
  container.appendChild(item)
}
```

Dialog ajout d'objectif via `createElement` (pas d'insertion HTML).

```bash
git add src/modules/statistics.js src/index.html src/style.css src/main.js
git commit -m "feat: add statistics view with heatmap, streaks, and goals"
```

---

## Phase 6 : Intégration finale

### Task 12 : Intégration mode + responsive + polish

**Files:**
- Modify: `src/main.js` (ordre d'init final)
- Modify: `src/style.css` (responsive)
- Modify: `src/modules/daily-content.js`

**Step 1: Ordre d'init final dans main.js**

```js
import { resolveMode, applyMode, getRamadanDay, isRamadanEve } from './modules/app-mode.js'
import { initTracker } from './modules/practice-tracker.js'
import { initDhikr } from './modules/dhikr.js'
import { initQibla } from './modules/qibla.js'
// duas, journal, statistics : lazy init via navTabs
```

Après `loadPrayerData` :
```js
const mode = resolveMode(hijriDate)
applyMode(mode)
updateRamadanProgress(getRamadanDay(hijriDate))
initTracker()
initDhikr()
initQibla()
updateDailyContent(mode === 'ramadan')
```

navTabs : ajouter `duas`, `journal`, `stats` avec lazy init.

**Step 2: Responsive**

```css
@media (max-width: 768px) {
  .stats-grid { grid-template-columns: 1fr 1fr; }
  .dhikr-arabic { font-size: 1.4rem; }
  .dua-arabic { font-size: 1.2rem; }
}
@media (max-width: 480px) {
  .stats-grid { grid-template-columns: 1fr; }
}
```

**Step 3: Test complet**

Run: `npm run tauri:dev`
1. Dashboard : tracker + dhikr + Qibla + contenu enrichi
2. Mode Normal : fasting card masquée
3. Mode Ramadan : barre progression + fasting card
4. Douas : recherche + favoris + copier
5. Journal : textarea + historique + filtre mois
6. Stats : heatmap + objectifs + filtres période
7. Persistence après restart

```bash
git add -A
git commit -m "feat: integrate all v2 features with mode system and responsive"
```

---

### Task 13 : Bump version + changelog

**Files:**
- Modify: `package.json` → `"version": "1.7.0"`
- Modify: `src-tauri/tauri.conf.json` → `"version": "1.7.0"`
- Modify: `src-tauri/Cargo.toml` → `version = "1.7.0"`
- Modify: `src/modules/changelog.js` → `APP_VERSION = '1.7.0'` + nouvelle entrée
- Modify: `CHANGELOG.md` → section `## [1.7.0]`

Entrée changelog :
- **Titre** : Compagnon spirituel quotidien
- **Type** : feature
- **Changes** : Mode Ramadan/Normal automatique, Tracker de pratique, Compteur dhikr, Encyclopédie douas, Boussole Qibla, Journal de gratitude, Statistiques + heatmap + objectifs, Contenu quotidien enrichi, Fin du fallback Paris

```bash
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src/modules/changelog.js CHANGELOG.md
git commit -m "chore: bump 1.6.1 → 1.7.0 (compagnon spirituel quotidien)"
```

---

## Résumé des tâches

| # | Tâche | Phase | Dépend de |
|---|-------|-------|-----------|
| 1 | Module app-mode.js | 1 - Fondation | — |
| 2 | Géolocalisation honnête | 1 - Fondation | — |
| 3 | Intégrer app-mode dans main.js + settings | 1 - Fondation | 1 |
| 4 | Créer duas.json | 2 - Données | — |
| 5 | Enrichir daily-content.json | 2 - Données | — |
| 6 | Module practice-tracker.js | 3 - Dashboard | — |
| 7 | Module dhikr.js | 3 - Dashboard | 6 |
| 8 | Module qibla.js | 3 - Dashboard | 2 |
| 9 | Module duas.js (encyclopédie) | 4 - Vues | 4 |
| 10 | Module journal.js | 4 - Vues | — |
| 11 | Module statistics.js | 5 - Stats | 6, 10 |
| 12 | Intégration finale + polish | 6 - Intégration | 1-11 |
| 13 | Bump version + changelog | 6 - Intégration | 12 |

**Tâches parallélisables** :
- Tasks 1 et 2 : en parallèle
- Tasks 4 et 5 : en parallèle
- Tasks 6, 8, 10 : en parallèle (pas de dépendances croisées)
