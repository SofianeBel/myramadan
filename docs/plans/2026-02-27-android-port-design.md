# GuideME Ramadan — Port Android + Fix Autostart

**Date :** 2026-02-27
**Version cible :** 1.8.0

---

## Partie A : Fix Autostart Desktop

### Problème

Au démarrage Windows, l'app ouvre Microsoft Edge avec une page d'erreur + une invite de commande vide, au lieu de lancer la fenêtre Tauri.

### Cause probable

Le plugin `tauri-plugin-autostart` enregistre le chemin de l'exécutable courant dans le registre Windows (`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`). Si l'autostart a été activé depuis une session `npm run tauri:dev`, le registre pointe vers le binaire de dev (`target/debug/myramadan.exe`), qui cherche `localhost:1420` — Vite n'étant pas lancé au boot, WebView2 affiche une erreur Edge.

### Solution

1. **Empêcher l'activation en mode dev** — Dans `settings.js`, vérifier `import.meta.env.DEV` avant d'autoriser le toggle autostart.
2. **Afficher un warning** — Si le toggle est désactivé (mode dev), afficher un message explicatif.
3. **Pas de changement Rust** — La condition `#[cfg(desktop)]` existante est suffisante.

---

## Partie B : Port Android (Tauri v2 Mobile)

### Architecture

Un seul codebase pour desktop et mobile :

```
myramadan/
├── src/                    # Frontend partagé (identique)
├── src-tauri/
│   ├── src/lib.rs          # #[cfg(desktop)] vs #[cfg(mobile)]
│   ├── tauri.conf.json     # Config commune
│   ├── capabilities/       # Permissions desktop + mobile
│   └── gen/
│       └── android/        # Projet Android généré par `tauri android init`
```

### Compatibilité plugins

| Plugin | Desktop | Android | Action |
|--------|---------|---------|--------|
| tauri-plugin-http | ✅ | ✅ | Aucune |
| tauri-plugin-store | ✅ | ✅ | Aucune |
| tauri-plugin-notification | ✅ | ✅ | Aucune |
| tauri-plugin-autostart | ✅ | ❌ | `#[cfg(desktop)]` (déjà en place) |
| tauri-plugin-shell | ✅ | ⚠️ | `open()` uniquement |
| tauri-plugin-updater | ✅ | ❌ | `#[cfg(desktop)]` |
| tauri-plugin-process | ✅ | ⚠️ | Garder, peu d'impact |

### Adaptations UI

**Titlebar :**
- Masquer `.custom-titlebar` et `#sakura-container` sur mobile
- Pas de boutons minimize/maximize/close

**Navigation Drawer (sidebar) :**
- Bouton hamburger en haut à gauche
- Swipe depuis le bord gauche → ouvre la sidebar en overlay
- Tap en dehors ou swipe retour → ferme
- Contenu identique à la sidebar desktop

**Bottom Tab Bar :**
- 5 onglets : Dashboard, Horaires, Duas, Journal, Stats
- Navigation identique au desktop mais en bas de l'écran

**Geste retour Android :**
- Ferme les modales ouvertes
- Revient à l'onglet précédent
- Sur Dashboard → minimize l'app (pas de quit)

### Permissions Android

- `ACCESS_FINE_LOCATION` — GPS (mosquée, Qibla)
- `POST_NOTIFICATIONS` (Android 13+) — rappels de prière
- `INTERNET` — APIs

### Splash Screen

Splash Android natif avec le logo `public/logo.png`.

### Hors scope v1

- ❌ Widgets Android (écran d'accueil)
- ❌ Service arrière-plan pour adhan
- ❌ Deep links
- ❌ Wear OS
- ❌ iOS (Android d'abord)
