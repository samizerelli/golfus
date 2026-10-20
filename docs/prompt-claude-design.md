# Prompt pour refaire le design de GolfUs avec Claude Design

À coller tel quel dans Claude Design (claude.ai/design). Si Claude Design propose d'importer un dépôt de code,
donne-lui https://github.com/samizerelli/golfus pour qu'il parte des vrais écrans.

---

Refais entièrement le design de **GolfUs**, une web app mobile d'abord (React + Tailwind CSS v4), en gardant
toutes les fonctionnalités existantes. Code source : https://github.com/samizerelli/golfus — site en ligne :
https://golfus-app.netlify.app

## Le produit
GolfUs sert à **organiser une partie de golf entre amis** en moins d'une minute :
1. je lance une partie (« New game ») ;
2. je choisis où et quand jouer ;
3. je choisis un golf dans la liste (synchronisée avec une carte) ;
4. j'invite mes amis ; ils répondent en un geste : **Rejoindre / Peut-être / Décliner**.

Public : golfeurs amateurs de 25 à 65 ans, souvent en vacances (Costa del Sol, France…), sur téléphone.
Ton : chaleureux, sportif, premium mais pas guindé. Langues : français (principale), anglais, espagnol —
prévoir des libellés 30 % plus longs.

## Identité actuelle (à faire évoluer, pas à jeter)
- Nom : Golf**Us** (« Us » en or).
- Couleurs : vert fairway profond `#1f5d4a`, or `#e8c76a`, bleu glacier `#7fb6e6`, fond clair `#f5f9fc`,
  fond sombre `#0f1923`.
- Police : Inter.
- Style actuel : « Liquid Glass » (verre dépoli, flou, reflets) au-dessus d'une carte plein écran.
- Écran d'intro : fond vert foncé rayé comme une tonte de green, une balle de golf blanche où il est écrit
  « I wanna play » ; toucher la balle mène à l'inscription (1re visite) ou à la connexion.

Je veux un design **plus affirmé et plus lisible** : hiérarchie claire, un seul bouton principal par écran,
moins d'effets de verre empilés, de vrais contrastes (WCAG AA), des cibles tactiles de 44 px minimum.

## Écrans à dessiner (mobile 390 px + ordinateur 1440 px, thème clair ET sombre)
1. **Intro** « I wanna play » (balle de golf cliquable).
2. **Connexion / Création de compte** (e-mail + mot de passe ; boutons Google / Apple optionnels).
3. **Accueil** : « Bonjour Prénom ! », gros bouton **New game**, puis « Parties en cours » : cartes de parties
   (golf, date, créneau, organisateur, « 2/4 partants », pastilles des réponses de chaque ami, boutons
   Rejoindre / ? / Décliner ; pour l'organisateur : « Partager le lien »).
4. **Où et quand jouer ?** : lieu (recherche + bouton « ma position »), rayon, date, plage horaire (curseur à
   2 poignées 06:00–21:00), 9/18 trous, note minimale (étoiles), nombre de joueurs (1 à 8+),
   bouton « Rechercher des golfs » toujours visible en bas.
5. **Résultats** : « 38 golfs correspondent », puces des critères (cliquables pour revenir modifier),
   interrupteur « Masquer les golfs sans info », liste de cartes (photo ou illustration, nom, distance,
   temps de route, trous, note, horaires du jour, prix par personne OU « Tarif à confirmer » + Appeler),
   carte avec marqueurs-pastilles de prix et grappes. Survol d'une carte = marqueur mis en évidence.
6. **Inviter des amis** : rappel du golf (prix par personne, total pour le groupe, note, Réserver,
   Itinéraire, fiche), liste d'amis à cocher, option « Inviter quelqu'un hors de l'app » (lien à partager),
   message pré-rempli modifiable, bouton « Envoyer l'invitation » ; écran de confirmation avec partage
   WhatsApp / SMS / copier le lien.
7. **Lien d'invitation reçu** (ouvert depuis WhatsApp, sans compte) : « Alice vous invite », golf, date,
   heure, joueurs, message, Itinéraire ; champ prénom ; énorme bouton **Rejoindre**, puis Peut-être /
   Décliner ; confirmation « Vous avez rejoint la partie ! » + « Changer ma réponse ».
8. **Fiche golf** : photo, nom, adresse, statut ouvert/fermé, « Organiser une partie ici », Réserver,
   Itinéraire, Appeler, Site web, tarifs (avec « Tarif indicatif relevé le … »), horaires de la semaine,
   parcours, services, coordonnées, avis.
9. **Menu d'actions** : barre verticale à droite sur ordinateur, pilule en bas sur mobile — Compte, Favoris,
   Mes parties, Amis (ajout par prénom/e-mail, demandes reçues), Notifications (pastille rouge), Réglages
   (langue, devise EUR/CHF/USD/GBP, thème). Chaque entrée ouvre un panneau.
10. **Admin** (sobre, dense, ordinateur seulement) : utilisateurs, golfs, validation des tarifs relevés
    sur les sites officiels (tableau à cases à cocher).

## Contraintes à respecter absolument
- **Ne jamais inventer de données** : quand un prix, un horaire, une note ou un nombre de trous est inconnu,
  l'interface affiche « Non communiqué » / « Tarif à confirmer » avec un bouton Appeler. Prévois ces états
  vides partout, ils sont fréquents (la majorité des golfs n'a ni prix ni horaires).
- Beaucoup de golfs n'ont **pas de photo** : dessine une illustration de remplacement élégante (pas une
  image cassée).
- La carte reste visible en fond sur les écrans 3 à 6 ; sur mobile, le contenu est dans un tiroir à
  3 hauteurs (réduit / moitié / plein écran) qu'on fait glisser.
- Données de carte © OpenStreetMap : l'attribution doit rester visible.
- Pas de nouvelles fonctionnalités : uniquement le design et l'ergonomie.

## Ce que j'attends
1. Une direction visuelle (2 pistes au choix, puis on affine celle que je préfère).
2. Un mini design system : couleurs (clair/sombre), typographie, espacements, rayons, ombres, boutons
   (principal / secondaire / fantôme / danger), champs, cartes, pastilles de statut (Partant, Peut-être,
   Absent, En attente), tiroir, menu.
3. Les 10 écrans ci-dessus en mobile et ordinateur, clair et sombre, avec les états vides, de chargement
   et d'erreur.
4. Un prototype cliquable du parcours principal : Accueil → New game → Résultats → Inviter → Envoyé,
   et du parcours invité : lien WhatsApp → Rejoindre → Confirmation.
5. À la fin, un export que Claude Code pourra implémenter dans le code existant (Tailwind v4, composants
   React), avec les jetons de design sous forme de variables CSS.
