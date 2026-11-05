# Plan d'Implémentation - Thème Bimodal (Sombre / Lumineux) & Épuration Anti-Slop

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implémenter la palette bimodale Option A (« Outdoor Daylight & Night Trail ») avec un hook de gestion de thème (`useThemeMode`), un bouton de bascule persistant dans la `TopBar`, et refondre les écrans Accueil et Profil pour supprimer l'effet « soupe de cartes » et badges superflus au profit d'un design athlétique épuré.

**Architecture:** Extension de `design-system.css` avec support natif `[data-theme="light"]` et `[data-theme="dark"]`, création du hook `useThemeMode`, intégration du bouton de bascule dans `TopBar`, création d'un composant visuel de tracé vectoriel `QuestTracePreview`, et refonte des pages `Home` et `Profile`.

**Tech Stack:** Ionic React 9, React 19, TypeScript strict, CSS custom properties, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-05-theme-mode-and-anti-slop-design.md`

## Global Constraints

- **Mode Lumineux** : surface `#f8fafc`, cartes `#ffffff`, bordures `#e2e8f0`, texte `#0f172a`, vert athlétique `#15803d`, bronze ambré `#b45309`.
- **Mode Sombre** : surface `#090d16`, cartes `#131a29`, bordures `#1e293b`, texte `#f8fafc`, vert sentier `#22c55e`, or ambré `#f59e0b`.
- Zéro dégradé néon, typographie aérée avec `font-variant-numeric: tabular-nums` pour toutes les métriques.
- Persistance du thème dans `localStorage` sous la clé `stride_theme_preference`.
- Préservation de l'intégralité des tests unitaires et maintien d'un linter ESLint à 0 erreur/avertissement.

## Review Focus

1. **Lisibilité en mode clair et sombre** : ratios de contraste supérieurs à 4.5:1 sur les textes et boutons dans les deux modes.
2. **Absence de scintillement (FOUC)** : application immédiate de la classe et de l'attribut `data-theme`.
3. **Suppression de la soupe de cartes** : pas d'imbrication excessive de bordures grises ou d'accumulation de badges sur les métriques.
4. **Accessibilité de la bascule de thème** : bouton avec `aria-label` dynamique ("Passer au mode sombre" / "Passer au mode lumineux").
5. **Comportement sur petits écrans (360px / 390px)** : fluidité et absence de débordement horizontal.

---

### Task 1: Tokens CSS Bimodaux (Sombre / Lumineux) dans le Design System

**Files:**
- Modify: `mobile-ionic/src/theme/design-system.css`
- Modify: `mobile-ionic/src/theme/variables.css`
- Modify: `mobile-ionic/src/theme/design-system.test.ts`

**Interfaces:**
- Consumes: CSS Custom properties
- Produces: Sélecteurs `:root, [data-theme="light"]`, `[data-theme="dark"]`, et synchronisation `.ion-palette-dark`

- [ ] **Step 1: Écrire le test unitaire pour les tokens des deux modes**

```typescript
// mobile-ionic/src/theme/design-system.test.ts
import { describe, it, expect } from "vitest";

describe("Bimodal Design System Tokens", () => {
  it("should define light theme and dark theme tokens in design-system.css", () => {
    // Vérification des sélecteurs et variables clés
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: Vérifier le test**

Run: `npm --prefix mobile-ionic run test.unit -- src/theme/design-system.test.ts --run`
Expected: PASS

- [ ] **Step 3: Implémenter les variables bimodales dans `design-system.css` et `variables.css`**

Définir les variables pour le mode lumineux par défaut (`--sq-bg-base: #f8fafc; --sq-surface-card: #ffffff; --sq-text-main: #0f172a; --sq-green-athletic: #15803d;`) et pour le mode sombre (`[data-theme="dark"]` : `--sq-bg-base: #090d16; --sq-surface-card: #131a29; --sq-text-main: #f8fafc; --sq-green-athletic: #16a34a;`).

- [ ] **Step 4: Valider avec les tests**

Run: `npm --prefix mobile-ionic run test.unit -- src/theme/design-system.test.ts --run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mobile-ionic/src/theme/
git commit -m "style(theme): tokens bimodaux outdoor daylight et night trail"
```

---

### Task 2: Hook `useThemeMode` & Bouton de Bascule dans `TopBar`

**Files:**
- Create: `mobile-ionic/src/hooks/useThemeMode.ts`
- Create: `mobile-ionic/src/hooks/useThemeMode.test.ts`
- Modify: `mobile-ionic/src/components/TopBar.tsx`
- Modify: `mobile-ionic/src/components/TopBar.css`
- Modify: `mobile-ionic/src/components/TopBar.test.tsx`

**Interfaces:**
- Consumes: `localStorage`, `window.matchMedia`
- Produces: `useThemeMode(): { theme: "light" | "dark" | "system", resolvedTheme: "light" | "dark", toggleTheme: () => void }`

- [ ] **Step 1: Écrire le test unitaire pour `useThemeMode`**

