"use client";

import type { ReactNode } from "react";
import { eur, km, prettyName, signedEur } from "@/lib/format";
import type { OpenState } from "@/lib/hours";
import { verdictFor, type TripMode } from "@/lib/netSavings";
import { CONNECTOR_LABEL } from "@/lib/ev/carPresets";
import type { EvBreakdown, EvResult } from "@/lib/ev/evSavings";
import { SPEED_LABEL } from "@/lib/ev/operatorPrices";
import type { NearbyEvSite } from "@/lib/ev/types";
import { VERDICT_COLOR } from "./verdictColors";

const kwhPrice = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateFmt = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** "1 h 36 min", "28 min" */
export function duration(min: number): string {
  const m = Math.round(Math.abs(min));
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}`;
}
/** "+18 min", "−5 min", "igual" */
export function signedMin(min: number): string {
  if (Math.abs(min) < 0.5) return "±0 min";
  return `${min > 0 ? "+" : "−"}${duration(min)}`;
}

/** "ENDESA X WAY, S.L." → "Endesa X Way" */
export function operatorName(raw: string): string {
  const cleaned = raw
    .replace(/\(([^)]*)\)/g, "$1")
    .replace(/,?\s*\b(S\.?\s?L\.?\s?U?\.?|S\.?\s?A\.?\s?U?\.?|SLU|SAU|SL|SA|SRL)\s*$/i, "")
    .trim();
  return prettyName(cleaned) || "Operador desconocido";
}

export const siteLabel = (s: NearbyEvSite) => (s.name ? prettyName(s.name) : operatorName(s.operator));

function priceText(row: EvBreakdown) {
  return `${row.price.isMinimum ? "desde " : ""}${kwhPrice.format(row.price.eurPerKwh)} €/kWh`;
}

function priceBasisText(row: EvBreakdown) {
  return row.price.basis === "operator"
    ? `Tarifa publicada por ${row.price.operatorLabel} · revisada el ${dateFmt.format(new Date(row.price.checkedOn))}`
    : "Este operador no publica tarifa: precio genérico (mediana del mercado)";
}

const connectorText = (row: EvBreakdown) =>
  `${CONNECTOR_LABEL[row.connector.type]} · ${String(row.connector.powerKw).replace(".", ",")} kW${row.connector.dc ? " DC" : " AC"}`;

const distance = (row: EvBreakdown) => `${row.estimated ? "≈ " : ""}${km(row.roadKm)}`;

// ---------------------------------------------------------------------------

export function EvInfoBar({
  sourceDate,
  pricesCheckedOn,
  kwh,
  routing,
  routingFailed,
  hiddenClosed,
}: {
  sourceDate: string;
  pricesCheckedOn: string;
  kwh: number | null;
  routing: boolean;
  routingFailed: boolean;
  hiddenClosed: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-xs text-ink-2">
      <span>
        <strong className="font-semibold text-ink">Puntos oficiales</strong> (NAP · DGT) publicados el {dateTimeFmt.format(new Date(sourceDate))}
      </span>
      <span className="rounded-md bg-accent-soft px-2 py-0.5 font-medium text-ink">
        Precios orientativos por operador · revisados el {dateFmt.format(new Date(pricesCheckedOn))}
      </span>
      {kwh !== null && (
        <span>
          Vas a cargar <strong className="text-ink tabular">{kwh.toFixed(1).replace(".", ",")} kWh</strong>
        </span>
      )}
      {routing && <span>Calculando rutas reales…</span>}
      {routingFailed && <span className="text-marginal">Rutas no disponibles: distancias estimadas (≈)</span>}
      {hiddenClosed > 0 && <span>{hiddenClosed} cerrados ahora, ocultos</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function EvSummary({ result, siteById }: { result: EvResult; siteById: Map<string, NearbyEvSite> }) {
  const { best, fastest, reference } = result;
  const bestS = siteById.get(best.id);
  const refS = siteById.get(reference.id);
  const fastS = siteById.get(fastest.id);
  if (!bestS || !refS || !fastS) return null;

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      {best.isReference ? (
        <p className="text-lg font-semibold leading-snug sm:text-xl">
          Ningún punto cercano te ahorra dinero frente al más próximo,{" "}
          <span className="text-brand">{siteLabel(refS)}</span>.
        </p>
      ) : (
        <p className="text-lg font-semibold leading-snug sm:text-xl">
          En <span className="text-brand">{siteLabel(bestS)}</span> ahorras{" "}
          <span className="tabular">{eur(best.netSaving)}</span> netos,{" "}
          {best.extraMin > 0.5 ? (
            <>
              pero tardas <span className="tabular text-marginal">{duration(best.extraMin)} más</span> en total.
            </>
          ) : best.extraMin < -0.5 ? (
            <>
              y además tardas <span className="tabular text-worth">{duration(best.extraMin)} menos</span>.
            </>
          ) : (
            <>sin tardar más.</>
          )}
        </p>
      )}
      <p className="mt-2 text-xs text-ink-3">
        Te damos las dos cifras por separado a propósito: cuánto vale tu tiempo lo decides tú. Precios orientativos, pueden variar.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <EvMiniCard tone="reference" title="Punto más cercano (referencia)" site={refS} row={reference} />
        <EvMiniCard tone="best" title="El que más ahorra" site={bestS} row={best} />
        <EvMiniCard tone="fast" title="El que menos tiempo te quita" site={fastS} row={fastest} />
      </div>
    </div>
  );
}

function EvMiniCard({ tone, title, site, row }: { tone: "reference" | "best" | "fast"; title: string; site: NearbyEvSite; row: EvBreakdown }) {
  const border = tone === "best" ? "border-worth" : tone === "reference" ? "border-reference/50" : "border-line";
  return (
    <div className={`rounded-xl border ${border} p-3`}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-ink-3">{title}</p>
      <p className="mt-1 truncate text-sm font-medium" title={siteLabel(site)}>
        {siteLabel(site)}
      </p>
      <p className="mt-1 text-xs text-ink-2 tabular">
        {priceText(row)} · {connectorText(row)}
      </p>
      <p className="mt-1 flex gap-3 text-sm font-semibold tabular">
        {row.isReference ? (
          <span>Carga ≈ {duration(row.chargeMin)}</span>
        ) : (
          <>
            <span>{signedEur(row.netSaving)}</span>
            <span className={row.extraMin > 0.5 ? "text-marginal" : "text-worth"}>{signedMin(row.extraMin)}</span>
          </>
        )}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------

function OpenBadge({ open }: { open?: OpenState }) {
  if (!open) return null;
  const tone =
    open.status === "open" ? "text-worth" : open.status === "closingSoon" ? "text-marginal" : open.status === "closed" ? "text-not-worth" : "text-ink-3";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${tone}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {open.label}
    </span>
  );
}

const mapsUrl = (s: NearbyEvSite) => `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}`;

function TwoFigures({ row, big = false }: { row: EvBreakdown; big?: boolean }) {
  const size = big ? "text-xl sm:text-2xl" : "text-base";
  if (row.isReference) {
    return (
      <div className="text-right">
        <p className={`${size} font-bold leading-none tabular`}>{priceText(row)}</p>
        <p className="mt-1 text-[11px] text-ink-3">referencia</p>
      </div>
    );
  }
  return (
    <div className="flex gap-4 text-right">
      <div>
        <p className={`${size} font-bold leading-none tabular`} style={{ color: VERDICT_COLOR[verdictFor(row)] }}>
          {signedEur(row.netSaving)}
        </p>
        <p className="mt-1 text-[11px] text-ink-3">ahorro neto</p>
      </div>
      <div>
        <p className={`${size} font-bold leading-none tabular ${row.extraMin > 0.5 ? "text-marginal" : "text-worth"}`}>
          {signedMin(row.extraMin)}
        </p>
        <p className="mt-1 text-[11px] text-ink-3">tiempo total</p>
      </div>
    </div>
  );
}

export function EvCard({
  row,
  site,
  open,
  mode,
  selected,
  isBest,
  isFastest,
  onClose,
}: {
  row: EvBreakdown;
  site: NearbyEvSite;
  open?: OpenState;
  mode: TripMode;
  selected: boolean;
  isBest: boolean;
  isFastest: boolean;
  onClose: () => void;
}) {
  return (
    <div className="rounded-2xl border border-line/80 bg-surface/92 p-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.22)] backdrop-blur-md sm:p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {isBest && !row.isReference && <Badge className="bg-worth text-white">{selected ? "Más ahorra" : "Recomendado"}</Badge>}
            {isFastest && !row.isReference && <Badge className="bg-ink text-bg">Más rápido</Badge>}
            {row.isReference && <Badge className="bg-reference text-white">Referencia</Badge>}
            <OpenBadge open={open} />
          </div>
          <p className="mt-1 truncate text-base font-semibold">{siteLabel(site)}</p>
          <p className="truncate text-xs text-ink-3">
            {operatorName(site.operator)} · {site.address}
            {site.town ? `, ${site.town}` : ""}
          </p>
        </div>
        <TwoFigures row={row} big />
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
          <strong className="text-ink">{priceText(row)}</strong> orientativo
        </span>
        <span>
          <strong className="text-ink">{connectorText(row)}</strong> · carga ≈ {duration(row.chargeMin)}
        </span>
        <span>
          {distance(row)} · {duration(row.driveMin)} en coche
          {mode === "dedicated" && !row.isReference && <> · llegar −{eur(row.travelCost)}</>}
        </span>
        <a href={mapsUrl(site)} target="_blank" rel="noopener noreferrer" className="ml-auto rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-brand-ink">
          Cómo llegar ↗
        </a>
      </div>
    </div>
  );
}

export function EvRow({
  rank,
  row,
  site,
  open,
  kwh,
  mode,
  isBest,
  isFastest,
  selected,
  onSelect,
  onMakeReference,
}: {
  rank: number;
  row: EvBreakdown;
  site: NearbyEvSite;
  open?: OpenState;
  kwh: number;
  mode: TripMode;
  isBest: boolean;
  isFastest: boolean;
  selected: boolean;
  onSelect: () => void;
  onMakeReference: () => void;
}) {
  const verdict = verdictFor(row);
  const kwhText = kwh.toFixed(1).replace(".", ",");
  return (
    <li
      onClick={onSelect}
      className={`cursor-pointer rounded-xl border bg-surface p-3 transition-colors sm:p-4 ${selected ? "border-ink" : "border-line hover:border-ink-3"}`}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold text-white" style={{ background: VERDICT_COLOR[verdict] }}>
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate font-medium">{siteLabel(site)}</p>
            {isBest && !row.isReference && <Badge className="bg-worth text-white">Más ahorra</Badge>}
            {isFastest && !row.isReference && <Badge className="bg-ink text-bg">Más rápido</Badge>}
            {row.isReference && <Badge className="bg-reference text-white">Referencia</Badge>}
          </div>
          <p className="truncate text-xs text-ink-3">
            {operatorName(site.operator)} · {site.address}
            {site.town ? `, ${site.town}` : ""}
          </p>
          <div className="mt-0.5">
            <OpenBadge open={open} />
          </div>
        </div>
        <TwoFigures row={row} />
      </div>

      {/* Desglose siempre visible: dinero y tiempo, cada uno con sus cuentas. */}
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-line pt-3 text-xs sm:grid-cols-4">
        <Fact label="Precio orientativo" value={priceText(row)} title={priceBasisText(row)} />
        <Fact label="Conector" value={connectorText(row)} />
        <Fact label="Carga" value={`≈ ${duration(row.chargeMin)} (${String(Math.round(row.effectiveKw))} kW medios)`} />
        <Fact label={row.estimated ? "Distancia (estimada)" : "Por carretera"} value={`${distance(row)} · ${duration(row.driveMin)}`} />
        {!row.isReference && (
          <>
            <Fact
              label="Ahorro en el cargador"
              value={`${kwhPrice.format(row.savingPerKwh)} × ${kwhText} kWh = ${signedEur(row.grossSaving)}`}
            />
            <Fact
              label="Coste de llegar"
              value={mode === "onTheWay" ? "0 € (de camino)" : `${km(row.extraKm)} extra = ${row.travelCost > 0 ? "−" : ""}${eur(row.travelCost)}`}
            />
            <Fact label="Tiempo de carga" value={`${signedMin(row.chargeDiffMin)} vs. referencia`} />
            <Fact label="Tiempo de desplazamiento" value={mode === "onTheWay" ? "0 min (de camino)" : `${signedMin(row.extraDriveMin)} ida y vuelta`} />
          </>
        )}
      </dl>
      <p className="mt-2 text-[11px] text-ink-3">{priceBasisText(row)}</p>

      <div className="mt-2 flex flex-wrap gap-3 text-xs">
        <a href={mapsUrl(site)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="font-medium text-brand hover:underline">
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
            Es mi punto habitual: usar como referencia
          </button>
        )}
      </div>
    </li>
  );
}

function Badge({ children, className }: { children: ReactNode; className: string }) {
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${className}`}>{children}</span>;
}

function Fact({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="min-w-0" title={title}>
      <dt className="text-ink-3">{label}</dt>
      <dd className="truncate font-medium tabular text-ink" title={title ?? value}>
        {value}
      </dd>
    </div>
  );
}

export { SPEED_LABEL };
