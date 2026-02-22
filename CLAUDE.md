# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**GuideME - Ramadan Edition** is a Tauri v2 desktop application for Ramadan: prayer times, fasting tracker, Qibla compass, daily Quran/Hadith, and notification reminders with Adhan playback. UI is fully in French. Built with vanilla JS (no framework), Vite, and Rust/Tauri backend.

## Commands

```bash
npm run dev              # Vite dev server (port 1420)
npm run build            # Vite production build → dist/
npm run tauri:dev        # Tauri dev (launches desktop app with hot reload)
npm run tauri:build      # Tauri production build (installer)
npm run preview          # Preview production build locally
```

## Architecture

### Tech Stack
- **Frontend:** Vanilla JS (ES modules), HTML, CSS — no framework
- **Desktop:** Tauri v2 (Rust backend) with plugins: `http`, `store`, `notification`, `autostart`
- **Build:** Vite 7 (`vite.config.js`, port 1420, `esnext` target)
- **Maps:** Leaflet.js (OpenStreetMap tiles)
- **Icons:** Font Awesome 6.4 (CDN), Google Fonts (Outfit)

### Entry Point & Initialization Sequence

`index.html` loads `src/main.js` which orchestrates startup in this order:

1. `storage.init()` — Load persistent settings from Tauri store
2. `initTheme()` — Restore dark/light mode
3. `requestGeolocation()` — GPS coordinates (silent fallback to Paris)
4. `initSplash()` — 2.5s animated splash screen
5. `updateLocationDisplay()` — Show mosque name or city
6. `loadPrayerData()` — Fetch prayer times (Mawaqit → Aladhan fallback)
7. `updateDailyContent()` — Display verse/hadith by day of year
8. `initOnboarding()` — First-visit guided tour (4 steps)
9. `initSettings()` — Settings modal + Leaflet map init
10. `startNotifications()` — 15s interval notification check loop

### Module Map (`src/modules/`)

| Module | Responsibility | Key Exports |
|---|---|---|
| `prayer-times.js` | Mawaqit & Aladhan API integration, time parsing | `loadPrayerData()`, `findNextPrayer()`, `parseTime()` |
| `settings.js` | Settings modal, mosque search, map (Leaflet), geolocation, calculation method | `initSettings()`, `requestGeolocation()` |
| `notifications.js` | OS notifications, Adhan audio playback, 15s check loop | `startNotifications()`, `initNotifications()` |
| `storage.js` | Tauri plugin-store wrapper with in-memory cache | `storage.init()`, `storage.get()`, `storage.set()` |
| `countdown.js` | Real-time countdown to next prayer (HH:MM:SS) | `startCountdown()` |
| `fasting.js` | Suhoor→Iftar progress bar and time remaining | `updateFasting()` |
| `schedule.js` | Daily prayer list rendering with visual states | `renderPrayerSchedule()` |
| `hijri-date.js` | Gregorian + Hijri date display | `updateHijriDate()` |
| `daily-content.js` | Rotating Quran verses & Hadith from JSON | `updateDailyContent()` |
| `theme.js` | Dark/light mode toggle via `data-theme` attribute | `initTheme()`, `toggleTheme()` |
| `onboarding.js` | 4-step guided tour (first visit only) | `initOnboarding()` |
| `splash.js` | 2.5s animated startup screen | `initSplash()` |

### Data Flow: Prayer Times

```
User selects mosque (Mawaqit)    User has no mosque (fallback)
         │                                │
         ▼                                ▼
  Mawaqit API                      Aladhan API
  /mosque/search?word=...         /timings?lat=...&lon=...&method=12
         │                                │
         ▼                                ▼
  times[]: [Fajr,Sunrise,       timings: {Fajr,Sunrise,Dhuhr,
  Dhuhr,Asr,Maghrib,Isha]       Asr,Maghrib,Isha,...}
         │                                │
         └──────────┬─────────────────────┘
                    ▼
           Normalized to 6 prayer times (HH:MM)
           Cached daily in Tauri store
                    │
        ┌───────────┼───────────────┐
        ▼           ▼               ▼
   countdown.js  fasting.js   schedule.js
   (next prayer) (progress)   (prayer list)
```

