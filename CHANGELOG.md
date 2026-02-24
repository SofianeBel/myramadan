# Changelog

Toutes les modifications notables de GuideME Ramadan Edition sont documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

## [1.1.1] - 2026-02-24

### Corrigé

- **Release CI** — pin `tauri-action@v0.6.1` (fix espaces dans productName)
- **CSS variables** — remplacement des couleurs hardcodées par des custom properties
- **Commentaires** — traduction des commentaires anglais en français

## [1.1.0] - 2026-02-24

### Ajouté

- **Quoi de neuf** — modale in-app affichant les nouveautés avec badge "NEW" dans la sidebar
- **Soutenir GuideME** — modale de dons avec PayPal, Ko-fi et Buy Me a Coffee (liens réels)
- **Signaler un bug** — formulaire intégré envoyant des issues GitHub via Tauri HTTP
- **Calendrier mensuel** — vue Horaires avec tableau des prières du mois entier
- **Navigation par date** — parcourir les horaires passés/futurs (±30 jours) avec debounce
- **Notifications de prière** — rappels par prière avec choix d'adhan (Makkah, Madina, Fajr spécial)
- **Toggles individuels** — activer/désactiver les notifications par prière depuis le planning
- **Tutoriel interactif** — onboarding guidé au premier lancement avec mise en surbrillance
- **Réinitialiser le tutoriel** — bouton dans les paramètres pour relancer le tour guidé
- **Titlebar custom** — barre de titre personnalisée avec branches de sakura et pétales animés
- **Lancement au démarrage** — option autostart via le plugin Tauri
- **System tray** — fermer la fenêtre minimise dans la barre système
- **Icônes officielles** — logo GuideME intégré (splash, sidebar, icônes app)
- **CI/CD** — workflow de release automatique Windows (MSI/NSIS) + code review Claude

### Modifié

- **Méthode UOIF corrigée** — angles custom (15°) via `method=99` quand Aladhan renvoie 12°
- **Responsive settings** — modale paramètres adaptée aux petits écrans (<600px)
- **Glassmorphism modales** — effet verre dépoli cohérent sur toutes les modales
- **Coming soon pattern** — style unifié pour les features en construction (sidebar + panels)
- **Bug report refactorisé** — migration vers `option_env!()` Rust, suppression config token UI

### Corrigé

- **Barre de progression jeûne** — masquée correctement en dehors des heures de jeûne
- **Permissions fenêtre** — ajout des permissions Tauri pour titlebar custom (minimize, maximize, close)
- **Notifications reminder** — reset correct de tous les toggles par prière à l'activation
- **CSP GitHub API** — ajout de `api.github.com` dans la Content Security Policy

## [1.0.0] - 2025-01-01

### Ajouté

- Version initiale de GuideME Ramadan Edition
- Horaires de prière via Mawaqit (mosquée) et Aladhan (calcul) avec fallback automatique
- Temps de jeûne Suhoor → Iftar avec progression en temps réel
- Countdown prochaine prière (tick 1s)
- Date Hijri depuis Aladhan
- Contenu quotidien (hadith, doua)
- Paramètres mosquée (recherche texte + carte Leaflet)
- Méthodes de calcul multiples (UOIF par défaut)
- Thème clair/sombre avec fond Sahara animé (nuit étoilée / désert jour)
- Géolocalisation avec fallback (GPS → sauvegardé → Paris)
- Cache intelligent Mawaqit (daily) et Aladhan (multi-dates, 7 entrées max)
- Storage persistant via Tauri Store (write-through, migration auto depuis localStorage)
