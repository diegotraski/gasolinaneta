import { isInSpainBounds } from "@/lib/geo";
import { postalCodeCentroid } from "@/lib/nearby";
import { getSnapshot } from "@/lib/store";

/**
 * Convierte una dirección o código postal en coordenadas con Nominatim (OpenStreetMap).
 * Su política de uso exige un User-Agent identificable, máximo ~1 petición/s y nada de
 * autocompletado: solo geocodificamos al pulsar "Buscar", y cacheamos las respuestas.
 * Si Nominatim falla con un código postal, usamos el centro de las gasolineras de ese CP.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { q?: unknown };
  const query = typeof body.q === "string" ? body.q.trim() : "";
  if (query.length < 3 || query.length > 200) {
    return Response.json({ error: "Escribe una dirección, municipio o código postal." }, { status: 400 });
  }
  const isPostalCode = /^\d{5}$/.test(query);

  try {
    const hit = await nominatim(query, isPostalCode);
    if (hit) return Response.json(hit);
  } catch (err) {
    console.error("[api/geocode]", err);
    if (!isPostalCode) {
      return Response.json({ error: "El buscador de direcciones no responde. Prueba con tu código postal." }, { status: 502 });
    }
  }

  if (isPostalCode) {
    const snapshot = await getSnapshot().catch(() => null);
    const hit = snapshot && postalCodeCentroid(snapshot.stations, query);
    if (hit) return Response.json(hit);
  }
  return Response.json({ error: "No encontramos esa ubicación en España." }, { status: 404 });
}

async function nominatim(query: string, isPostalCode: boolean) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set(isPostalCode ? "postalcode" : "q", query);
  url.searchParams.set("countrycodes", "es");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("accept-language", "es");

  const res = await fetch(url, {
    headers: { "User-Agent": `GasolinaNeta/1.0 (${process.env.NEXT_PUBLIC_SITE_URL ?? "desarrollo local"})` },
    signal: AbortSignal.timeout(8000),
    next: { revalidate: 60 * 60 * 24 * 7 },
  });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const [hit] = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  const lat = Number(hit?.lat);
  const lon = Number(hit?.lon);
  if (!hit || !isInSpainBounds(lat, lon)) return null;
  return { lat, lon, label: hit.display_name.split(",").slice(0, 3).join(",") };
}
