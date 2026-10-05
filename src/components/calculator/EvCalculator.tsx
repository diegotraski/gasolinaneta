"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { trackEvent } from "@/lib/analytics";
import { CONNECTOR_LABEL, EV_PRESETS, SELECTABLE_CONNECTORS } from "@/lib/ev/carPresets";
import { parseDatexHours } from "@/lib/ev/datex";
import { computeEvSavings } from "@/lib/ev/evSavings";
import { PRICES_CHECKED_ON, SPEED_LABEL, type SpeedClass } from "@/lib/ev/operatorPrices";
import type { ConnectorType, NearbyEvSite } from "@/lib/ev/types";
import { minuteOfWeek, openStateAt, type OpenState } from "@/lib/hours";
import { verdictFor, type TripMode } from "@/lib/netSavings";
import { EmptyState, LoadingBar, RadiusField, StationMap, TripModeField } from "./Calculator";
import { EvCard, EvInfoBar, EvRow, EvSummary, signedMin } from "./EvResults";
import { Legend } from "./Results";
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

interface EvPrefs {
  batteryKwh: number;
  currentPct: number;
  targetPct: number;
  consumptionKwh100: number;
  maxAcKw: number;
  maxDcKw: number;
  connectors: ConnectorType[];
  speeds: SpeedClass[];
  mode: TripMode;
  radius: number;
  onlyOpen: boolean;
  sortBy: "money" | "time";
}

const ALL_SPEEDS: SpeedClass[] = ["slow", "fast", "ultra"];
const DEFAULT_PREFS: EvPrefs = {
  batteryKwh: 60,
  currentPct: 20,
  // 80 %: lo habitual en carga rápida (por encima la potencia cae mucho y se recomienda para cuidar la batería).
  targetPct: 80,
  consumptionKwh100: 16,
  maxAcKw: 11,
  maxDcKw: 120,
  connectors: ["T2", "CCS"],
  speeds: ALL_SPEEDS,
  mode: "dedicated",
  radius: 15,
  onlyOpen: true,
  sortBy: "money",
};
const LIST_PAGE = 15;
const MAX_PINS = 12;

const sanitize = (s: Partial<EvPrefs>): EvPrefs => {
  const connectors = Array.isArray(s.connectors) ? s.connectors.filter((c) => SELECTABLE_CONNECTORS.includes(c)) : [];
  const speeds = Array.isArray(s.speeds) ? s.speeds.filter((v) => ALL_SPEEDS.includes(v)) : [];
  return {
    batteryKwh: clampNum(s.batteryKwh, 10, 200, DEFAULT_PREFS.batteryKwh),
    currentPct: clampNum(s.currentPct, 0, 99, DEFAULT_PREFS.currentPct),
    targetPct: clampNum(s.targetPct, 1, 100, DEFAULT_PREFS.targetPct),
    consumptionKwh100: clampNum(s.consumptionKwh100, 8, 40, DEFAULT_PREFS.consumptionKwh100),
    maxAcKw: clampNum(s.maxAcKw, 2, 43, DEFAULT_PREFS.maxAcKw),
    maxDcKw: clampNum(s.maxDcKw, 20, 400, DEFAULT_PREFS.maxDcKw),
    connectors: connectors.length ? connectors : DEFAULT_PREFS.connectors,
    speeds: speeds.length ? speeds : ALL_SPEEDS,
    mode: s.mode === "onTheWay" ? "onTheWay" : "dedicated",
    radius: clampNum(s.radius, 3, 40, DEFAULT_PREFS.radius),
    onlyOpen: s.onlyOpen !== false,
    sortBy: s.sortBy === "time" ? "time" : "money",
  };
};

interface EvData {
  key: string;
  sites: NearbyEvSite[];
  sourceDate: string;
}

const kwhFmt = (n: number) => n.toFixed(2).replace(".", ",");

