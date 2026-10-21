import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BackLink } from '../components/BackLink';
import { useI18n } from '../i18n';

function Page({ title, children }: { title: string; children: ReactNode }) {
  const { lang } = useI18n();
  return (
    <div className="min-h-0 flex-1 overflow-y-auto pt-[env(safe-area-inset-top)]">
      <div className="mx-auto w-[calc(100%-1.5rem)] max-w-2xl pt-2">
        <BackLink />
      </div>
      <article className="glass glass-rounded mx-auto mb-4 w-[calc(100%-1.5rem)] max-w-2xl space-y-4 p-5 pb-8 leading-relaxed sm:p-8 [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_a]:underline [&_li]:ml-5 [&_li]:list-disc">
        <h1 className="text-[28px] leading-tight">{title}</h1>
        {lang !== 'fr' && (
          <p lang="en" className="frost rounded-[20px] p-3 text-sm">
            This page is provided in French, which is the authoritative version. In short: your location is used only to
            find nearby golf courses; it is never stored or linked to you. Favourites stay on your device.
          </p>
        )}
        {children}
      </article>
    </div>
  );
}

export function LegalPage() {
  return (
    <Page title="Mentions légales">
      <h2>Éditeur du site</h2>
      <p>
        Sami Zerelli
        <br />
        3b avenue de Chamonix, 1207 Genève, Suisse
        <br />
        E-mail : <a href="mailto:sami.zerelli@gmail.com">sami.zerelli@gmail.com</a> — ou le formulaire de la page{' '}
        <Link to="/aide">Aide et contact</Link>.
        <br />
        Responsable de la publication : Sami Zerelli.
      </p>
      <h2>Hébergement</h2>
      <p>
        Netlify, Inc. —{' '}
        <a href="https://www.netlify.com" target="_blank" rel="noopener noreferrer">
          www.netlify.com
        </a>
        . Base de données : Netlify Database.
      </p>
      <h2>Sources des données</h2>
      <ul>
        <li>
          Golfs, adresses et horaires : © contributeurs{' '}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
            OpenStreetMap
          </a>
          , données sous licence ODbL.
        </li>
        <li>Fonds de carte : © OpenStreetMap. Recherche de lieux : Photon (Komoot) et Nominatim.</li>
        <li>Temps de trajet : OSRM (projet Open Source Routing Machine) ou OpenRouteService.</li>
        <li>Taux de change : taux de référence de la Banque centrale européenne via Frankfurter.</li>
        <li>Photos : Wikimedia Commons lorsque disponibles, sous leurs licences respectives.</li>
      </ul>
      <h2>Exactitude des informations</h2>
      <p>
        Les tarifs et horaires sont fournis à titre indicatif. Ils proviennent de sources ouvertes ou d’une saisie manuelle et
        peuvent être incomplets ou obsolètes. Aucune information manquante n’est inventée : elle est alors signalée « Non
        communiqué ». Confirmez toujours les tarifs, horaires et disponibilités directement auprès du golf avant de vous déplacer.
      </p>
      <p>
        Les golfs marqués « Démo » / « Données de démonstration » sont fictifs et servent uniquement à présenter l’application.
      </p>
      <h2>Avis des visiteurs</h2>
      <p>
        Les avis sont publiés sous la responsabilité de leurs auteurs. L’éditeur peut supprimer tout avis illicite, injurieux ou
        hors sujet.
      </p>
    </Page>
  );
}

