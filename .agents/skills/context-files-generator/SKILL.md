---
name: context-files-generator
description: >
  Génère et optimise les fichiers de contexte pour les outils AI coding agents :
  AGENTS.md (Codex), GEMINI.md (Gemini CLI), AGENTS.md (Codex CLI).
  Utilise ce skill quand l'utilisateur veut créer ou améliorer un de ces fichiers,
  auditer un fichier existant, ou comprendre ce qui doit s'y trouver. Adapte le
  contenu au projet détecté dans le codebase ou décrit par l'utilisateur.
---

Tu es un expert en configuration d'AI coding agents. Tu génères des fichiers de contexte
(AGENTS.md, GEMINI.md, AGENTS.md) optimaux qui donnent aux agents exactement ce dont ils
ont besoin — ni plus, ni moins.

---

## PHILOSOPHIE FONDAMENTALE

Ces fichiers sont injectés dans **chaque** session de l'agent. Chaque règle inutile dilue
les règles importantes. Les LLMs peuvent suivre ~150-200 instructions avec cohérence, et
les agents comme Codex consomment déjà ~50 instructions dans leur system prompt.

**Règle d'or : si l'agent fait déjà quelque chose correctement sans l'instruction, ne
l'écris pas.**

Un fichier de contexte performant :
- Est court et dense (pas de remplissage)
- Contient uniquement ce qui n'est pas évident depuis le code
- Documente le WHAT et le HOW, pas le WHY en détail
- Permet à l'agent de vérifier son propre travail (commandes de test)

---

## STRUCTURE DES FICHIERS DE CONTEXTE

### AGENTS.md (Codex)

Codex lit le AGENTS.md à chaque démarrage de session. Hiérarchie :
- `~/.Codex/AGENTS.md` — préférences globales (tous projets)
- `./AGENTS.md` — racine du projet
- Sous-dossiers peuvent avoir leurs propres AGENTS.md pour des règles spécifiques

**Structure recommandée :**
```markdown
# AGENTS.md

## Stack technique
[Technologies, frameworks, versions importantes]

## Commandes essentielles
[build, test, lint, dev server — ce dont l'agent a besoin pour vérifier son travail]

## Architecture & structure
[Map du codebase : où sont les components, services, config, etc.]

## Conventions de code
[Nommage, patterns à suivre, patterns à éviter]

## Scope des modifications
[Ce que l'agent peut et ne peut pas toucher]

## Pièges connus
[Comportements contre-intuitifs, configs spéciales, dépendances cachées]
```

**Spécificités Codex :**
- Codex 4.x tend à over-engineer : ajoute toujours une section scope qui limite les modifications
- Utilise `/init` pour générer un AGENTS.md de départ basé sur la structure du projet
- Les règles critiques → hooks (déterministes) plutôt que AGENTS.md (advisory)
- Trop long = le modèle ignore la moitié → pruner sans pitié

### GEMINI.md (Gemini CLI)

Gemini CLI charge les GEMINI.md hiérarchiquement :
- `~/.gemini/GEMINI.md` — global
- `./GEMINI.md` — projet
- GEMINI.md de chaque sous-dossier chargé dynamiquement quand l'agent navigue dedans

**Avantage unique :** `/memory add "texte"` ajoute une info persistante pendant la session.
Utile pour des discoveries importantes : "Le flag X doit être true ou le service crash."

**Même structure que AGENTS.md.** Gemini comprend aussi les balises XML et le Markdown.

**Spécificité Gemini :** mettre les instructions critiques EN PREMIER dans le fichier (priorité
aux éléments en début de prompt dans la doc Google).

### AGENTS.md (Codex CLI)

Codex CLI — système le plus granulaire :
- `~/.codex/AGENTS.md` — global (working agreements personnels)
- `./AGENTS.md` — racine du projet
- `./sous-dossier/AGENTS.override.md` — override pour un module spécifique

Chaque fichier devient un **user-role message** distinct injecté avant le prompt.
Les fichiers plus profonds overrident les fichiers parents.

**Spécificité Codex :** les Skills (`.agents/skills/SKILL.md`) permettent d'enseigner des
capacités réutilisables (comment créer un PR, comment déployer, etc.).

---

## CE QUI DOIT Y ÊTRE

### ✅ À INCLURE SYSTÉMATIQUEMENT

**Stack et versions :**
```markdown
## Stack
- Next.js 15.x, React 19, TypeScript 5.x (strict mode)
- TailwindCSS 4.x
- Backend : ASP.NET Core 9, C#
- BDD : PostgreSQL 16 avec Entity Framework Core
- Tests : Jest + Testing Library (front), xUnit (back)
```

**Commandes de vérification** — c'est ce qui permet à l'agent de valider son propre travail :
```markdown
## Commandes
- `npm run dev` — dev server (port 3000)
- `npm test` — tests unitaires
- `npm run lint` — ESLint + type check
- `dotnet run` — backend (port 5000)
- `dotnet test` — tests backend
```

**Map du codebase** (surtout pour les monorepos) :
```markdown
## Structure
- `/src/components` — composants UI réutilisables
- `/src/app` — pages Next.js (app router)
- `/src/lib` — utils, hooks, helpers
- `/src/api` — client API et types
- `/backend` — ASP.NET Core project
- `/shared` — types partagés front/back
```

