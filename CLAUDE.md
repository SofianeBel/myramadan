# CLAUDE.md

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
npm run tauri:dev        # App desktop avec hot reload
npm run tauri:build      # Build installer desktop
npm run preview          # Preview build local
```

## Structure du projet

```
src/
├── main.js              # Point d'entrée, orchestre l'init de tous les modules
├── style.css            # Styles + variables thème (dark/light)
├── modules/             # 12 modules ES (prayer-times, settings, notifications, storage, etc.)
├── data/
│   └── daily-content.json  # 400+ entrées (arabe, français, référence)
public/
├── audio/               # adhan-{makkah,madina,fajr}.mp3 + notification.mp3
src-tauri/
├── tauri.conf.json      # Config app, CSP, dimensions fenêtre
├── src/lib.rs           # Setup app, system tray, plugins
└── Cargo.toml           # Dépendances Rust
```

## APIs externes

| API | Usage | Appel depuis |
|---|---|---|
| **Mawaqit** (`mawaqit.net/api/2.0/`) | Horaires mosquée spécifique | Plugin HTTP Tauri (Rust) — **CORS bypass obligatoire** |
| **Aladhan** (`api.aladhan.com/v1/`) | Horaires calculés + date Hijri | JS direct (pas de CORS) |

Flux : Mawaqit prioritaire → Aladhan fallback → normalisé en 6 horaires (HH:MM) → cache quotidien Tauri store.

## Conventions de code

- Vanilla JS avec ES modules (`import`/`export`)
- Pas de point-virgule
- Noms de variables et commentaires en français
- Tout texte UI en français
- CSS : custom properties pour le theming, sélecteurs `[data-theme="dark"|"light"]`

## Scope des modifications

- Modifier uniquement ce qui est explicitement demandé
- Ne pas ajouter de framework JS (React, Vue, etc.) — le projet reste en vanilla JS
- Ne pas ajouter de dépendances npm sans confirmation
- `src-tauri/` (Rust) : ne modifier que si explicitement demandé
- Toujours tester avec `npm run tauri:dev` après modification

## À savoir (pièges)

- **CSP stricte** : toute nouvelle URL externe → l'ajouter dans `tauri.conf.json` → `app.security.csp`, sinon bloquée silencieusement
- **Mawaqit = Tauri HTTP only** : l'API bloque les appels navigateur, toujours passer par le plugin HTTP côté Rust
- **Date Hijri** : toujours depuis Aladhan (Mawaqit ne la fournit pas)
- **Géolocalisation** : fallback chain GPS → coordonnées sauvegardées → Paris (48.85, 2.35)
- **Méthode de calcul** : UOIF (method 12) par défaut, n'affecte que le mode sans mosquée
- **Cache prières** : invalidé quotidiennement ou quand mosquée/méthode change
- **Rotation contenu** : `dayOfYear % entries.length` dans `daily-content.json`
- **Pas de .env** : aucune variable d'environnement, tout dans le Tauri store ou hardcodé
- **Fenêtre** : min 900×600, default 1200×800 (`tauri.conf.json`)
- **System tray** : fermer la fenêtre = minimize to tray, pas quit
