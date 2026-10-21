# GolfUs sur iPhone — guide pas à pas (étape 5)

De votre Mac jusqu'à TestFlight. Toutes ces étapes se font **avec vos identifiants Apple, par vous** : je n'y touche pas.
Durée totale : environ 2 heures, plus 24 à 48 h d'attente pour l'activation du compte développeur.

---

## 1. Compte Apple Developer (99 $ par an)

1. Ouvrez https://developer.apple.com/programs/enroll/ et connectez-vous avec votre identifiant Apple
   (double authentification obligatoire).
2. Choisissez **Individual** (particulier) : le nom affiché sur l'App Store sera votre nom.
   Pour afficher un nom de société, il faut **Organization** et un numéro D-U-N-S (gratuit, quelques jours).
3. Payez les 99 $. L'activation prend souvent 24 à 48 heures ; vous recevez un e-mail.
4. Notez votre **Team ID** : developer.apple.com › Account › Membership details (10 caractères, ex. `AB12CD34EF`).

## 2. Signature dans Xcode

1. Dans le Terminal, dans le dossier du projet :

   ```bash
   npm run ios:sync
   ```

   ```bash
   npm run ios:open
   ```

2. Xcode › menu **Xcode › Settings › Accounts** › **+** › Apple ID : connectez-vous.
3. À gauche, cliquez sur **App** (icône bleue), puis la cible **App** › onglet **Signing & Capabilities** :
   - cochez **Automatically manage signing** ;
   - **Team** : votre nom (Personal Team ne suffit pas pour l'App Store) ;
   - **Bundle Identifier** : `ch.golfus.app` (déjà rempli).
4. Toujours dans cet onglet, bouton **+ Capability**, ajoutez :
   - **Push Notifications** ;
   - **Sign in with Apple** ;
   - **Associated Domains** › **+** › `applinks:golfus.ch`.
5. Netlify › Site configuration › Environment variables : ajoutez `APPLE_TEAM_ID` (votre Team ID), puis redéployez.
   Vérification : https://golfus.ch/.well-known/apple-app-site-association affiche votre Team ID.

## 3. Notifications push (clé APNs)

1. developer.apple.com › Certificates, Identifiers & Profiles › **Keys** › **+**.
2. Nom : `GolfUs APNs`, cochez **Apple Push Notifications service (APNs)** (et **Sign in with Apple** si vous voulez
   la révocation à la suppression de compte, voir `docs/APP_STORE.md`). **Continue › Register**.
3. **Download** : le fichier `.p8` ne se télécharge qu'une fois. Rangez-le en lieu sûr, jamais dans le projet.
4. Netlify : `APNS_KEY_ID` (le Key ID affiché), `APNS_PRIVATE_KEY` (ouvrez le `.p8` dans TextEdit, copiez tout le texte),
   et pour la clé « Sign in with Apple » : `APPLE_SIWA_KEY_ID`, `APPLE_SIWA_PRIVATE_KEY` (même clé si elle a les deux cases).
   Redéployez.
5. Pour tester depuis Xcode sur votre iPhone, mettez temporairement `APNS_PRODUCTION=false` ; remettez `true` pour
   TestFlight et l'App Store.

## 4. Lancer l'app sur votre iPhone

1. Branchez l'iPhone en USB (ou même Wi-Fi), déverrouillez-le, touchez **Se fier à cet ordinateur**.
2. Sur l'iPhone : **Réglages › Confidentialité et sécurité › Mode développeur** › activer › redémarrer › confirmer.
   (L'option apparaît après le premier branchement à Xcode.)
3. Dans Xcode, en haut, choisissez votre iPhone comme destination, puis **▶** (Run).
4. Si l'iPhone affiche « Développeur non approuvé » : **Réglages › Général › VPN et gestion de l'appareil** › votre nom ›
   **Approuver**.

## 5. Créer l'app dans App Store Connect

1. https://appstoreconnect.apple.com › **Apps** › **+** › **Nouvelle app** :
   - Plateforme : iOS ; Nom : **GolfUs** (s'il est pris, par ex. « GolfUs – Golf entre amis ») ;
   - Langue principale : Français ; Bundle ID : `ch.golfus.app` ; SKU : `golfus-ios`.
2. Onglet **Confidentialité de l'app** : URL `https://golfus.ch/confidentialite`, puis les réponses de
   `docs/APP_STORE.md` (section 2).
3. **Informations sur l'app** › Classification par âge : réponses de `docs/APP_STORE.md` (section 3).
   Catégorie : Sports (secondaire : Voyages).

## 6. Envoyer une version de test (Archive)

1. Dans le Terminal : `npm run ios:sync` (toujours avant d'archiver : l'app embarque la dernière version du site).
2. Xcode › destination en haut : **Any iOS Device (arm64)**.
3. Menu **Product › Archive** (quelques minutes). La fenêtre **Organizer** s'ouvre.
4. **Distribute App › App Store Connect › Upload** › laissez les options par défaut › **Upload**.
5. Pour chaque nouvel envoi, augmentez le **Build** : cible App › General › Identity › Build (1, puis 2, 3…).
   La **Version** (1.0) ne change qu'à chaque sortie publique.
6. Après 10 à 30 minutes, la version apparaît dans App Store Connect › TestFlight (statut « Processing » puis prêt).
   Question sur le chiffrement : déjà réglée dans l'app (`ITSAppUsesNonExemptEncryption = NO`, HTTPS standard).

## 7. TestFlight

- **Testeurs internes** (jusqu'à 100 personnes de votre équipe App Store Connect) : immédiat, sans examen.
  App Store Connect › Users and Access › ajoutez-les, puis TestFlight › Internal Testing › **+**.
- **Testeurs externes** (amis golfeurs, jusqu'à 10 000) : TestFlight › External Testing › créer un groupe, ajouter la
  version. Le premier envoi passe un court examen d'Apple (souvent < 24 h). Vous pouvez ensuite partager un **lien public**.
- Les testeurs installent l'app **TestFlight** depuis l'App Store, puis acceptent l'invitation.

## 8. Recueillir les bugs

- **Dans TestFlight** (le plus simple) : le testeur fait une **capture d'écran** dans GolfUs, touche **Partager les
  commentaires avec la bêta** et écrit ce qui ne va pas. Ou : app TestFlight › GolfUs › **Envoyer des commentaires bêta**.
  Tout arrive dans App Store Connect › TestFlight › **Feedback**, avec modèle d'iPhone et version d'iOS.
- Les **plantages** remontent automatiquement : App Store Connect › TestFlight › **Crashes** (et Xcode › Organizer › Crashes).
- Envoyez-moi le texte et les captures : je reproduis et corrige.

## 9. Liste de tests avant chaque envoi

À faire sur un vrai iPhone (mode clair **et** sombre, 4G et Wi-Fi) :

**Démarrage et recherche**
- [ ] L'intro s'affiche, barre d'état lisible ; « Continuer sans compte » ouvre la carte.
- [ ] Une seule demande de localisation, au nom de GolfUs ; la carte se centre sur vous, cercle de 25 km.
- [ ] Localisation refusée : message discret, saisie d'une ville possible.
- [ ] Changer date, horaire, trous, joueurs : la liste se met à jour seule, sans bouton.
- [ ] Les golfs complets disparaissent ; les autres restent avec « Disponibilité à vérifier ».

**Fiches et réservation**
- [ ] Fiche d'un golf : tarifs, horaires, retour par la flèche.
- [ ] « Réserver » et « Site web » ouvrent Safari intégré ; ✕ ramène dans l'app.
- [ ] « Itinéraire » ouvre Plans ou Google Maps ; « Appeler » propose l’appel.
- [ ] Partager une fiche : feuille de partage iOS, le lien ouvre https://golfus.ch/golf/….

**Compte**
- [ ] Créer un compte e-mail ; se déconnecter ; se reconnecter ; l'app reste connectée après fermeture.
- [ ] « Se connecter avec Apple » (nouveau compte puis compte existant).
- [ ] Télécharger mes données (fichier JSON dans Safari intégré).
- [ ] Supprimer le compte : retour à l'état déconnecté, reconnexion impossible.

**Amis et parties** (deux iPhones ou un iPhone + le site)
- [ ] Demande d'ami, acceptation ; organiser une partie et inviter.
- [ ] Notifications : bouton « Activer », puis invitation, réponse, annulation reçues ; toucher une notification
      ouvre « Mes parties ».
- [ ] Lien d'invitation reçu par Messages : ouvre l'app (Universal Link) si elle est installée.
- [ ] Signaler un avis et un joueur ; bloquer un joueur (il disparaît de la recherche) ; débloquer.
- [ ] Un prénom ou un avis injurieux est refusé avec un message clair.

**Divers**
- [ ] Rotation : l'app reste en portrait. Texte agrandi (Réglages › Luminosité › Taille du texte) : rien ne déborde.
- [ ] Mode avion : message d'erreur propre, pas d'écran blanc.
