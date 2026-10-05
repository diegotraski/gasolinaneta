import { haversineKm, isInSpainBounds } from "@/lib/geo";
import { timeZoneForProvince } from "@/lib/hours";
import type { NearbyEvSite } from "@/lib/ev/types";
import { getEvSnapshot } from "@/lib/store";

export const maxDuration = 120;

const MAX_RADIUS_KM = 40;
const MAX_RESULTS = 800;

/** POST { lat, lon, radius } → puntos de recarga del NAP en ese radio. Los filtros y cálculos se hacen en el navegador. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const lat = Number(body.lat);
  const lon = Number(body.lon);
  const radius = Math.min(Math.max(Number(body.radius) || 15, 1), MAX_RADIUS_KM);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !isInSpainBounds(lat, lon)) {
    return Response.json({ error: "Ubicación fuera de España o no válida." }, { status: 400 });
  }

  try {
    const snapshot = await getEvSnapshot();
    const dLat = radius / 111;
    const dLon = radius / (111 * Math.cos((lat * Math.PI) / 180));
    const sites: NearbyEvSite[] = [];
    for (const s of snapshot.items) {
      if (Math.abs(s.lat - lat) > dLat || Math.abs(s.lon - lon) > dLon) continue;
      const straightKm = haversineKm(lat, lon, s.lat, s.lon);
      if (straightKm <= radius) sites.push({ ...s, straightKm, timeZone: timeZoneForProvince(s.province) });
    }
    sites.sort((a, b) => a.straightKm - b.straightKm);
    return Response.json({
      sourceDate: snapshot.sourceDate,
      fetchedAt: snapshot.fetchedAt,
      sites: sites.slice(0, MAX_RESULTS),
    });
  } catch (err) {
    console.error("[api/ev/stations]", err);
    return Response.json({ error: "No hemos podido cargar los puntos de recarga. Inténtalo en unos minutos." }, { status: 503 });
  }
}
