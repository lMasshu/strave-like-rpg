# Design Document - Refonte UI/UX Globale « Strava Pro Outdoor + HUD RPG Tactile »

- **Projet** : Stride Quest (`mobile-ionic`)
- **Date** : 2026-11-05
- **Branche** : `feat/app-ui-ux-design`
- **Statut** : En révision

---

## 1. Contexte & Intentions

**Stride Quest** est une application mobile hybride combinant le tracking sportif géolocalisé (style Strava) et les mécaniques de jeu de rôle (RPG).
Actuellement, l'architecture fonctionnelle (moteur GPS, calculs géodésiques, génération de boucles de quête, tests unitaires) est solide. Cependant, l'expérience utilisateur et l'interface graphique souffrent d'un niveau d'intégration hétérogène :
- `Home.tsx` est un écran vide avec un seul bouton de redirection.
- `Profile.tsx` présente des statistiques brutes sans mise en valeur RPG (pas d'inventaire de badges, pas d'historique).
- Les composants de navigation et les cartes manquent d'un système visuel cohérent respectant les règles d'ergonomie sportive en extérieur et les principes anti-slop du skill `design-taste-frontend`.

**Objectif** : Concevoir et implémenter un système de design global cohérent et refondre tous les onglets pour livrer une application moderne, valorisante et immédiatement lisible en conditions réelles d'effort extérieur.

---

## 2. Objectifs, Non-Objectifs & Anti-Objectifs

### Objectifs (Goals)
1. **Système de design unifié (`design-tokens`)** :
   - Définir une palette resserrée : fond sombre ardoise outdoor (`#0f172a`, `#1e293b`), vert athlétique franc (`#16a34a` / `#15803d`), ambre/or chaud pour les accomplissements RPG (`#d97706`, `#b45309`), typographie technique claire et contrastes accessibles (> 4.5:1).
   - Micro-interactions tactiles : boutons avec feedback d'enfoncement (`active: scale(0.98)`), cartes interactives avec élévation légère, transitions fluides.
2. **Refonte de l'Accueil (`Home.tsx`)** :
   - Transformer la page en un tableau de bord d'aventure complet :
     - *Hero Card Quête du jour* : distance cible, estimation de durée, gain XP et bouton d'action direct.
     - *Bannière Raid Communautaire* : boss en cours, jauge de points de vie (HP) globale, compte à rebours de l'événement.
     - *Résumé de la semaine* : distance cumulée, temps d'activité, XP gagnée.
     - *Flux des activités récentes* : carte résumée des dernières sorties sportives avec kudos.
3. **Refonte du Profil RPG (`Profile.tsx`)** :
   - Fiche aventurier complète : avatar, niveau, jauge d'XP avec progression vers le prochain rang.
   - Grille de badges et trophées (ex. *Premier 10km*, *Chasseur de POI*, *Vainqueur de Raid*).
   - Grille de métriques globales (distance totale, dénivelé positif, vitesse moyenne record).
   - Historique défilable des sorties enregistrées avec détail du tracé.
4. **Sublimation de la Carte & HUD (`Map.tsx`, `QuestRunHud.tsx`, `QuestGeneratorModal.tsx`)** :
   - HUD d'enregistrement semi-transparent au style athlétique épuré.
   - Modale de génération de quête intégrée sous forme de feuille inférieure (*bottom sheet*) moderne avec sélecteur de distance/allure intuitif.
   - Conservation intégrale de la console de debug GPS escamotable.
5. **Harmonisation des pages secondaires (`FriendSearch.tsx`, `Notifications.tsx`)** :
   - Flux de notifications par catégories (Raids, Amis, Succès).
   - Liste d'amis façon guilde sportive avec classement hebdomadaire d'XP et de distance.

### Non-Objectifs (Non-Goals)
- Pas de refonte du schéma de base de données PostgreSQL côté backend (le mock/demo state enrichi est utilisé côté client pour alimenter l'interface de façon autonome).
- Pas d'introduction de modèles 3D lourds ou de WebGL énergivore qui pénaliseraient l'autonomie de la batterie lors du suivi GPS en extérieur.

### Anti-Objectifs (Anti-Goals)
- Pas d'esthétique "néon cyberpunk" ou "jeu mobile bas de gamme" criard.
- Pas de typographie fantaisiste illisible en plein soleil lors de la course à pied.
- Pas d'animations au défilement (scroll-jacking) saccadées.
- Pas de régression sur la suite de 86 tests unitaires existants.

---

## 3. Approches Envisagées & Justification du Choix

1. **Approche 1 : « Strava Pro Outdoor + HUD RPG Tactile » (Retenue)**
   - *Description* : Esthétique sobre athlétique inspirée des équipements d'aventure outdoor haut de gamme et des trackers GPS pro, complétée par des éléments RPG subtils et gratifiants (badges forgés, barres de raid, anneaux d'XP).
   - *Justification* : Respecte à 100 % les standards de `design-taste-frontend` et les directives du projet `AGENTS.md`. Maintient une lisibilité maximale en plein soleil tout en gamifiant l'effort physique.
