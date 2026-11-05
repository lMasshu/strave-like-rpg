---
name: Commit and Push Workflow
description: Guide et exécute le workflow complet de validation, commit conventionnel et push Git conforme aux standards du projet strave-like-rpg.
---

# Workflow Git Commit & Push

Ce skill définit la procédure standard pour valider, commiter et pousser des modifications sur le dépôt **strave-like-rpg**.

---

## 1. Inspection des modifications

1. **Vérifier l'état du dépôt :**
   ```bash
   git status
   ```
2. **Examiner les diffs :**
   ```bash
   git diff
   git diff --staged
   ```
3. **Sécurité & Nettoyage :**
   - S'assurer qu'aucun fichier sensible (`.env`, clés d'API, tokens, secrets) n'est présent.
   - S'assurer qu'aucun fichier temporaire, build artifact ou fichier orphelin indésirable n'est inclus.

---

## 2. Validation locale (qualité CI)

Avant tout commit, exécuter les vérifications de la CI pour garantir que la branche reste saine :

```bash
# 1. Formatage (Prettier)
npm --prefix mobile-ionic run format:check
# Si des erreurs de formatage apparaissent : npm --prefix mobile-ionic run format

# 2. Linter (ESLint)
npm --prefix mobile-ionic run lint

# 3. Tests unitaires (Vitest)
npm --prefix mobile-ionic run test.unit -- --run

# 4. Typecheck & Build (Vite / TypeScript)
npm --prefix mobile-ionic run build
```

> ⚠️ **Bloquant** : Si l'un des tests ou le build échoue, corriger les anomalies avant de commiter. Ne jamais commiter de code cassé.

---

## 3. Staging ciblé

- Privilégier un staging atomique et intentionnel avec `git add <fichiers>`.
- Éviter `git add .` sans vérification préalable.
- Grouper les changements par unité logique (ex. séparer une refactorisation d'une nouvelle fonctionnalité).

---

## 4. Convention de messages de commit

Le projet applique les **Conventional Commits** rédigés en français.

### Format
```text
<type>(<scope>): <description claire et concise en français>
```
*(Le scope est optionnel si le changement est transversal ou global)*

### Types reconnus
- `feat` : Nouvelle fonctionnalité
- `fix` : Correction de bug
- `style` : Formatage, CSS, retouches graphiques sans changement de logique
- `refactor` : Restructuration du code sans altérer le comportement
- `test` : Ajout ou mise à jour de tests unitaires/e2e
- `docs` : Documentation (README, etc.)
- `chore` : Maintenance, configuration de build, dépendances

### Scopes courants du projet
- `gps` : Suivi, géolocalisation, télémétrie, console debug
- `carte` : Affichage Mapbox, marqueurs, layers
- `generator` : Génération de quêtes et parcours
- `poi` : Points d'intérêt, reconnaissance de zones
- `ui` : Composants graphiques, modales, bannières
- `theme` : Charte graphique, styles globaux
- `lint` : Configuration et corrections ESLint / typage

### Exemples conformes
- `feat(gps): ajout du bouton de recentrage de la position`
- `fix(gps): robustesse du suivi de géolocalisation et sécurisation des formats télémétriques`
- `style: formatage prettier sur les composants et tests du suivi GPS`
- `feat(generator): boucle asymetrique anti-aller-retour et calibration dynamique`

---

## 5. Commit

Effectuer le commit avec le message validé :

```bash
git commit -m "<type>(<scope>): <description>"
```

Si le commit nécessite des explications complémentaires, utiliser un corps de message :
```bash
git commit -m "<type>(<scope>): <description>" -m "Détails explicatifs supplémentaires si nécessaire."
```

---

## 6. Push sécurisé

1. **Vérifier la branche active :**
   ```bash
   git branch --show-current
   ```
2. **Règles de protection :**
   - 🚫 **Ne JAMAIS forcer le push (`--force` ou `-f`)** sur des branches partagées.
   - 🚫 **Ne pas pousser directement sur `main` ou `develop`** sans accord explicite préalable de l'utilisateur (passer par une Pull Request).
   - Les branches de travail standard suivent le préfixe `feat/`, `fix/`, `chore/` ou `refactor/`.
3. **Pousser sur le remote :**
   ```bash
   git push origin <nom-de-branche>
   ```
   *(Ou `git push -u origin <nom-de-branche>` si la branche distante n'est pas encore associée).*
4. **Vérification finale :**
   ```bash
   git status
   ```
