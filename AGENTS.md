# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

> **Ce fichier est gitignored** — il reste local uniquement.

## Prérequis

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) toolchain stable
- [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) (WebView2 sur Windows)

## Stack

- **Frontend:** Vanilla JS (ES modules), HTML, CSS — pas de framework
- **Desktop:** Tauri v2 (Rust) — plugins: `http`, `store`, `notification`, `autostart`, `shell`, `updater`, `process`
- **Build:** Vite 7 (port 1420, `esnext` target)
- **Maps:** Leaflet.js (OpenStreetMap)
- **Icons:** Font Awesome 6.4 (CDN + SRI), Google Fonts (Outfit)

## Commandes

```bash
npm run dev              # Vite dev server (port 1420)
npm run build            # Production build → dist/
npm run tauri:dev        # App desktop avec hot reload (dev principal)
npm run tauri:build      # Build installer desktop (MSI/NSIS)
npx tauri icon <src.png> # Génère toutes les icônes depuis un PNG carré
```

## Architecture

**GuideME Ramadan** — app desktop de horaires de prière avec suivi du jeûne, notifications adhan et contenu quotidien.

### Flux principal (`main.js`)

```
storage.init() → GPS/fallback → loadPrayerData(mosqueSlug, offset)
  ├── Mawaqit API (Tauri HTTP, today only) → prioritaire
  ├── Aladhan API (fetch JS, toute date) → fallback
  └── Résultat → schedule.js + fasting.js (60s) + countdown.js (1s) + notifications.js (15s)
```

### Modules (`src/modules/`)

| Module | Rôle |
|--------|------|
| `prayer-times.js` | Fetch Mawaqit/Aladhan, cache multi-dates, utilitaires temps |
| `settings.js` | Modal 4 onglets (mosquée, carte Leaflet, rappels, calcul) |
| `notifications.js` | Boucle 15s, adhan audio, notifications OS par prière |
| `storage.js` | Cache in-memory + write-through Tauri store |
| `date-navigation.js` | Offset ±30 jours, debounce 300ms |
| `countdown.js` | Timer prochaine prière (tick 1s, wraparound minuit→Fajr) |
| `fasting.js` | Progression Suhoor→Iftar (live + mode référence) |
| `schedule.js` | Rendu liste prières avec états (active, passed, selected) |
| `calendar.js` | Vue calendrier mensuel des horaires |
| `daily-content.js` | Contenu quotidien (hadith, doua) depuis `src/data/daily-content.json` |
| `hijri-date.js` | Date Hijri depuis Aladhan |
| `changelog.js` | Modale "Quoi de neuf" + badge NEW |
| `bug-report.js` | Formulaire → GitHub Issues via Tauri invoke (Rust) |
| `sanitize.js` | `escapeHtml()` + `isValidSlug()` — sécurité XSS |
| `theme.js` | Toggle dark/light, persistance storage |
| `sidebar.js` | Navigation, collapse/expand |
| `splash.js` | Écran chargement initial |
| `onboarding.js` | Tour guidé premier lancement |
| `window.js` | Contrôles fenêtre custom (min, max, close) |
| `support.js` | Modal dons (PayPal, Ko-fi, BMC) |
| `updater.js` | Auto-update : check 30s startup + boucle 4h, modale progression |

### Côté Rust (`src-tauri/src/lib.rs`)

- `create_bug_report` — commande Tauri : crée issue GitHub via `reqwest` (token build-time `option_env!()`)
- System tray : menu "Ouvrir GuideME" / "Quitter", clic gauche = show window
- Close-to-tray : `CloseRequested` → `window.hide()`
- Plugins enregistrés : http, store, notification, shell, autostart, updater, process

## Stratégie API duale

- **Mawaqit** (`mawaqit.net/api/2.0/`) : horaires mosquée, précis — **Tauri HTTP obligatoire** (CORS bloqué)
- **Aladhan** (`api.aladhan.com/v1/`) : horaires calculés + date Hijri — fetch JS direct
- Mawaqit = today only → Aladhan pour navigation passé/futur et calendrier
- UOIF : `method=99&methodSettings=15,null,15` (Aladhan renvoie 12° au lieu de 15°)

## Cache

- **Mawaqit** : `{date, mosqueSlug, data}` — invalidé quotidiennement
- **Aladhan** : `Record<YYYY-MM-DD, {locationKey, data}>` — pruné à 7 entrées
- **Storage** : `storage.get(key)` synchrone (Map mémoire), `storage.set(key, val)` write-through async
- **Jamais localStorage** — toujours `storage.js`

## Conventions de code

- Vanilla JS ES modules, pas de point-virgule
- Commentaires et variables en français, texte UI en français
- DOM : `getElementById()` / `querySelector()`, jamais de framework
- CSS : `var(--xxx)` pour couleurs — jamais de valeurs hardcodées
- Nommage CSS : `--clr-{component}-{purpose}` (ex: `--clr-changelog-border`)
- Glass réutilisables : `--clr-glass-bg` / `--clr-glass-border`
- Thèmes : `[data-theme="dark"|"light"]` sur `<html>`

