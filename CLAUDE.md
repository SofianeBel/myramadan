# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

- **Frontend:** Vanilla JS (ES modules), HTML, CSS — pas de framework
- **Desktop:** Tauri v2 (Rust) — plugins: `http`, `store`, `notification`, `autostart`
- **Build:** Vite 7 (port 1420, `esnext` target)
- **Maps:** Leaflet.js (OpenStreetMap)
- **Icons:** Font Awesome 6.4 (CDN), Google Fonts (Outfit)

## Commandes

```bash
npm install              # Prérequis : Rust toolchain + Node.js 18+
npm run dev              # Vite dev server (port 1420)
npm run build            # Production build → dist/
npm run tauri:dev        # App desktop avec hot reload (dev principal)
npm run tauri:build      # Build installer desktop
npm run preview          # Preview build local
```

## Architecture

**GuideME Ramadan** — app desktop de horaires de prière avec suivi du jeûne, notifications adhan et contenu quotidien.

### Flux de données principal

```
main.js (orchestrateur)
  ├── storage.init() → charge le Tauri store en mémoire
  ├── requestGeolocation() → GPS → coords sauvegardées → Paris (fallback)
  └── loadPrayerData(mosqueSlug, offset)
        ├── Mawaqit API (Tauri HTTP, today only) ─── prioritaire
        ├── Aladhan API (fetch JS, supporte dates) ── fallback
        └── Résultat normalisé → 6 horaires {Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha}
              ├── renderPrayerSchedule() → schedule.js
              ├── updateFasting() → fasting.js (live, toutes les 60s)
              ├── startCountdown() → countdown.js (tick 1s)
              └── startNotifications() → notifications.js (check 15s)
```

### Modules clés (`src/modules/`)

| Module | Rôle | Dépendances |
|--------|------|-------------|
| `prayer-times.js` | Fetch Mawaqit/Aladhan, cache multi-dates, utilitaires temps | `storage.js`, Tauri HTTP |
| `settings.js` | Modal 4 onglets (mosquée, carte, rappels, calcul), Leaflet map | `storage.js`, `prayer-times.js` |
| `notifications.js` | Boucle 15s, adhan audio, notifications OS par prière | `storage.js`, Tauri notification |
| `storage.js` | Cache in-memory + write-through Tauri store (`guideme-settings.json`) | Tauri store |
| `date-navigation.js` | Offset ±30 jours, debounce 300ms, format dates Aladhan/cache | — |
| `countdown.js` | Timer prochaine prière (tick 1s, wraparound minuit→Fajr) | `prayer-times.js` |
| `fasting.js` | Progression Suhoor→Iftar (live + mode référence non-today) | `prayer-times.js` |
| `schedule.js` | Rendu liste prières avec états (active, passed, selected) | `prayer-times.js`, `countdown.js` |

### Stratégie API duale

- **Mawaqit** (`mawaqit.net/api/2.0/`) : horaires mosquée spécifiques, précis — **Tauri HTTP obligatoire** (CORS bloqué côté browser)
- **Aladhan** (`api.aladhan.com/v1/`) : horaires calculés + date Hijri — fetch JS direct
- Mawaqit = today only (pas de requête par date) → Aladhan pour navigation passé/futur
- UOIF : angles corrigés via `method=99&methodSettings=15,null,15` (Aladhan renvoie 12° au lieu de 15°)

### Cache

- **Mawaqit** : cache single-day `{date, mosqueSlug, data}` — invalidé quotidiennement
- **Aladhan** : cache multi-dates `Record<YYYY-MM-DD, {locationKey, data}>` — pruné à 7 entrées
- **Storage** : `storage.get(key)` synchrone (Map en mémoire), `storage.set(key, value)` write-through async vers Tauri store
- **Jamais localStorage** — toujours `storage.js` (migration auto depuis localStorage au premier lancement)

### Clés de stockage persistantes

`mosqueSlug`, `mosqueName`, `userCity`, `userCountry`, `userLat`, `userLon`, `calculationMethod`, `theme`, `tourCompleted`, `notificationPrefs`, `mawaqitCache`, `prayerTimesCache`

## Conventions de code

- Vanilla JS avec ES modules (`import`/`export`), pas de point-virgule
- Noms de variables et commentaires en français, tout texte UI en français
- DOM : `document.getElementById()` / `document.querySelector()`, jamais de framework
- CSS : custom properties pour le theming, `[data-theme="dark"|"light"]` sur `<html>`
- Palettes : dark = bleu nuit + glassmorphism, light = vert foncé + or + sable
- Toujours `var(--xxx)` pour couleurs — jamais de valeurs hardcodées

## Scope des modifications

- Modifier uniquement ce qui est explicitement demandé
- Ne pas ajouter de framework JS (React, Vue, etc.)
- Ne pas ajouter de dépendances npm sans confirmation
- `src-tauri/` (Rust) : ne modifier que si explicitement demandé
- Tester avec `npm run tauri:dev` après modification

## Pièges critiques

- **CSP stricte** : toute nouvelle URL externe → l'ajouter dans `tauri.conf.json` → `app.security.csp`, sinon bloquée **silencieusement**
- **Mawaqit = Tauri HTTP only** : `tauriFetch` obligatoire, jamais `fetch()` browser
- **Aladhan dans CSP** : déjà dans `connect-src`, ajouter toute nouvelle API ici
- **Date Hijri** : toujours depuis Aladhan (Mawaqit ne la fournit pas)
- **Géolocalisation** : fallback chain GPS → coords sauvegardées → Paris (48.8566, 2.3522)
- **Méthode de calcul** : UOIF (method 12) par défaut, utilise `method=99` + angles custom quand `getMethodAngles()` retourne non-null
- **Dates locales** : toujours utiliser `getFullYear()`/`getMonth()`/`getDate()` — jamais `toISOString()` (UTC, décalage d'un jour après minuit)
- **Cache Aladhan** : clés au format `YYYY-MM-DD`, tri lexicographique = chronologique
- **Leaflet map** : ne s'initialise qu'au clic sur l'onglet Carte (lazy init), appeler `invalidateSize()` si le conteneur change de taille
- **System tray** : fermer la fenêtre = minimize to tray, pas quit
- **`opacity: 0` initial** : `.app-container` masqué jusqu'à la fin du splash (révélé par JS)
- **Pas de .env** : aucune variable d'environnement, tout dans le Tauri store ou hardcodé
- **Fenêtre** : min 900×600, default 1200×800 (`tauri.conf.json`)

## Git flow

```
main ← production stable (PR only)
  └── dev ← développement (toujours partir de là)
       └── feature/xxx, fix/xxx, refactor/xxx
```

Commits : Conventional Commits (`feat:`, `fix:`, `refactor:`). Toujours créer les branches depuis `dev`.
