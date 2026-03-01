# GuideME Ramadan v2 — Design Document

**Date** : 2026-02-27
**Objectif** : Transformer GuideME d'un outil Ramadan en compagnon spirituel quotidien toute l'année.
**Contraintes techniques** : Vanilla JS, Tauri store local, pas de backend, APIs légères uniquement (aucune nouvelle API ajoutée).

---

## 1. Mode Ramadan / Normal

Bascule automatique via la date Hijri (Aladhan). Override manuel dans les settings.

**Stockage** : `appMode: 'ramadan' | 'normal' | 'auto'` (défaut: `auto`).

### Mode Ramadan (existant + enrichi)
- Dashboard actuel : countdown prière, tracker jeûne Suhoor→Iftar, schedule, contenu quotidien
- Barre de progression "Jour X/30 du Ramadan" en haut du dashboard
- Contenu quotidien priorise les hadiths/versets liés au jeûne

### Mode Normal (reste de l'année)
- Dashboard simplifié : countdown prière, schedule, contenu quotidien
- Tracker de jeûne masqué (toggle optionnel pour jeûnes volontaires : lundi/jeudi, Arafat, Achoura)
- Sections visibles : compteur de dhikr, accès rapide douas, boussole Qibla

### Transition
- Toast notification la veille du 1er Ramadan : "Le Ramadan commence demain !"
- Bascule automatique à minuit si mode `auto`

---

## 2. Tracker de pratique quotidien

Carte dashboard entre le countdown et le schedule. Compacte par défaut, expandable au clic.

### Métriques trackées
- **Prières** (5/5) : checkboxes par prière. Toast "Dhuhr prié ?" après l'heure passée (optionnel)
- **Jeûne** : auto-coché en Ramadan (décochable). Toggle volontaire en mode Normal
- **Lecture Coran** : slider 0-20 pages/jour. Objectif suggéré ~20 pages/jour en Ramadan (Khatma)

### Vue compacte
```
┌─────────────────────────────────┐
│ Aujourd'hui           streak 🔥7 │
│ ● ● ● ○ ○  Prières 3/5          │
│ Jeûne ✓     Coran 5 pages       │
└─────────────────────────────────┘
```

### Vue expandée
- Détail des 5 prières avec nom + heure + checkbox
- Sélecteur type de jeûne (Ramadan / lundi-jeudi / Arafat / autre)
- Input pages Coran avec barre de progression Khatma

### Persistence
```json
{
  "practiceLog": {
    "2026-02-27": {
      "prayers": [true, true, true, false, false],
      "fasting": true,
      "quranPages": 5,
      "dhikrCount": 234
    }
  }
}
```
Pruning : 90 jours glissants. Tout local (Tauri store).

---

## 3. Compteur de dhikr / tasbih

Carte dashboard sous le tracker. Interactive directement, pas de modal.

### Fonctionnement
- Gros bouton central [+] pour incrémenter
- Raccourci clavier : `Espace` quand la carte est focus
- Passage automatique au dhikr suivant quand l'objectif est atteint (flash vert)
- Animation de complétion quand le cycle entier est fini

### Dhikrs disponibles (menu déroulant)
- Cycle post-prière : SubhanAllah (33) → Alhamdulillah (33) → Allahu Akbar (34)
- SubhanAllah seul (objectif libre)
- Astaghfirullah (objectif libre)
- La ilaha illa Allah (objectif libre)
- Personnalisé : texte + objectif définis par l'utilisateur

### Persistence
- Compteur courant sauvegardé (reprise si app fermée)
- Total quotidien ajouté au `practiceLog.dhikrCount`

---

## 4a. Contenu quotidien enrichi

Amélioration de la carte dashboard existante.

### Changements
- **365+ entrées** dans `daily-content.json` (au lieu de ~20)
- Ajout de la **translittération phonétique**
- Tags affichés comme badge : `quran` / `hadith` / `doua` / `sagesse`
- Mode Ramadan : priorise les contenus tagués `ramadan: true`
- Bouton **copier** : arabe + translittération + traduction + référence
- **Flèches** pour voir les contenus des jours précédents

### Structure enrichie
```json
{
  "day": 1,
  "category": "hadith",
  "arabic": "...",
  "transliteration": "...",
  "translation": "...",
  "reference": "Sahih al-Bukhari 1901",
  "ramadan": true
}
```

---

## 4b. Encyclopédie de douas

Nouvelle vue dédiée dans la sidebar : **"Douas"** 🤲.

### Organisation hiérarchique (~120-150 douas)

**Vie quotidienne** : Matin (Adhkar as-sabah), Soir (Adhkar al-massa), Avant/après le repas, Entrer/sortir de la maison, Sommeil/Réveil

**Prière & Adoration** : Avant/pendant/après la prière, Entrer à la mosquée, Nuit (Qiyam, Tahajjud)

**Ramadan & Jeûne** : Rupture du jeûne (Iftar), Nuit du Destin (Laylat al-Qadr), Douas spécifiques Ramadan

**Situations de vie** : Voyage, Maladie & guérison, Détresse & anxiété, Pluie & tonnerre, Mariage, Parents & famille

**Protection** : Contre le mal, Ayat al-Kursi & Mu'awwidhat, Invocations de protection

**Repentir & Pardon** : Istighfar, Tawbah