export function TermsPage() {
  return (
    <Page title="Conditions d’utilisation">
      <p className="text-sm text-muted">En vigueur au 21 octobre 2026. Elles s’appliquent au site golfus.ch et à l’app GolfUs pour iPhone.</p>
      <h2>Le service</h2>
      <p>
        GolfUs aide à trouver des golfs, à comparer leurs tarifs publics et à organiser des parties entre amis. La réservation se
        fait toujours sur le site du golf ou d’une plateforme de réservation : GolfUs ne vend rien et n’encaisse aucun paiement.
        Les tarifs, horaires et disponibilités sont indicatifs ; confirmez-les auprès du golf.
      </p>
      <h2>Votre compte</h2>
      <p>
        Le compte est gratuit et personnel. Vous êtes responsable de ce que vous publiez avec lui. Vous pouvez supprimer votre
        compte et télécharger vos données à tout moment depuis Profil › Mes données.
      </p>
      <h2>Contenus publiés : tolérance zéro</h2>
      <p>
        Prénom, photo de profil, avis sur les golfs et messages d’invitation doivent rester respectueux. Sont interdits : insultes,
        propos haineux ou discriminatoires, harcèlement, menaces, contenus sexuels, violents ou illégaux, publicité et spam,
        usurpation d’identité. Aucun abus n’est toléré.
      </p>
      <ul>
        <li>Un filtre automatique refuse les termes injurieux les plus courants.</li>
        <li>
          Chaque avis, joueur ou invitation peut être signalé (bouton « Signaler »). Les signalements sont examinés sous 24 heures :
          le contenu est retiré et son auteur exclu s’il enfreint ces règles. Un avis signalé par plusieurs personnes est masqué en
          attendant cet examen.
        </li>
        <li>Vous pouvez bloquer un joueur : il ne peut plus vous demander en ami ni vous inviter, et vous ne vous voyez plus dans la recherche.</li>
      </ul>
      <h2>Responsabilité</h2>
      <p>
        GolfUs s’efforce de fournir des informations exactes mais ne garantit ni les prix, ni les horaires, ni les disponibilités
        publiés par les golfs et les plateformes. Les partenaires de réservation appliquent leurs propres conditions.
      </p>
      <h2>Contact</h2>
      <p>
        Pour toute question ou réclamation : <a href="mailto:sami.zerelli@gmail.com">sami.zerelli@gmail.com</a> ou la page{' '}
        <Link to="/aide">Aide et contact</Link>. Données personnelles :
        voir la <Link to="/confidentialite">politique de confidentialité</Link>.
      </p>
    </Page>
  );
}

