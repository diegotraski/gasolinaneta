import { haversineKm, isInSpainBounds } from "@/lib/geo";
import { roadDistances } from "@/lib/routing";

const MAX_DESTINATIONS = 100;
const MAX_KM_FROM_ORIGIN = 60;

const isPoint = (p: unknown): p is { lat: number; lon: number } =>
  typeof p === "object" &&
  p !== null &&
  Number.isFinite((p as { lat: unknown }).lat) &&
  Number.isFinite((p as { lon: unknown }).lon) &&
  isInSpainBounds((p as { lat: number }).lat, (p as { lon: number }).lon);

/** POST { origin: {lat, lon}, destinations: [{id, lat, lon}] } → { roads: { [id]: { km, min } } } */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { origin?: unknown; destinations?: unknown };
  const { origin, destinations } = body;
  if (!isPoint(origin) || !Array.isArray(destinations) || destinations.length > MAX_DESTINATIONS) {
    return Response.json({ error: "Petición no válida." }, { status: 400 });
  }
  // Solo gasolineras razonablemente cerca: este endpoint no es un servicio de rutas genérico.
  const valid = destinations.filter(
    (d): d is { id: string; lat: number; lon: number } =>
      isPoint(d) &&
      typeof (d as unknown as { id: unknown }).id === "string" &&
      haversineKm(origin.lat, origin.lon, d.lat, d.lon) <= MAX_KM_FROM_ORIGIN,
  );
  try {
    return Response.json({ roads: await roadDistances(origin, valid) });
  } catch (err) {
    console.error("[api/routes]", err);
    // La interfaz sigue con distancias estimadas.
    return Response.json({ roads: {}, error: "Servicio de rutas no disponible." }, { status: 502 });
  }
}