export function EvCalculator({ location, locationPicker }: { location: Location | null; locationPicker: ReactNode }) {
  const { prefs, update } = useStoredPrefs("gn-ev-prefs-v1", DEFAULT_PREFS, sanitize);
  const originKey = originKeyOf(location);
  const [data, setData] = useState<EvData | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [reference, setReference] = useState<{ origin: string; id: string } | null>(null);
  const [selected, setSelected] = useState<{ origin: string; id: string } | null>(null);
  const referenceId = reference?.origin === originKey ? reference.id : undefined;
  const selectedId = selected?.origin === originKey ? selected.id : null;
  const [visible, setVisible] = useState(LIST_PAGE);
  const [cardRef, cardHeight] = useElementHeight(160);
  const now = useNow();

  // ---------- Puntos de recarga ----------
  const requestKey = location ? `${originKey},${prefs.radius}` : null;
  const sites = useMemo(() => data?.sites ?? [], [data]);
  const fetchError = failure && failure.key === requestKey ? failure.message : null;
  const loading = requestKey !== null && data?.key !== requestKey && !fetchError;

  useEffect(() => {
    if (!location || !requestKey) return;
    const ctrl = new AbortController();
    const timer = setTimeout(
      () =>
        postJson("/api/ev/stations", { lat: Number(location.lat.toFixed(4)), lon: Number(location.lon.toFixed(4)), radius: prefs.radius }, ctrl.signal)
          .then(async (res) => {
            const body = await res.json();
            if (!res.ok) throw new Error(body.error ?? "Error al cargar los puntos de recarga");
            setData({ key: requestKey, sites: body.sites, sourceDate: body.sourceDate });
            setVisible(LIST_PAGE);
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
  }, [location, requestKey, prefs.radius]);

  // ---------- Horarios ----------
  const openStates = useMemo(() => {
    const minuteByTz = new Map<string, number>();
    const out = new Map<string, OpenState>();
    for (const s of sites) {
      if (!minuteByTz.has(s.timeZone)) minuteByTz.set(s.timeZone, minuteOfWeek(new Date(now), s.timeZone));
      out.set(s.id, openStateAt(parseDatexHours(s.hours), minuteByTz.get(s.timeZone)!));
    }
    return out;
  }, [sites, now]);
  const eligible = useMemo(
    () => (prefs.onlyOpen ? sites.filter((s) => openStates.get(s.id)?.status !== "closed") : sites),
    [sites, openStates, prefs.onlyOpen],
  );
  const siteById = useMemo(() => new Map(sites.map((s) => [s.id, s])), [sites]);

  // ---------- Cálculo ----------
  const [routeTargets, setRouteTargets] = useState<string[]>([]);
  const { roadById, pending: routingPending, failed: routingFailed } = useRoadDistances(location, routeTargets, siteById, true);

  const car = useMemo(
    () => ({
      batteryKwh: prefs.batteryKwh,
      currentPct: prefs.currentPct,
      targetPct: prefs.targetPct,
      consumptionKwh100: prefs.consumptionKwh100,
      maxAcKw: prefs.maxAcKw,
      maxDcKw: prefs.maxDcKw,
      connectors: prefs.connectors,
    }),
    [prefs.batteryKwh, prefs.currentPct, prefs.targetPct, prefs.consumptionKwh100, prefs.maxAcKw, prefs.maxDcKw, prefs.connectors],
  );
  const result = useMemo(
    () =>
      computeEvSavings(
        eligible.map((s) => ({
          id: s.id,
          operator: s.operator,
          connectors: s.connectors,
          straightKm: s.straightKm,
          roadKm: roadById[s.id]?.km,
          roadMin: roadById[s.id]?.min,
        })),
        { car, mode: prefs.mode, speeds: prefs.speeds, referenceId },
      ),
    [eligible, roadById, car, prefs.mode, prefs.speeds, referenceId],
  );
  const rowsById = useMemo(() => new Map(result?.ranked.map((r) => [r.id, r]) ?? []), [result]);
  const ordered = useMemo(
    () =>
      !result
        ? []
        : prefs.sortBy === "time"
          ? [...result.ranked].sort((a, b) => a.extraMin - b.extraMin || b.netSaving - a.netSaving)
          : result.ranked,
    [result, prefs.sortBy],
  );

  // Rutas reales para los que deciden el resultado: los más cercanos, los que más ahorran y los más rápidos.
  const targetsKey = useMemo(() => {
    if (!result) return "";
    const nearest = [...result.ranked].sort((a, b) => a.roadKm - b.roadKm).slice(0, 8).map((r) => r.id);
    const top = result.ranked.slice(0, 20).map((r) => r.id);
    const fast = [...result.ranked].sort((a, b) => a.extraMin - b.extraMin).slice(0, 8).map((r) => r.id);
    return [...new Set([...nearest, ...top, ...fast, ...(selectedId ? [selectedId] : [])])].join(",");
  }, [result, selectedId]);
  useEffect(() => {
    // Solo actualizamos la lista cuando cambian los ids, no en cada render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRouteTargets(targetsKey ? targetsKey.split(",") : []);
  }, [targetsKey]);

  const selectedSite = selectedId ? (siteById.get(selectedId) ?? null) : null;
  const route = useRouteGeometry(location, selectedSite);

  // Métrica: ¿con qué frecuencia el que más ahorra NO es el que menos tiempo quita?
  useEffect(() => {
    if (!result || !requestKey || routingPending) return;
    trackEvent("Resultado eléctrico", { difiere: result.best.id !== result.fastest.id ? "si" : "no" });
  }, [result, requestKey, routingPending]);

  const select = useCallback(
    (id: string) => {
      setSelected({ origin: originKey, id });
      const idx = ordered.findIndex((r) => r.id === id);
      if (idx >= visible) setVisible(idx + 1);
    },
    [ordered, visible, originKey],
  );

  // ---------- Mapa ----------
  const mapItems: MapItem[] = useMemo(
    () =>
      sites
        .filter((s) => rowsById.has(s.id))
        .map((s) => {
          const row = rowsById.get(s.id)!;
          return {
            id: s.id,
            lat: s.lat,
            lon: s.lon,
            price: row.price.eurPerKwh,
            netSaving: row.netSaving,
            verdict: verdictFor(row),
            open: openStates.get(s.id)?.status ?? "unknown",
            pinTitle: `${kwhFmt(row.price.eurPerKwh)} €/kWh`,
            pinSub: `${row.netSaving >= 0 ? "+" : "−"}${kwhFmt(Math.abs(row.netSaving))} € · ${signedMin(row.extraMin)}`,
          };
        }),
    [sites, rowsById, openStates],
  );
  const pinnedIds = useMemo(() => {
    if (!result) return [];
    const ids = [result.best.id, result.fastest.id, result.reference.id];
    for (const r of result.ranked) if (r.netSaving > 0) ids.push(r.id);
    return [...new Set(ids)].slice(0, MAX_PINS);
  }, [result]);

  const cardId = selectedId && rowsById.has(selectedId) ? selectedId : (result?.best.id ?? null);
  const cardRow = cardId ? rowsById.get(cardId) : undefined;
  const cardSite = cardId ? siteById.get(cardId) : undefined;
  const presetId = EV_PRESETS.find((p) => p.batteryKwh === prefs.batteryKwh && p.maxDcKw === prefs.maxDcKw)?.id ?? "custom";
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const numberInput = (label: string, value: number, onChange: (n: number) => void, min: number, max: number, unit: string, step = 1) => (
    <label className="flex items-center justify-between gap-2 text-sm">
      <span className="text-ink-2">{label}</span>
      <span className="flex items-center gap-1.5">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(clampNum(e.target.value, min, max, value))}
          className="w-20 rounded-lg border border-line bg-bg px-2.5 py-1.5 text-right text-sm tabular"
        />
        <span className="w-14 text-xs text-ink-3">{unit}</span>
      </span>
    </label>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      {/* ---------- Formulario ---------- */}
      <div className="h-fit space-y-5 rounded-2xl border border-line bg-surface p-5 lg:sticky lg:top-20">
        {locationPicker}

        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-semibold">2. Tu coche</legend>
          <select
            value={presetId}
            onChange={(e) => {
              const p = EV_PRESETS.find((x) => x.id === e.target.value);
              if (!p) return;
              update("batteryKwh", p.batteryKwh);
              update("consumptionKwh100", p.consumptionKwh100);
              update("maxAcKw", p.maxAcKw);
              update("maxDcKw", p.maxDcKw);
            }}
            className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm"
            aria-label="Tipo de coche eléctrico"
          >
            {EV_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
            <option value="custom">Mis datos exactos…</option>
          </select>
          {numberInput("Batería útil", prefs.batteryKwh, (n) => update("batteryKwh", n), 10, 200, "kWh")}
          {numberInput("Consumo", prefs.consumptionKwh100, (n) => update("consumptionKwh100", n), 8, 40, "kWh/100", 0.5)}
          {numberInput("Carga máx. en AC", prefs.maxAcKw, (n) => update("maxAcKw", n), 2, 43, "kW", 0.1)}
          {numberInput("Carga máx. en DC", prefs.maxDcKw, (n) => update("maxDcKw", n), 20, 400, "kW")}
        </fieldset>

        <fieldset>
          <legend className="mb-2 flex w-full justify-between text-sm font-semibold">
            <span>3. ¿Cuánto vas a cargar?</span>
            <span className="font-normal text-ink-2 tabular">
              {prefs.currentPct} % → {prefs.targetPct} %
            </span>
          </legend>
          <div className="space-y-2">
            <label className="block text-xs text-ink-3">
              Batería ahora: {prefs.currentPct} %
              <input
                type="range"
                min={0}
                max={95}
                value={prefs.currentPct}
                onChange={(e) => update("currentPct", Math.min(Number(e.target.value), prefs.targetPct - 1))}
                className="w-full accent-[var(--brand)]"
              />
            </label>
            <label className="block text-xs text-ink-3">
              Cargar hasta: {prefs.targetPct} %
              <input
                type="range"
                min={5}
                max={100}
                value={prefs.targetPct}
                onChange={(e) => update("targetPct", Math.max(Number(e.target.value), prefs.currentPct + 1))}
                className="w-full accent-[var(--brand)]"
              />
            </label>
            <p className="text-xs text-ink-3">
              Recomendado: hasta el 80 % en carga rápida; por encima la potencia cae mucho y desgasta más la batería.
            </p>
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold">4. Conectores de tu coche</legend>
          <div className="flex flex-wrap gap-1.5">
            {SELECTABLE_CONNECTORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={prefs.connectors.includes(c)}
                onClick={() => {
                  const next = toggle(prefs.connectors, c);
                  if (next.length) update("connectors", next);
                }}
                className={`rounded-lg border px-3 py-1.5 text-sm ${
                  prefs.connectors.includes(c) ? "border-brand bg-brand-soft font-medium" : "border-line text-ink-2 hover:bg-surface-2"
                }`}
              >
                {CONNECTOR_LABEL[c]}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs font-medium text-ink-2">Velocidad de carga</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {ALL_SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={prefs.speeds.includes(s)}
                onClick={() => {
                  const next = toggle(prefs.speeds, s);
                  if (next.length) update("speeds", next);
                }}
                className={`rounded-lg border px-2.5 py-1.5 text-xs ${
                  prefs.speeds.includes(s) ? "border-brand bg-brand-soft font-medium" : "border-line text-ink-2 hover:bg-surface-2"
                }`}
              >
                {SPEED_LABEL[s]}
              </button>
            ))}
          </div>
        </fieldset>

        <TripModeField mode={prefs.mode} onChange={(m) => update("mode", m)} />

        <RadiusField
          radius={prefs.radius}
          onRadius={(r) => update("radius", r)}
          onlyOpen={prefs.onlyOpen}
          onOnlyOpen={(v) => update("onlyOpen", v)}
          openLabel="Solo puntos abiertos ahora"
        />
      </div>

      {/* ---------- Resultados ---------- */}
      <div className="min-w-0 space-y-4">
        {!location ? (
          <EmptyState>
            Usa tu ubicación o escribe tu código postal y compararemos los puntos de recarga cercanos por lo que ahorras y por el
            tiempo que te cuesta, por separado.
          </EmptyState>
        ) : (
          <>
            {fetchError && <div className="rounded-xl border border-not-worth/40 bg-surface p-4 text-sm text-not-worth">{fetchError}</div>}
            {data && (
              <EvInfoBar
                sourceDate={data.sourceDate}
                pricesCheckedOn={PRICES_CHECKED_ON}
                kwh={result?.kwh ?? null}
                routing={routingPending}
                routingFailed={routingFailed}
                hiddenClosed={prefs.onlyOpen ? sites.length - eligible.length : 0}
              />
            )}
            {result && <EvSummary result={result} siteById={siteById} />}
            {!loading && !fetchError && data && !result && (
              <div className="rounded-xl border border-line bg-surface p-4 text-sm text-ink-2">
                {prefs.targetPct <= prefs.currentPct
                  ? "El % objetivo tiene que ser mayor que el actual."
                  : `No hay puntos ${prefs.onlyOpen ? "abiertos " : ""}compatibles con tus conectores y velocidades en ${prefs.radius} km. Prueba a ampliar el radio o los filtros.`}
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
              {cardRow && cardSite && (
                <div ref={cardRef} className="absolute inset-x-3 bottom-3 z-10">
                  <EvCard
                    row={cardRow}
                    site={cardSite}
                    open={openStates.get(cardSite.id)}
                    mode={prefs.mode}
                    selected={Boolean(selectedId)}
                    isBest={cardRow.id === result?.best.id}
                    isFastest={cardRow.id === result?.fastest.id}
                    onClose={() => setSelected(null)}
                  />
                </div>
              )}
              {loading && <LoadingBar />}
            </div>
            <MapAttribution />

            {result && (
              <section aria-label="Puntos de recarga">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-semibold">{ordered.length} puntos compatibles</h3>
                  <div className="flex rounded-lg border border-line p-0.5 text-xs" role="group" aria-label="Ordenar por">
                    {(
                      [
                        ["money", "Más ahorro"],
                        ["time", "Menos tiempo"],
                      ] as const
                    ).map(([v, label]) => (
                      <button
                        key={v}
                        type="button"
                        aria-pressed={prefs.sortBy === v}
                        onClick={() => update("sortBy", v)}
                        className={`rounded-md px-2.5 py-1 ${prefs.sortBy === v ? "bg-brand text-brand-ink" : "text-ink-2 hover:bg-surface-2"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <ol className="space-y-2">
                  {ordered.slice(0, visible).map((row, i) => (
                    <EvRow
                      key={row.id}
                      rank={i + 1}
                      row={row}
                      site={siteById.get(row.id)!}
                      open={openStates.get(row.id)}
                      kwh={result.kwh}
                      mode={prefs.mode}
                      isBest={row.id === result.best.id}
                      isFastest={row.id === result.fastest.id}
                      selected={row.id === selectedId}
                      onSelect={() => {
                        select(row.id);
                        document.getElementById("mapa")?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }}
                      onMakeReference={() => setReference({ origin: originKey, id: row.id })}
                    />
                  ))}
                </ol>
                {visible < ordered.length && (
                  <button onClick={() => setVisible((v) => v + LIST_PAGE)} className="mt-3 w-full rounded-lg border border-line py-2 text-sm hover:bg-surface-2">
                    Ver más ({ordered.length - visible} restantes)
                  </button>
                )}
                <p className="mt-4 text-xs leading-relaxed text-ink-3">
                  Ubicación y conectores: Punto de Acceso Nacional de la DGT (CC BY). <strong>Los precios son orientativos</strong>:
                  ningún organismo publica el precio de cada punto, así que usamos la tarifa que cada operador publica en su web
                  (o un precio genérico si no la publica). El precio real puede variar según la hora, tu suscripción o el punto:
                  compruébalo en la app del operador. Tiempos de carga estimados con la potencia máxima que admiten el punto y tu
                  coche; en continua aplicamos un 75 % de media por la curva de carga.
                </p>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
