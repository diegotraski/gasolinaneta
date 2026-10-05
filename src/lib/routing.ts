import "server-only";

/**
 * Distancias y rutas reales por carretera con OSRM.
 *
 * Por defecto usa el servidor público de demostración de OSRM, que vale para empezar pero no
 * para producción con tráfico: su política pide uso moderado (~1 petición/s). Para producción,
 * define OSRM_URL apuntando a una instancia propia (ver README). Si OSRM falla, la interfaz
 * sigue funcionando con distancias estimadas.
 */

const OSRM_URL = (process.env.OSRM_URL ?? "https://router.project-osrm.org").replace(/\/$/, "");
const IS_PUBLIC_DEMO = /router\.project-osrm\.org|routing\.openstreetmap\.de/.test(OSRM_URL);
const USER_AGENT = `GasolinaNeta/1.0 (${process.env.NEXT_PUBLIC_SITE_URL ?? "desarrollo local"})`;
const MAX_PER_TABLE = 90;

export interface RoadInfo {
  /** Distancia por carretera, solo ida, en km. */
  km: number;
  /** Duración estimada sin tráfico, en minutos. */
  min: number;
}

export interface LatLon {
  lat: number;
  lon: number;
}

// --- Caché en memoria con caducidad (las carreteras no cambian en un día) ---
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 50_000;
const cache = new Map<string, { value: RoadInfo; at: number }>();

const keyFor = (from: LatLon, to: LatLon) =>
  `${from.lat.toFixed(4)},${from.lon.toFixed(4)}>${to.lat.toFixed(5)},${to.lon.toFixed(5)}`;

function cacheGet(key: string): RoadInfo | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return hit.value;
}

function cacheSet(key: string, value: RoadInfo) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(key, { value, at: Date.now() });
}

// --- Respeto al servidor público: como mucho una petición por segundo desde este proceso ---
let queue: Promise<unknown> = Promise.resolve();
let lastCall = 0;
function throttled<T>(fn: () => Promise<T>): Promise<T> {
  if (!IS_PUBLIC_DEMO) return fn();
  const run = queue.then(async () => {
    const wait = 1000 - (Date.now() - lastCall);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    return fn();
  });
  queue = run.catch(() => undefined);
  return run;
}

async function osrm<T>(path: string): Promise<T> {
  const res = await throttled(() =>
    fetch(`${OSRM_URL}${path}`, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(10_000) }),
  );
  if (!res.ok) throw new Error(`OSRM ${res.status}`);
  const body = (await res.json()) as T & { code: string; message?: string };
  if (body.code !== "Ok") throw new Error(`OSRM ${body.code}: ${body.message ?? ""}`);
  return body;
}

const coord = (p: LatLon) => `${p.lon.toFixed(6)},${p.lat.toFixed(6)}`;

/** Distancia y tiempo por carretera desde `from` a cada destino. Los que fallen no aparecen en el resultado. */
export async function roadDistances(from: LatLon, destinations: (LatLon & { id: string })[]): Promise<Record<string, RoadInfo>> {
  const out: Record<string, RoadInfo> = {};
  const pending: (LatLon & { id: string })[] = [];
  for (const d of destinations) {
    const hit = cacheGet(keyFor(from, d));
    if (hit) out[d.id] = hit;
    else pending.push(d);
  }

  for (let i = 0; i < pending.length; i += MAX_PER_TABLE) {
    const chunk = pending.slice(i, i + MAX_PER_TABLE);
    const path =
      `/table/v1/driving/${[from, ...chunk].map(coord).join(";")}` + `?sources=0&annotations=distance,duration`;
    const body = await osrm<{ distances: (number | null)[][]; durations: (number | null)[][] }>(path);
    chunk.forEach((d, j) => {
      const meters = body.distances[0][j + 1];
      const seconds = body.durations[0][j + 1];
      if (meters === null || seconds === null) return;
      const info = { km: meters / 1000, min: seconds / 60 };
      cacheSet(keyFor(from, d), info);
      out[d.id] = info;
    });
  }
  return out;
}

export interface RouteGeometry extends RoadInfo {
  /** [lon, lat][] */
  coordinates: [number, number][];
}

const routeCache = new Map<string, { value: RouteGeometry; at: number }>();

/** Trazado completo de la ruta, para dibujarla en el mapa. */
export async function route(from: LatLon, to: LatLon): Promise<RouteGeometry> {
  const key = keyFor(from, to);
  const hit = routeCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  const body = await osrm<{ routes: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[] }>(
    `/route/v1/driving/${coord(from)};${coord(to)}?overview=full&geometries=geojson`,
  );
  const r = body.routes[0];
  const value = { km: r.distance / 1000, min: r.duration / 60, coordinates: r.geometry.coordinates };
  if (routeCache.size > 5000) routeCache.delete(routeCache.keys().next().value!);
  routeCache.set(key, { value, at: Date.now() });
  return value;
}
