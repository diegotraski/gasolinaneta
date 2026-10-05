import { haversineKm, isInSpainBounds } from "@/lib/geo";
import { route } from "@/lib/routing";

const isPoint = (p: unknown): p is { lat: number; lon: number } =>
  typeof p === "object" &&
  p !== null &&
  Number.isFinite((p as { lat: unknown }).lat) &&
  Number.isFinite((p as { lon: unknown }).lon) &&
  isInSpainBounds((p as { lat: number }).lat, (p as { lon: number }).lon);

/** POST { from: {lat, lon}, to: {lat, lon} } → { km, min, coordinates } para dibujar la ruta en el mapa. */
export async function POST(request: Request) {
  const { from, to } = (await request.json().catch(() => ({}))) as { from?: unknown; to?: unknown };
  if (!isPoint(from) || !isPoint(to) || haversineKm(from.lat, from.lon, to.lat, to.lon) > 60) {
    return Response.json({ error: "Petición no válida." }, { status: 400 });
  }
  try {
    return Response.json(await route(from, to));
  } catch (err) {
    console.error("[api/route]", err);
    return Response.json({ error: "Servicio de rutas no disponible." }, { status: 502 });
  }
}
