"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { trackEvent } from "@/lib/analytics";
import { CONSUMPTION_PRESETS, FUEL_IDS, FUELS, isFuelId, type FuelId } from "@/lib/fuels";
import { minuteOfWeek, openStateAt, parseHours, type OpenState } from "@/lib/hours";
import { computeNetSavings, verdictFor, type TripMode } from "@/lib/netSavings";
import type { NearbyStation } from "@/lib/types";
import { FreshnessBar, Legend, StationCard, StationRow, Summary } from "./Results";
import {
  clampNum,
  MapAttribution,
  originKeyOf,
  postJson,
  useElementHeight,
  useNow,
  useRoadDistances,
  useRouteGeometry,
  useStoredPrefs,
  type Location,
} from "./shared";
import type { MapItem } from "./StationMap";

// MapLibre necesita `window` y WebGL: el mapa solo se renderiza en el cliente.
export const StationMap = dynamic(() => import("./StationMap"), {
  ssr: false,
  loading: () => <div className="gn-shimmer absolute inset-0" />,
});

interface Prefs {
  fuel: FuelId;
  liters: number;
  consumption: number;
  mode: TripMode;
  radius: number;
  onlyOpen: boolean;
}

interface StationsData {
  key: string;
  stations: NearbyStation[];
  ministryDate: string;
  /** Cuándo descargó nuestro servidor los precios del Ministerio (ISO). */
  fetchedAt: string;
  /** Cuándo los recibió este navegador (ms). */
  receivedAt: number;
}

const DEFAULT_PREFS: Prefs = { fuel: "g95", liters: 40, consumption: 6, mode: "dedicated", radius: 15, onlyOpen: true };
const LIST_PAGE = 15;
/** Con la pestaña abierta, volvemos a pedir precios cada 10 minutos. */
const AUTO_REFRESH_MS = 10 * 60 * 1000;
/** Si el servidor nos da datos de más de 30 min, ya está descargando unos nuevos: volvemos a preguntar enseguida. */
const SERVER_STALE_MS = 30 * 60 * 1000;
const RETRY_FRESH_AFTER_MS = 20 * 1000;
const MAX_PINS = 12;

const sanitizePrefs = (s: Partial<Prefs>): Prefs => ({
  fuel: isFuelId(s.fuel) ? s.fuel : DEFAULT_PREFS.fuel,
  liters: clampNum(s.liters, 5, 150, DEFAULT_PREFS.liters),
  consumption: clampNum(s.consumption, 2, 30, DEFAULT_PREFS.consumption),
  mode: s.mode === "onTheWay" ? "onTheWay" : "dedicated",
  radius: clampNum(s.radius, 3, 40, DEFAULT_PREFS.radius),
  onlyOpen: s.onlyOpen !== false,
});

