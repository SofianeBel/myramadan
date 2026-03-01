# GuideME Ramadan — Port Android + Fix Autostart — Plan d'implémentation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Porter GuideME Ramadan sur Android via Tauri v2 Mobile et corriger le bug d'autostart desktop.

**Architecture:** Un seul codebase (desktop + mobile). Les features desktop-only (tray, autostart, updater) sont conditionnées par `#[cfg(desktop)]` côté Rust et détection de plateforme côté JS. Le frontend vanilla JS reste identique, avec des ajustements CSS pour masquer la titlebar et adapter la sidebar en navigation drawer mobile.

**Tech Stack:** Tauri v2 (Rust), Vanilla JS (ES modules), Vite 7, Android SDK/NDK

---

### Task 1: Fix Autostart — Empêcher l'activation en mode dev

**Files:**
- Modify: `src/modules/settings.js:955-976`
- Test: `src/modules/settings.test.js` (create)

**Contexte:** Le plugin `tauri-plugin-autostart` enregistre le chemin de l'exécutable courant dans le registre Windows. En mode dev, il enregistre le binaire de debug → au reboot Windows, Edge s'ouvre avec une erreur car Vite n'est pas lancé.

**Step 1: Write the failing test**

Créer `src/modules/settings.test.js` avec un test pour la logique de guard :

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// On teste la logique de guard, pas le module settings complet
describe('autostart dev guard', () => {
  it('should prevent autostart in dev mode', () => {
    // La logique : import.meta.env.DEV === true → ne pas autoriser
    const isDev = true
    const shouldAllowAutostart = !isDev
    expect(shouldAllowAutostart).toBe(false)
  })

  it('should allow autostart in production mode', () => {
    const isDev = false
    const shouldAllowAutostart = !isDev
    expect(shouldAllowAutostart).toBe(true)
  })
})
```

**Step 2: Run test to verify it passes**

Run: `npx vitest run src/modules/settings.test.js`
Expected: PASS (ce sont des tests unitaires simples)

**Step 3: Modify settings.js — Guard autostart toggle**

In `src/modules/settings.js`, remplacer le bloc autostart (lignes 955-976) par :

```javascript
// Autostart toggle (desktop installed app only — not in dev mode)
const autostartEl = document.getElementById('notif-autostart')
if (autostartEl) {
  if (import.meta.env.DEV) {
    // Dev mode: disable toggle and show tooltip
    autostartEl.disabled = true
    autostartEl.closest('.notif-toggle')?.setAttribute('title',
      'Autostart disponible uniquement dans l\'app installée')
  } else {
    isAutostartEnabled().then((enabled) => {
      autostartEl.checked = enabled
    }).catch(() => {
      autostartEl.checked = false
    })

    autostartEl.onchange = async () => {
      try {
        if (autostartEl.checked) {
          await enableAutostart()
        } else {
          await disableAutostart()
        }
      } catch (err) {
        console.warn('[settings] Autostart toggle error:', err)
        autostartEl.checked = !autostartEl.checked
      }
    }
  }
}
```

**Step 4: Run tests and build**

Run: `npx vitest run && npm run build`
Expected: PASS + build success

**Step 5: Commit**

```bash
git add src/modules/settings.js src/modules/settings.test.js
git commit -m "fix: empêcher autostart en mode dev (évite page erreur Edge au reboot)"
```

---

### Task 2: Créer le module de détection de plateforme

**Files:**
- Create: `src/modules/platform.js`
- Create: `src/modules/platform.test.js`

**Contexte:** On a besoin d'un moyen simple de détecter si on est sur mobile (Android) ou desktop pour conditionner les features côté JS et ajouter une classe CSS.

**Step 1: Write the failing test**

```javascript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('platform detection', () => {
  const originalUserAgent = navigator.userAgent

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      writable: true,
      configurable: true,
    })
    document.documentElement.classList.remove('platform-android', 'platform-desktop')
  })

  it('detects Android from user agent', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 13; Pixel 6)',
      writable: true,
      configurable: true,
    })
    const { isAndroid, isMobile, isDesktop } = await import('./platform.js')
    expect(isAndroid).toBe(true)
    expect(isMobile).toBe(true)
    expect(isDesktop).toBe(false)
  })

  it('detects desktop from user agent', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      writable: true,
      configurable: true,
    })
    const { isAndroid, isMobile, isDesktop } = await import('./platform.js')
    expect(isAndroid).toBe(false)
    expect(isMobile).toBe(false)
    expect(isDesktop).toBe(true)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/modules/platform.test.js`
Expected: FAIL — module `platform.js` not found

**Step 3: Write the module**

Create `src/modules/platform.js`:

```javascript
// src/modules/platform.js — Platform detection for Tauri desktop/mobile

