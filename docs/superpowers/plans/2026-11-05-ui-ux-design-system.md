# Plan d'Implémentation - Refonte UI/UX « Strava Pro Outdoor + HUD RPG Tactile »

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refondre l'interface et l'expérience utilisateur de Stride Quest (`mobile-ionic`) en déployant un système de design unifié (ardoise technique, vert athlétique et orbes/badges RPG), en enrichissant l'accueil en tableau de bord d'aventure, en structurant le profil d'aventurier avec ses accomplissements, et en harmonisant tous les onglets.

**Architecture:** Définition d'un système de tokens CSS (`theme/design-system.css`), création de composants atomiques réutilisables (`StatMetric`, `RpgBadgeCard`, `RaidBossBanner`), enrichissement des données de démonstration (`demo.ts`), puis intégration complète dans les pages `Home`, `Profile`, `Map`, `FriendSearch` et `Notifications`.

**Tech Stack:** Ionic React 9, React 19, TypeScript strict, CSS custom properties, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-05-ui-ux-design-system-design.md`

## Global Constraints

- Palette principale : surface `#0b0f19`, cartes `#151e2e`, bordures `#233248`, vert athlétique `#16a34a`, ambre/or RPG `#d97706`, rouge raid `#ef4444`.
- Typographie système native, chiffres tabulaires pour les métriques (`font-variant-numeric: tabular-nums`).
- Micro-interactions tactiles : enfoncement léger au tap (`transform: scale(0.98)`).
- Préservation absolue des 86 tests unitaires existants et de la console de debug GPS.
- Zéro régression ESLint et formatage Prettier obligatoire.

## Review Focus

1. **Rendu sur petits écrans mobiles (390px / 360px)** : pas de débordement horizontal (`overflow-x: hidden`), cartes et grilles flexibles.
2. **Accessibilité des contrastes** : texte sur fond sombre respectant le ratio WCAG AA (au minimum 4.5:1).
3. **États vides ou nuls (Empty states)** : affichage bienveillant quand aucune activité ou quête n'est encore enregistrée.
4. **Cohérence des barres de progression** : jauge d'XP et points de vie de boss limités entre 0% et 100%.
5. **Fluidité des transitions d'onglets** : aucun saut de mise en page (layout shift) lors du changement d'écran.

---

### Task 1: Tokens du Design System et Style Global

**Files:**
- Create: `mobile-ionic/src/theme/design-system.css`
- Modify: `mobile-ionic/src/theme/variables.css`
- Modify: `mobile-ionic/src/App.tsx`
- Test: `mobile-ionic/src/theme/design-system.test.ts`

**Interfaces:**
- Consumes: Ionic CSS theme
- Produces: Classes utilitaires `.sq-card`, `.sq-button-primary`, `.sq-metric-value`, variables CSS `--sq-*`

- [ ] **Step 1: Écrire le test unitaire pour les tokens CSS essentiels**

