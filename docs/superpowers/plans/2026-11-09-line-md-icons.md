# Line MD Icons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer toutes les Ionicons visibles du mobile par une sélection Line MD locale, cohérente, accessible et utilisable hors ligne.

**Architecture:** Les SVG Line MD nécessaires sont versionnés dans `mobile-ionic/public/icons/line-md/`. Un composant `LineMdIcon` typé les affiche comme masques CSS colorés par `currentColor`, ce qui conserve les couleurs, tailles et slots Ionic sans CDN ni nouvelle dépendance.

**Tech Stack:** React 19, TypeScript strict, Ionic React, CSS mask, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-09-line-md-icons-design.md`

## Global Constraints

- Toutes les icônes Line MD sont téléchargées depuis `https://api.iconify.design/line-md/<nom>.svg`, conservées localement et couvertes par la licence MIT de la collection.
- Aucun CDN, appel réseau à l’exécution ou nouvelle dépendance d’icônes.
- Les icônes décoratives sont `aria-hidden`; toute icône-action sans texte conserve un nom accessible sur son bouton.
- La couleur hérite de `currentColor`; les dimensions et zones tactiles Ionic existantes restent inchangées.
- Toute animation respecte `prefers-reduced-motion`.
- Navigation, logique métier, textes, illustrations et avatars restent inchangés.

## Review Focus

- Mode hors ligne : aucune URL distante ne doit apparaître dans le code ou le CSS livré.
- Mode sombre : les icônes doivent hériter de la couleur du contexte, sans couleur SVG figée.
- Boutons « icône seule » : leur nom accessible doit rester présent après retrait d’`IonIcon`.
- Navigation active : l’état actif doit rester visible par couleur et non dépendre uniquement d’une variante pleine Ionicons.
- Icônes dynamiques : badges, activités et notifications inconnus doivent utiliser un fallback Line MD valide.

---

### Task 1: Composant et ressources Line MD locales

**Files:**
- Create: `mobile-ionic/src/components/LineMdIcon.tsx`
- Create: `mobile-ionic/src/components/LineMdIcon.css`
- Create: `mobile-ionic/src/components/LineMdIcon.test.tsx`
- Create: `mobile-ionic/public/icons/line-md/*.svg`

**Interfaces:**
- Produces: `LineMdIconName`, union fermée des noms embarqués.
- Produces: `LineMdIconProps extends React.HTMLAttributes<HTMLSpanElement>` avec `name: LineMdIconName`, `label?: string`, `size?: string | number`.
- Produces: `LineMdIcon`, composant qui expose `data-icon`, hérite de `currentColor`, accepte `slot` et applique `aria-hidden` ou `role="img"`/`aria-label`.

- [ ] **Step 1: Écrire les tests rouges du composant**

Tester qu’une icône décorative est cachée des technologies d’assistance, qu’une icône labellisée expose `role="img"`, que `className`, `slot`, `size` et `currentColor` restent configurables, et qu’un nom hors union échoue au typecheck.

- [ ] **Step 2: Vérifier l’échec**

Run: `npm --prefix mobile-ionic run test.unit -- --run src/components/LineMdIcon.test.tsx`
Expected: FAIL car `LineMdIcon` n’existe pas.

- [ ] **Step 3: Embarquer la sélection et implémenter le composant**

Télécharger uniquement les équivalents nécessaires à l’inventaire : accueil, carte/parcours, cible/enregistrement, drapeau/défis, groupe/amis, profil/ajout, cloche, soleil/lune, fermeture, étincelles, répétition, localisation/navigation, marche, vélo, dé, flamme, horloge, tendance, validation, trophée, cadenas, ruban, crâne, chevron, boussole, outils, cœur et activité/course. Conserver les fichiers SVG originaux sous licence MIT et les rendre par masque CSS local.

- [ ] **Step 4: Vérifier le composant**

Run: `npm --prefix mobile-ionic run test.unit -- --run src/components/LineMdIcon.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile-ionic/src/components/LineMdIcon.* mobile-ionic/public/icons/line-md
git commit -m "feat(ui): ajoute les icones line md embarquees"
```

### Task 2: Migration complète des icônes d’interface