const ua = navigator.userAgent

export const isAndroid = /Android/i.test(ua)
export const isIOS = /iPhone|iPad|iPod/i.test(ua)
export const isMobile = isAndroid || isIOS
export const isDesktop = !isMobile

/**
 * Apply platform-specific CSS class to <html>.
 * Call once at app startup (before rendering).
 */
export function applyPlatformClass() {
  if (isAndroid) {
    document.documentElement.classList.add('platform-android')
  } else {
    document.documentElement.classList.add('platform-desktop')
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/modules/platform.test.js`
Expected: PASS

Note: les tests `import()` dynamiques peuvent avoir des problèmes de cache module. Si c'est le cas, restructurer les tests pour ne pas réimporter dynamiquement.

**Step 5: Commit**

```bash
git add src/modules/platform.js src/modules/platform.test.js
git commit -m "feat: module de détection de plateforme (Android/desktop)"
```

---

### Task 3: Adapter lib.rs pour le mobile

**Files:**
- Modify: `src-tauri/src/lib.rs`

**Contexte:** Le fichier Rust doit exporter un point d'entrée mobile (`#[cfg_attr(mobile, tauri::mobile_entry_point)]`) et conditionner les features desktop-only (system tray, close-to-tray).

**Step 1: Ajouter l'attribut mobile entry point**

Ligne 85, remplacer :
```rust
pub fn run() {
```
par :
```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
```

**Step 2: Entourer le system tray avec `#[cfg(desktop)]`**

Entourer le bloc lignes 105-147 (system tray) avec un gate desktop :

```rust
// ── System tray (desktop only) ──
#[cfg(desktop)]
{
    let show_item =
        MenuItem::with_id(app, "show", "Ouvrir GuideME", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quitter", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

    TrayIconBuilder::new()
        .icon(
            app.default_window_icon()
                .expect("App icon must be configured in tauri.conf.json")
                .clone(),
        )
        .tooltip("GuideME - Ramadan")
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.unminimize();
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.unminimize();
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;
}
```

**Step 3: Conditionner les imports desktop-only**

Au début du fichier (lignes 1-6), les imports `menu`, `tray` sont desktop-only. Entourer :

```rust
use serde::Deserialize;

#[cfg(desktop)]
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};

use tauri::Manager;
```

**Step 4: Conditionner le close-to-tray (lignes 151-159)**

Entourer le `.on_window_event()` avec un gate. Comme c'est un appel chaîné sur `Builder`, utiliser une condition différente :

```rust
        .setup(|app| {
            // ... (unchanged)
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
```

Note : `.on_window_event()` ne peut pas être directement entouré de `#[cfg(desktop)]` car c'est un appel chaîné. Alternatives :
- Garder le handler mais vérifier la plateforme à l'intérieur (sur mobile, `CloseRequested` ne sera pas émis de la même façon)
- Ou restructurer avec un builder intermédiaire

Approche recommandée — garder le handler, il est inoffensif sur mobile :

```rust
        .on_window_event(|window, event| {
            #[cfg(desktop)]
            if window.label() == "main" {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
```

**Step 5: Vérifier la compilation**

Run: `cd src-tauri && cargo check`
Expected: compilation sans erreur

**Step 6: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: adapter lib.rs pour Tauri mobile (entry point + desktop gates)"
```

---

### Task 4: Séparer les capabilities par plateforme

**Files:**
- Modify: `src-tauri/capabilities/default.json` → renommer en `desktop.json`
- Create: `src-tauri/capabilities/android.json`

**Contexte:** Les capabilities Tauri supportent un champ `"platforms"` pour cibler desktop ou mobile. On sépare les permissions desktop-only (autostart, updater, window controls) des permissions partagées.

**Step 1: Renommer default.json → desktop.json et ajouter `platforms`**

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "desktop-capability",
  "description": "Capabilities for desktop (Windows, macOS, Linux)",
  "windows": ["main"],
  "platforms": ["windows", "macos", "linux"],
  "permissions": [
    "core:default",
    "core:window:allow-start-dragging",
    "core:window:allow-minimize",
    "core:window:allow-toggle-maximize",
    "core:window:allow-close",
    {
      "identifier": "http:default",
      "allow": [
        { "url": "https://mawaqit.net/**" },
        { "url": "https://api.aladhan.com/**" },
        { "url": "https://nominatim.openstreetmap.org/**" }
      ]
    },
    "store:default",
    "notification:default",
    "notification:allow-is-permission-granted",
    "notification:allow-request-permission",
    "notification:allow-notify",
    "autostart:allow-enable",
    "autostart:allow-disable",
    "autostart:allow-is-enabled",
    {
      "identifier": "shell:allow-open",
      "allow": [
        { "url": "https://github.com/SofianeBel/**" },
        { "url": "https://paypal.me/**" },
        { "url": "https://ko-fi.com/**" },
        { "url": "https://buymeacoffee.com/**" }
      ]
    },
    "updater:default",
    "process:allow-restart",
    "process:allow-exit"
  ]
}
```

**Step 2: Créer android.json**

```json
{
  "$schema": "../gen/schemas/mobile-schema.json",
  "identifier": "android-capability",
  "description": "Capabilities for Android",
  "windows": ["main"],
  "platforms": ["android"],
  "permissions": [
    "core:default",
    {
      "identifier": "http:default",
      "allow": [
        { "url": "https://mawaqit.net/**" },
        { "url": "https://api.aladhan.com/**" },
        { "url": "https://nominatim.openstreetmap.org/**" }
      ]
    },
    "store:default",
    "notification:default",
    "notification:allow-is-permission-granted",
    "notification:allow-request-permission",
    "notification:allow-notify",
    {
      "identifier": "shell:allow-open",
      "allow": [
        { "url": "https://github.com/SofianeBel/**" },
        { "url": "https://paypal.me/**" },
        { "url": "https://ko-fi.com/**" },
        { "url": "https://buymeacoffee.com/**" }
      ]
    }
  ]
}
```

Note : le `$schema` pour mobile (`mobile-schema.json`) sera généré par `tauri android init` à la Task 6. Si le fichier n'existe pas encore, le laisser temporairement.

**Step 3: Supprimer default.json**

```bash
git rm src-tauri/capabilities/default.json
```

**Step 4: Vérifier la compilation desktop**

Run: `cd src-tauri && cargo check`
Expected: compilation OK (les capabilities desktop sont toujours valides)

**Step 5: Commit**

```bash
git add src-tauri/capabilities/
git commit -m "feat: séparer capabilities par plateforme (desktop + android)"
```

---

### Task 5: Configurer tauri.conf.json pour Android

**Files:**
- Modify: `src-tauri/tauri.conf.json`

**Step 1: Ajouter la section Android au bundle**

Ajouter `"android"` dans le bloc `"bundle"` :

```json
{
  "productName": "GuideME - Ramadan",
  "version": "1.7.0",
  "identifier": "com.guideme.ramadan",
  "bundle": {
    "active": true,
    "targets": "all",
    "createUpdaterArtifacts": "v1Compatible",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "android": {
      "minSdkVersion": 24
    }
  }
}
```

Le reste du fichier (`build`, `plugins`, `app`) reste inchangé.

**Step 2: Commit**

```bash
git add src-tauri/tauri.conf.json
git commit -m "feat: configurer tauri.conf.json pour Android (minSdkVersion 24)"
```

---

### Task 6: Initialiser le target Android

**Prérequis (à faire manuellement avant cette tâche) :**

1. **Installer Android Studio** : https://developer.android.com/studio
2. **Via SDK Manager** d'Android Studio, installer :
   - Android SDK Platform (API 34+)
   - Android SDK Platform-Tools
   - NDK (Side by side)
   - Android SDK Build-Tools
   - Android SDK Command-line Tools
3. **Variables d'environnement** (PowerShell admin) :
   ```powershell
   [System.Environment]::SetEnvironmentVariable("JAVA_HOME", "C:\Program Files\Android\Android Studio\jbr", "User")
   [System.Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LocalAppData\Android\Sdk", "User")
   $NDK_VERSION = Get-ChildItem -Name "$env:LocalAppData\Android\Sdk\ndk" | Select-Object -Last 1
   [System.Environment]::SetEnvironmentVariable("NDK_HOME", "$env:LocalAppData\Android\Sdk\ndk\$NDK_VERSION", "User")
   ```
4. **Redémarrer le terminal** pour que les variables soient prises en compte

**Step 1: Installer les targets Rust Android**

```bash
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
```

**Step 2: Initialiser le projet Android**

```bash
npx tauri android init
```

Expected: Génère `src-tauri/gen/android/` avec un projet Gradle complet.

**Step 3: Vérifier la structure générée**

```bash
ls src-tauri/gen/android/
```

Expected: Dossiers `app/`, `buildSrc/`, fichiers `build.gradle.kts`, `settings.gradle`, etc.

**Step 4: Ajouter gen/android au .gitignore si nécessaire**

Le dossier `gen/android/` est généralement gitignored par défaut par Tauri. Vérifier et ajuster si besoin.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: initialiser le target Android (tauri android init)"
```

---

### Task 7: Appliquer la détection de plateforme au démarrage

**Files:**
- Modify: `src/main.js:289-300` (début du DOMContentLoaded)

**Contexte:** Importer `applyPlatformClass()` du module créé à la Task 2 et l'appeler au tout début du DOMContentLoaded, avant `initTheme()`. Cela ajoute la classe `platform-android` ou `platform-desktop` sur `<html>` pour le CSS.

**Step 1: Ajouter l'import**

Après la ligne 36 (`import { initQibla } from './modules/qibla.js'`), ajouter :

```javascript
import { applyPlatformClass, isMobile } from './modules/platform.js'
```

**Step 2: Appeler au début de DOMContentLoaded**

Juste après `await storage.init()` (ligne 291), ajouter :

```javascript
  // 0.5. Platform detection (adds CSS class before any rendering)
  applyPlatformClass()
```

**Step 3: Conditionner les features desktop-only**

Entourer les initialisations desktop-only avec `if (!isMobile)` :

```javascript
  // Window controls (desktop only)
  if (!isMobile) initWindowControls()

  // ... plus loin dans le code ...

  // 3.8 Initialize Sakura Titlebar Effects (desktop only)
  if (!isMobile) initSakura()

  // 3.11 Initialize Auto-updater (desktop only)
  if (!isMobile) await initUpdater()
```

**Step 4: Vérifier le build**

Run: `npm run build`
Expected: build success

**Step 5: Commit**

```bash
git add src/main.js
git commit -m "feat: appliquer détection plateforme au démarrage, conditionner features desktop"
```

---

### Task 8: CSS Mobile — Masquer titlebar et adapter le layout

**Files:**
- Modify: `src/style.css`

**Contexte:** Sur Android (`html.platform-android`), masquer la titlebar custom et le conteneur sakura, transformer la sidebar en overlay (navigation drawer), et ajouter un bouton hamburger.

**Step 1: Ajouter les règles CSS mobile à la fin du fichier**

```css
/* ─── PLATFORM: Android ─── */

.platform-android .custom-titlebar {
  display: none !important;
}

.platform-android #sakura-container {
  display: none !important;
}

/* Sidebar → Navigation Drawer (overlay) on mobile */
.platform-android .sidebar {
  position: fixed;
  top: 0;
  left: 0;
  height: 100vh;
  width: 280px;
  transform: translateX(-100%);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 1000;
  padding-top: 1.5rem;
}

.platform-android .sidebar.drawer-open {
  transform: translateX(0);
}

/* Backdrop overlay when drawer is open */
.platform-android .sidebar-backdrop {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
}

.platform-android .sidebar-backdrop.visible {
  display: block;
}

/* Sidebar toggle button → hidden on mobile (replaced by hamburger) */
.platform-android .sidebar-toggle-btn {
  display: none;
}

/* Hamburger button (mobile only) */
.hamburger-btn {
  display: none;
}

.platform-android .hamburger-btn {
  display: flex;
  position: fixed;
  top: 12px;
  left: 12px;
  z-index: 998;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 8px;
  background: var(--bg-sidebar);
  color: var(--clr-gold);
  font-size: 1.2rem;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: var(--shadow-md);
}

/* Main content adjustments */
.platform-android .main-content {
  margin-left: 0 !important;
  width: 100% !important;
  padding-top: 56px; /* Space for hamburger button */
}

/* Sidebar minimized state irrelevant on mobile */
.platform-android .sidebar.minimized {
  width: 280px;
  padding: 1.5rem;
}

.platform-android .sidebar.minimized .logo span,
.platform-android .sidebar.minimized .menu-item span {
  display: inline;
}
```

**Step 2: Vérifier le build**

Run: `npm run build`
Expected: build success

**Step 3: Commit**

```bash
git add src/style.css
git commit -m "feat: CSS mobile — titlebar masquée, sidebar en drawer overlay"
```

---

### Task 9: Navigation Drawer — Hamburger + Swipe

**Files:**
- Modify: `src/modules/sidebar.js`
- Modify: `index.html` (ajouter bouton hamburger + backdrop)

**Step 1: Ajouter le HTML pour hamburger et backdrop**

Dans `index.html`, juste avant `<aside class="sidebar">` (ligne 55), ajouter :

```html
        <!-- Hamburger button (mobile only) -->
        <button id="hamburger-btn" class="hamburger-btn" aria-label="Menu">
            <i class="fa-solid fa-bars"></i>
        </button>
        <!-- Backdrop for drawer (mobile only) -->
        <div id="sidebar-backdrop" class="sidebar-backdrop"></div>
```

**Step 2: Réécrire sidebar.js pour supporter desktop + mobile**

```javascript
import { isMobile } from './platform.js'

export function initSidebar() {
    const sidebar = document.querySelector('.sidebar')
    const toggleBtn = document.getElementById('sidebar-toggle')
    const hamburgerBtn = document.getElementById('hamburger-btn')
    const backdrop = document.getElementById('sidebar-backdrop')

    if (!sidebar) return

    if (isMobile) {
        initMobileDrawer(sidebar, hamburgerBtn, backdrop)
    } else {
        initDesktopSidebar(sidebar, toggleBtn)
    }
}

function initDesktopSidebar(sidebar, toggleBtn) {
    if (!toggleBtn) return
    import('./storage.js').then(({ default: storage }) => {
        const isMinimized = storage.get('sidebar_minimized') === true
        if (isMinimized) sidebar.classList.add('minimized')

        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('minimized')
            storage.set('sidebar_minimized', sidebar.classList.contains('minimized'))
        })
    })
}

