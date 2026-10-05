"use client";

import type { ReactNode } from "react";
import { eur, km, prettyName, pricePerLiter, signedEur } from "@/lib/format";
import type { OpenState } from "@/lib/hours";
import { verdictFor, type Breakdown, type NetSavingsResult, type TripMode } from "@/lib/netSavings";
import type { NearbyStation } from "@/lib/types";
import { VERDICT_COLOR } from "./verdictColors";

export interface RoadInfo {
  km: number;
  min: number;
}

const stationLabel = (s: NearbyStation) => `${prettyName(s.brand)} (${prettyName(s.town)})`;
const distance = (row: Breakdown) => `${row.estimated ? "≈ " : ""}${km(row.roadKm)}`;
const minutes = (m: number) => (m < 1 ? "<1 min" : `${Math.round(m)} min`);

/** Si cierra antes de que llegues (con 5 min de margen), avisamos. */
function mayArriveClosed(open: OpenState | undefined, road: RoadInfo | undefined, row: Breakdown) {
  if (!open || open.minutes === undefined || (open.status !== "open" && open.status !== "closingSoon")) return false;
  const travelMin = road?.min ?? (row.roadKm / 40) * 60;
  return open.minutes < travelMin + 5;
}

// ---------------------------------------------------------------------------

export function FreshnessBar({
  fetchedAt,
  ministryDate,
  now,
  refreshing,
  routing,
  routingFailed,
  hiddenClosed,
  onRefresh,
}: {
  fetchedAt: string;
  ministryDate: string;
  now: number;
  refreshing: boolean;
  routing: boolean;
  routingFailed: boolean;
  hiddenClosed: number;
  onRefresh: () => void;
}) {
  const ageMin = Math.max(0, Math.round((now - new Date(fetchedAt).getTime()) / 60_000));
  const fresh = ageMin <= 45;
  const ageText = ageMin < 1 ? "ahora mismo" : ageMin < 60 ? `hace ${ageMin} min` : `hace ${Math.floor(ageMin / 60)} h ${ageMin % 60} min`;
  const hour = ministryDate.split(" ")[1]?.slice(0, 5);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-xs text-ink-2">
      <span className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          {fresh && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-worth opacity-50" />}
          <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${fresh ? "bg-worth" : "bg-marginal"}`} />
        </span>
        <span>
          <strong className="font-semibold text-ink">Precios oficiales</strong> · descargados {ageText}
          {hour && <> (Ministerio, {hour})</>}
        </span>
      </span>
      {routing && (
        <span className="flex items-center gap-1.5">
          <Spinner /> Calculando rutas reales por carretera…
        </span>
      )}
      {routingFailed && <span className="text-marginal">Rutas no disponibles: distancias estimadas (≈)</span>}
      {hiddenClosed > 0 && <span>{hiddenClosed} cerradas ahora, ocultas</span>}
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        className="ml-auto flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 font-medium text-ink hover:bg-surface-2 disabled:opacity-50"
      >
        {refreshing ? <Spinner /> : <RefreshIcon />} Actualizar
      </button>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------

export function Legend() {
  const items = [
    ["reference", "Ref."],
    ["worth", "Compensa"],
    ["marginal", "Poco"],
    ["notWorth", "No compensa"],
  ] as const;
  return (
    <div className="inline-flex flex-wrap gap-x-2.5 gap-y-1 rounded-xl border border-line/80 bg-surface/85 px-2.5 py-1.5 text-[10.5px] font-medium text-ink-2 shadow-sm backdrop-blur sm:gap-x-3 sm:px-3 sm:py-2 sm:text-[11px]">
      {items.map(([v, label]) => (
        <span key={v} className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full ring-2 ring-white/80" style={{ background: VERDICT_COLOR[v] }} />
          {label}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function Summary({
  result,
  stationById,
  liters,
  mode,
}: {
  result: NetSavingsResult;
  stationById: Map<string, NearbyStation>;
  liters: number;
  mode: TripMode;
}) {
  const { best, cheapest, reference, cheapestIsNotBest } = result;
  const bestS = stationById.get(best.id);
  const cheapS = stationById.get(cheapest.id);
  const refS = stationById.get(reference.id);
  if (!bestS || !cheapS || !refS) return null;

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <p className="text-lg font-semibold leading-snug sm:text-xl">
        {best.isReference ? (
          <>
            Ninguna compensa el viaje. <span className="text-ink-2">Reposta en tu referencia,</span> {stationLabel(refS)}.
          </>
        ) : (
          <>
            Ve a <span className="text-brand">{stationLabel(bestS)}</span>: ahorras{" "}
            <span className="tabular">{eur(best.netSaving)}</span> netos en {liters} litros.
          </>
        )}
      </p>
      {cheapestIsNotBest && !cheapest.isReference && (
        <p className="mt-3 rounded-lg bg-accent-soft p-3 text-sm text-ink">
          <strong>La más barata no es la que más ahorra.</strong> {stationLabel(cheapS)} tiene el mejor precio (
          {pricePerLiter(cheapest.price)}), pero está a {distance(cheapest)}: llegar te cuesta {eur(cheapest.travelCost)} y tu
          ahorro neto se queda en <strong className="tabular">{signedEur(cheapest.netSaving)}</strong>
          {cheapest.netSaving < 0 && " (perderías dinero)"}.
        </p>
      )}
      <div className={`mt-4 grid gap-2 ${cheapestIsNotBest ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        <MiniCard tone="reference" title="Tu referencia" station={refS} row={reference} />
        {cheapestIsNotBest ? (
          <>
            <MiniCard tone="cheapest" title="Más barata por litro" station={cheapS} row={cheapest} />
            <MiniCard tone="best" title="La que más ahorra" station={bestS} row={best} />
          </>
        ) : (
          !best.isReference && <MiniCard tone="best" title="La más barata y la que más ahorra" station={bestS} row={best} />
        )}
      </div>
      {mode === "onTheWay" && (
        <p className="mt-3 text-xs text-ink-3">
          Modo &quot;de camino&quot;: no descontamos desplazamiento, así que la que más ahorra coincide con la más barata.
        </p>
      )}
    </div>
  );
}

function MiniCard({
  tone,
  title,
  station,
  row,
}: {
  tone: "reference" | "cheapest" | "best";
  title: string;
  station: NearbyStation;
  row: Breakdown;
}) {
  const border = tone === "best" ? "border-worth" : tone === "reference" ? "border-reference/50" : "border-line";
  return (
    <div className={`rounded-xl border ${border} p-3`}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-ink-3">{title}</p>
      <p className="mt-1 truncate text-sm font-medium" title={stationLabel(station)}>
        {stationLabel(station)}
      </p>
      <p className="mt-1 text-xs text-ink-2 tabular">
        {pricePerLiter(row.price)} · {distance(row)}
      </p>
      <p className="mt-1 text-sm font-semibold tabular">{row.isReference ? "Punto de partida" : `Neto ${signedEur(row.netSaving)}`}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------

function OpenBadge({ open }: { open?: OpenState }) {
  if (!open) return null;
  const tone =
    open.status === "open"
      ? "text-worth"
      : open.status === "closingSoon"
        ? "text-marginal"
        : open.status === "closed"
          ? "text-not-worth"
          : "text-ink-3";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${tone}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {open.label}
    </span>
  );
}

const mapsUrl = (s: NearbyStation) => `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}`;

/** Tarjeta flotante sobre el mapa con la gasolinera seleccionada (o la mejor, por defecto). */
export function StationCard({
  row,
  station,
  open,
  road,
  liters,
  mode,
  isBest,
  isCheapest,
  selected,
  onClose,
}: {
  row: Breakdown;
  station: NearbyStation;
  open?: OpenState;
  road?: RoadInfo;
  liters: number;
  mode: TripMode;
  isBest: boolean;
  isCheapest: boolean;
  selected: boolean;
  onClose: () => void;
}) {
  const verdict = verdictFor(row);
  return (
    <div className="rounded-2xl border border-line/80 bg-surface/92 p-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.22)] backdrop-blur-md sm:p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {!selected && isBest && !row.isReference && <Badge className="bg-worth text-white">Recomendada</Badge>}
            {selected && isBest && !row.isReference && <Badge className="bg-worth text-white">Más ahorra</Badge>}
            {isCheapest && <Badge className="bg-ink text-bg">Más barata</Badge>}
            {row.isReference && <Badge className="bg-reference text-white">Referencia</Badge>}
            <OpenBadge open={open} />
          </div>
          <p className="mt-1 truncate text-base font-semibold">{prettyName(station.brand)}</p>
          <p className="truncate text-xs text-ink-3">
            {prettyName(station.address)}, {prettyName(station.town)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold leading-none tabular sm:text-2xl" style={{ color: row.isReference ? undefined : VERDICT_COLOR[verdict] }}>
            {row.isReference ? pricePerLiter(row.price) : signedEur(row.netSaving)}
          </p>
          <p className="mt-1 text-[11px] text-ink-3">{row.isReference ? "precio" : `neto en ${liters} l`}</p>
        </div>
        {selected && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="-mr-1 -mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-2 tabular">
        <span>
          <strong className="text-ink">{pricePerLiter(row.price)}</strong>
        </span>
        <span>
          <strong className="text-ink">{distance(row)}</strong>
          {road ? ` · ${minutes(road.min)} en coche` : " estimados"}
        </span>
        {!row.isReference && (
          <span>
            surtidor {signedEur(row.grossSaving)}
            {mode === "dedicated" && <> · llegar −{eur(row.travelCost)}</>}
          </span>
        )}
        <a
          href={mapsUrl(station)}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-brand-ink"
        >
          Cómo llegar ↗
        </a>
      </div>
      {mayArriveClosed(open, road, row) && (
        <p className="mt-2 text-xs font-medium text-marginal">⚠ Puede que llegues con la gasolinera ya cerrada.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function StationRow({
  rank,
  row,
  station,
  open,
  road,
  liters,
  mode,
  isBest,
  isCheapest,
  selected,
  onSelect,
  onMakeReference,
}: {
  rank: number;
  row: Breakdown;
  station: NearbyStation;
  open?: OpenState;
  road?: RoadInfo;
  liters: number;
  mode: TripMode;
  isBest: boolean;
  isCheapest: boolean;
  selected: boolean;
  onSelect: () => void;
  onMakeReference: () => void;
}) {
  const verdict = verdictFor(row);
  const perLiter = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(row.savingPerLiter);

  return (
    <li
      id={`station-${row.id}`}
      onClick={onSelect}
      className={`cursor-pointer rounded-xl border bg-surface p-3 transition-colors sm:p-4 ${
        selected ? "border-ink" : "border-line hover:border-ink-3"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold text-white"
          style={{ background: VERDICT_COLOR[verdict] }}
        >
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate font-medium">{prettyName(station.brand)}</p>
            {isBest && !row.isReference && <Badge className="bg-worth text-white">Más ahorra</Badge>}
            {isCheapest && <Badge className="bg-ink text-bg">Más barata</Badge>}
            {row.isReference && <Badge className="bg-reference text-white">Referencia</Badge>}
          </div>
          <p className="truncate text-xs text-ink-3">
            {prettyName(station.address)}, {prettyName(station.town)}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2">
            <OpenBadge open={open} />
            {mayArriveClosed(open, road, row) && <span className="text-xs text-marginal">· puede que llegues cerrada</span>}
          </div>
        </div>
        <div className="text-right">
          <p className="font-semibold tabular">{row.isReference ? "—" : signedEur(row.netSaving)}</p>
          <p className="text-xs text-ink-3">neto</p>
        </div>
      </div>

      {/* El desglose siempre visible: es lo que hace creíble el resultado. */}
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-line pt-3 text-xs sm:grid-cols-4">
        <Fact label="Precio" value={pricePerLiter(row.price)} />
        <Fact label={row.estimated ? "Distancia (estimada)" : "Por carretera"} value={`${distance(row)}${road ? ` · ${minutes(road.min)}` : ""}`} />
        <Fact label="Ahorro en surtidor" value={row.isReference ? "—" : `${perLiter} × ${liters} l = ${signedEur(row.grossSaving)}`} />
        <Fact
          label="Coste de llegar"
          value={
            mode === "onTheWay"
              ? "0 € (de camino)"
              : row.isReference
                ? "—"
                : `${km(row.extraKm)} extra = ${row.travelCost > 0 ? "−" : ""}${eur(row.travelCost)}`
          }
        />
      </dl>

      <div className="mt-2 flex flex-wrap gap-3 text-xs">
        <a
          href={mapsUrl(station)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="font-medium text-brand hover:underline"
        >
          Cómo llegar ↗
        </a>
        {!row.isReference && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMakeReference();
            }}
            className="text-ink-2 hover:text-ink hover:underline"
          >
            Es mi gasolinera habitual: usar como referencia
          </button>
        )}
      </div>
    </li>
  );
}

function Badge({ children, className }: { children: ReactNode; className: string }) {
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${className}`}>{children}</span>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-ink-3">{label}</dt>
      <dd className="truncate font-medium tabular text-ink" title={value}>
        {value}
      </dd>
    </div>
  );
}
