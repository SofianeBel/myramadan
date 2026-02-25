# Security Policy

## Versions supportées

| Version | Supportée |
|---------|-----------|
| dernière release | Oui |
| versions antérieures | Non |

## Signaler une vulnérabilité

Si vous découvrez une faille de sécurité dans GuideME Ramadan, **ne créez pas d'issue publique**.

Envoyez un email à **sifly789@gmail.com** avec :

- Description de la vulnérabilité
- Étapes de reproduction
- Impact potentiel

Vous recevrez une réponse sous 48h. Les vulnérabilités confirmées seront corrigées en priorité et créditées dans le changelog.

## Architecture de sécurité

- **CSP stricte** : `script-src: 'self'` — aucun script externe autorisé
- **Permissions Tauri scopées** : HTTP limité à 2 domaines API, shell limité à des URLs spécifiques
- **Pas de secrets côté frontend** : le seul token (bug report) est embarqué côté Rust au build time
- **Sanitisation XSS** : `textContent` pour tout contenu dynamique, `escapeHtml()` disponible
- **Signature des mises à jour** : les installers sont signés via minisign, vérifiés par clé publique
- **Dependabot** : mises à jour automatiques npm, Cargo et GitHub Actions
