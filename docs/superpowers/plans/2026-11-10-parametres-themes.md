# Paramètres et thèmes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter une page Paramètres permettant de choisir et conserver les palettes Lime Frost, Violet Bloom et Scarlet Snow indépendamment du mode clair/sombre.

**Architecture:** Étendre le hook de thème avec une préférence de palette persistée et exposée au DOM par `data-palette`. Définir les palettes au niveau des tokens CSS existants, puis ajouter une page Ionic accessible depuis la barre supérieure et enregistrée dans le routeur.

**Tech Stack:** React 19, TypeScript 5.9, Ionic React 9, Ionicons, CSS custom properties, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-10-parametres-themes-design.md`

## Global Constraints

- Utiliser les Ionicons et composants Ionic déjà installés ; aucune nouvelle dépendance.
- Garder la palette indépendante de l’apparence `system`, `light` ou `dark`.
- Conserver les préférences dans `localStorage` et les appliquer immédiatement.
- Ne pas modifier les fonctionnalités GPS, métier ou backend.
- Respecter TypeScript strict et les commandes qualité du projet.

## Review Focus

- Une valeur de palette absente ou invalide doit retomber sur `lime-frost`.
- Le choix de palette doit survivre à un nouveau montage du hook.
- La palette et le mode clair/sombre doivent pouvoir changer sans s’écraser mutuellement.
- La page Paramètres doit rester utilisable au clavier et annoncer la sélection active.
- La barre d’onglets doit être masquée sur `/parametres` puis réapparaître après navigation.

---

### Task 1: Préférence de palette persistante

**Files:**
- Modify: `mobile-ionic/src/hooks/useThemeMode.ts`
- Modify: `mobile-ionic/src/hooks/useThemeMode.test.ts`

**Interfaces:**
- Produces: `ColorPalette = "lime-frost" | "violet-bloom" | "scarlet-snow"`
- Produces: `palette: ColorPalette` et `setPalette(palette: ColorPalette): void` dans `useThemeMode()`
- Produces: attribut DOM `data-palette` sur `document.documentElement` et `document.body`

- [ ] **Step 1: Écrire les tests en échec**

Ajouter des tests vérifiant la valeur par défaut `lime-frost`, la restauration d’une valeur stockée valide, le repli face à une valeur invalide, l’écriture dans `localStorage`, l’attribut `data-palette` et l’indépendance vis-à-vis de `setTheme`.

- [ ] **Step 2: Vérifier l’échec ciblé**

Run: `npm --prefix mobile-ionic run test.unit -- --run src/hooks/useThemeMode.test.ts`
Expected: FAIL car `palette` et `setPalette` n’existent pas.

- [ ] **Step 3: Implémenter la préférence**

Dans `useThemeMode.ts`, ajouter le type `ColorPalette`, la clé `stride_color_palette`, la validation des valeurs stockées, l’état `palette`, `setPalette` et l’application de `data-palette` au DOM.

- [ ] **Step 4: Vérifier les tests ciblés**

Run: `npm --prefix mobile-ionic run test.unit -- --run src/hooks/useThemeMode.test.ts`
Expected: PASS.

### Task 2: Tokens des trois palettes

**Files:**
- Modify: `mobile-ionic/src/theme/design-system.css`
- Modify: `mobile-ionic/src/theme/variables.css`
- Modify: `mobile-ionic/src/theme/design-system.test.ts`

**Interfaces:**
- Consumes: attribut `data-palette` de Task 1
- Produces: tokens Lime Frost, Violet Bloom et Scarlet Snow pour les apparences claire et sombre

- [ ] **Step 1: Écrire les tests en échec**

Étendre `design-system.test.ts` pour exiger les sélecteurs des trois palettes, leurs couleurs principales, leurs fonds, textes, bordures et variantes sombres, ainsi que le raccordement aux variables Ionic.

- [ ] **Step 2: Vérifier l’échec ciblé**

Run: `npm --prefix mobile-ionic run test.unit -- --run src/theme/design-system.test.ts`
Expected: FAIL faute de tokens Violet Bloom et Scarlet Snow.

- [ ] **Step 3: Définir les tokens CSS**

Conserver Lime Frost comme défaut, puis ajouter des blocs `[data-palette="violet-bloom"]` et `[data-palette="scarlet-snow"]`, avec surcharges `[data-theme="dark"]`, en réutilisant les variables `--sq-*` et `--ion-*` existantes.

- [ ] **Step 4: Vérifier les tests ciblés**

Run: `npm --prefix mobile-ionic run test.unit -- --run src/theme/design-system.test.ts`
Expected: PASS.

### Task 3: Page Paramètres et sélecteur accessible

**Files:**
- Create: `mobile-ionic/src/pages/Settings.tsx`
- Create: `mobile-ionic/src/pages/Settings.css`
- Create: `mobile-ionic/src/pages/Settings.test.tsx`

**Interfaces:**
- Consumes: `palette`, `setPalette` et `ColorPalette` de Task 1
- Produces: page Ionic `Settings` avec trois options de palette accessibles

- [ ] **Step 1: Écrire les tests en échec**

Tester le titre « Paramètres », la section « Thème de l’interface », les trois noms de palette, l’état sélectionné via un groupe radio, l’appel à `setPalette` au clic et la présence du bouton retour.

- [ ] **Step 2: Vérifier l’échec ciblé**

Run: `npm --prefix mobile-ionic run test.unit -- --run src/pages/Settings.test.tsx`
Expected: FAIL car la page n’existe pas.

- [ ] **Step 3: Implémenter la page**

Créer une `IonPage` avec en-tête et retour, puis trois cartes radio tactiles affichant nom, description courte, pastilles de couleurs et coche active. Utiliser uniquement les variables du design system dans `Settings.css`.

- [ ] **Step 4: Vérifier les tests ciblés**

Run: `npm --prefix mobile-ionic run test.unit -- --run src/pages/Settings.test.tsx`
Expected: PASS.

### Task 4: Navigation vers Paramètres

**Files:**
- Modify: `mobile-ionic/src/components/TopBar.tsx`
- Modify: `mobile-ionic/src/components/TopBar.test.tsx`
- Modify: `mobile-ionic/src/App.tsx`
- Create: `mobile-ionic/src/App.test.tsx`

**Interfaces:**
- Consumes: page `Settings` de Task 3
- Produces: bouton accessible « Paramètres », route `/parametres`, barre d’onglets masquée sur cette route

- [ ] **Step 1: Écrire les tests en échec**

Tester dans `TopBar.test.tsx` le bouton engrenage pointant vers `/parametres`. Tester dans `App.test.tsx` le rendu de la route et la classe `tab-bar-hidden` sur cette URL.

- [ ] **Step 2: Vérifier l’échec ciblé**

Run: `npm --prefix mobile-ionic run test.unit -- --run src/components/TopBar.test.tsx src/App.test.tsx`
Expected: FAIL faute de bouton et de route.

- [ ] **Step 3: Câbler la navigation**

Ajouter `settingsOutline` et un `IonButton` dans `TopBar.tsx`. Importer `Settings`, déclarer `/parametres` et ajouter cette URL à `ROUTES_WITHOUT_TAB_BAR` dans `App.tsx`.

- [ ] **Step 4: Vérifier les tests ciblés**

Run: `npm --prefix mobile-ionic run test.unit -- --run src/components/TopBar.test.tsx src/App.test.tsx`
Expected: PASS.

### Task 5: Vérification globale

**Files:**
- Modify if required by formatting only: files changed in Tasks 1–4

**Interfaces:**
- Consumes: toutes les tâches précédentes
- Produces: fonctionnalité intégrée et vérifiée

- [ ] **Step 1: Appliquer le formatage**

Run: `npm --prefix mobile-ionic run format`
Expected: commande réussie.

- [ ] **Step 2: Exécuter toute la suite de tests**

Run: `npm --prefix mobile-ionic run test.unit -- --run`
Expected: tous les tests réussissent.

- [ ] **Step 3: Vérifier lint et format**

Run: `npm --prefix mobile-ionic run lint`
Expected: aucune erreur ni avertissement.

Run: `npm --prefix mobile-ionic run format:check`
Expected: tous les fichiers respectent Prettier.

- [ ] **Step 4: Compiler l’application**

Run: `npm --prefix mobile-ionic run build`
Expected: build TypeScript/Vite réussi ; seuls les avertissements préexistants sont acceptés.