function initMobileDrawer(sidebar, hamburgerBtn, backdrop) {
    function openDrawer() {
        sidebar.classList.add('drawer-open')
        if (backdrop) backdrop.classList.add('visible')
    }

    function closeDrawer() {
        sidebar.classList.remove('drawer-open')
        if (backdrop) backdrop.classList.remove('visible')
    }

    // Hamburger button
    if (hamburgerBtn) {
        hamburgerBtn.addEventListener('click', openDrawer)
    }

    // Backdrop tap → close
    if (backdrop) {
        backdrop.addEventListener('click', closeDrawer)
    }

    // Close drawer when a menu item is tapped
    sidebar.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', closeDrawer)
    })

    // Swipe gesture: left edge → open, swipe left → close
    let touchStartX = 0
    let touchStartY = 0
    const EDGE_THRESHOLD = 30 // px from left edge
    const SWIPE_MIN = 60 // px minimum swipe distance

    document.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX
        touchStartY = e.touches[0].clientY
    }, { passive: true })

    document.addEventListener('touchend', (e) => {
        const touchEndX = e.changedTouches[0].clientX
        const touchEndY = e.changedTouches[0].clientY
        const deltaX = touchEndX - touchStartX
        const deltaY = Math.abs(touchEndY - touchStartY)

        // Ignore vertical swipes
        if (deltaY > Math.abs(deltaX)) return

        const isDrawerOpen = sidebar.classList.contains('drawer-open')

        // Swipe right from left edge → open
        if (!isDrawerOpen && touchStartX < EDGE_THRESHOLD && deltaX > SWIPE_MIN) {
            openDrawer()
        }

        // Swipe left → close
        if (isDrawerOpen && deltaX < -SWIPE_MIN) {
            closeDrawer()
        }
    }, { passive: true })
}
```

**Step 3: Vérifier le build**

Run: `npm run build`
Expected: build success

**Step 4: Commit**

```bash
git add src/modules/sidebar.js index.html
git commit -m "feat: navigation drawer mobile — hamburger + swipe + backdrop"
```

---

### Task 10: Conditionner updater.js et window.js pour mobile

**Files:**
- Modify: `src/modules/updater.js:7-8`
- Modify: `src/modules/window.js`

**Contexte:** Les imports `@tauri-apps/plugin-updater` et `@tauri-apps/plugin-process` (pour `relaunch`) peuvent échouer sur mobile. Les conditionner avec la détection de plateforme.

**Step 1: Modifier updater.js**

Au début du fichier, ajouter un guard :

```javascript
import { isMobile } from './platform.js'

