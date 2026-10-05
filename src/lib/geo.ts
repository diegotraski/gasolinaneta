const EARTH_RADIUS_KM = 6371;

/** Distancia en línea recta (círculo máximo) entre dos puntos, en km. */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

/** España peninsular, Baleares, Canarias, Ceuta y Melilla caben holgadamente en esta caja. */
export function isInSpainBounds(lat: number, lon: number): boolean {
  return lat >= 27 && lat <= 44.5 && lon >= -18.5 && lon <= 4.6;
}
