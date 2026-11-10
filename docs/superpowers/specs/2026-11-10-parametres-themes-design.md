# Paramètres et thèmes d’interface

## Intention

Ajouter un accès clair aux paramètres de Stride Quest et permettre à l’utilisateur de personnaliser la palette de l’interface sans perdre le choix clair, sombre ou système existant.

## Objectifs

- Ajouter un bouton Paramètres identifiable par une Ionicon d’engrenage dans la barre supérieure.
- Ouvrir une page secondaire `/parametres`, avec barre d’onglets masquée et navigation de retour.
- Présenter trois palettes sous forme de cartes avec aperçu : Lime Frost, Violet Bloom et Scarlet Snow.
- Appliquer le choix immédiatement à toute l’application et le conserver dans le stockage local.
- Conserver le réglage d’apparence clair/sombre/système indépendamment de la palette.
- Couvrir la navigation, la sélection, la persistance et l’application au DOM par des tests.

## Hors périmètre

- Synchronisation du thème avec un compte utilisateur ou le backend.
- Autres paramètres applicatifs.
- Reproduction de composants ou de mises en page provenant des pages de démonstration 21st.dev : seules les palettes servent de référence visuelle.

## Approches considérées

1. **Palette indépendante du mode d’apparence — retenue.** Chaque palette possède des variantes claire et sombre. Cette solution conserve le comportement actuel et permet des évolutions futures.
2. **Thèmes complets figés.** Plus direct, mais incompatible avec le sélecteur clair/sombre existant.
3. **Remplacement de la seule couleur principale.** Plus simple, mais insuffisant pour produire trois identités visuelles cohérentes.

## Conception retenue

- Étendre le système de thème avec une préférence de palette distincte : `lime-frost`, `violet-bloom` ou `scarlet-snow`.
- Poser cette préférence sur le document via un attribut dédié, puis définir les couleurs avec les variables CSS existantes afin que les composants actuels en bénéficient sans réécriture.
- Ajouter une page Ionic Paramètres contenant une section « Thème de l’interface ». Chaque carte affiche le nom, quelques pastilles de couleur et un état sélectionné accessible.
- Ajouter l’accès par engrenage à la barre supérieure. La page Paramètres est une page poussée : elle comporte un retour et masque la barre d’onglets inférieure, comme Notifications.
- Garder le bouton clair/sombre actuel ; la palette et l’apparence restent deux réglages indépendants.

## Contraintes et garde-fous

- Utiliser les Ionicons déjà présentes et les composants Ionic existants.
- Respecter le contraste des textes et états interactifs dans les six combinaisons palette/apparence.
- Ne pas ajouter de dépendance ni de secret.
- Ne pas modifier les fonctionnalités GPS ou métier.