// Skip updater on mobile (Play Store handles updates)
if (isMobile) {
  export function initUpdater() { /* no-op on mobile */ }
} else {
  // ... existing code
}
```

Alternative plus propre (sans `if` au top-level) — modifier `initUpdater()` :

Ajouter en haut de `initUpdater()` :

```javascript
import { isMobile } from './platform.js'
```

Et dans la fonction `initUpdater` (ou `checkForUpdate`), ajouter au tout début :

```javascript
export async function initUpdater() {
  if (isMobile) return // Play Store handles updates on mobile
  // ... rest of existing code
}
```

**Step 2: Modifier window.js**

Ajouter un guard mobile :

```javascript
import { getCurrentWindow } from '@tauri-apps/api/window'
import { isMobile } from './platform.js'

export function initWindowControls() {
    if (isMobile) return // No window controls on mobile

    let appWindow
    try {
        appWindow = getCurrentWindow()
    } catch (e) {
        console.warn('Tauri window API not available (browser context?)')
        return
    }

    // ... rest unchanged
}
```

**Step 3: Vérifier le build**

Run: `npm run build`
Expected: build success

**Step 4: Commit**

```bash
git add src/modules/updater.js src/modules/window.js
git commit -m "feat: conditionner updater et window controls pour mobile"
```

---

### Task 11: Gérer le bouton retour Android

**Files:**
- Modify: `src/main.js`

**Contexte:** Sur Android, le geste/bouton retour doit : fermer les modales ouvertes → fermer le drawer → ne rien faire sur le dashboard (l'OS gère le minimize).

**Step 1: Ajouter le handler dans main.js**

Dans le bloc `DOMContentLoaded`, après `setupNavigation()`, ajouter :

```javascript
  // Android back button handling
  if (isMobile) {
    document.addEventListener('backbutton', (e) => {
      e.preventDefault()

      // 1. Close drawer if open
      const sidebar = document.querySelector('.sidebar')
      if (sidebar?.classList.contains('drawer-open')) {
        sidebar.classList.remove('drawer-open')
        document.getElementById('sidebar-backdrop')?.classList.remove('visible')
        return
      }

      // 2. Close any open modal
      const openModal = document.querySelector('.modal.show, .modal-overlay.active, .settings-modal.show')
      if (openModal) {
        openModal.classList.remove('show', 'active')
        return
      }

      // 3. On dashboard → let OS handle (minimize app)
      // Don't call e.preventDefault() in this case → default behavior = back/minimize
    })
  }
