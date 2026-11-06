# Design Document - Thème Bimodal (Sombre / Lumineux) & Épuration Anti-Slop

- **Projet** : Stride Quest (`mobile-ionic`)
- **Date** : 2026-11-05
- **Branche** : `feat/app-ui-ux-design`
- **Statut** : En révision

---

## 1. Contexte & Intentions

Après une première passe d'intégration, l'interface souffre de deux défauts majeurs :
1. **Absence de mode lumineux** : L'application n'était conçue qu'en mode sombre, ce qui pose de réels problèmes d'ergonomie et de lisibilité en extérieur lors d'activités sportives sous le soleil (course, marche, vélo).
2. **Effet « Slop IA » & Dérive UX** :
   - Multiplication de boîtes grises imbriquées (« card soup ») encombrant le regard.
   - Surcharge de puces et badges colorés partout, diluant l'attention.
   - Manque d'un ancrage visuel fort (trace de parcours / carte) et typographie trop peu affirmée.
   - Copywriting trop verbeux et corporatif au lieu d'un langage sportif franc et immédiat.

**Objectif** :
Déployer la palette **Option A (« Outdoor Daylight & Night Trail »)** avec bascule dynamique Mode Sombre / Mode Lumineux (support système + toggle manuel mémorisé), et épurer drastiquement l'UX des écrans (en particulier `Home` et `Profile`) selon les principes stricts du skill `design-taste-frontend`.

---

## 2. Objectifs, Non-Objectifs & Anti-Objectifs

### Objectifs (Goals)
1. **Palette Bimodale Robuste (`design-system.css`)** :
   - **Mode Lumineux** : Fond blanc cassé outdoor (`#f8fafc`), cartes blanc franc (`#ffffff`) avec bordure ardoise claire (`#e2e8f0`), texte noir encre (`#0f172a`), vert sentier athlétique contrasté (`#15803d`), accents bronze chaud (`#b45309`).
   - **Mode Sombre** : Fond noir ardoise technique profond (`#090d16`), cartes ardoise dense (`#131a29`), bordure nette (`#1e293b`), texte blanc craie (`#f8fafc`), vert sentier lumineux (`#22c55e`), or ambré (`#f59e0b`).
2. **Gestionnaire de Thème Dynamique (`useThemeMode` & `TopBar`)** :
   - Hook React et service gérant 3 états : `system` (défaut), `light`, `dark`.
   - Persistance dans `localStorage` (`stride_theme_preference`).
   - Application automatique de l'attribut `data-theme="light"` ou `data-theme="dark"` sur `<html>` / `<body>`, avec synchronisation des méta et styles Ionic.
   - Bouton de bascule intuitif (icône ☀️ / 🌙) dans la `TopBar`.
3. **Refonte Anti-Slop de l'Accueil (`Home.tsx`)** :
   - Suppression de l'empilement de boîtes grises et du verbiage.
   - **Hero visuel fort** : Aperçu graphique épuré du tracé de la quête active (mini profil / trace SVG vectorielle nette), 2 chiffres d'impact géants (`7.2 km` • `42 min`), et bouton d'action massif placé dans la zone du pouce en bas.
   - Synthèse hebdomadaire présentée sur une ligne typographique épurée sans bordures superflues.
   - Carte de raid communautaire compacte et franche.
4. **Épuration de la fiche Profil (`Profile.tsx`)** :
   - Remplacement des mini-boîtes de badges par une étagère de médailles athlétiques épurée.
   - Chiffres de carrière géants en tête d'écran.
   - Historique des sorties lisible d'un coup d'œil, sans badges multiples superposés.

### Non-Objectifs (Non-Goals)
- Pas de modification des calculs GPS internes ou de la logique de routage Mapbox.
- Pas d'ajout de bibliothèques tierces de thème (l'implémentation repose purement sur les CSS Variables natives et React).

### Anti-Objectifs (Anti-Goals)
- Zéro dégradé néon, zéro effet de flou inutile qui fait baisser le contraste.
- Pas de scintillement visuel (FOUC) lors du chargement du thème mémorisé.
- Zéro régression sur la suite de 118 tests unitaires existants.

---

## 3. Approches Envisagées & Justification du Choix

1. **Option A : « Outdoor Daylight & Night Trail » (Retenue)**
   - *Justification* : Conçue pour l'ergonomie en conditions réelles d'entraînement. En plein jour, le contraste noir sur blanc est inégalable sous la lumière directe du soleil. La nuit, le mode sombre protège la vision nocturne.
2. **Option B : « High-Contrast Monochrome & Accent Émeraude » (Écartée)**
   - *Motif de rejet* : Trop clinique et agressif, manque la chaleur des accomplissements RPG.
3. **Option C : « Terre & Roche Outdoor (Warm Earth) » (Écartée)**
   - *Motif de rejet* : Style rando rétro, pas assez moderne ni athlétique.