## Scope des modifications

- Modifier uniquement ce qui est explicitement demandé
- Ne pas ajouter de framework JS ni de dépendances npm sans confirmation
- `src-tauri/` (Rust) : ne modifier que si explicitement demandé
- Tester avec `npm run tauri:dev` après modification

## Pièges critiques

- **CSP stricte** : toute nouvelle URL externe → l'ajouter dans `tauri.conf.json` → `app.security.csp`, sinon bloquée **silencieusement**
- **Mawaqit = Tauri HTTP only** : `tauriFetch` obligatoire, jamais `fetch()` browser
- **Plugin shell = URLs seulement** : `shell.open()` refuse les chemins locaux, n'accepte que `http://`, `https://`, `mailto:`, `tel:` → utiliser des URLs GitHub
- **Permissions Tauri obligatoires** : chaque nouveau plugin nécessite sa permission dans `src-tauri/capabilities/default.json` (ex: `shell:allow-open`), sinon échec silencieux
- **GitHub API** : création issues via Rust `reqwest` (pas le plugin HTTP), token embarqué au build via `option_env!()`
- **Rust `String::len()` ≠ caractères** : `len()` compte les octets UTF-8 (é=2). Utiliser `chars().count()` pour les limites
- **Validation UX** : les erreurs de validation côté client ne doivent jamais masquer le formulaire — afficher inline
- **Leaflet popups** : pas de styles inline pour les couleurs → classes CSS + variables pour le theming
- **Faux diff CRLF Windows** : `Cargo.toml` / `Cargo.lock` peuvent apparaître modifiés sans changement réel → `git checkout -- <fichier>`
- **Date Hijri** : toujours depuis Aladhan (Mawaqit ne la fournit pas)
- **Géolocalisation** : fallback GPS → coords sauvegardées → Paris (48.8566, 2.3522)
- **Dates locales** : toujours `getFullYear()`/`getMonth()`/`getDate()` — jamais `toISOString()` (UTC décale d'un jour après minuit)
- **Cache Aladhan** : clés `YYYY-MM-DD`, tri lexicographique = chronologique
- **Leaflet map** : lazy init au clic onglet Carte, `invalidateSize()` si le conteneur change
- **System tray** : fermer fenêtre = minimize to tray, pas quit
- **`opacity: 0` initial** : `.app-container` masqué jusqu'à fin du splash
- **Notifications dev mode** : Windows filtre les toast des apps non-installées — tester avec `npm run tauri:build` + install
- **CHANGELOG.md obligatoire** : à chaque bump, mettre à jour 5 fichiers (voir Versioning)
- **Dependabot merge sur main** : crée un décalage dev/main — toujours `git merge origin/main` dans dev après

## Variables d'environnement

```bash
# GitHub PAT pour bug report — lu au BUILD TIME par option_env!() (Rust)
# Doit être défini AVANT `cargo build` / `npm run tauri:build`
# Scope requis : fine-grained, Issues Read/Write sur SofianeBel/myramadan
BUG_REPORT_TOKEN=
```

Pas de `VITE_*` côté frontend. Le seul secret est embarqué au build time par Rust.

## Git flow

```
main ← production stable (PR only)
  └── dev ← développement (toujours partir de là)
       └── feature/xxx, fix/xxx, refactor/xxx
```

Commits : Conventional Commits (`feat:`, `fix:`, `refactor:`). Branches depuis `dev`.

## Versioning

Version synchronisée dans 5 emplacements :

| Fichier | Champ | Sync |
|---------|-------|------|
| `package.json` | `version` | Manuel (source de vérité) |
| `src-tauri/tauri.conf.json` | `version` | Auto-sync CI, mais garder à jour localement |
| `src-tauri/Cargo.toml` | `version` | Auto-sync CI, mais garder à jour localement |
| `src/modules/changelog.js` | `APP_VERSION` + entrée `CHANGELOG_ENTRIES` | Manuel |
| `CHANGELOG.md` | `## [x.y.z]` | Manuel |

Bump : `feat:` → MINOR, `fix:` → PATCH. **Toujours mettre à jour les 5 emplacements.**

## CI/CD

- **Release** (`release.yml`) : build Windows (MSI/NSIS) + GitHub Release quand la version change dans `package.json` sur `main`
- **Code review** (`Codex-review.yml`) : review automatique sur PR
- **Codex** (`Codex.yml`) : assistance interactive via `@Codex` dans issues/PRs
- **Dependabot** : mises à jour auto GitHub Actions + npm + Cargo

## Assets

- `public/logo.png` — logo app (splash, sidebar)
- `public/audio/` — 3 adhans MP3 + notification.mp3
- `src-tauri/icons/` — générés via `npx tauri icon`
- `.assets/` (gitignored) — backups originaux