```

Note : le comportement exact de `backbutton` dans Tauri Android WebView peut nécessiter des ajustements. Tester avec `npm run tauri android dev`.

**Step 2: Commit**

```bash
git add src/main.js
git commit -m "feat: gérer le bouton retour Android (ferme drawer/modales)"
```

---

### Task 12: Build et test Android

**Prérequis :** Tasks 1-11 complétées + Android Studio installé + émulateur ou device USB.

**Step 1: Tester en mode dev**

```bash
npm run tauri android dev
```

Expected: L'app s'ouvre sur l'émulateur/device Android avec :
- Pas de titlebar custom
- Hamburger menu visible en haut à gauche
- Swipe depuis le bord gauche ouvre le drawer
- Toutes les cartes du dashboard visibles
- Horaires de prière chargés

**Step 2: Builder le debug APK**

```bash
npm run tauri android build -- --debug --apk
```

Expected: APK généré dans `src-tauri/gen/android/app/build/outputs/apk/universal/debug/`

**Step 3: Installer sur device**

```bash
adb install -r src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk
```

**Step 4: Vérifier la checklist**

- [ ] Titlebar custom masquée
- [ ] Hamburger button visible
- [ ] Swipe bord gauche → ouvre drawer
- [ ] Tap backdrop → ferme drawer
- [ ] Tap menu item → ferme drawer + navigue
- [ ] Horaires de prière chargés (Mawaqit ou Aladhan)
- [ ] Carte Leaflet fonctionne dans les paramètres
- [ ] Notifications de prière
- [ ] Thème dark/light
- [ ] Pas de crash au démarrage

**Step 5: Commit les ajustements éventuels**

```bash
git add -A
git commit -m "fix: ajustements Android après tests sur device"
```

---

### Task 13: Version bump 1.8.0

**Files:**
- Modify: `package.json` (version)
- Modify: `src-tauri/tauri.conf.json` (version)
- Modify: `src-tauri/Cargo.toml` (version)
- Modify: `src/modules/changelog.js` (APP_VERSION + entrée)
- Modify: `CHANGELOG.md`

**Step 1: Bump version dans les 5 fichiers**

`package.json` :
```json
"version": "1.8.0"
```

`src-tauri/tauri.conf.json` :
```json
"version": "1.8.0"
```

`src-tauri/Cargo.toml` :
```toml
version = "1.8.0"
```

`src/modules/changelog.js` :
```javascript
const APP_VERSION = '1.8.0'

// En premier dans CHANGELOG_ENTRIES :
{
  version: '1.8.0',
  date: '2026-02-27',
  changes: [
    { type: 'feature', text: 'Application disponible sur Android' },
    { type: 'feature', text: 'Navigation drawer mobile (hamburger + swipe)' },
    { type: 'fix', text: 'Autostart ne cause plus d\'erreur Edge au redémarrage' },
  ]
}
```

`CHANGELOG.md` :
```markdown
## [1.8.0] - 2026-02-27

### Ajouté
- Application disponible sur Android (Tauri v2 Mobile)
- Navigation drawer mobile (hamburger + swipe depuis le bord gauche)

### Corrigé
- Autostart : ne cause plus de page d'erreur Edge au redémarrage Windows
```

**Step 2: Run tests et build**

Run: `npx vitest run && npm run build`
Expected: PASS + build success

**Step 3: Commit**

```bash
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src/modules/changelog.js CHANGELOG.md
git commit -m "chore: bump 1.7.0 → 1.8.0 (port Android + fix autostart)"
```
