"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { RoadInfo } from "./Results";

export interface Location {
  lat: number;
  lon: number;
  label: string;
}

export const postJson = (url: string, body: unknown, signal?: AbortSignal) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });

export function clampNum(v: unknown, min: number, max: number, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
}

export const originKeyOf = (l: Location | null) => (l ? `${l.lat.toFixed(4)},${l.lon.toFixed(4)}` : "");

/** Preferencias guardadas en este navegador (se leen tras hidratar para no desajustar el HTML del servidor). */
export function useStoredPrefs<T>(key: string, defaults: T, sanitize: (raw: Partial<T>) => T) {
  const [prefs, setPrefs] = useState<T>(defaults);
  const [loaded, setLoaded] = useState(false);
  const sanitizeRef = useRef(sanitize);
  useEffect(() => {
    try {
      setPrefs(sanitizeRef.current(JSON.parse(localStorage.getItem(key) ?? "{}")));
    } catch {
      /* sin almacenamiento o JSON roto: valores por defecto */
    }
    setLoaded(true);
  }, [key]);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(key, JSON.stringify(prefs));
    } catch {
      /* sin almacenamiento: no pasa nada */
    }
  }, [key, prefs, loaded]);
  const update = <K extends keyof T>(k: K, v: T[K]) => setPrefs((p) => ({ ...p, [k]: v }));
  return { prefs, update };
}