**Mes favoris** : douas marquées ⭐ par l'utilisateur

### Vue d'une doua
- Texte arabe (police grande, centrée)
- Translittération phonétique (italique)
- Traduction française
- Source/référence (Coran ou Hadith)
- Note contextuelle optionnelle ("Se dit au début de chaque action")

### Features
- Recherche temps réel (traduction, translittération, référence)
- Favoris ⭐ sauvegardés dans le store
- Bouton copier (arabe + translittération + traduction + source)
- Compteur par catégorie

### Données
Fichier statique `src/data/duas.json`. Pas d'API.

---

## 5. Boussole Qibla + fin du fallback Paris

### Boussole
Carte dashboard. Calcul trigonométrique (great-circle bearing) entre la position de l'utilisateur et la Kaaba (21.4225° N, 39.8262° E).

- Boussole SVG avec aiguille pointant vers la Qibla
- Angle en degrés + direction cardinale
- Nom de la ville
- Statique (pas de magnétomètre sur desktop)
- Aucune API : `Math.atan2` + coordonnées du store

### Gestion honnête de la géolocalisation (toute l'app)

```
GPS disponible
  → Utiliser et sauvegarder

Échec GPS + coordonnées sauvegardées
  → Utiliser avec avertissement : "Position approximative (dernière localisation connue)"

Échec GPS + aucune coordonnée
  → Bloquer : "Localisation requise" + bouton [Ouvrir les paramètres]
```

Suppression du fallback silencieux Paris dans toute l'app. Bandeau orange "Position non détectée" dans le header si nécessaire.

---

## 6. Statistiques, streaks et objectifs

### A. Streaks
Basés sur le `practiceLog`. Affichés sur la carte tracker : `🔥 7`.

- Prière complète : 5/5 → streak +1
- Jeûne : jour coché → streak +1
- Coran : ≥1 page → streak +1
- Dhikr : ≥1 cycle complété → streak +1

Reset à 0 si un jour est manqué.

### B. Statistiques (nouvelle vue sidebar 📊)

- Pourcentage prières (semaine/mois)
- Meilleur streak par catégorie
- Pages Coran (semaine + total + progression Khatma)
- Total dhikr (mois)
- **Heatmap** type GitHub : grille SVG, couleur selon le score du jour (🟩 5/5, 🟨 3-4, ⬜ 0-2)
- Compteur entrées journal "📝 12 entrées ce mois"

**Filtres temporels** : Semaine / Mois / Ramadan / Tout

### C. Objectifs personnalisés

Section en bas de la vue Statistiques.

**Objectifs prédéfinis (suggestions)** :
- Prier Fajr X jours d'affilée
- Prier 5/5 pendant X jours
- Khatma complète (604 pages)
- X dhikr ce mois
- Jeûner lundi/jeudi pendant X semaines

**Objectifs personnalisés** : métrique + cible + durée.

Barre de progression par objectif. Marqué ✓ quand atteint.

```json
{
  "goals": [
    {
      "id": "fajr-streak-30",
      "type": "prayer-streak",
      "prayer": "Fajr",
      "target": 30,
      "current": 12,
      "completed": false
    }
  ]
}
```

---

## 7. Journal de gratitude

Nouvelle vue sidebar : **"Journal"** 📝.

### Interface
- Zone de texte libre en haut pour le jour en cours
- Placeholder rotatif inspirant : "Qu'est-ce qui t'a marqué aujourd'hui ?", "Pour quoi es-tu reconnaissant ?", "Quelle intention pour demain ?"
- Auto-save après 3 secondes d'inactivité + bouton sauvegarder
- Historique scrollable par date DESC
- Filtre par mois (dropdown)

### Contraintes
- Texte brut uniquement (pas de formatage riche)
- Pas de limite de caractères
- Jours sans entrée = pas affichés (pas de pression)

### Persistence
```json
{
  "journal": {
    "2026-02-27": "Réveillé pour Fajr sans alarme...",
    "2026-02-26": "Iftar en famille..."
  }
}
```
Pruning : 365 jours glissants.

---

## Impact architectural

### Nouveaux modules (`src/modules/`)
| Module | Rôle |
|--------|------|
| `practice-tracker.js` | Tracker quotidien + streaks |
| `dhikr.js` | Compteur tasbih |
| `duas.js` | Encyclopédie de douas |
| `qibla.js` | Boussole Qibla |
| `journal.js` | Journal de gratitude |
| `statistics.js` | Vue stats + heatmap + objectifs |
| `app-mode.js` | Gestion mode Ramadan/Normal/Auto |

### Modules modifiés
- `main.js` : init nouveaux modules, système de modes
- `schedule.js` : intégration tracker
- `storage.js` : nouvelles clés de stockage
- `sidebar.js` : 3 nouvelles entrées (Douas, Stats, Journal)
- `index.html` : 3 nouvelles vues + nouvelles cartes dashboard
- `settings.js` : sélecteur de mode app
- `globals.css` : styles nouveaux composants

### Nouveaux fichiers de données (`src/data/`)
- `duas.json` : ~120-150 douas organisées par catégorie
- `daily-content.json` : enrichi de ~20 à 365+ entrées

### Aucune nouvelle dépendance npm
### Aucune nouvelle API externe