export function Calculator({ location, locationPicker }: { location: Location | null; locationPicker: ReactNode }) {
  const { prefs, update } = useStoredPrefs("gn-prefs-v1", DEFAULT_PREFS, sanitizePrefs);
  const originKey = originKeyOf(location);

  const [data, setData] = useState<StationsData | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  // Referencia y selección pertenecen a una ubicación: al cambiarla, se ignoran solas.
  const [reference, setReference] = useState<{ origin: string; id: string } | null>(null);
  const [selected, setSelected] = useState<{ origin: string; id: string } | null>(null);
  const referenceId = reference?.origin === originKey ? reference.id : undefined;
  const selectedId = selected?.origin === originKey ? selected.id : null;
  const [visible, setVisible] = useState(LIST_PAGE);
  const [cardRef, cardHeight] = useElementHeight(150);

  // ---------- Precios ----------
  const requestKey = location ? `${originKey},${prefs.fuel},${prefs.radius}` : null;
  // Mientras llega la consulta nueva seguimos mostrando la anterior (con barra de carga), sin parpadeos.
  const stations = useMemo(() => data?.stations ?? [], [data]);
  const fetchError = failure && failure.key === requestKey ? failure.message : null;
  const loading = requestKey !== null && data?.key !== requestKey && !fetchError;
  const retriedFresh = useRef("");

  useEffect(() => {
    if (!location || !requestKey) return;
    const ctrl = new AbortController();
    // Pausa breve para no disparar una petición por cada paso del deslizador.
    const timer = setTimeout(
      () =>
        postJson(
          "/api/stations",
          // ~10 m de precisión: la ubicación no se guarda, solo se usa para medir distancias.
          { lat: Number(location.lat.toFixed(4)), lon: Number(location.lon.toFixed(4)), fuel: prefs.fuel, radius: prefs.radius },
          ctrl.signal,
        )
          .then(async (res) => {
            const body = await res.json();
            if (!res.ok) throw new Error(body.error ?? "Error al cargar los precios");
            setData((prev) => {
              if (prev?.key !== requestKey) setVisible(LIST_PAGE);
              return { key: requestKey, ...body, receivedAt: Date.now() };
            });
            const age = Date.now() - new Date(body.fetchedAt).getTime();
            if (age > SERVER_STALE_MS && retriedFresh.current !== `${requestKey}@${body.fetchedAt}`) {
              retriedFresh.current = `${requestKey}@${body.fetchedAt}`;
              setTimeout(() => setRefreshTick((t) => t + 1), RETRY_FRESH_AFTER_MS);
            }
          })
          .catch((err: Error) => {
            if (err.name !== "AbortError") setFailure({ key: requestKey, message: err.message });
          }),
      250,
    );
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [location, requestKey, prefs.fuel, prefs.radius, refreshTick]);

  // Reloj: horarios y antigüedad cada minuto; con la pestaña a la vista, precios nuevos cada 10 min.
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);
  const now = useNow(
    useCallback(() => {
      const d = dataRef.current;
      if (document.visibilityState === "visible" && d && Date.now() - d.receivedAt > AUTO_REFRESH_MS) {
        setRefreshTick((t) => t + 1);
      }
    }, []),
  );

  // ---------- Horarios ----------
  const openStates = useMemo(() => {
    const minuteByTz = new Map<string, number>();
    const out = new Map<string, OpenState>();
    for (const s of stations) {
      if (!minuteByTz.has(s.timeZone)) minuteByTz.set(s.timeZone, minuteOfWeek(new Date(now), s.timeZone));
      out.set(s.id, openStateAt(parseHours(s.hours), minuteByTz.get(s.timeZone)!));
    }
    return out;
  }, [stations, now]);

  const eligible = useMemo(
    () => (prefs.onlyOpen ? stations.filter((s) => openStates.get(s.id)?.status !== "closed") : stations),
    [stations, openStates, prefs.onlyOpen],
  );
  const hiddenClosed = stations.length - eligible.length;
  const stationById = useMemo(() => new Map(stations.map((s) => [s.id, s])), [stations]);

  // ---------- Cálculo (primero con estimaciones; se recalcula al llegar las rutas reales) ----------
  const [routeTargets, setRouteTargets] = useState<string[]>([]);
  const { roadById, pending: routingPending, failed: routingFailed } = useRoadDistances(
    location,
    routeTargets,
    stationById,
    prefs.mode === "dedicated",
  );

  const result = useMemo(
    () =>
      computeNetSavings(
        eligible.map((s) => ({ id: s.id, price: s.price, straightKm: s.straightKm, roadKm: roadById[s.id]?.km })),
        { liters: prefs.liters, consumptionL100: prefs.consumption, mode: prefs.mode, referenceId },
      ),
    [eligible, roadById, prefs.liters, prefs.consumption, prefs.mode, referenceId],
  );
  const rowsById = useMemo(() => new Map(result?.ranked.map((r) => [r.id, r]) ?? []), [result]);

  // Pedimos ruta real para las que pueden decidir el resultado: las más cercanas (la referencia sale de ahí),
  // las mejores por ahorro y las más baratas. Si el orden cambia, se piden las nuevas candidatas.
  const targetsKey = useMemo(() => {
    if (!result) return "";
    const nearest = [...eligible].sort((a, b) => a.straightKm - b.straightKm).slice(0, 8).map((s) => s.id);
    const top = result.ranked.slice(0, 25).map((r) => r.id);
    const cheapest = [...result.ranked].sort((a, b) => a.price - b.price).slice(0, 6).map((r) => r.id);
    return [...new Set([...nearest, ...top, ...cheapest, ...(selectedId ? [selectedId] : [])])].join(",");
  }, [result, eligible, selectedId]);
  useEffect(() => {
    // Solo actualizamos la lista cuando cambian los ids, no en cada render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRouteTargets(targetsKey ? targetsKey.split(",") : []);
  }, [targetsKey]);

  const selectedStation = selectedId ? (stationById.get(selectedId) ?? null) : null;
  const route = useRouteGeometry(location, selectedStation);

  // ---------- Métrica clave: ¿con qué frecuencia la más barata no es la que más ahorra? ----------
  const trackedKey = useRef("");
  useEffect(() => {
    if (!result || !requestKey || routingPending) return;
    if (trackedKey.current === requestKey) return;
    trackedKey.current = requestKey;
    trackEvent("Resultado", { difiere: result.cheapestIsNotBest ? "si" : "no", modo: prefs.mode });
  }, [result, requestKey, routingPending, prefs.mode]);

  const select = useCallback(
    (id: string) => {
      setSelected({ origin: originKey, id });
      const idx = result?.ranked.findIndex((r) => r.id === id) ?? -1;
      if (idx >= visible) setVisible(idx + 1);
    },
    [result, visible, originKey],
  );

  // ---------- Datos para el mapa ----------
  const cardId = selectedId && rowsById.has(selectedId) ? selectedId : (result?.best.id ?? null);
  const mapItems: MapItem[] = useMemo(
    () =>
      stations
        .filter((s) => rowsById.has(s.id) || openStates.get(s.id)?.status === "closed")
        .map((s) => {
          const row = rowsById.get(s.id);
          return {
            id: s.id,
            lat: s.lat,
            lon: s.lon,
            price: s.price,
            netSaving: row?.netSaving ?? 0,
            verdict: row ? verdictFor(row) : "notWorth",
            open: openStates.get(s.id)?.status ?? "unknown",
          };
        }),
    [stations, rowsById, openStates],
  );
  const pinnedIds = useMemo(() => {
    if (!result) return [];
    const ids = [result.best.id, result.cheapest.id, result.reference.id];
    for (const r of result.ranked) if (r.netSaving > 0) ids.push(r.id);
    return [...new Set(ids)].slice(0, MAX_PINS);
  }, [result]);

  const presetId = CONSUMPTION_PRESETS.find((p) => p.value === prefs.consumption)?.id ?? "custom";
  const cardRow = cardId ? rowsById.get(cardId) : undefined;
  const cardStation = cardId ? stationById.get(cardId) : undefined;

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      {/* ---------- Formulario ---------- */}
      <div className="h-fit space-y-5 rounded-2xl border border-line bg-surface p-5 lg:sticky lg:top-20">
        {locationPicker}

        <fieldset>
          <legend className="mb-2 text-sm font-semibold">2. Combustible</legend>
          <div className="grid grid-cols-2 gap-1.5">
            {FUEL_IDS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => update("fuel", id)}
                aria-pressed={prefs.fuel === id}
                className={`rounded-lg border px-2 py-2 text-sm ${
                  prefs.fuel === id ? "border-brand bg-brand-soft font-medium text-ink" : "border-line text-ink-2 hover:bg-surface-2"
                }`}
              >
                {FUELS[id].label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold">3. ¿Cuánto vas a repostar?</legend>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={5}
              max={150}
              value={prefs.liters}
              onChange={(e) => update("liters", clampNum(e.target.value, 1, 150, prefs.liters))}
              className="w-20 rounded-lg border border-line bg-bg px-3 py-2 text-sm tabular"
              aria-label="Litros a repostar"
            />
            <span className="text-sm text-ink-2">litros</span>
            <div className="ml-auto flex gap-1">
              {[20, 40, 60].map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => update("liters", l)}
                  className={`rounded-md border px-2 py-1 text-xs ${prefs.liters === l ? "border-brand bg-brand-soft" : "border-line hover:bg-surface-2"}`}
                >
                  {l} l
                </button>
              ))}
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold">4. Consumo de tu coche</legend>
          <select
            value={presetId}
            onChange={(e) => {
              const preset = CONSUMPTION_PRESETS.find((p) => p.id === e.target.value);
              if (preset) update("consumption", preset.value);
            }}
            className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm"
            aria-label="Tipo de coche"
          >
            {CONSUMPTION_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} (~{String(p.value).replace(".", ",")} l/100 km)
              </option>
            ))}
            <option value="custom">Mi consumo exacto…</option>
          </select>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              step={0.1}
              min={2}
              max={30}
              value={prefs.consumption}
              onChange={(e) => update("consumption", clampNum(e.target.value, 1, 30, prefs.consumption))}
              className="w-20 rounded-lg border border-line bg-bg px-3 py-2 text-sm tabular"
              aria-label="Consumo en litros cada 100 km"
            />
            <span className="text-sm text-ink-2">l/100 km</span>
          </div>
        </fieldset>

        <TripModeField mode={prefs.mode} onChange={(m) => update("mode", m)} />

        <RadiusField
          radius={prefs.radius}
          onRadius={(r) => update("radius", r)}
          onlyOpen={prefs.onlyOpen}
          onOnlyOpen={(v) => update("onlyOpen", v)}
          openLabel="Solo gasolineras abiertas ahora"
        />
      </div>

      {/* ---------- Resultados ---------- */}
      <div className="min-w-0 space-y-4">
        {!location ? (
          <EmptyState>
            Usa tu ubicación o escribe tu código postal y calcularemos cuánto ahorras <em>de verdad</em> en cada gasolinera
            cercana, descontando el combustible que gastas en llegar.
          </EmptyState>
        ) : (
          <>
            {fetchError && <div className="rounded-xl border border-not-worth/40 bg-surface p-4 text-sm text-not-worth">{fetchError}</div>}
            {data && (
              <FreshnessBar
                fetchedAt={data.fetchedAt}
                ministryDate={data.ministryDate}
                now={now}
                refreshing={loading}
                routing={routingPending}
                routingFailed={routingFailed}
                hiddenClosed={prefs.onlyOpen ? hiddenClosed : 0}
                onRefresh={() => setRefreshTick((t) => t + 1)}
              />
            )}
            {result && <Summary result={result} stationById={stationById} liters={prefs.liters} mode={prefs.mode} />}
            {!loading && !fetchError && data && eligible.length === 0 && (
              <div className="rounded-xl border border-line bg-surface p-4 text-sm text-ink-2">
                No hay gasolineras {prefs.onlyOpen ? "abiertas " : ""}con {FUELS[prefs.fuel].label} en {prefs.radius} km. Prueba a
                ampliar el radio{prefs.onlyOpen ? " o a incluir las cerradas" : ""}.
              </div>
            )}

            <div
              id="mapa"
              className="relative h-[540px] scroll-mt-20 overflow-hidden rounded-2xl border border-line bg-surface-2 shadow-sm [&:fullscreen]:rounded-none"
            >
              <StationMap
                center={location}
                radiusKm={prefs.radius}
                items={mapItems}
                pinnedIds={pinnedIds}
                bestId={result?.best.id}
                referenceId={result?.reference.id}
                selectedId={selectedId}
                onSelect={select}
                route={route}
                bottomInset={cardRow ? cardHeight + 12 : 0}
              />
              <div className="pointer-events-none absolute left-3 right-16 top-3 z-10">
                <Legend />
              </div>
              {cardRow && cardStation && (
                <div ref={cardRef} className="absolute inset-x-3 bottom-3 z-10">
                  <StationCard
                    row={cardRow}
                    station={cardStation}
                    open={openStates.get(cardStation.id)}
                    road={roadById[cardStation.id]}
                    liters={prefs.liters}
                    mode={prefs.mode}
                    isBest={cardRow.id === result?.best.id}
                    isCheapest={cardRow.id === result?.cheapest.id}
                    selected={Boolean(selectedId)}
                    onClose={() => setSelected(null)}
                  />
                </div>
              )}
              {loading && <LoadingBar />}
            </div>
            <MapAttribution />

            {result && (
              <section aria-label="Gasolineras ordenadas por ahorro neto">
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <h3 className="font-semibold">Ordenadas por ahorro neto</h3>
                  <span className="text-xs text-ink-3">{result.ranked.length} gasolineras</span>
                </div>
                <ol className="space-y-2">
                  {result.ranked.slice(0, visible).map((row, i) => (
                    <StationRow
                      key={row.id}
                      rank={i + 1}
                      row={row}
                      station={stationById.get(row.id)!}
                      open={openStates.get(row.id)}
                      road={roadById[row.id]}
                      liters={prefs.liters}
                      mode={prefs.mode}
                      isBest={row.id === result.best.id}
                      isCheapest={row.id === result.cheapest.id}
                      selected={row.id === selectedId}
                      onSelect={() => {
                        select(row.id);
                        document.getElementById("mapa")?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }}
                      onMakeReference={() => setReference({ origin: originKey, id: row.id })}
                    />
                  ))}
                </ol>
                {visible < result.ranked.length && (
                  <button onClick={() => setVisible((v) => v + LIST_PAGE)} className="mt-3 w-full rounded-lg border border-line py-2 text-sm hover:bg-surface-2">
                    Ver más ({result.ranked.length - visible} restantes)
                  </button>
                )}
                <p className="mt-4 text-xs leading-relaxed text-ink-3">
                  Distancias por carretera calculadas con OSRM sobre OpenStreetMap; las marcadas con «≈» son estimaciones (línea
                  recta × 1,3) mientras se calcula la ruta. El coste de desplazamiento usa el precio de tu gasolinera de
                  referencia. Precios oficiales del Ministerio a fecha {data?.ministryDate}. Comprueba siempre el precio en el
                  surtidor.
                </p>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ---------- Piezas reutilizadas por el modo eléctrico ----------

export function TripModeField({ mode, onChange, step = 5 }: { mode: TripMode; onChange: (m: TripMode) => void; step?: number }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">{step}. ¿Cómo vas a ir?</legend>
      <div className="space-y-1.5">
        {(
          [
            ["dedicated", "Viaje solo para esto", "Contamos la ida y vuelta extra por carretera."],
            ["onTheWay", "Me pilla de camino", "No contamos desplazamiento (el desvío real llegará pronto)."],
          ] as const
        ).map(([value, title, hint]) => (
          <label
            key={value}
            className={`flex cursor-pointer gap-2.5 rounded-lg border p-2.5 ${mode === value ? "border-brand bg-brand-soft" : "border-line hover:bg-surface-2"}`}
          >
            <input type="radio" name={`mode-${step}`} checked={mode === value} onChange={() => onChange(value)} className="mt-1 accent-[var(--brand)]" />
            <span>
              <span className="block text-sm font-medium">{title}</span>
              <span className="block text-xs text-ink-3">{hint}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function RadiusField({
  radius,
  onRadius,
  onlyOpen,
  onOnlyOpen,
  openLabel,
}: {
  radius: number;
  onRadius: (r: number) => void;
  onlyOpen: boolean;
  onOnlyOpen: (v: boolean) => void;
  openLabel: string;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="mb-1 flex w-full justify-between text-sm font-semibold">
        <span>Radio de búsqueda</span>
        <span className="font-normal text-ink-2 tabular">{radius} km</span>
      </legend>
      <input
        type="range"
        min={3}
        max={40}
        step={1}
        value={radius}
        onChange={(e) => onRadius(Number(e.target.value))}
        className="w-full accent-[var(--brand)]"
        aria-label="Radio de búsqueda en kilómetros"
      />
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" checked={onlyOpen} onChange={(e) => onOnlyOpen(e.target.checked)} className="accent-[var(--brand)]" />
        {openLabel}
      </label>
    </fieldset>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-[360px] place-items-center rounded-2xl border border-dashed border-line bg-surface p-8 text-center">
      <div className="max-w-sm">
        <p className="text-lg font-semibold">Dinos dónde estás</p>
        <p className="mt-2 text-sm text-ink-2">{children}</p>
      </div>
    </div>
  );
}

export function LoadingBar() {
  return (
    <div className="absolute inset-x-0 top-0 z-20 h-1 overflow-hidden bg-brand/20">
      <div className="gn-shimmer h-full w-full bg-brand/60" />
    </div>
  );
}