**Hijri date** always comes from Aladhan (Mawaqit doesn't provide it).

### Storage (`storage.js`)

Uses Tauri `plugin-store` writing to `guideme-settings.json`. In-memory `Map()` cache for sync reads, async write-through to disk.

**Key stored values:**
- `mosqueSlug`, `mosqueName` — Selected mosque
- `userLat`, `userLon`, `userCity`, `userCountry` — Location
- `calculationMethod` — Aladhan method ID (default: 12 = UOIF/France)
- `mawaqitCache`, `prayerTimesCache` — Daily API response cache
- `notificationPrefs` — Notification preferences object
- `theme` — `'dark'` or `'light'`
- `tourCompleted` — Onboarding shown flag

### Notification System (`notifications.js`)

- **Check interval:** 15 seconds
- **Detection window:** 30 seconds (avoids duplicate fires)
- **Two-tier:** Pre-prayer (X min before, chime sound) → At prayer time (Adhan audio)
- **Special cases:** Suhoor replaces Fajr pre-notification, Maghrib pre-notification becomes Iftar reminder
- **Per-prayer toggles** for granular control
- **Adhan audio files:** `public/audio/adhan-{makkah,madina,fajr}.mp3` + `notification.mp3`

### Tauri Backend (`src-tauri/`)

- `lib.rs` — App setup, system tray (close-to-tray behavior), plugin registration
- **Plugins:** `http` (CORS bypass for Mawaqit), `store` (persistence), `notification` (OS alerts), `autostart` (boot launch)
- **System tray:** Left-click shows window, menu has "Ouvrir GuideME" / "Quitter"
- **CSP** configured in `tauri.conf.json`: allows `api.aladhan.com`, OpenStreetMap tiles, Google Fonts, Font Awesome CDN

### External APIs

| API | Base URL | Purpose |
|---|---|---|
| **Mawaqit** | `https://mawaqit.net/api/2.0/mosque/search` | Mosque-specific prayer times |
| **Aladhan** | `https://api.aladhan.com/v1/timings` | Calculated prayer times + Hijri date |

Mawaqit is called via Tauri's HTTP plugin (Rust-side) to bypass CORS. Aladhan is called directly from JS.

### Theming

Two themes toggled via `data-theme` attribute on `<html>`:
- **Dark** (default): Deep twilight blue (`#0B1320`), glassmorphism cards, sand-colored text, SVG Sahara night background
- **Light**: Desert sand palette, green sidebar, SVG daytime Sahara background

CSS variables defined in `src/style.css` under `[data-theme="dark"]` and `[data-theme="light"]` selectors.

### UI Structure (`index.html`)

Single-page app with sidebar navigation (4 pages: Dashboard, Horaires, Coran & Invocations, Qibla). Dashboard grid contains:
- **Fasting card** — Suhoor/Iftar times + progress bar
- **Countdown card** — Next prayer timer + reminder button
- **Schedule card** — Full-width daily prayer list with color-coded states
- **Quote card** — Daily Quranic verse or Hadith

Settings modal has 4 tabs: Mosque search, Map, Notifications, Calculation method.

## Key Patterns

**Geolocation fallback chain:** Browser GPS → Saved coordinates in store → Paris (48.85, 2.35)

**Prayer time caching:** Each API response is cached with a date key. Cache invalidated daily or when mosque/calculation method changes.

**Calculation methods:** 15 supported methods via Aladhan (UOIF = method 12 is default for France). Method selection only affects fallback mode (without mosque).

**Daily content rotation:** `dayOfYear % entries.length` indexes into `src/data/daily-content.json` (400+ entries with Arabic text, French translation, and reference).

**Onboarding:** Only runs once (`tourCompleted` flag). 4-step tour highlighting Dashboard, Fasting card, Schedule, and Theme toggle.

## Code Style

- Vanilla JS with ES modules (`import`/`export`)
- No semicolons convention in most modules
- French variable names and comments throughout
- CSS uses custom properties extensively for theming
- All user-facing text in French
