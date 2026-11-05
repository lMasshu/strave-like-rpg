# Transfert de Contexte & Skills - Stride Quest (strave-like-rpg)

Ce document sert de passerelle complète pour transférer la session, le contexte de développement et les compétences (skills) vers un nouveau répertoire ou un nouvel agent IA.

---

## 1. Contexte & Historique des Travaux Récents

### 🎯 Objectifs Réalisés
1. **Console de Débogage GPS (`GeolocationDebugConsole`)** :
   - Intégration dans le HUD de quête (`QuestRunHud.tsx`).
   - Diagnostic en temps réel : coordonnées GPS, précision (`accuracy`), altitude, vitesse, pings reçus, statut des permissions Capacitor Geolocation.
   - Journal rétractable avec bascule minimisée / plein écran pour les tests sur mobile.

2. **Fiabilisation de la Télémétrie & Calculs de Vitesse** :
   - Dérivation spatio-temporelle ($\Delta d / \Delta t$) dans `useGeolocationTracker.ts` pour compenser les navigateurs mobiles retournant `coords.speed = null`.
   - Seuil anti-jitter (mouvements < 1 m filtrés pour éviter les vitesses aberrantes à l'arrêt).
   - Recalibration de la simulation de course à $3.0\text{ m/s}$ (~$10.8\text{ km/h}$).
   - Suivi précis de la progression de quête (`questProgress.ts`) calculé le long de la polyligne réelle (`quest.route.coordinates`) plutôt qu'à vol d'oiseau.

3. **Génération de Boucles et Élimination des Allers-Retours** :
   - **Circle Center Offset** dans `questGenerator.ts` : décale le centre géométrique pour assurer un angle de divergence net au départ sans tronçon commun.
   - **Répulsion latérale** (`widenWaypointsOnOverlap`) : détection de superposition des segments aller/retour et écartement automatique des waypoints.
   - **Suppression des demi-tours en cul-de-sac** : application stricte de `continue_straight=true` sur les endpoints Mapbox et OSRM dans `mapboxDirections.ts`.
   - **Élagage géométrique (`pruneRouteSpurs`)** dans `geo.ts` : détecte et élague automatiquement les antennes/impasses de parcours.
   - **Déviation orthogonale (90°)** sur les boucles POI pour séparer les corridors aller et retour.

4. **Cartographie & Résilience** :
   - Fallback automatique transparent vers des tuiles raster libres (CARTO Voyager, CARTO Dark, OSM, Esri Satellite) en cas d'erreur de clé Mapbox (401/403) ou d'absence de réseau Mapbox vectoriel.

5. **Gestion Git & GitHub CLI** :
   - `gh` CLI installé sous `~/.local/bin/gh` (v2.103.3) et authentifié pour l'utilisateur GitHub `lMasshu`.
   - Pull Request créée : **[PR #8 : feat(gps): console de debug geolocalisation, fiabilisation des parcours et HUD de quete](https://github.com/lMasshu/strave-like-rpg/pull/8)** (branche `feat/geolocation-debug-console` vers `develop`).
   - `.gitignore` mis à jour pour ignorer `graphify-out/`.

---

## 2. État Git Actuel

- **Dépôt** : `https://github.com/lMasshu/strave-like-rpg`
- **Branche courante** : `feat/geolocation-debug-console`
- **Branche cible** : `develop`
- **Dernier commit** : `6e31caa` (`chore(git): ignorer le repertoire graphify-out`)
- **Working Tree** : Propre (`clean`), tout est poussé sur `origin`.
- **Pull Request active** : https://github.com/lMasshu/strave-like-rpg/pull/8

---

## 3. Configuration des Skills OpenCode & Superpowers

Le système de compétences se décompose en deux niveaux :

### A. Skills Globaux Utilisateur (`~/.config/opencode/`)
Ces configurations s'appliquent à tous les répertoires ouverts par le compte utilisateur `baptiste` :
1. **Fichier `~/.config/opencode/opencode.json`** :
   ```json
   {
     "$schema": "https://opencode.ai/config.json",
     "plugins": [
       "opencode-antigravity-auth@2.1.2",
       "superpowers@git+https://github.com/obra/superpowers.git"
     ]
   }
   ```
   Ce plugin injecte automatiquement le catalogue complet des superpowers :
   - `brainstorming`
   - `executing-plans`
   - `systematic-debugging`
   - `test-driven-development`
   - `finishing-a-development-branch`
   - `using-superpowers`
   - `verification-before-completion`, etc.

2. **Skill Graphify (`~/.config/opencode/skills/graphify/`)** :
   - Installé globalement dans `~/.config/opencode/skills/graphify/`.
   - Permet d'analyser le graphe de connaissances avec `python -m graphify` ou `/graphify`.

### B. Skills Spécifiques au Dépôt (`.opencode/skills/`)
Ce dossier est versionné dans Git et vous suit automatiquement si vous déplacez ou clonez le dépôt :
- **`commit-push`** (`.opencode/skills/commit-push/SKILL.md`) :
  - Procédure stricte de vérification avant commit (formatage Prettier, ESLint, tests unitaires Vitest, build Vite).
  - Conventions de commit en français (`<type>(<scope>): <description>`).

---

## 4. Commandes de Validation & Contrôle Qualité

À exécuter depuis le répertoire du projet (ou avec le préfixe `--prefix mobile-ionic`) :

| Étape | Commande |
|---|---|
| **Tests Unitaires (Vitest)** | `npm --prefix mobile-ionic run test.unit -- --run` (84 tests actuels) |
| **Vérification Format (Prettier)** | `npm --prefix mobile-ionic run format:check` |
| **Application Format (Prettier)** | `npm --prefix mobile-ionic run format` |
| **Linter (ESLint)** | `npm --prefix mobile-ionic run lint` |
| **Compilation (TypeScript & Vite)** | `npm --prefix mobile-ionic run build` |
| **Serveur de Dev Mobile** | `npm --prefix mobile-ionic run dev` |

---

## 5. Comment Initialiser le Nouveau Répertoire

Si vous déplacez le projet vers un nouveau dossier :

### Option 1 : Déplacement physique du dossier
```bash
# Exemple : déplacer le dossier vers son nouvel emplacement
mv /home/baptiste/dev/strava_like/strave-like-rpg /chemin/vers/nouveau/dossier

# Ouvrir OpenCode dans le nouveau dossier
cd /chemin/vers/nouveau/dossier
opencode
```

### Option 2 : Nouveau clone Git
```bash
git clone https://github.com/lMasshu/strave-like-rpg /chemin/vers/nouveau/dossier
cd /chemin/vers/nouveau/dossier
git checkout feat/geolocation-debug-console
npm --prefix mobile-ionic install
```

---

## 6. Prompt de Démarrage Prêt à l'Emploi pour le Nouvel Agent

Copiez et collez le bloc ci-dessous dans la première invite du nouvel agent dans le nouveau répertoire :

```markdown
Bonjour ! Nous continuons le développement du projet Stride Quest (strave-like-rpg).
Le document de transfert de contexte complet est disponible dans `HANDOVER_CONTEXT.md` et les directives architecturales dans `AGENTS.md`.

Voici l'état actuel :
- Branche de travail : `feat/geolocation-debug-console` (PR #8 ouverte vers `develop`).
- Toutes les fonctionnalités de télémétrie GPS, console de debug, élagage d'antennes et génération de boucles sans U-turn sont implémentées et validées par 84 tests unitaires.
- Les conventions de commits suivent le format conventionnel en français (skill `commit-push`).
- Le plugin superpowers et le skill graphify sont configurés dans `~/.config/opencode/`.

Lis `HANDOVER_CONTEXT.md` et `AGENTS.md` pour initialiser ta session.
```
