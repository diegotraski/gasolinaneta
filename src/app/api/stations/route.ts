import { isFuelId } from "@/lib/fuels";
import { isInSpainBounds } from "@/lib/geo";
import { findNearby, MAX_RADIUS_KM } from "@/lib/nearby";
import { getSnapshot } from "@/lib/store";

export const maxDuration = 120;

/** POST para que la ubicación del usuario no quede en logs de URLs ni en cachés intermedias. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const lat = Number(body.lat);
  const lon = Number(body.lon);
  const fuel = body.fuel;
  const radius = Math.min(Math.max(Number(body.radius) || 15, 1), MAX_RADIUS_KM);

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !isInSpainBounds(lat, lon)) {
    return Response.json({ error: "Ubicación fuera de España o no válida." }, { status: 400 });
  }
  if (!isFuelId(fuel)) return Response.json({ error: "Combustible no válido." }, { status: 400 });

  try {
    const snapshot = await getSnapshot();
    return Response.json({
      ministryDate: snapshot.ministryDate,
      fetchedAt: snapshot.fetchedAt,
      stations: findNearby(snapshot.stations, lat, lon, fuel, radius),
    });
  } catch (err) {
    console.error("[api/stations]", err);
    return Response.json({ error: "No hemos podido cargar los precios. Inténtalo en unos minutos." }, { status: 503 });
  }
}
