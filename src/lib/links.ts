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