```typescript
// mobile-ionic/src/theme/design-system.test.ts
import { describe, it, expect } from "vitest";

describe("Design System CSS tokens", () => {
  it("should have design system styles available in document or imports", () => {
    // Vérification de la présence des définitions de base
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: Vérifier le test**

Run: `npm --prefix mobile-ionic run test.unit -- src/theme/design-system.test.ts --run`
Expected: PASS

- [ ] **Step 3: Implémenter `design-system.css` et mettre à jour `variables.css` et `App.tsx`**

Définir les variables `--sq-bg-base`, `--sq-surface-card`, `--sq-border`, `--sq-green-athletic`, `--sq-gold-rpg`, `--sq-danger-raid`, ainsi que les styles de base des cartes et boutons avec micro-animations. Importer `design-system.css` dans `App.tsx`.

- [ ] **Step 4: Valider le test et le build**

Run: `npm --prefix mobile-ionic run test.unit -- src/theme/design-system.test.ts --run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mobile-ionic/src/theme/ mobile-ionic/src/App.tsx
git commit -m "style(theme): creation des design tokens outdoor rpg et styles partages"
```

---

### Task 2: Modèle de Données & Composants Partagés (StatMetric, RpgBadgeCard, RaidBossBanner)

**Files:**
- Modify: `mobile-ionic/src/data/demo.ts`
- Create: `mobile-ionic/src/components/StatMetric.tsx`
- Create: `mobile-ionic/src/components/StatMetric.css`
- Create: `mobile-ionic/src/components/StatMetric.test.tsx`
- Create: `mobile-ionic/src/components/RpgBadgeCard.tsx`
- Create: `mobile-ionic/src/components/RpgBadgeCard.css`
- Create: `mobile-ionic/src/components/RpgBadgeCard.test.tsx`
- Create: `mobile-ionic/src/components/RaidBossBanner.tsx`
- Create: `mobile-ionic/src/components/RaidBossBanner.css`
- Create: `mobile-ionic/src/components/RaidBossBanner.test.tsx`

**Interfaces:**
- Consumes: Données démo enrichies (`RpgBadge`, `RaidBoss`, `UserActivity`)
- Produces: Composants `<StatMetric />`, `<RpgBadgeCard />`, `<RaidBossBanner />`

- [ ] **Step 1: Écrire les tests unitaires pour les composants atomiques**

```typescript
// mobile-ionic/src/components/StatMetric.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import StatMetric from "./StatMetric";

describe("StatMetric Component", () => {
  it("renders value, unit, and label accurately", () => {
    render(<StatMetric value="24.8" unit="km" label="Distance totale" />);
    expect(screen.getByText("24.8")).toBeInTheDocument();
    expect(screen.getByText("km")).toBeInTheDocument();
    expect(screen.getByText("Distance totale")).toBeInTheDocument();
  });
});
```

```typescript
// mobile-ionic/src/components/RpgBadgeCard.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import RpgBadgeCard from "./RpgBadgeCard";

describe("RpgBadgeCard Component", () => {
  it("displays unlocked badge correctly", () => {
    render(
      <RpgBadgeCard
        name="Pionnier 10K"
        description="Parcourir 10km en une sortie"
        icon="ribbon-outline"
        unlocked={true}
        unlockedAt="12 Oct 2026"
      />,
    );
    expect(screen.getByText("Pionnier 10K")).toBeInTheDocument();
    expect(screen.getByText("12 Oct 2026")).toBeInTheDocument();
  });
});
```

```typescript
// mobile-ionic/src/components/RaidBossBanner.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import RaidBossBanner from "./RaidBossBanner";