**Conventions non-évidentes :**
```markdown
## Conventions
- Toujours React Query pour les calls API, jamais fetch direct
- Components : PascalCase, hooks : camelCase préfixé use
- Nommage fichiers : kebab-case sauf components (PascalCase)
- CSS : Tailwind uniquement, pas de CSS modules ni styled-components
```

**Scope des modifications** (critique pour Codex) :
```markdown
## Scope
- Ne modifie que ce qui est explicitement demandé
- Ne refactorise pas le code adjacent non demandé
- Ne crée pas de nouvelles dépendances sans confirmation
- /legacy/ est en cours de migration — ne pas toucher
```

**Pièges et comportements non-évidents :**
```markdown
## À savoir
- NODE_ENV doit être "development" pour les feature flags en local
- Le token CSRF est requis sur toutes les routes POST — voir middleware AuthMiddleware.cs
- Les tests E2E nécessitent la BDD de test : `npm run db:test:setup` avant
```

### ❌ À NE PAS INCLURE

- Ce que l'agent fait déjà correctement sans instruction
- Les explications longues sur "pourquoi" une règle existe
- Les edge cases ultra-spécifiques (ça pollue les instructions générales)
- Les choses déjà évidentes depuis la structure du code
- Les redites de ce qui est dans le README
- Les règles de politesse ("réponds toujours en français")
  → Pour ça, utilise un hook ou une instruction en début de session

---

## TEMPLATE DE GÉNÉRATION

Quand l'utilisateur veut créer un fichier de contexte, collecte ces informations
(depuis le codebase ou en posant des questions) :

1. **Stack** : langages, frameworks, versions
2. **Commandes clés** : comment build, tester, lancer en local
3. **Structure** : organisation des dossiers importants
4. **Conventions** : patterns utilisés qui ne sont pas standards
5. **Libs imposées / interdites** : ce qui doit/ne doit pas être utilisé
6. **Zones sensibles** : code à ne pas toucher
7. **Pièges connus** : comportements non-évidents, configs spéciales

### Template universel (AGENTS.md / GEMINI.md / AGENTS.md)

```markdown
# [Codex|GEMINI|AGENTS].md

## Stack
- [framework principal] [version]
- [autres techno importantes]
- [BDD et ORM si applicable]
- [framework de test]

## Commandes
- `[commande]` — [description courte]
- `[commande]` — [description courte]
- `[commande]` — lancer les tests (à exécuter avant tout commit)

## Structure du projet
- `/[dossier]` — [rôle]
- `/[dossier]` — [rôle]

## Conventions
- [convention 1]
- [convention 2]
- [pattern à utiliser] (ex: toujours X, jamais Y)

## Scope des modifications
- Modifier uniquement ce qui est demandé
- Ne pas ajouter de dépendances sans confirmation
- [zones sensibles à ne pas toucher]

## À savoir (pièges / non-évidents)
- [info critique 1]
- [info critique 2]
```

---

## AUDIT D'UN FICHIER EXISTANT

Si l'utilisateur soumet un fichier existant à auditer, évalue-le selon ces critères :

**Longueur :** est-il plus long que nécessaire ? Y a-t-il des règles redondantes ou
déjà respectées naturellement par l'agent ?

**Clarté des commandes :** l'agent peut-il vérifier son propre travail ? Les commandes
de test/lint sont-elles présentes ?

**Scope défini :** y a-t-il des instructions claires sur ce que l'agent peut et ne peut
pas modifier ?

**Pièges couverts :** les comportements non-évidents du projet sont-ils documentés ?

**Instructions négatives :** y a-t-il des "ne fais pas X" sans alternative claire ?
Préférer "fais Y" à "ne fais pas X".

Propose une version révisée + liste des changements avec justification.

---

## GLOBAL vs PROJET

**Fichier global** (`~/.Codex/AGENTS.md` etc.) — tes préférences universelles :
```markdown
## Préférences générales
- Langue de réponse : français
- Toujours demander confirmation avant de supprimer des fichiers
- Toujours lancer les tests après une modification
- Préférer des solutions simples aux abstractions prématurées
- Nettoyer les fichiers temporaires créés pendant le travail
```

**Fichier projet** — conventions et structure spécifiques au codebase.

**Règle :** ce qui change d'un projet à l'autre → fichier projet.
Ce qui est vrai partout → fichier global.

---

## SPÉCIFICITÉS PAR OUTIL

### Codex en particulier
- `/init` génère un AGENTS.md de départ — utilise-le comme base
- Les règles critiques (ex: "toujours lancer les tests") → préférer un **hook** qui s'exécute
  automatiquement plutôt qu'une instruction advisory dans le fichier
- Si le AGENTS.md devient trop long → convertir les règles les moins critiques en hooks
- Codex 4.x crée des fichiers temporaires pendant le travail → ajouter :
  ```markdown
  Nettoie les fichiers temporaires créés pendant les tâches.
  ```

### Gemini CLI en particulier
- `/memory show` pour voir le contexte chargé — utile pour débugger
- Structure hiérarchique des GEMINI.md par sous-dossier : utile pour les monorepos
  (règles différentes pour `/frontend` et `/backend`)
- Custom commands (`.gemini/commands/`) pour automatiser des tâches répétitives

### Codex CLI en particulier
- `AGENTS.override.md` dans un sous-dossier remplace complètement le fichier parent
  pour ce module
- Skills (`.agents/skills/`) pour des capacités réutilisables complexes
- Limite de taille : 32 KiB combiné → surveiller si tu as des fichiers dans plusieurs
  sous-dossiers
