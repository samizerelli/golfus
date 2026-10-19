import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';

function Page({ title, children }: { title: string; children: ReactNode }) {
  const { lang } = useI18n();
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <article className="glass glass-rounded mx-auto my-4 w-[calc(100%-1.5rem)] max-w-2xl space-y-4 p-5 pb-8 leading-relaxed sm:p-8 [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_a]:underline [&_li]:ml-5 [&_li]:list-disc">
        <h1 className="text-[28px] leading-tight">{title}</h1>
        {lang !== 'fr' && (
          <p lang="en" className="frost rounded-[20px] p-3 text-sm">
            This page is provided in French, which is the authoritative version. In short: your location is used only to
            find nearby golf courses; it is never stored or linked to you. Favourites stay on your device.
          </p>
        )}
        {children}
        <p className="pt-4">
          <Link to="/">← Golf Finder</Link>
        </p>
      </article>
    </div>
  );
}

export function LegalPage() {
  return (
    <Page title="Mentions légales">
      <h2>Éditeur du site</h2>
      <p>
        [Nom ou raison sociale de l’éditeur] — [adresse postale] — [adresse e-mail de contact].
        <br />
        Directeur de la publication : [nom].
      </p>
      <p className="text-sm text-muted">
        À compléter avant toute mise en ligne publique (obligatoire en France : loi n° 2004-575 du 21 juin 2004, art. 6).
      </p>
      <h2>Hébergement</h2>
      <p>[Nom de l’hébergeur] — [adresse] — [téléphone ou site web].</p>
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

export function PrivacyPage() {
  return (
    <Page title="Politique de confidentialité">
      <h2>En résumé</h2>
      <ul>
        <li>
          <strong>Votre position géographique n’est ni enregistrée ni partagée.</strong>
        </li>
        <li>Aucun compte, aucun cookie publicitaire ni outil de mesure d’audience.</li>
        <li>Vos favoris et préférences restent dans votre navigateur.</li>
      </ul>
      <h2>Géolocalisation</h2>
      <p>
        Lorsque vous touchez « Me localiser », votre navigateur vous demande votre accord. Si vous acceptez, la position est
        utilisée uniquement pendant votre visite, en mémoire, pour trouver les golfs proches. Elle n’est jamais écrite sur
        disque, ni dans votre navigateur, ni sur notre serveur, ni dans des journaux.
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
        Ces requêtes sont faites par notre serveur : votre adresse IP n’est pas transmise à ces services. En revanche, l’affichage
        du fond de carte est chargé directement par votre navigateur depuis les serveurs de tuiles d’OpenStreetMap, qui voient
        donc votre adresse IP et la zone de carte affichée (comme pour toute carte en ligne).
      </p>
      <h2>Position approximative (repli)</h2>
      <p>
        Si la géolocalisation échoue, vous pouvez choisir « Position approximative ». Notre serveur demande alors au service
        ipwho.is (ou GeoJS en secours) la ville correspondant à votre adresse IP. Cette demande n’a lieu que si vous cliquez sur
        ce bouton ; le résultat (ville, coordonnées arrondies à environ 1 km) n’est ni mis en cache ni enregistré.
      </p>
      <h2>Recherche de lieux</h2>
      <p>
        Le texte que vous tapez dans la recherche est transmis, via notre serveur, au service Photon (Komoot) pour proposer des
        lieux. Il n’est pas associé à votre identité.
      </p>
      <h2>Stockage local (navigateur)</h2>
      <p>
        Le site enregistre dans le <em>localStorage</em> de votre navigateur : vos favoris, la langue, la devise et le thème. Ces
        données ne quittent pas votre appareil ; vous pouvez les effacer à tout moment depuis les réglages du navigateur.
      </p>
      <h2>Avis</h2>
      <p>
        Si vous publiez un avis, le pseudo, la note et le commentaire que vous saisissez sont enregistrés et rendus publics.
        Aucune adresse IP n’est conservée. Pour faire supprimer un avis, contactez l’éditeur (voir les mentions légales).
      </p>
      <h2>Administration</h2>
      <p>
        L’espace d’administration utilise un cookie technique de session (strictement nécessaire), réservé à l’exploitant du
        site.
      </p>
      <h2>Vos droits</h2>
      <p>
        Conformément au RGPD, vous disposez d’un droit d’accès, de rectification et d’effacement. Comme nous ne conservons pas de
        données vous identifiant (hors avis publiés), ces droits s’exercent principalement sur les avis. Contact : [adresse
        e-mail de l’éditeur]. Vous pouvez aussi saisir la CNIL (www.cnil.fr).
      </p>
    </Page>
  );
}
