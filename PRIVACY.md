# Politique de confidentialite — GuideME Ramadan

*Derniere mise a jour : 24 fevrier 2026*

## Principes

GuideME est concue avec un principe simple : **vos donnees vous appartiennent**. L'application fonctionne entierement sur votre appareil et ne collecte aucune donnee personnelle.

## Donnees stockees localement

GuideME enregistre vos preferences dans un fichier local (`guideme-settings.json`) sur votre ordinateur. Ces donnees ne sont **jamais transmises** a un serveur externe.

**Ce qui est stocke :**
- Slug et nom de la mosquee selectionnee
- Ville et pays (pour le calcul des horaires)
- Coordonnees GPS (latitude/longitude) pour la geolocalisation
- Methode de calcul preferee
- Theme choisi (dark/light)
- Preferences de notifications (quelles prieres, adhan)
- Cache des horaires (pour fonctionner hors ligne)
- Progression du tutoriel

**Ce qui n'est PAS stocke :**
- Aucun nom, email, ou identifiant personnel
- Aucun historique de navigation
- Aucun cookie
- Aucune donnee de tracking ou analytique

## Communications reseau

L'application contacte uniquement les APIs suivantes, et **seulement pour recuperer des horaires de priere** :

### Mawaqit (`mawaqit.net`)
- **Quand** : au lancement et lors du changement de mosquee
- **Donnees envoyees** : slug de la mosquee (ex: `grande-mosquee-de-paris`)
- **Donnees recues** : horaires du jour pour cette mosquee
- **Aucune donnee personnelle n'est envoyee**

### Aladhan (`api.aladhan.com`)
- **Quand** : en fallback si Mawaqit n'est pas disponible, ou pour la navigation par date
- **Donnees envoyees** : ville/pays ou coordonnees GPS, methode de calcul
- **Donnees recues** : horaires calcules + date Hijri
- **Les coordonnees GPS servent uniquement au calcul astronomique**

### OpenStreetMap (`tile.openstreetmap.org`)
- **Quand** : uniquement a l'ouverture de l'onglet Carte dans les parametres
- **Donnees envoyees** : requetes standard de tuiles cartographiques
- **Aucune donnee personnelle n'est envoyee**

### GitHub (`api.github.com`)
- **Quand** : uniquement quand vous envoyez volontairement un rapport de bug
- **Donnees envoyees** : titre et description du bug (que vous redigez)
- **Cette action est entierement volontaire et explicite**

## Telemetrie et tracking

**Aucun.** GuideME n'utilise :
- Aucun service d'analytics (pas de Google Analytics, Mixpanel, etc.)
- Aucun pixel de tracking
- Aucun identifiant publicitaire
- Aucun fingerprinting
- Aucune collecte automatique de crash reports

## Geolocalisation

Votre position est utilisee **exclusivement** pour :
1. Calculer les horaires de priere adaptes a votre localisation
2. Afficher la carte pour selectionner une mosquee

Vos coordonnees sont stockees localement et ne sont transmises qu'a l'API Aladhan pour le calcul des horaires. Elles ne sont jamais partagees avec un tiers.

**Fallback** : si la geolocalisation n'est pas disponible, l'application utilise Paris (48.8566, 2.3522) par defaut.

## Donnees des enfants

GuideME ne collecte aucune donnee, y compris celle de mineurs.

## Modifications de cette politique

Toute modification sera documentee dans ce fichier avec la date de mise a jour. Etant donne que l'application ne collecte aucune donnee, les modifications seront rares.

## Contact

Pour toute question concernant la vie privee : ouvrir une [issue](https://github.com/SofianeBel/myramadan/issues) sur le depot GitHub.

Consultez également nos [Conditions Générales d'Utilisation et Mentions Légales](CGU.md).
