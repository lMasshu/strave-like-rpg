# Design Document - Intégration Complète de la Maquette Produit Stride Quest

- **Projet** : Stride Quest (`mobile-ionic`)
- **Date** : 2026-11-05
- **Branche** : `feat/app-ui-ux-design`
- **Statut** : En cours de validation

---

## 1. Contexte & Intentions

L'utilisateur a fourni la maquette officielle de référence du projet (**`Maquette application sport.pdf`**), comportant 8 écrans fondamentaux :
1. Accueil (Tableau de bord, quête active, dernière sortie, boss en cours).
2. Enregistrement en mode Statistiques (Rythme réel géant, métriques d'effort).
3. Enregistrement en mode Carte GPS (Carte vectorielle Mapbox avec tracé et métriques).
4. Défis (Boss local/national/mondial + Quêtes géolocalisées à proximité).
5. Amis (Avatars horizontaux + Activités récentes des amis avec tracés).
6. Parcours (Bibliothèque de parcours communautaires avec recherche et filtres).
7. Mes activités (Historique personnel des sorties avec points et tracés).
8. Profil (Avatar, niveau, stats globales, histogramme hebdomadaire en barres, badges).

**Objectif** : Implémenter fidèlement cette architecture complète dans `mobile-ionic` tout en l'élevant aux standards professionnels de `design-taste-frontend` :
- Remplacement du violet uniforme par notre palette athlétique bimodal (mode sombre profond & mode clair outdoor daylight).
- Élimination des dégradés superflus et de la « soupe de cartes » au profit d'un rythme typographique franc et aéré.
- Tracés vectoriels SVG fluides pour toutes les cartes de parcours.
- Maintien intégral de la télémétrie GPS en temps réel et de la suite de tests unitaires.

---

## 2. Architecture de Navigation & Écrans

### A. Barre de Navigation Inférieure (5 Onglets)
- **`/accueil`** : Écran Accueil
- **`/parcours`** : Bibliothèque de parcours publics
- **`/enregistrer`** : Enregistrement actif (avec sélecteur Statistiques / Carte GPS)
- **`/defis`** : Défis & Boss de Raids
- **`/amis`** : Social & Amis
- **`/profil`** : Fiche Athlète / Profil (accessible via l'avatar en haut à droite de la `TopBar`)

---

## 3. Spécifications Détaillées par Écran

### 1. Accueil (`Home.tsx`)
- En-tête : Salutation personnalisée (`Bonjour Alexis`), accroche (`Prêt à bouger ?`), badge de niveau compact (`N7`).
- Grand bouton Hero : *"Démarrer une sortie (Enregistrement en un geste)"* avec icône de lancement, menant directement à `/enregistrer`.
- Section *"Cette semaine"* : 3 métriques clés aérées (Distance `24,6 km`, Temps `2 h 18`, Dénivelé `310 m`).
- Section *"Dernière sortie · Course à pied"* : Vignette de parcours vectoriel SVG, gain de points (`+120 pts`), distance (`8,2 km`), durée (`44:10`) et allure (`5:23 min/km`).
- Section *"Boss en cours · Titan de la ville"* : Jauge de points de vie (`58 %`), statut de raid actif.

### 2. Enregistrement (`Map.tsx`)
- Sélecteur à deux segments en haut d'écran : `Statistiques` | `Carte GPS`.
- **Mode Statistiques** :
  - Chiffre géant au centre : Allure instantanée en direct (`5:12 min/km · à cet instant`).
  - Grille 4 cadrans : Distance cumulée (`3,42 km`), Chrono actif (`18:06`), Dénivelé (`46 m`), Points gagnés (`+48`).
  - Contrôles sous le pouce : Bouton `Pause` / `Reprendre` et `Terminer`.
- **Mode Carte GPS** :
  - Rendu Mapbox GL plein écran avec la trace réelle du coureur.
  - HUD compact en bas d'écran reprenant Allure, Distance et Chrono.
  - Console de debug GPS escamotable préservée.

### 3. Défis (`Defis.tsx` - `/defis`)
- Titre : *"Défis"* avec sous-titre *"Tes sorties te donnent des points. Utilise-les ici."*
- Carte Boss : Titre (`Boss local · Fin dans 2 jours`), Nom (`Titan de la ville`), jauge PV chiffrée (`580 000 / 1 000 000 PV · 58 %`), contribution personnelle (`Ta contribution : 860 points`).
- Filtres de zone : Chips `Local` | `National` | `Mondial`.
- Liste *"Quêtes près de toi"* :
  - Quête 1 : `Rejoindre le parc` (1,2 km · 8 min · +80 XP).
  - Quête 2 : `Atteindre le monument` (2,5 km · 16 min · +150 XP).
  - Clic lance l'itinéraire vers la quête sélectionnée.

### 4. Amis (`FriendsPage.tsx` - `/amis`)
- En-tête : Titre *"Amis"* et bouton discret *"Ajouter un ami"*.
- Rangée d'avatars horizontaux défilable : `Mes amis · 12` avec initiales et prénoms (Léa, Hugo, Sarah, Tom, +8 Voir tout).
- Flux *"Activités de mes amis"* :
  - Cartes d'activités sociales avec tracé vectoriel SVG, sport (Course, Vélo), date relative (*Aujourd'hui à 12:40*, *Hier à 18:05*), distance, chrono et vitesse/allure.

### 5. Bibliothèque de parcours (`ParcoursPage.tsx` - `/parcours`)
- Titre : *"Bibliothèque de parcours"*.
- Barre de recherche avec autocomplétion : *"Lieu, nom du parcours..."*.
- Filtres rapides : `Près de moi` | `Course` | `Vélo`.
- Liste de parcours :
  - Tracé vectoriel SVG de chaque boucle.
  - Titre du parcours (`Boucle du parc`, `Le long des quais`, `Montée de la colline`).
  - Métriques : Distance, Dénivelé, Proximité géographique (*À 1,1 km*) et auteur (*Publié par Léa*).

### 6. Profil & Mes activités (`Profile.tsx` - `/profil`)
- En-tête joueur : Avatar rond, Nom, Niveau, Jauge d'XP chiffrée (`1 240 / 2 000 XP`).
- Grille statistiques globales : `86 Sorties`, `612 km Distance`, `58 h Temps`, `7 240 m Dénivelé`.
- Histogramme d'entraînement : Graphique en barres verticales CSS représentant les 6 dernières semaines (`18`, `22`, `19`, `28`, `25`, `24,6 km`).
- Étagère de Badges : Médailles débloquées et silhouettes à accomplir.
- Section ou sous-page *"Mes activités"* : Liste chronologique des sorties personnelles avec tracé SVG et points récoltés.

---

## 4. Données de Démonstration (`demo.ts`)

Enrichissement des structures TypeScript :
- `PUBLIC_ROUTES` : Bibliothèque de parcours publics pour `/parcours`.
- `FRIEND_ACTIVITIES` : Sorties des amis pour `/amis`.
- `WEEKLY_HISTORY` : Données de l'histogramme des 6 dernières semaines.
- `LOCAL_QUESTS` : Quêtes de proximité pour `/defis`.

---

## 5. Arbitrages Techniques & Précisions d'Architecture

1. **Rôle de `/enregistrer` & Planification d'itinéraires** :
   - L'écran `/enregistrer` se concentre en priorité sur l'expérience de la maquette (Pages 2 et 3) avec le sélecteur `Statistiques` | `Carte GPS`, l'allure instantanée géante et les contrôles `Pause` / `Terminer`.
   - Les outils de planification avancée (génération procédurale de boucles et sélection de destination) restent accessibles via une modale rétractable dédiée, préservant 100% des algorithmes géodésiques existants.
2. **Cycle de Vie de l'Enregistrement inter-onglets** :
   - La session d'entraînement est gérée par un hook/store partagé (`useActiveWorkout`) afin que le chronomètre et l'accumulation de distance GPS ne soient pas réinitialisés si l'utilisateur consulte ses amis ou les défis pendant sa sortie.
3. **Flux de Fin d'Activité (« Terminer »)** :
   - L'appui sur `Terminer` ouvre un panneau récapitulatif valorisant (*Résumé de l'effort*, distance, allure, points gagnés, dégâts infligés au boss) et insère la sortie dans la liste locale des activités, actualisant dynamiquement l'Accueil et le Profil.

---

## 6. Non-Objectifs & Anti-Objectifs

- Pas de dépendance tierce de charting lourde : l'histogramme est un composant CSS pur fluide et réactif.
- Pas de régression sur les 125 tests unitaires existants.
- Pas de violet saturé uniforme : utilisation de la palette outdoor daylight & dark trail pour une lisibilité maximale.
