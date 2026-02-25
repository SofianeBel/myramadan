<div align="center">
  <img src="public/logo.png" width="120" alt="GuideME Logo">
  <h1>GuideME — Ramadan Edition</h1>
  <p><strong>App desktop d'horaires de priere, suivi du jeune et notifications adhan.</strong></p>
  <p>Legere, privee, 100% locale. Construite avec Tauri et Rust.</p>

  [![Release](https://img.shields.io/github/v/release/SofianeBel/myramadan?style=for-the-badge&logo=github&label=version)](https://github.com/SofianeBel/myramadan/releases/latest)
  [![Downloads](https://img.shields.io/github/downloads/SofianeBel/myramadan/total?style=for-the-badge)](https://github.com/SofianeBel/myramadan/releases)
  [![License](https://img.shields.io/github/license/SofianeBel/myramadan?style=for-the-badge)](LICENSE)
  [![Stars](https://img.shields.io/github/stars/SofianeBel/myramadan?style=for-the-badge)](https://github.com/SofianeBel/myramadan/stargazers)

  ![Tauri](https://img.shields.io/badge/tauri-%2324C8DB.svg?style=for-the-badge&logo=tauri&logoColor=%23FFFFFF)
  ![Rust](https://img.shields.io/badge/rust-%23CE422B.svg?style=for-the-badge&logo=rust&logoColor=white)
  ![JavaScript](https://img.shields.io/badge/javascript-%23323330.svg?style=for-the-badge&logo=javascript&logoColor=%23F7DF1E)
  ![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)

</div>

---

<!-- VIDEO DE PRESENTATION-->

https://github.com/user-attachments/assets/67305de7-2c04-4491-b5e2-15dd823498c9


## Fonctionnalites

### Horaires de priere
- **Double source API** — Mawaqit (horaires mosquee) avec Aladhan en fallback (calcul astronomique)
- **Navigation par date** — Parcourir les horaires sur ±30 jours
- **Calendrier mensuel** — Vue complete des horaires du mois
- **Date Hijri** — Affichage de la date du calendrier islamique

### Suivi du jeune
- **Progression en direct** — Barre Suhoor → Iftar mise a jour chaque minute
- **Compte a rebours** — Timer vers la prochaine priere (tick par seconde)
- **Mode reference** — Consulter les horaires de jeune des jours passes/futurs

### Notifications
- **Adhan personnalise** — Notification OS a l'heure de chaque priere
- **Controle par priere** — Activer/desactiver les rappels individuellement
- **Rappels silencieux** — Notifications sans son disponibles

### Interface
- **Themes Dark / Light** — Bleu nuit + glassmorphism ou vert + or + sable
- **System tray** — Fermer = minimiser, l'app reste accessible
- **Lancement au demarrage** — Option autostart
- **Titlebar custom** — Barre de titre personnalisee avec animations sakura
- **Carte interactive** — Localiser sa mosquee sur OpenStreetMap
- **Onboarding** — Tutoriel guide au premier lancement

### Communaute
- **Signaler un bug** — Formulaire integre creant une issue GitHub
- **Quoi de neuf** — Modale changelog avec badge NEW a chaque mise a jour

---

## Telecharger

<div align="center">

  [![Telecharger pour Windows](https://img.shields.io/badge/Telecharger_pour_Windows-0078D4?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/SofianeBel/myramadan/releases/latest)

  **Windows 10/11** — Installer `.exe` (NSIS) ou `.msi` disponibles.

</div>

> macOS et Linux ne sont pas encore supportes. Contributions bienvenues !

---

## Vie privee

> **Vos donnees ne quittent jamais votre appareil.**

GuideME est concue dans le respect total de votre vie privee :

- **Aucun compte requis** — Pas d'inscription, pas de login
- **Aucune telemetrie** — Zero tracking, zero analytics, zero cookie
- **Stockage 100% local** — Tous vos parametres sont dans un fichier local (`guideme-settings.json`)
- **Geolocalisation locale** — Vos coordonnees servent uniquement a calculer les horaires et ne sont jamais transmises
- **Bug reports volontaires** — Envoyes a GitHub Issues uniquement quand vous cliquez "Envoyer"

### APIs externes appelees

| API | Usage | Donnees envoyees |
|-----|-------|-----------------|
| [Mawaqit](https://mawaqit.net) | Horaires de la mosquee selectionnee | Slug de la mosquee uniquement |
| [Aladhan](https://aladhan.com) | Horaires calcules + date Hijri | Ville ou coordonnees GPS |
| [OpenStreetMap](https://www.openstreetmap.org) | Tuiles de la carte (settings) | Requetes de tuiles standard |

Aucune de ces APIs ne recoit de donnees personnelles identifiantes.

Pour plus de details, consultez notre [Politique de confidentialite](PRIVACY.md). 
Pour les mentions légales, référez-vous aux [Conditions Générales d'Utilisation](CGU.md).

---

## Stack technique

| Composant | Technologie | Role |
|-----------|-------------|------|
| Desktop | [Tauri v2](https://v2.tauri.app/) | Framework desktop leger (~8 MB) |
| Backend | [Rust](https://www.rust-lang.org/) | Logique native, system tray, HTTP securise |
| Frontend | Vanilla JavaScript (ES modules) | Interface sans framework |
| Build | [Vite 7](https://vite.dev/) | Bundler ultra-rapide |
| Cartes | [Leaflet.js](https://leafletjs.com/) + OpenStreetMap | Carte interactive |
| Icones | [Font Awesome 6](https://fontawesome.com/) | Icones UI |
| Police | [Outfit](https://fonts.google.com/specimen/Outfit) (Google Fonts) | Typographie principale |

---

## Developpement

### Prerequis

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) toolchain stable
- [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) (WebView2 sur Windows)

### Installation

```bash
git clone https://github.com/SofianeBel/myramadan.git
cd myramadan
npm install
```

### Commandes

```bash
npm run tauri:dev     # App desktop avec hot reload
npm run tauri:build   # Build installer (MSI + NSIS)
npm run dev           # Vite dev server seul (port 1420)
npm run build         # Build frontend seul
```

### Structure du projet

```
src/                  # Frontend (JS, HTML, CSS)
  modules/            # Modules ES : prayer-times, notifications, settings...
  style.css           # Styles + theming (CSS custom properties)
src-tauri/            # Backend Rust
  src/lib.rs          # System tray, bug report, autostart
public/               # Assets statiques (logo, audio)
```

---

## Credits & Attributions

Ce projet existe grace a ces services et librairies :

- **[Mawaqit](https://mawaqit.net)** — Horaires de priere des mosquees (waqf)
- **[Aladhan](https://aladhan.com)** — API de calcul des horaires de priere et calendrier Hijri
- **[OpenStreetMap](https://www.openstreetmap.org/copyright)** contributors — Donnees cartographiques (ODbL)
- **[Leaflet](https://leafletjs.com)** — Bibliotheque de cartes interactives (BSD-2)
- **[Tauri](https://tauri.app)** — Framework desktop (MIT + Apache 2.0)
- **[Font Awesome](https://fontawesome.com)** — Icones (CC BY 4.0 / OFL / MIT)
- **[Google Fonts](https://fonts.google.com)** — Police Outfit (OFL 1.1)

---

## Soutenir le projet

GuideME est gratuit et open source. Si l'app vous est utile, un petit soutien aide a la maintenir :

<div align="center">

  [![Ko-Fi](https://img.shields.io/badge/Ko--fi-F16061?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/sifly)
  [![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/sifly)
  [![PayPal](https://img.shields.io/badge/PayPal-00457C?style=for-the-badge&logo=paypal&logoColor=white)](https://paypal.me/Siflyisback?locale.x=fr_FR&country.x=FR)

</div>

---

## Licence

Ce projet est sous licence [MIT](LICENSE).

Distribue librement — voir le fichier `LICENSE` pour les details.

---

<div align="center">
  <sub>Fait avec soin pour le Ramadan. Qu'Allah accepte nos efforts.</sub>
</div>
