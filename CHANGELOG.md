# Changelog

Toutes les modifications notables de GuideME Ramadan Edition sont documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

## [1.7.0] - 2026-02-27

### Ajouté

- **Mode Ramadan / Normal** — détection automatique via la date Hijri (mois 9), ou choix manuel dans les paramètres
- **Tracker de pratique quotidienne** — suivi des 5 prières, jeûne, pages de Coran et dhikr avec calcul de streaks
- **Compteur de dhikr / tasbih** — 5 préréglages (post-prière, SubhanAllah, Astaghfirullah, La ilaha illa Allah, Salawat), raccourci clavier Espace
- **Encyclopédie de douas** — 88 invocations réparties en 9 catégories et 25 sous-catégories, avec recherche, favoris et copie
- **Boussole Qibla** — calcul trigonométrique grand-cercle avec compas SVG interactif
- **Journal de gratitude** — sauvegarde automatique (3s), historique filtrable par mois, purge à 365 jours
- **Statistiques** — heatmap 12 semaines, grille de stats, streaks multiples, objectifs personnels avec barres de progression
- **Barre de progression Ramadan** — affiche le jour courant du Ramadan avec barre visuelle

### Amélioré

- **Contenu quotidien enrichi** — 69 entrées (contre 30) avec translittération, catégories (Coran/Hadith/Doua/Sagesse) et contenu spécifique Ramadan
- **CSS responsive** — breakpoints 768px et 480px pour tous les nouveaux composants

### Corrigé

- **Géolocalisation honnête** — fin du fallback silencieux vers Paris (48.8566, 2.3522), avertissements clairs pour positions GPS/sauvegardées/absentes

## [1.6.1] - 2026-02-25

### Corrigé

- **Recherche mosquée CORS** — les suggestions de ville (Nominatim) fonctionnent maintenant dans Tauri (`tauriFetch` + permission HTTP)

### Amélioré

- **Recherche parallèle** — Mawaqit et Nominatim sont interrogés simultanément, les suggestions de ville apparaissent toujours en complément des mosquées

## [1.6.0] - 2026-02-25

### Ajouté

- **Demande de feature** — le formulaire de signalement permet désormais de proposer une idée (radio Bug / Feature)
- **Styles sélecteur** — boutons visuels avec hover/checked states, labels GitHub dynamiques (`bug` / `enhancement`)

## [1.5.0] - 2026-02-25

### Ajouté

- **Auto-détection mosquée** — au premier lancement, la mosquée la plus proche est sélectionnée automatiquement via GPS + API Mawaqit (seuil 20 km)
- **Fly-to carte** — l'onglet Carte se déplace en douceur vers la mosquée sélectionnée et ouvre son popup
- **Toast de confirmation** — notification discrète avec nom, distance et bouton "Modifier" (auto-dismiss 6s)

## [1.4.1] - 2026-02-25

### Corrigé

- **Carte mosquées** — les marqueurs ne disparaissent plus au dézoom (cache par slug au lieu de clearLayers)
- **Seuil de rechargement** — proportionnel à la vue visible (30% de la largeur) au lieu d'un seuil fixe 3km
- **Nettoyage mémoire** — les marqueurs très éloignés (hors ×3 la vue) sont automatiquement supprimés

## [1.4.0] - 2026-02-25

### Ajouté

- **Builds macOS et Linux** — l'app est désormais disponible sur Windows, macOS et Linux
- **macOS** — binaire universel (.dmg) Intel + Apple Silicon via `--target universal-apple-darwin`
- **Linux** — packages .deb et .AppImage pour les distributions Debian/Ubuntu et autres
- **CI/CD multi-plateforme** — jobs parallèles macOS et Linux dans le workflow de release GitHub Actions
- **Auto-update multi-plateforme** — `latest.json` unifié couvre les 3 OS automatiquement

## [1.3.0] - 2026-02-25

### Ajouté

- **Mises à jour automatiques** — vérification au démarrage (délai 30s) puis toutes les 4h, téléchargement en arrière-plan
- **Bouton "Mises à jour"** — accès rapide depuis la sidebar avec badge NEW quand une mise à jour est disponible
- **Modale de mise à jour** — progression du téléchargement, notes de version, boutons "Installer et redémarrer" / "Plus tard"
- **Signature des installers** — CI/CD signe les builds NSIS/MSI et génère `latest.json` pour l'auto-update
- **Plugins Tauri** — `tauri-plugin-updater` et `tauri-plugin-process` pour le cycle de mise à jour

## [1.2.1] - 2026-02-24

### Corrigé

- **Permission shell** — ajout de `shell:allow-open` dans les capabilities Tauri
- **Liens légaux** — ouverture via URLs GitHub au lieu de chemins locaux (restriction plugin shell)

## [1.2.0] - 2026-02-24

### Ajouté

- **CGU & Mentions Légales** — Conditions Générales d'Utilisation conformes LCEN, RGPD et droit français
- **Boutons Mentions Légales** — accès Confidentialité et CGU depuis les paramètres (plugin shell)
- **Plugin shell** — `@tauri-apps/plugin-shell` pour ouvrir les documents légaux dans le navigateur

## [1.1.4] - 2026-02-24

### Corrigé

- **Popups carte** — couleurs hardcodées remplacées par des classes CSS + variables (theming OK)
- **Validation bug report** — le formulaire reste visible en cas d'erreur, message inline
- **Comptage caractères** — `String::len()` → `chars().count()` pour les caractères accentués (Rust)
- **Commentaires** — traduction des derniers commentaires anglais en français

## [1.1.3] - 2026-02-24

### Corrigé

- **Failles XSS** — sanitisation des entrées dans la recherche mosquée et la carte (textContent + escapeHtml)
- **CI injection** — sécurisation du pipeline release (variables via `env:` au lieu d'inline `${{ }}`)
- **TLS** — activation du chiffrement TLS pour les requêtes réseau Rust (`rustls-tls`)
- **CSP renforcée** — `script-src 'self'`, suppression de `api.github.com` du frontend
- **Validation bug report** — limites titre/description + rate limiting côté client et Rust

### Ajouté

- **Dependabot** — mises à jour automatiques de sécurité (GitHub Actions + npm + Cargo)
- **SRI** — intégrité Subresource Integrity pour les ressources CDN (Font Awesome)

### Supprimé

- **CLAUDE.md / GEMINI.md** — retirés du repo (fichiers de contexte AI, gitignored)

## [1.1.2] - 2026-02-24

### Corrigé

- **Release CI** — pin `tauri-action@v0.6.1` + activer `bundle.active: true` (Tauri v2 défaut = false)
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
