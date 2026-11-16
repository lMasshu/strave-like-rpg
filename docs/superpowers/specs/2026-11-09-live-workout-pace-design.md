# Allure instantanée fiable — conception

## Intention et accord

L'utilisateur a validé l'option robuste : séparer l'allure instantanée de la moyenne, distinguer arrêt et signal indisponible, conserver la cadence GPS et tester arrêt/reprise. Aucun délai physique de détection GPS n'est garanti.

## Approches

- Minimal : supprimer seulement le fallback moyen ; laisse les vitesses périmées affichées.
- Robuste (retenue) : corriger le calcul affiché, contrôler la fraîcheur et couvrir les transitions.
- Fusion GPS/capteurs : complexité prématurée et nouveaux réglages ; hors périmètre.

## Constat

`useActiveWorkout.ts` remplace la vitesse basse ou absente par l'allure moyenne après 50 m. La dernière vitesse reste disponible sans expiration. Le tracker demande déjà une mesure toutes les 1 000 ms sur Android ; la vitesse native est utilisée directement, le fallback géométrique est lissé à 60 % nouvelle mesure / 40 % précédente et possède déjà un seuil anti-bruit.

## Comportement

- `paceMinPerKm` ne représente que l'allure instantanée. Aucun fallback vers la moyenne.
- Une vitesse fiable égale à zéro indique l'arrêt ; une vitesse positive faible ne suffit pas à déclarer l'arrêt. À l'arrêt, afficher `--:--` et « À l'arrêt ».
- Sans vitesse fiable ou sans position fraîche : `--:--` et « Signal GPS indisponible ». Ne pas représenter une perte de signal comme un arrêt.
- Pause manuelle : `--:--` et « En pause ». Au repos ou après fin, aucune allure instantanée active.
- Reprise : exiger un nouveau fix, ne pas réutiliser le fix antérieur à la reprise.
- Format : arrondir d'abord les secondes totales pour éviter `5:60`. Accepter la marche lente sans plafond arbitraire de 30 min/km.

## Choix techniques proposés par l'agent

- Une mesure expire après 3 000 ms depuis son timestamp ; contrôle toutes les 250 ms pendant l'enregistrement. Seuil initial à valider sur appareil, pas une garantie de détection d'arrêt en trois secondes.
- Réutiliser le seuil de précision sportive de 25 m pour décider si l'allure est exploitable ; rejeter vitesse non finie/négative et timestamps invalides/futurs.
- Conserver le lissage et les seuils du tracker pour ce premier correctif : aucune preuve ne justifie encore leur modification.
- Extraire les décisions de présentation dans un service pur, sans dépendance supplémentaire. Ajouter un état explicite de l'allure aux métriques du hook.

## Limites et validation

Ne pas modifier le calcul des distances/XP, la configuration Vite, les dépendances, Auth0, l'API ni ajouter de capteur. Pas de nouvelle case moyenne dans cette intervention.

Tests unitaires : arrêt après plus de 50 m, marche lente, vitesse inconnue, bruit/précision insuffisante, silence GPS, reprise et pause, formatage. Validation terrain : APK ou navigateur à préciser ; observer les horodatages et vitesses de la console GPS existante lors de plusieurs arrêts/reprises, pour distinguer retard du fournisseur et affichage. Toute modification ultérieure du lissage exige ces mesures.