2. **Approche 2 : « Full Game-UI Fantastique Médiévale » (Écartée)**
   - *Description* : Textures pierre, enluminures et parchemins.
   - *Motif de rejet* : Mauvaise lisibilité en extérieur, rupture avec l'ADN sportif moderne de l'application.
3. **Approche 3 : « Minimalisme Brutaliste / Dashboard Noir & Blanc » (Écartée)**
   - *Description* : Écrans purement textuels en noir et blanc.
   - *Motif de rejet* : Supprime le plaisir de progression RPG et la convivialité de la communauté.

---

## 4. Spécifications Techniques & Composants du Design System

### A. Tokens & Thème (`src/theme/variables.css` & `src/theme/design-system.css`)
- **Fonds** :
  - Surface principale : `#0b0f19` (nuit outdoor profonde)
  - Cartes et panneaux : `#151e2e` (ardoise sombre renforcée)
  - Bordures subtiles : `#233248` (séparations nettes, zéro flou)
- **Accents & Rôles** :
  - Primaire / Action : `#16a34a` (vert sentier athlétique, contraste blanc 4.8:1)
  - Succès / Validation : `#10b981` (émeraude POI)
  - RPG / Accomplissement : `#d97706` (ambre doré pour les niveaux et badges)
  - Alerte / Raid : `#ef4444` (danger boss de raid)
- **Typographie** :
  - Textes d'interface : système natif sans-serif propre (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto`)
  - Télémétrie & Données GPS : chiffres tabulaires à espacement régulier (`font-variant-numeric: tabular-nums`)
- **Micro-interactions** :
  - Transitions : `transition: all 0.15s ease-out`
  - Boutons : élévation au repos, légère compression au tap `transform: scale(0.98)`
  - Cartes : `border-radius: 16px` avec bordure 1px solide contrastée

### B. Composants Partagés à Créer / Enrichir
1. `RpgBadgeCard` : Affichage d'un badge avec icône, nom, date d'obtention ou progression de déblocage.
2. `RaidBossBanner` : Carte compacte affichant l'avatar du boss, son nom, sa zone d'influence et sa jauge HP résiduelle.
3. `StatMetric` : Bloc de métrique standardisé (Valeur en grand, unité, libellé).
4. `QuestPreviewCard` : Carte de quête recommandée (carte miniature, nom, difficulté, distance, gain XP).
5. `ActivityListItem` : Élément d'historique de sortie sportive (type d'activité, date, distance, chrono, XP).

---

## 5. Ce qui est Laissé à la Charge du Développeur (Builder)

- Définition exacte du jeu de données mockées de démonstration (`demo.ts`) pour peupler les badges, l'historique et les raids récents sans backend actif.
- Sélection des icônes Ionicons appropriées pour chaque type de quête (marche, course, vélo, dénivelé).
- Optimisation des paddings de safe-area sur iPhone et téléphones Android avec encoche.

---

## 6. Critères d'Acceptation & Validation

1. **Esthétique & Ergonomie** :
   - Tous les onglets (`Home`, `Map`, `Profile`, `Friends`, `Notifications`) partagent la même identité visuelle cohérente.
   - Aucun écran n'est une coquille vide ou un placeholder générique.
2. **Performance & Robustesse** :
   - Navigation fluide entre onglets sans rechargement lourd.
   - Le HUD de quête et la console de debug GPS restent 100 % opérationnels sur la carte.
3. **Qualité Logicielle** :
   - 100 % des tests Vitest passent avec succès (`npm --prefix mobile-ionic run test.unit -- --run`).
   - Formatage Prettier conforme (`npm --prefix mobile-ionic run format:check`).
   - Linter ESLint sans erreur ni avertissement (`npm --prefix mobile-ionic run lint`).
   - Build Vite validé (`npm --prefix mobile-ionic run build`).
