# GEMINI.md

## Scope des modifications

- Focus principal : frontend (HTML, CSS, JS dans `src/`)
- Modifier uniquement ce qui est explicitement demandé
- Pas de framework JS (React, Vue, etc.) — le projet est en vanilla JS
- Pas de dépendances npm sans confirmation
- `src-tauri/` (Rust) : uniquement si demandé explicitement
- Tout texte UI en français
- Tester avec `npm run tauri:dev` après modification

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
```

## Structure du projet

```
src/
├── main.js              # Point d'entrée, orchestre l'init
├── style.css            # 1700+ lignes, variables thème dark/light
├── modules/             # 12 modules ES
│   ├── prayer-times.js  # APIs Mawaqit (Tauri HTTP) & Aladhan (fetch)
│   ├── settings.js      # Modal settings, recherche mosquée, carte Leaflet
│   ├── notifications.js # Notifications OS + lecture Adhan audio
│   ├── storage.js       # Tauri plugin-store (cache in-memory, write-through)
│   ├── countdown.js     # Compte à rebours prochaine prière
│   ├── fasting.js       # Barre progression Suhoor→Iftar
│   ├── schedule.js      # Liste prières du jour avec états visuels
│   ├── hijri-date.js    # Date grégorienne + hijri
│   ├── daily-content.js # Verset/Hadith du jour
│   ├── theme.js         # Toggle dark/light via data-theme
│   ├── onboarding.js    # Tour guidé première visite
│   └── splash.js        # Écran de démarrage animé
├── data/
│   └── daily-content.json  # 400+ entrées (arabe, français, référence)
public/
├── audio/               # adhan-{makkah,madina,fajr}.mp3 + notification.mp3
src-tauri/               # Backend Rust (modifier seulement si demandé)
├── tauri.conf.json      # Config app, CSP, dimensions fenêtre
├── src/lib.rs           # System tray, plugins, close-to-tray
└── Cargo.toml           # Dépendances Rust
```

## Frontend : conventions CSS

- Theming via `data-theme` attribute sur `<html>` : `"dark"` (défaut) ou `"light"`
- Variables CSS dans `:root` (light) et `[data-theme="dark"]` (dark)
- Palette light : vert foncé (`#0B2B1B`), or (`#D4AF37`), sable (`#F4EBD0`)
- Palette dark : bleu nuit (`#0B1320`), glassmorphism (`rgba + backdrop-filter`)
- Toujours utiliser `var(--xxx)` pour couleurs, ombres, rayons — jamais de valeurs hardcodées
- Font unique : `Outfit` (Google Fonts)
- Icônes : classes Font Awesome `fa-solid fa-xxx`
- Animations : keyframes dans `style.css`, classes utilitaires (`animate-entry`, `floating-icon`, etc.)

## Frontend : conventions JS

- Vanilla JS avec ES modules (`import`/`export`)
- Pas de point-virgule
- Noms de variables et commentaires en français
- Accès DOM via `document.getElementById()` / `document.querySelector()`
- Persistance : `storage.get(key)` / `storage.set(key, value)` (jamais localStorage)
- Import Tauri : `import { fetch as tauriFetch } from '@tauri-apps/plugin-http'`

## Backend Tauri (si nécessaire)

- `lib.rs` : setup app, system tray (close-to-tray), enregistrement des 4 plugins
- Plugins : `http` (CORS bypass), `store` (persistance), `notification` (OS), `autostart` (boot)
- Fichier store : `guideme-settings.json` (géré par `storage.js`)
- Modifier `Cargo.toml` pour ajouter des dépendances Rust

## APIs externes

| API | Appel depuis | CORS |
|---|---|---|
| **Mawaqit** (`mawaqit.net/api/2.0/`) | `tauriFetch` (Rust) | Bloqué en browser — **Tauri HTTP obligatoire** |
| **Aladhan** (`api.aladhan.com/v1/`) | `fetch` (JS direct) | OK |

## À savoir (pièges)

- **CSP stricte** : nouvelle URL externe → ajouter dans `tauri.conf.json` → `app.security.csp`, sinon bloquée silencieusement
- **Mawaqit = Tauri HTTP only** : ne jamais appeler depuis le browser JS
- **Date Hijri** : toujours depuis Aladhan (Mawaqit ne la fournit pas)
- **Géolocalisation** : fallback chain GPS → coordonnées sauvegardées → Paris (48.85, 2.35)
- **Cache prières** : invalidé quotidiennement ou quand mosquée/méthode change
- **Méthode de calcul** : UOIF (method 12) par défaut, n'affecte que le mode sans mosquée
- **Rotation contenu** : `dayOfYear % entries.length` dans `daily-content.json`
- **Pas de .env** : tout dans le Tauri store ou hardcodé
- **Fenêtre** : min 900×600, default 1200×800
- **System tray** : fermer = minimize to tray, pas quit
- **`opacity: 0` initial** : `.app-container` est masqué puis révélé par JS après le splash
