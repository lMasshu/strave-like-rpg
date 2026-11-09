# Correction XSS du marqueur de quête

## Objectif et périmètre approuvé

Sur `fix/security-independent`, issue de `origin/develop`, afficher le titre de quête comme du texte, même s'il contient du HTML malveillant. Conserver les classes CSS, le trophée et le positionnement Mapbox existants. Aucun changement Auth0/API et aucune dépendance ajoutée.

## Approches

- Construction DOM avec `createElement` et `textContent` : approche retenue, sans interprétation HTML ni dépendance.
- Échappement ou sanitisation du HTML : inutile ici puisque le titre ne doit contenir aucun balisage actif.

## Conception

Extraire la création du contenu du marqueur dans `src/services/questMarker.ts`, avec `createQuestMarkerElement(title: string): HTMLDivElement`. Créer un conteneur et deux enfants : icône trophée et libellé textuel. Appeler cette fonction dans `Map.tsx` à la place du bloc `innerHTML` dynamique.

## Validation

Tests Vitest/jsdom pour titre normal, titre vide, accents/emoji, balises et attributs malveillants, entités HTML. Vérifier la structure et les classes existantes, le titre littéral et l'absence de nœuds injectés. Puis tests unitaires, lint et build mobile. Le `innerHTML` statique du marqueur joueur reste hors périmètre.