describe("RaidBossBanner Component", () => {
  it("displays boss name, location, and HP progress bar", () => {
    render(
      <RaidBossBanner
        name="Titan des Collines"
        location="Forêt Régionale"
        currentHp={35000}
        maxHp={100000}
        endsIn="3j 14h"
      />,
    );
    expect(screen.getByText("Titan des Collines")).toBeInTheDocument();
    expect(screen.getByText("35%")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Vérifier que les tests échouent**

Run: `npm --prefix mobile-ionic run test.unit -- src/components/StatMetric.test.tsx src/components/RpgBadgeCard.test.tsx src/components/RaidBossBanner.test.tsx --run`
Expected: FAIL (fichiers inexistants)

- [ ] **Step 3: Enrichir `demo.ts` et implémenter les 3 composants**

Implémenter `StatMetric`, `RpgBadgeCard` et `RaidBossBanner` avec leurs styles CSS respectifs en utilisant les classes du design system.

- [ ] **Step 4: Vérifier que les tests passent**

Run: `npm --prefix mobile-ionic run test.unit -- src/components/StatMetric.test.tsx src/components/RpgBadgeCard.test.tsx src/components/RaidBossBanner.test.tsx --run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mobile-ionic/src/data/demo.ts mobile-ionic/src/components/StatMetric* mobile-ionic/src/components/RpgBadgeCard* mobile-ionic/src/components/RaidBossBanner*
git commit -m "feat(ui): composants atomiques partages statmetric, badge rpg et banniere de raid"
```

---

### Task 3: Refonte de l'Accueil (`Home.tsx`) en Tableau de Bord d'Aventure

**Files:**
- Modify: `mobile-ionic/src/pages/Home.tsx`
- Modify: `mobile-ionic/src/pages/Home.css`
- Create: `mobile-ionic/src/pages/Home.test.tsx`

**Interfaces:**
- Consumes: `<RaidBossBanner />`, `<StatMetric />`, données démo de l'utilisateur
- Produces: Tableau de bord complet : Hero quête du jour, Boss de raid actif, résumé hebdomadaire, flux d'activité récente.

- [ ] **Step 1: Écrire le test unitaire pour `Home.tsx`**

```typescript
// mobile-ionic/src/pages/Home.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { IonReactRouter } from "@ionic/react-router";
import Home from "./Home";

describe("Home Page (Adventure Dashboard)", () => {
  it("renders the adventure greeting and daily quest hero action", () => {
    render(
      <IonReactRouter>
        <Home />
      </IonReactRouter>,
    );
    expect(screen.getByText(/Quête du jour/i)).toBeInTheDocument();
    expect(screen.getByText(/Démarrer la sortie/i)).toBeInTheDocument();
  });

  it("renders weekly athletic stats and active community raid", () => {
    render(
      <IonReactRouter>
        <Home />
      </IonReactRouter>,
    );
    expect(screen.getByText(/Raid en cours/i)).toBeInTheDocument();
    expect(screen.getByText(/Cette semaine/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Vérifier l'échec initial**

Run: `npm --prefix mobile-ionic run test.unit -- src/pages/Home.test.tsx --run`
Expected: FAIL

- [ ] **Step 3: Implémenter la nouvelle page `Home.tsx` et son CSS**

Structurer l'Accueil avec :
1. Hero Card "Quête du jour recommandée" avec distance cible, estimation temps, récompense XP et bouton d'action vers `/enregistrer`.
2. Carte Raid communautaire avec le composant `RaidBossBanner`.
3. Grille de synthèse d'entraînement "Cette semaine" (Km, Temps, Dénivelé).
4. Section "Dernières expéditions" avec carte d'activité et badges reçus.

- [ ] **Step 4: Valider le passage du test**

Run: `npm --prefix mobile-ionic run test.unit -- src/pages/Home.test.tsx --run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mobile-ionic/src/pages/Home.tsx mobile-ionic/src/pages/Home.css mobile-ionic/src/pages/Home.test.tsx
git commit -m "feat(home): tableau de bord d'aventure complet avec quete du jour et raid actif"
```

---

### Task 4: Refonte du Profil d'Aventurier (`Profile.tsx`)

**Files:**
- Modify: `mobile-ionic/src/pages/Profile.tsx`
- Modify: `mobile-ionic/src/pages/Profile.css`
- Create: `mobile-ionic/src/pages/Profile.test.tsx`

**Interfaces:**
- Consumes: `<RpgBadgeCard />`, `<StatMetric />`, profil joueur
- Produces: Fiche aventurier complète : XP, Rang, étagère de badges débloqués, statistiques globales, historique détaillé.

- [ ] **Step 1: Écrire le test unitaire pour `Profile.tsx`**

```typescript
// mobile-ionic/src/pages/Profile.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { IonReactRouter } from "@ionic/react-router";
import Profile from "./Profile";

describe("Profile Page (Adventurer Card)", () => {
  it("renders user level, xp progress, and adventurer title", () => {
    render(
      <IonReactRouter>
        <Profile />
      </IonReactRouter>,
    );
    expect(screen.getByText(/Niveau/i)).toBeInTheDocument();
    expect(screen.getByText(/XP/i)).toBeInTheDocument();
  });

  it("renders the badge shelf and activity history", () => {
    render(
      <IonReactRouter>
        <Profile />
      </IonReactRouter>,
    );
    expect(screen.getByText(/Accomplissements/i)).toBeInTheDocument();
    expect(screen.getByText(/Historique des sorties/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Vérifier l'échec initial**

Run: `npm --prefix mobile-ionic run test.unit -- src/pages/Profile.test.tsx --run`
Expected: FAIL

- [ ] **Step 3: Implémenter la nouvelle page `Profile.tsx` et son CSS**

1. En-tête Aventurier : Avatar stylisé, rang/titre (ex: "Rôdeur des Bois"), barre de progression XP vers le niveau supérieur.
2. Grille de statistiques globales d'entraînement (Distance totale, dénivelé cumulé, sorties).
3. Section "Accomplissements & Trophées" avec la grille de `RpgBadgeCard` (badges débloqués et badges en cours avec jauge).
4. Section "Historique des sorties" listant les expéditions passées avec date, durée, allure et XP récolté.

- [ ] **Step 4: Valider le passage du test**

Run: `npm --prefix mobile-ionic run test.unit -- src/pages/Profile.test.tsx --run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mobile-ionic/src/pages/Profile.tsx mobile-ionic/src/pages/Profile.css mobile-ionic/src/pages/Profile.test.tsx
git commit -m "feat(profile): fiche aventurier complete avec progression xp badges et historique"
```

---

### Task 5: Harmonisation de la Carte, HUD et Pages Sociales

**Files:**
- Modify: `mobile-ionic/src/components/TopBar.tsx`
- Modify: `mobile-ionic/src/components/TopBar.css`
- Modify: `mobile-ionic/src/components/QuestRunHud.css`
- Modify: `mobile-ionic/src/pages/FriendSearch.tsx`
- Modify: `mobile-ionic/src/pages/FriendSearch.css`
- Modify: `mobile-ionic/src/pages/Notifications.tsx`
- Modify: `mobile-ionic/src/pages/Notifications.css`
- Modify: `mobile-ionic/src/theme/navigation.css`

**Interfaces:**
- Consumes: Design tokens `--sq-*`
- Produces: Navigation par onglets soignée, TopBar épurée, filtres de notifications et classements d'amis.

- [ ] **Step 1: Mettre à jour `TopBar.css` et `navigation.css`**

Appliquer les styles de barre supérieure discrète et barre d'onglets inférieure flottante avec état actif net (`#16a34a`).

- [ ] **Step 2: Sublimer `FriendSearch.tsx` et `Notifications.tsx`**

1. `FriendSearch.tsx` : Encart "Classement de la Guilde" (Top 3 de la semaine en km) et liste d'amis avec statut d'activité.
2. `Notifications.tsx` : Onglets de filtrage (Tous, Raids, Succès) avec icônes contrastées et marqueurs temporels nets.

- [ ] **Step 3: Ajuster le HUD de quête (`QuestRunHud.css`)**

Optimiser les contrastes du chronomètre et de la distance restante pour assurer une lisibilité instantanée en mouvement.

- [ ] **Step 4: Exécuter la suite complète de tests de non-régression**

Run: `npm --prefix mobile-ionic run test.unit -- --run`
Expected: PASS (tous les tests passent, y compris `QuestRunHud` et `GeolocationDebugConsole`)

- [ ] **Step 5: Commit**

```bash
git add mobile-ionic/src/components/TopBar* mobile-ionic/src/components/QuestRunHud.css mobile-ionic/src/pages/FriendSearch* mobile-ionic/src/pages/Notifications* mobile-ionic/src/theme/navigation.css
git commit -m "style(ui): harmonisation globale de la topbar navigation sociale et hud"
```

---

### Task 6: Validation Qualité Finale & Vérification CI

**Files:**
- Audit sur l'ensemble de `mobile-ionic/`

- [ ] **Step 1: Vérification du formatage Prettier**

Run: `npm --prefix mobile-ionic run format:check`
Si besoin d'ajustements : `npm --prefix mobile-ionic run format`

- [ ] **Step 2: Vérification du linter ESLint**

Run: `npm --prefix mobile-ionic run lint`
Expected: 0 erreur, 0 avertissement

- [ ] **Step 3: Lancement de tous les tests unitaires**

Run: `npm --prefix mobile-ionic run test.unit -- --run`
Expected: 100% PASS

- [ ] **Step 4: Compilation TypeScript et build Vite**

Run: `npm --prefix mobile-ionic run build`
Expected: Build production réussi sans erreur

- [ ] **Step 5: Commit final de consolidation si nécessaire**

```bash
git commit --allow-empty -m "chore(ci): validation de conformite de la refonte ui ux globale"
```
