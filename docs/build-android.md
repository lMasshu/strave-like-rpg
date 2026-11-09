# 🤖 Guide de Compilation & Déploiement Android — Stride Quest

Ce guide détaille la procédure complète pour compiler l'application mobile Stride Quest en fichier binaire Android (`app-debug.apk`) et l'installer sur un smartphone physique ou un émulateur.

---

## 1. Prérequis Système

Pour compiler l'application native Android, votre machine doit disposer de :
- **Node.js** : v20 ou supérieur (`node -v`).
- **Android Studio** : version Ladybug / Koala ou plus récente.
- **Android SDK** : API Level 34 à 36 installé via le SDK Manager d'Android Studio.
- **OpenJDK 21** : inclus directement avec Android Studio dans le répertoire JetBrains Runtime (`jbr`).

---

## 2. Configuration Cruciale du JDK (Java 21)

Capacitor 8 et le plugin Android Gradle moderne requièrent **Java 21** (`source release: 21`).

Afin d'éviter tout conflit de version (par exemple si un ancien JDK 17 ou 8 est présent dans vos variables d'environnement Windows), le projet est configuré de façon déterministe dans `mobile-ionic/android/gradle.properties` :

```properties
org.gradle.jvmargs=-Xmx1536m
org.gradle.java.home=C:/Program Files/Android/Android Studio/jbr
```

> **Attention sous Windows / cmd.exe** : Lors de l'affectation de variables en ligne de commande batch, veillez à ne jamais laisser d'espace avant `&&` (ex. `set "JAVA_HOME=..." &&`), sinon Windows intègre un espace parasite dans le chemin du JDK.

---

## 3. Procédure de Compilation Pas-à-Pas

La génération de l'APK s'effectue en 3 étapes successives :

### Étape 1 : Compilation des Assets Web (Vite)
Depuis la racine du projet :
```bash
npm run build
```
*Cette commande compile le code TypeScript et produit les fichiers statiques de production dans `mobile-ionic/dist/`.*

### Étape 2 : Synchronisation Capacitor
Injectez les assets web et les plugins natifs dans le projet Android :
```bash
cd mobile-ionic
npx cap sync android
```
*Capacitor copie les assets dans `android/app/src/main/assets/public` et met à jour les plugins (`geolocation`, `haptics`, `app`, `keyboard`, `status-bar`).*

### Étape 3 : Compilation Native Gradle (Génération APK)
Rendez-vous dans le dossier Android :
```bash
cd android
```

- **Depuis WSL (Windows Subsystem for Linux)** :
  ```bash
  cmd.exe /c "gradlew.bat assembleDebug"
  ```
- **Depuis PowerShell ou Invite de Commandes Windows** :
  ```cmd
  gradlew.bat assembleDebug
  ```
- **Depuis une machine Linux / Mac native** :
  ```bash
  ./gradlew assembleDebug
  ```

Résultat attendu : `BUILD SUCCESSFUL in ~15-20s`.

---

## 4. Emplacement de l'APK & Installation sur Smartphone

Une fois la compilation réussie, le fichier binaire se trouve dans :

```text
mobile-ionic/android/app/build/outputs/apk/debug/app-debug.apk
```

### Installation via ADB (Câble USB ou Wi-Fi) :
1. Activez le **Mode Développeur** et le **Débogage USB** sur votre smartphone Android.
2. Branchez votre téléphone à votre PC.
3. Vérifiez la détection de l'appareil :
   ```bash
   adb devices
   ```
4. Installez l'application :
   ```bash
   adb install -r mobile-ionic/android/app/build/outputs/apk/debug/app-debug.apk
   ```

---

## 5. Débogage & Consultation des Logs Natifs

Pour inspecter la télémétrie GPS en direct ou observer les échanges réseau depuis le smartphone :

```bash
# Filtrer les logs Capacitor et Geolocation
adb logcat | grep -E "Capacitor|Geolocation|useActiveWorkout"
```

Vous pouvez également ouvrir le projet dans Android Studio pour profiter du profileur de performances :
```bash
cd mobile-ionic
npx cap open android
```

---

## 6. Dépannage des Erreurs Fréquentes

| Erreur rencontrée | Cause | Solution |
| :--- | :--- | :--- |
| `invalid source release: 21` | Le démon Gradle tourne sur un ancien JDK (ex. JDK 17). | Arrêtez les démons existants (`gradlew.bat --stop`) et vérifiez que `gradle.properties` pointe vers `C:/Program Files/Android/Android Studio/jbr`. |
| `android platform has not been added yet` | La commande Capacitor a été lancée depuis la racine au lieu de `mobile-ionic`. | Exécutez `npx --prefix mobile-ionic cap sync android` ou placez-vous dans `mobile-ionic/`. |
| `JAVA_HOME is set to an invalid directory` | Espace involontaire dans la commande `set JAVA_HOME=... &&`. | Encadrez avec des guillemets : `set "JAVA_HOME=..." && gradlew.bat assembleDebug`. |
