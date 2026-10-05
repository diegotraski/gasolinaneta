import type { FuelId } from "./fuels";
import { haversineKm } from "./geo";
import { timeZoneForProvince } from "./hours";
import type { NearbyStation, Station } from "./types";

export const MAX_RADIUS_KM = 40;
export const MAX_RESULTS = 800;

export function findNearby(
  stations: Station[],
  lat: number,
  lon: number,
  fuel: FuelId,
  radiusKm: number,
): NearbyStation[] {
  // Filtro barato por caja antes del cálculo exacto (1º de latitud ≈ 111 km).
  const dLat = radiusKm / 111;
  const dLon = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  const out: NearbyStation[] = [];
  for (const s of stations) {
    const price = s.prices[fuel];
    if (price === undefined) continue;
    if (Math.abs(s.lat - lat) > dLat || Math.abs(s.lon - lon) > dLon) continue;
    const straightKm = haversineKm(lat, lon, s.lat, s.lon);
    if (straightKm > radiusKm) continue;
    out.push({
      id: s.id,
      brand: s.brand,
      address: s.address,
      town: s.town,
      lat: s.lat,
      lon: s.lon,
      hours: s.hours,
      timeZone: timeZoneForProvince(s.province),
      price,
      straightKm,
    });
  }
  return out.sort((a, b) => a.straightKm - b.straightKm).slice(0, MAX_RESULTS);
}

/** Centro aproximado de un código postal a partir de las gasolineras que hay en él. Evita depender de un geocodificador para el caso más común. */
export function postalCodeCentroid(stations: Station[], postalCode: string): { lat: number; lon: number; label: string } | null {
  const inCp = stations.filter((s) => s.postalCode === postalCode);
  if (inCp.length === 0) return null;
  const lat = inCp.reduce((sum, s) => sum + s.lat, 0) / inCp.length;
  const lon = inCp.reduce((sum, s) => sum + s.lon, 0) / inCp.length;
  return { lat, lon, label: `${postalCode} ${inCp[0].town}` };
}
