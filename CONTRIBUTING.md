# Contribuer a GuideME Ramadan

Merci de vouloir contribuer ! Ce guide explique comment participer au projet.

## Prerequis

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) toolchain stable
- Prerequis Tauri v2 selon votre OS :
  - **Windows** — [WebView2](https://v2.tauri.app/start/prerequisites/#windows)
  - **macOS** — Xcode Command Line Tools (`xcode-select --install`)
  - **Linux** — `sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf`

## Installation

```bash
git clone https://github.com/SofianeBel/myramadan.git
cd myramadan
npm install
npm run tauri:dev   # Lance l'app avec hot reload
```

## Git flow

```
main          # Production stable — jamais de commit direct
  └── dev     # Developpement — toujours partir de la
       ├── feature/xxx   # Nouvelles fonctionnalites
       ├── fix/xxx       # Corrections de bugs
       └── refactor/xxx  # Refactoring
```

### Workflow

1. **Fork** le repo et clone ton fork
2. **Creer une branche** depuis `dev` :
   ```bash
   git checkout dev
   git pull origin dev
   git checkout -b feature/ma-feature
   ```
3. **Developper** avec `npm run tauri:dev`
4. **Commiter** en Conventional Commits :
   - `feat: ajouter la fonctionnalite X`
   - `fix: corriger le bug Y`
   - `refactor: simplifier le module Z`
5. **Pousser** et ouvrir une **Pull Request** vers `dev`

## Conventions de code

### JavaScript

- **Vanilla JS** — ES modules, pas de framework
- **Pas de point-virgule**
- Commentaires et variables en francais
- DOM : `getElementById()` / `querySelector()`
- Toujours utiliser `storage.js` (jamais `localStorage`)

### CSS

- Variables CSS : `var(--clr-xxx)` — jamais de couleurs hardcodees
- Nommage : `--clr-{composant}-{usage}` (ex: `--clr-glass-bg`)
- Themes : `[data-theme="dark"|"light"]` sur `<html>`
- Glass reutilisables : `--clr-glass-bg` / `--clr-glass-border`

### Rust (src-tauri/)

- Ne modifier que si explicitement necessaire
- Les secrets sont injectes au build time via `option_env!()`

## Structure du projet

```
src/
  modules/          # Modules ES (prayer-times, settings, notifications...)
  data/             # Donnees statiques (daily-content.json)
  style.css         # Styles + theming
src-tauri/
  src/lib.rs        # System tray, bug report, commandes Tauri
  capabilities/     # Permissions des plugins
  tauri.conf.json   # Config Tauri
public/
  logo.png          # Logo app
  audio/            # Adhans + notification sonore
```

## Pieges a connaitre

- **CSP stricte** — toute nouvelle URL externe doit etre ajoutee dans `tauri.conf.json` → `app.security.csp`
- **Mawaqit = Tauri HTTP seulement** — utiliser `tauriFetch`, jamais `fetch()` browser (CORS)
- **Plugin shell** — n'accepte que les URLs (`http://`, `https://`, `mailto:`) pas les chemins locaux
- **Permissions Tauri** — chaque nouveau plugin necessite sa permission dans `src-tauri/capabilities/default.json`
- **Dates locales** — toujours `getFullYear()`/`getMonth()`/`getDate()`, jamais `toISOString()` (decalage UTC)
- **Notifications** — en dev, Windows filtre les toast des apps non installees. Tester avec `npm run tauri:build`

## Versioning

Chaque PR mergee doit mettre a jour la version dans **5 fichiers** :

| Fichier | Champ |
|---------|-------|
| `package.json` | `version` |
| `src-tauri/tauri.conf.json` | `version` |
| `src-tauri/Cargo.toml` | `version` |
| `src/modules/changelog.js` | `APP_VERSION` + nouvelle entree `CHANGELOG_ENTRIES` |
| `CHANGELOG.md` | Nouvelle section `## [x.y.z]` |

- `feat:` → bump MINOR (1.2.0 → 1.3.0)
- `fix:` → bump PATCH (1.3.0 → 1.3.1)
- Breaking change → bump MAJOR (1.3.1 → 2.0.0)

## Tester

```bash
npm run tauri:dev     # App desktop avec hot reload
npm run dev           # Frontend seul (port 1420)
npm run build         # Verifier que le build passe
```

Avant de soumettre ta PR, verifie que :
- [ ] `npm run build` passe sans erreur
- [ ] L'app fonctionne avec `npm run tauri:dev`
- [ ] Les 5 fichiers de version sont a jour (si applicable)
- [ ] Le commit suit les Conventional Commits

## Signaler un bug

- Utiliser le formulaire integre dans l'app (sidebar → Signaler un bug)
- Ou ouvrir une [issue GitHub](https://github.com/SofianeBel/myramadan/issues/new)

## Licence

En contribuant, vous acceptez que vos contributions soient sous licence [MIT](LICENSE), comme le reste du projet.
