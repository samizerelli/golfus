export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Arrondit une coordonnée (2 décimales ≈ 1 km) */
export const round = (v: number, decimals: number) => Math.round(v * 10 ** decimals) / 10 ** decimals;

export function isLat(v: number) {
  return Number.isFinite(v) && v >= -90 && v <= 90;
}
export function isLon(v: number) {
  return Number.isFinite(v) && v >= -180 && v <= 180;
}