/** Hora actual, actualizada cada minuto (horarios de apertura y antigüedad de los datos). */
export function useNow(onTick?: () => void) {
  const [now, setNow] = useState(() => Date.now());
  const tickRef = useRef(onTick);
  useEffect(() => {
    tickRef.current = onTick;
  }, [onTick]);
  useEffect(() => {
    const tick = () => {
      setNow(Date.now());
      tickRef.current?.();
    };
    const id = setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  return now;
}

/**
 * Distancias reales por carretera (OSRM vía /api/routes) para los destinos indicados.
 * Pide solo los que faltan, nunca repite un destino para el mismo origen y, si el servicio falla,
 * deja de intentarlo para ese origen (la interfaz sigue con estimaciones).
 */
export function useRoadDistances(
  location: Location | null,
  targetIds: string[],
  coordsById: Map<string, { lat: number; lon: number }>,
  enabled: boolean,
) {
  const originKey = originKeyOf(location);
  const [roads, setRoads] = useState<{ origin: string; byId: Record<string, RoadInfo>; attempted: Set<string>; failed: boolean }>({
    origin: "",
    byId: {},
    attempted: new Set(),
    failed: false,
  });
  const inFlight = useRef(new Set<string>());

  const current = roads.origin === originKey ? roads : null;
  const roadById = useMemo(() => current?.byId ?? {}, [current]);
  const pending = enabled && !current?.failed && targetIds.some((id) => !current?.attempted.has(id));

  useEffect(() => {
    if (!location || !enabled) return;
    if (current?.failed) return;
    const missing = targetIds.filter(
      (id) => !current?.attempted.has(id) && !inFlight.current.has(`${originKey}|${id}`) && coordsById.has(id),
    );
    if (missing.length === 0) return;
    missing.forEach((id) => inFlight.current.add(`${originKey}|${id}`));
    const destinations = missing.map((id) => ({ id, ...coordsById.get(id)! }));
    const origin = { lat: Number(location.lat.toFixed(4)), lon: Number(location.lon.toFixed(4)) };

    const merge = (byId: Record<string, RoadInfo>, failed: boolean) =>
      setRoads((prev) => {
        const base = prev.origin === originKey ? prev : { origin: originKey, byId: {}, attempted: new Set<string>(), failed: false };
        const attempted = new Set(base.attempted);
        missing.forEach((id) => attempted.add(id));
        return { origin: originKey, byId: { ...base.byId, ...byId }, attempted, failed: base.failed || failed };
      });

    postJson("/api/routes", { origin, destinations })
      .then(async (res) => merge(((await res.json()) as { roads?: Record<string, RoadInfo> }).roads ?? {}, !res.ok))
      .catch(() => merge({}, true))
      .finally(() => missing.forEach((id) => inFlight.current.delete(`${originKey}|${id}`)));
  }, [targetIds, originKey, location, enabled, current, coordsById]);

  return { roadById, pending, failed: Boolean(current?.failed) };
}

/** Trazado de la ruta hasta el punto seleccionado, para dibujarlo en el mapa. */
export function useRouteGeometry(location: Location | null, target: { id: string; lat: number; lon: number } | null) {
  const [geom, setGeom] = useState<{ key: string; coordinates: [number, number][] } | null>(null);
  const key = location && target ? `${originKeyOf(location)}>${target.id}` : "";
  useEffect(() => {
    if (!location || !target) return;
    const ctrl = new AbortController();
    postJson("/api/route", { from: { lat: location.lat, lon: location.lon }, to: { lat: target.lat, lon: target.lon } }, ctrl.signal)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { coordinates: [number, number][] } | null) => {
        if (body) setGeom({ key: `${originKeyOf(location)}>${target.id}`, coordinates: body.coordinates });
      })
      .catch(() => {});
    return () => ctrl.abort();
    // target cambia de identidad en cada render: dependemos de su id y coordenadas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, target?.id, target?.lat, target?.lon]);
  return geom && geom.key === key ? geom.coordinates : null;
}

// ---------------------------------------------------------------------------

/** Paso 1 del formulario: ubicación por GPS o por dirección / código postal. */
export function LocationPicker({ location, onChange }: { location: Location | null; onChange: (l: Location) => void }) {
  const [query, setQuery] = useState("");
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function locateMe() {
    if (!("geolocation" in navigator)) {
      setError("Tu navegador no permite geolocalización. Escribe tu dirección o código postal.");
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        onChange({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          label: `Tu ubicación actual (±${Math.round(pos.coords.accuracy)} m)`,
        });
      },
      (err) => {
        setLocating(false);
        setError(
          err.code === err.PERMISSION_DENIED
            ? "No has dado permiso de ubicación. Escribe tu dirección o código postal."
            : "No hemos podido obtener tu ubicación. Escribe tu dirección o código postal.",
        );
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  }

  async function search(e: FormEvent) {
    e.preventDefault();
    if (query.trim().length < 3) return;
    setLocating(true);
    setError(null);
    try {
      const res = await postJson("/api/geocode", { q: query.trim() });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      onChange(body);
    } catch (err) {
      setError((err as Error).message || "No encontramos esa dirección.");
    } finally {
      setLocating(false);
    }
  }

  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-semibold">1. ¿Dónde estás?</legend>
      <button
        type="button"
        onClick={locateMe}
        disabled={locating}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-3 py-2.5 text-sm font-medium text-brand-ink disabled:opacity-60"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          <circle cx="12" cy="12" r="7" />
        </svg>
        {locating ? "Buscando…" : "Usar mi ubicación"}
      </button>
      <form onSubmit={search} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Dirección, municipio o código postal"
          aria-label="Dirección, municipio o código postal"
          className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 py-2 text-sm"
        />
        <button type="submit" disabled={locating} className="rounded-lg border border-line px-3 py-2 text-sm font-medium hover:bg-surface-2">
          Buscar
        </button>
      </form>
      {location && !error && <p className="text-xs text-ink-3">📍 {location.label}</p>}
      {error && <p className="text-xs text-not-worth">{error}</p>}
    </fieldset>
  );
}

/** Altura real de un elemento (la tarjeta flotante), para encuadrar el mapa por encima de ella. */
export function useElementHeight(initial: number) {
  const [height, setHeight] = useState(initial);
  const observer = useRef<ResizeObserver | null>(null);
  const ref = useMemo(
    () => (el: HTMLDivElement | null) => {
      observer.current?.disconnect();
      if (!el) return;
      observer.current = new ResizeObserver(([entry]) => setHeight(Math.round(entry.contentRect.height)));
      observer.current.observe(el);
    },
    [],
  );
  return [ref, height] as const;
}

export function MapAttribution() {
  return (
    <p className="-mt-2 text-right text-[10px] text-ink-3">
      Mapa:{" "}
      <a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer" className="hover:underline">
        OpenFreeMap
      </a>{" "}
      ©{" "}
      <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener noreferrer" className="hover:underline">
        OpenMapTiles
      </a>{" "}
      · Datos ©{" "}
      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="hover:underline">
        colaboradores de OpenStreetMap
      </a>{" "}
      · Rutas: OSRM
    </p>
  );
}
