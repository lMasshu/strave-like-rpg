# Quest Marker XSS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Empêcher l'interprétation du titre de quête comme HTML dans le marqueur Mapbox.

**Architecture:** Isoler la création DOM dans une petite fonction testable. Map.tsx conserve la gestion du marqueur et ses coordonnées.

**Tech Stack:** TypeScript strict, DOM, Vitest/jsdom, Ionic React, Mapbox.

**Spec:** `docs/superpowers/specs/2026-11-09-quest-marker-xss-design.md`

## Global Constraints

- Aucun changement Auth0/API et aucune dépendance ajoutée.
- Conserver les classes CSS, le trophée et le positionnement Mapbox existants.
- Ne pas modifier le marqueur joueur statique.

## Review Focus

- Balises HTML : titre littéral, aucun élément injecté.
- Attributs événementiels : aucun attribut actif créé.
- Entités HTML : ne pas décoder le titre.
- Accents et emoji : affichage textuel inchangé.
- Titre vide : structure du marqueur toujours valide.

### Task 1: Création sûre du marqueur

**Files:**
- Create: `mobile-ionic/src/services/questMarker.ts`
- Test: `mobile-ionic/src/services/questMarker.test.ts`
- Modify: `mobile-ionic/src/pages/Map.tsx`

**Interfaces:**
- Consumes: titre `string` de la quête.
- Produces: `createQuestMarkerElement(title: string): HTMLDivElement`.

- [x] Écrire des tests paramétrés pour `Cap sur : le parc`, une chaîne vide, `Église 🌳`, `<img src=x onerror="alert(1)"><script>alert(1)</script>` et `&lt;b&gt;`. Vérifier le libellé via `textContent`, les deux enfants et classes attendues, le trophée, et l'absence de `img`, `script` ou attribut événementiel.
- [x] Exécuter `npm --prefix mobile-ionic run test.unit -- --run src/services/questMarker.test.ts` ; constater l'échec dû au module absent.
- [x] Implémenter la fonction avec `createElement`, `className`, `textContent` et `append`, puis l'utiliser dans `Map.tsx` à la place du bloc HTML dynamique.
- [x] Relancer les tests ; résultat : cinq cas passent dans la suite mobile. Une mutation temporaire vers `innerHTML` a provoqué deux échecs d'assertion avant restauration du correctif.
- [x] Formater les fichiers touchés avec Prettier, lancer les tests unitaires mobiles, `npm --prefix mobile-ionic run lint` et `npm --prefix mobile-ionic run build`.
- [x] Relire le diff pour confirmer le périmètre, relever les éventuels avertissements préexistants et présenter le résultat. Aucun commit/push sans demande explicite.

## Résultats

- `npm test` : 157 tests réussis (146 mobile, 11 API).
- Lint et build mobile : réussis ; avertissements build CSS Ionic `host-context`, taille des chunks et durée des plugins.
- Revue indépendante : aucun problème critique, important ou mineur constaté.
- Validation avant commit : tests, lint et build réussis. Le contrôle Prettier ciblé passe ; le contrôle global signale 40 fichiers non modifiés dans le checkout local (CRLF constatés sur `App.tsx`, dont la version Git LF passe Prettier). Ces fichiers restent hors périmètre.