**Files:**
- Modify: `mobile-ionic/src/App.tsx`
- Modify: `mobile-ionic/src/components/{TopBar,QuestGeneratorModal,QuestRunHud,RaidBossBanner,RpgBadgeCard}.tsx`
- Modify: `mobile-ionic/src/pages/{Home,Map,Parcours,Defis,FriendSearch,Notifications,Profile}.tsx`
- Modify: tests correspondants dans `mobile-ionic/src/**/*.test.tsx`

**Interfaces:**
- Consumes: `LineMdIcon` et `LineMdIconName` de Task 1.
- Produces: aucune importation de `IonIcon` ou `ionicons/icons` dans `mobile-ionic/src`.
- Produces: fonctions dynamiques de Profile et Notifications retournant `LineMdIconName`.

- [ ] **Step 1: Ajouter les assertions rouges de migration et d’accessibilité**

Adapter les tests des composants/pages pour rechercher les noms accessibles des boutons icône seule, vérifier les fallbacks dynamiques et confirmer que les onglets actifs conservent `aria-selected`/la classe Ionic active et une icône Line MD.

- [ ] **Step 2: Vérifier l’échec ciblé**

Run: `npm --prefix mobile-ionic run test.unit -- --run src/components/TopBar.test.tsx src/components/RpgBadgeCard.test.tsx src/pages/Profile.test.tsx src/pages/Notifications.test.tsx`
Expected: FAIL sur les anciens rendus Ionicons.

- [ ] **Step 3: Remplacer les imports et rendus statiques**

Migrer les icônes dans `App`, `TopBar`, `QuestGeneratorModal`, `QuestRunHud`, `RaidBossBanner`, `Home`, `Map`, `Parcours`, `Defis` et `FriendSearch`. Utiliser une seule variante Line MD par fonction; l’état actif des onglets reste porté par le style Ionic existant.

- [ ] **Step 4: Remplacer les tables et fallbacks dynamiques**

Faire retourner `LineMdIconName` par les mappings de `Profile` et `Notifications`; modifier `RpgBadgeCardProps.icon` en `LineMdIconName | undefined`; utiliser ruban, activité et notification comme fallbacks sûrs.

- [ ] **Step 5: Vérifier qu’Ionicons a disparu du code applicatif**

Run: `rg 'IonIcon|ionicons/icons' mobile-ionic/src --glob '!**/*.test.*'`
Expected: aucune sortie.

- [ ] **Step 6: Exécuter les tests mobile**

Run: `npm --prefix mobile-ionic run test.unit -- --run`
Expected: tous les tests passent.

- [ ] **Step 7: Commit**

```bash
git add mobile-ionic/src
git commit -m "style(ui): harmonise les icones existantes avec line md"
```

### Task 3: Règle durable et vérification finale

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/superpowers/specs/2026-11-09-line-md-icons-design.md` si l’inventaire final nécessite une précision factuelle.

**Interfaces:**
- Consumes: politique Line MD et architecture locale des Tasks 1–2.
- Produces: règle explicite pour toutes les futures modifications frontend.

- [ ] **Step 1: Documenter la règle dans `AGENTS.md`**

Sous « Expérience Utilisateur & Game Design », imposer Line MD pour les icônes d’interface lorsqu’un équivalent pertinent existe, stockage local dans `mobile-ionic/public/icons/line-md/`, interdiction des CDN, `currentColor`, accessibilité des actions sans texte et respect de `prefers-reduced-motion`.

- [ ] **Step 2: Vérifier les ressources et l’absence de références distantes**

Run: `rg 'https?://|api.iconify.design' mobile-ionic/src mobile-ionic/public/icons/line-md`
Expected: aucune référence réseau dans le code ou les SVG livrés.

- [ ] **Step 3: Vérifier qualité et compilation**

Run: `npm --prefix mobile-ionic run format:check && npm --prefix mobile-ionic run lint && npm --prefix mobile-ionic run test.unit -- --run && npm --prefix mobile-ionic run build`
Expected: toutes les commandes passent; seuls les avertissements build préexistants peuvent subsister.

- [ ] **Step 4: Contrôler visuellement les écrans clés**

Vérifier à 390 px et en mode clair/sombre : barre d’onglets, barre supérieure, accueil, carte, génération de quête, défis, notifications et profil. Confirmer l’absence d’icône vide, de décalage, de contraste insuffisant et d’animation persistante avec réduction des mouvements.

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md docs/superpowers/specs/2026-11-09-line-md-icons-design.md
git commit -m "docs(ui): impose line md pour les futures icones"
```