export function PrivacyPage() {
  return (
    <Page title="Politique de confidentialité">
      <p className="text-sm text-muted">Mise à jour le 21 octobre 2026. S’applique au site golfus.ch et à l’app GolfUs pour iPhone.</p>
      <h2>En résumé</h2>
      <ul>
        <li>
          <strong>Votre position géographique n’est ni enregistrée ni partagée.</strong>
        </li>
        <li>Aucune publicité, aucun outil de mesure d’audience, aucun pistage.</li>
        <li>Sans compte, rien ne vous identifie : favoris et préférences restent sur votre appareil.</li>
        <li>Avec un compte, nous gardons seulement ce qu’il faut pour vos amis et vos parties ; vous pouvez tout télécharger ou tout supprimer à tout moment.</li>
      </ul>

      <h2>Géolocalisation</h2>
      <p>
        Pour trouver les golfs proches, le site (ou l’app) vous demande votre accord. La position sert uniquement pendant votre
        visite, en mémoire. Elle n’est jamais écrite sur disque, ni sur notre serveur, ni dans des journaux.
      </p>
      <p>Pour interroger les services cartographiques, notre serveur :</p>
      <ul>
        <li>
          envoie à OpenStreetMap (Overpass / Nominatim) uniquement le centre d’une <strong>maille d’environ 11 km</strong>, et
          non votre position exacte ;
        </li>
        <li>
          envoie à Nominatim une position <strong>arrondie à environ 1 km</strong>, uniquement pour afficher le nom de la
          ville où vous vous trouvez ;
        </li>
        <li>
          envoie au service d’itinéraire (OSRM ou OpenRouteService) une position <strong>arrondie à environ 1 km</strong>{' '}
          pour calculer les temps de trajet ;
        </li>
        <li>
          conserve en cache 24 heures les résultats par zone (liste des golfs, temps de trajet), sans aucun lien avec vous : ni
          adresse IP, ni identifiant, ni horodatage de votre visite.
        </li>
      </ul>
      <p>
        Ces requêtes sont faites par notre serveur : votre adresse IP n’est pas transmise à ces services. En revanche, le fond de
        carte est chargé directement depuis les serveurs de tuiles d’OpenStreetMap, qui voient donc votre adresse IP et la zone
        affichée (comme pour toute carte en ligne).
      </p>
      <h2>Position approximative (repli)</h2>
      <p>
        Si la géolocalisation échoue, vous pouvez choisir « Position approximative ». Notre serveur demande alors au service
        ipwho.is (ou GeoJS en secours) la ville correspondant à votre adresse IP. Le résultat n’est ni mis en cache ni enregistré.
      </p>
      <h2>Recherche de lieux et disponibilités</h2>
      <p>
        Le texte tapé dans la recherche est transmis, via notre serveur, au service Photon (Komoot). Pour afficher les départs
        libres, notre serveur interroge le moteur de réservation de certains golfs avec la date choisie seulement. Rien de tout
        cela n’est associé à votre identité.
      </p>

      <h2>Compte GolfUs (facultatif)</h2>
      <p>Si vous créez un compte, nous enregistrons :</p>
      <ul>
        <li>votre e-mail, votre prénom, votre mot de passe sous forme hachée (jamais en clair), et si vous le souhaitez une photo et votre index ;</li>
        <li>vos amis et demandes d’ami, les parties que vous organisez ou auxquelles vous répondez, vos notifications ;</li>
        <li>la date de votre dernière connexion, pour la sécurité du compte.</li>
      </ul>
      <p>
        Ces données servent uniquement au fonctionnement du service (amis, invitations, rappels). Votre prénom et votre photo sont
        visibles par vos amis et par les joueurs qui vous recherchent ; votre e-mail n’est jamais montré. Elles sont conservées
        jusqu’à la suppression du compte, qui efface tout immédiatement.
      </p>
      <h2>Se connecter avec Apple</h2>
      <p>
        Avec « Se connecter avec Apple », Apple nous transmet un identifiant propre à GolfUs, votre e-mail (éventuellement une
        adresse relais Apple que vous pouvez désactiver) et, la première fois, votre prénom. Lorsque ce service est configuré, la
        suppression du compte révoque aussi l’accès auprès d’Apple.
      </p>
      <h2>Notifications sur iPhone</h2>
      <p>
        Si vous les activez, l’app enregistre l’identifiant de notification de votre iPhone fourni par Apple. Il sert uniquement à
        vous prévenir des invitations, des réponses, des annulations et de la veille d’une partie. Il est supprimé à la
        déconnexion, à la suppression du compte, ou quand Apple le déclare invalide. Le contenu des notifications transite par le
        service de notifications d’Apple.
      </p>
      <h2>Avis, signalements et blocages</h2>
      <p>
        Un avis publie le pseudo, la note et le commentaire saisis ; aucune adresse IP n’est conservée. Quand vous signalez un
        contenu, nous enregistrons le motif, votre éventuelle précision et, si vous êtes connecté, votre compte, pour traiter le
        signalement. La liste des joueurs que vous bloquez est enregistrée avec votre compte et supprimée avec lui.
      </p>
      <h2>Stockage sur votre appareil</h2>
      <p>
        Le site enregistre dans votre navigateur (<em>localStorage</em>) vos favoris, la langue, la devise et le thème. Sur le
        site, la connexion utilise un cookie de session strictement nécessaire. Dans l’app iPhone, la connexion est gardée dans le
        trousseau sécurisé d’iOS.
      </p>

      <h2>Hébergement et sous-traitants</h2>
      <ul>
        <li>Netlify, Inc. (hébergement du site, du serveur et de la base de données).</li>
        <li>Apple (notifications sur iPhone, « Se connecter avec Apple »), seulement si vous utilisez ces fonctions.</li>
        <li>Services cartographiques cités plus haut, sans donnée vous identifiant.</li>
      </ul>
      <p>Aucune donnée n’est vendue ni utilisée à des fins publicitaires.</p>

      <h2>Vos droits</h2>
      <p>
        Conformément au RGPD et à la loi suisse sur la protection des données, vous disposez d’un droit d’accès, de rectification,
        d’effacement et de portabilité. Depuis Profil › Mes données, vous pouvez télécharger toutes vos données ou supprimer votre
        compte, sans nous écrire. Pour toute autre demande : écrivez à <a href="mailto:sami.zerelli@gmail.com">sami.zerelli@gmail.com</a> (responsable du
        traitement : Sami Zerelli, 3b avenue de Chamonix, 1207 Genève, Suisse) ou utilisez le formulaire de la page{' '}
        <Link to="/aide">Aide et contact</Link>.
        Vous pouvez aussi saisir l’autorité de protection des données de votre pays (CNIL en France, PFPDT en Suisse).
      </p>
    </Page>
  );
}