---

## 4. Spécifications Techniques

### A. Tokens CSS Bimodaux (`src/theme/design-system.css`)
```css
/* Mode Lumineux par défaut ou explicite */
:root,
[data-theme="light"] {
  --sq-bg-base: #f8fafc;
  --sq-surface-card: #ffffff;
  --sq-surface-card-subtle: #f1f5f9;
  --sq-border: #e2e8f0;
  --sq-border-highlight: rgba(21, 128, 61, 0.25);
  --sq-text-main: #0f172a;
  --sq-text-muted: #64748b;
  --sq-green-athletic: #15803d;
  --sq-green-athletic-tint: #16a34a;
  --sq-gold-rpg: #b45309;
  --sq-gold-rpg-tint: #d97706;
  --sq-danger-raid: #dc2626;
  --sq-shadow-sm: 0 1px 3px rgba(15, 23, 42, 0.06);
  --sq-shadow-md: 0 4px 12px rgba(15, 23, 42, 0.08);
}

/* Mode Sombre explicite ou via préférence système */
[data-theme="dark"] {
  --sq-bg-base: #090d16;
  --sq-surface-card: #131a29;
  --sq-surface-card-subtle: rgba(255, 255, 255, 0.04);
  --sq-border: #1e293b;
  --sq-border-highlight: rgba(34, 197, 94, 0.35);
  --sq-text-main: #f8fafc;
  --sq-text-muted: #94a3b8;
  --sq-green-athletic: #16a34a;
  --sq-green-athletic-tint: #22c55e;
  --sq-gold-rpg: #d97706;
  --sq-gold-rpg-tint: #f59e0b;
  --sq-danger-raid: #ef4444;
  --sq-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --sq-shadow-md: 0 4px 14px rgba(0, 0, 0, 0.4);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    /* Mêmes valeurs que [data-theme="dark"] */
  }
}
```

### B. Hook & Gestionnaire de Thème (`src/hooks/useThemeMode.ts`)
- Détecte le thème stocké dans `localStorage` ou écoute `window.matchMedia("(prefers-color-scheme: dark)")`.
- Expose : `{ theme, resolvedTheme, toggleTheme, setTheme }`.
- Applique `document.documentElement.setAttribute("data-theme", resolvedTheme)`.

### C. Épuration des Écrans (`Home.tsx` & `Profile.tsx`)
- **Accueil** :
  - Un conteneur sans bordures multiples.
  - Carte Quête avec preview tracé SVG sobre et 2 métriques en typographie géante (32px tabular-nums).
  - Un bouton primaire franc (`Démarrer la quête`).
  - Bloc Raid épuré (nom, barre de vie fine sans texte superflu).
- **Profil** :
  - En-tête aéré avec avatar, niveau et barre d'XP continue.
  - Statistiques de carrière en grand format typographique net.
  - Étagère de médailles sobres.

---

## 5. Arbitrages Techniques & Précisions d'Architecture

1. **Données des Tests & Libellés** :
   - Les données affichées dans l'Accueil et le Profil restent pilotées par les fixtures réelles de `src/data/demo.ts` (`DEMO_DAILY_QUEST`, `DEMO_ACTIVE_RAID`, `DEMO_USER_PROFILE`). Les tests unitaires sont synchronisés pour valider la structure épurée sans régression.
2. **Synchronisation Carte Mapbox** :
   - La carte conserve son propre sélecteur de style visuel (`outdoors`, `dark`, `streets`, `satellite`), mais initialise son style par défaut sur `outdoors` si le thème actif est clair, et `dark` s'il est sombre.
3. **Comportement du Toggle Thème dans la TopBar** :
   - Bascule directe binaire (`light` ↔ `dark`) au clic sur l'icône (☀️ / 🌙) pour une action immédiate à un tap. Si aucune préférence n'est encore enregistrée en `localStorage`, la valeur initiale est déduite de `prefers-color-scheme`.
4. **Bouton d'Action Quête (CTA)** :
   - Positionné en bas de la Hero Card, pleine largeur avec une hauteur tactile généreuse (min 48px), assurant un confort d'appui maximal sans interférer avec la barre d'onglets Ionic.
5. **Intégration Ionic & Palette Système** :
   - Bascule de la classe native `.ion-palette-dark` sur `document.documentElement` conjointement avec `data-theme="dark"` / `data-theme="light"` pour assurer la cohérence des composants natifs Ionic (modales, popovers, alertes).

---

## 6. Ce qui est Laissé au Développeur (Builder)

- Rendu exact de la trace SVG vectorielle de quête (dessin d'un tracé géométrique représentatif dans le Hero).
- Placement exact de l'icône de bascule de thème dans la `TopBar` (à côté des notifications et amis).
