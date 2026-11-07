export const isApple = () => /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document;

export const googleDirections = (lat: number, lon: number) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
export const appleDirections = (lat: number, lon: number, name?: string) =>
  `https://maps.apple.com/?daddr=${lat},${lon}${name ? `&q=${encodeURIComponent(name)}` : ''}`;

/** Lien d'itinéraire adapté à l'appareil (Plans sur iPhone/iPad, Google Maps ailleurs) */
export const directionsUrl = (lat: number, lon: number, name?: string) =>
  isApple() ? appleDirections(lat, lon, name) : googleDirections(lat, lon);

export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;

export const displayHost = (url: string) => {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url;
  }
};

/** Numéro au format international (+… ou 00…), en chiffres seuls ; null si le pays est inconnu. */
export function internationalDigits(phone: string | null | undefined) {
  if (!phone) return null;
  const p = phone.trim();
  if (!p.startsWith('+') && !p.startsWith('00')) return null;
  const digits = p.replace(/^00/, '').replace(/\D/g, '');
  return digits.length >= 8 ? digits : null;
}

// Préfixes des numéros mobiles (indicatif + premier chiffre) : seuls ceux-là ont de bonnes chances d'être sur WhatsApp
const MOBILE_PREFIXES = ['346', '347', '336', '337', '417', '447', '3519', '393', '491', '324', '3526'];

/** Numéro WhatsApp probable : international et mobile. Une ligne fixe de club n'est presque jamais sur WhatsApp. */
export function whatsappMobile(phone: string | null | undefined) {
  const d = internationalDigits(phone);
  return d && MOBILE_PREFIXES.some((p) => d.startsWith(p)) ? d : null;
}