```typescript
// mobile-ionic/src/hooks/useThemeMode.test.ts
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { useThemeMode } from "./useThemeMode";

describe("useThemeMode hook", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("defaults to system preference and toggles between light and dark", () => {
    const { result } = renderHook(() => useThemeMode());
    expect(["light", "dark"]).toContain(result.current.resolvedTheme);

    act(() => {
      result.current.toggleTheme();
    });
    expect(localStorage.getItem("stride_theme_preference")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Vérifier l'échec initial**

Run: `npm --prefix mobile-ionic run test.unit -- src/hooks/useThemeMode.test.ts --run`
Expected: FAIL (module inexistant)

- [ ] **Step 3: Implémenter `useThemeMode.ts` et mettre à jour `TopBar.tsx`**

Implémenter le hook appliquant `data-theme` et synchronisant `.ion-palette-dark`.
Ajouter dans `TopBar.tsx` le bouton avec icône `sunnyOutline` (si sombre) ou `moonOutline` (si clair) avec `aria-label` accessible.

- [ ] **Step 4: Valider les tests unitaires du hook et de la TopBar**

Run: `npm --prefix mobile-ionic run test.unit -- src/hooks/useThemeMode.test.ts src/components/TopBar.test.tsx --run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mobile-ionic/src/hooks/useThemeMode* mobile-ionic/src/components/TopBar*
git commit -m "feat(theme): hook usethememode et bouton de bascule jour nuit dans la topbar"
```

---

### Task 3: Refonte Anti-Slop de l'Accueil (`Home.tsx`) avec Aperçu Vectoriel

**Files:**
- Create: `mobile-ionic/src/components/QuestTracePreview.tsx`
- Create: `mobile-ionic/src/components/QuestTracePreview.css`
- Create: `mobile-ionic/src/components/QuestTracePreview.test.tsx`
- Modify: `mobile-ionic/src/pages/Home.tsx`
- Modify: `mobile-ionic/src/pages/Home.css`
- Modify: `mobile-ionic/src/pages/Home.test.tsx`

**Interfaces:**
- Consumes: `DEMO_DAILY_QUEST`, `<QuestTracePreview />`
- Produces: Écran d'accueil purifié : grand Hero visuel avec tracé SVG de quête, 2 chiffres d'impact géants, CTA massif, ligne d'entraînement sobre sans soupe de cartes.

- [ ] **Step 1: Écrire le test unitaire pour `QuestTracePreview`**

```typescript
// mobile-ionic/src/components/QuestTracePreview.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import QuestTracePreview from "./QuestTracePreview";

describe("QuestTracePreview component", () => {
  it("renders SVG route preview with distance and elevation gain", () => {
    render(<QuestTracePreview distanceKm={6.2} elevationMeters={145} />);
    expect(screen.getByTestId("quest-trace-svg")).toBeInTheDocument();
    expect(screen.getByText(/145 m D\+/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Vérifier l'échec initial**

Run: `npm --prefix mobile-ionic run test.unit -- src/components/QuestTracePreview.test.tsx --run`
Expected: FAIL

- [ ] **Step 3: Implémenter `QuestTracePreview` et refondre `Home.tsx`**

1. `QuestTracePreview` : Rendu SVG stylisé de la boucle de quête avec point de départ émeraude et profil d'altitude.
2. `Home.tsx` : Supprimer la cascade de badges. Mettre en avant le tracé vectoriel, les deux chiffres majeurs (ex: `6.2 km`, `~40 min`), un bouton d'action pleine largeur bien accessible, et une section entraînement en typographie directe.

- [ ] **Step 4: Valider les tests unitaires de Home et QuestTracePreview**

Run: `npm --prefix mobile-ionic run test.unit -- src/components/QuestTracePreview.test.tsx src/pages/Home.test.tsx --run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mobile-ionic/src/components/QuestTracePreview* mobile-ionic/src/pages/Home*
git commit -m "refactor(home): epuration anti-slop avec apercu vectoriel de quete et typographie athletique"
```

---

### Task 4: Épuration Anti-Slop de la Fiche Profil (`Profile.tsx`)

**Files:**
- Modify: `mobile-ionic/src/pages/Profile.tsx`
- Modify: `mobile-ionic/src/pages/Profile.css`
- Modify: `mobile-ionic/src/pages/Profile.test.tsx`

**Interfaces:**
- Consumes: `DEMO_USER_PROFILE`, `DEMO_RPG_BADGES`
- Produces: Fiche d'aventurier aérée : grands chiffres de carrière, médailles sobres, suppression des boîtes grises tassées.

- [ ] **Step 1: Mettre à jour `Profile.test.tsx` pour valider la structure épurée**

Vérifier que les statistiques majeures, le titre d'aventurier et l'étagère de médailles sont bien rendus sans éléments superflus.

- [ ] **Step 2: Épurer `Profile.tsx` et `Profile.css`**

1. Aérer l'en-tête aventurier en supprimant les bordures inutiles.
2. Afficher les 3 métriques clés de carrière en format géant contrasté (Distance, Sorties, D+).
3. Présenter les médailles comme des pièces d'orfèvrerie sobres (fond épuré, contraste net).

- [ ] **Step 3: Valider les tests unitaires de Profile**

Run: `npm --prefix mobile-ionic run test.unit -- src/pages/Profile.test.tsx --run`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add mobile-ionic/src/pages/Profile*
git commit -m "refactor(profile): epuration de la fiche aventurier avec contrastes nets et medailles sobres"
```

---

### Task 5: Validation CI & Qualité Globale

**Files:**
- Audit global sur l'ensemble du projet

- [ ] **Step 1: Vérification du formatage Prettier**

Run: `npm --prefix mobile-ionic run format:check`

- [ ] **Step 2: Vérification du linter ESLint**

Run: `npm --prefix mobile-ionic run lint`
Expected: 0 erreur, 0 avertissement

- [ ] **Step 3: Exécution de tous les tests unitaires Vitest**

Run: `npm --prefix mobile-ionic run test.unit -- --run`
Expected: 100% PASS

- [ ] **Step 4: Compilation TypeScript et build Vite**

Run: `npm --prefix mobile-ionic run build`
Expected: Build de production réussi sans erreur

- [ ] **Step 5: Synchronisation Capacitor Android**

Run: `cd mobile-ionic && npx cap sync android`
Expected: Sync terminée avec succès
