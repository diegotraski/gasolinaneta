import type { WeeklySchedule } from "../hours";
import type { ConnectorType, EvConnector, EvSite } from "./types";

/**
 * Lector del dataset oficial "Puntos de recarga eléctrica para vehículos" del Punto de Acceso Nacional (DGT/MITERD),
 * en formato DATEX II v3 (EnergyInfrastructureTablePublication).
 *
 * Verificado con una descarga real el 05/10/2026: ~83 MB de XML, 12.038 emplazamientos, licencia CC BY.
 * NO incluye precios ni estado de ocupación en tiempo real.
 *
 * Usamos un lector por expresiones regulares en lugar de un parser XML completo: el esquema es muy regular,
 * evita una dependencia y procesa los 83 MB en ~1-2 s.
 */

export const NAP_EV_URL = "https://nap.dgt.es/datex2/v3/miterd/EnergyInfrastructureTablePublication/electrolineras.xml";

const first = (block: string, re: RegExp) => block.match(re)?.[1]?.trim();
const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");

const CONNECTOR_MAP: Record<string, ConnectorType> = {
  iec62196T2: "T2",
  iec62196T2COMBO: "CCS",
  chademo: "CHAdeMO",
  domesticF: "Schuko",
  domesticE: "Schuko",
  iec62196T1: "T1",
};

/** Potencias por encima de esto son errores de carga (hay registros con 1.000 kW). */
const MAX_PLAUSIBLE_KW = 600;

function parseConnectors(site: string): EvConnector[] {
  const found = new Map<string, EvConnector>();
  for (const m of site.matchAll(/<egi:connector>([\s\S]*?)<\/egi:connector>/g)) {
    const c = m[1];
    const rawType = first(c, /<egi:connectorType>([^<]+)</);
    const mode = first(c, /<egi:chargingMode>([^<]+)</) ?? "";
    const watts = Number(first(c, /<egi:maxPowerAtSocket>([^<]+)</));
    if (!rawType || !Number.isFinite(watts) || watts <= 0) continue;
    const powerKw = Math.round((watts / 1000) * 10) / 10;
    if (powerKw > MAX_PLAUSIBLE_KW) continue;
    const type = CONNECTOR_MAP[rawType] ?? "other";
    const dc = mode === "mode4DC" || type === "CCS" || type === "CHAdeMO";
    const key = `${type}|${powerKw}|${dc}`;
    const prev = found.get(key);
    if (prev) prev.count += 1;
    else found.set(key, { type, powerKw, dc, count: 1 });
  }
  return [...found.values()].sort((a, b) => b.powerKw - a.powerKw);
}

const DAY_INDEX: Record<string, number> = { lunes: 0, martes: 1, miercoles: 2, jueves: 3, viernes: 4, sabado: 5, domingo: 6 };

/**
 * "Miercoles (08:30 - 17:30) Lunes (00:00 - 23:59) …" → horario semanal.
 * Días que no aparecen = cerrado. "00:00 - 23:59" se trata como 24 h.
 */
export function parseDatexHours(label: string): WeeklySchedule | null {
  const norm = label.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const intervals: [number, number][] = [];
  let matched = 0;
  for (const m of norm.matchAll(/(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\s*\((\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\)/g)) {
    matched++;
    const day = DAY_INDEX[m[1]];
    const start = Number(m[2]) * 60 + Number(m[3]);
    let end = Number(m[4]) * 60 + Number(m[5]);
    if (end >= 1439 || end === 0) end = 1440;
    if (end <= start) end += 1440; // cruza medianoche
    intervals.push([day * 1440 + start, day * 1440 + end]);
  }
  if (matched === 0) return null;
  // Unir solapes y normalizar a la semana.
  const week = 7 * 1440;
  const split: [number, number][] = [];
  for (const [s, e] of intervals) {
    if (e <= week) split.push([s, e]);
    else split.push([s, week], [0, e - week]);
  }
  split.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [s, e] of split) {
    const last = merged[merged.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else merged.push([s, e]);
  }
  return merged;
}

function addressLine(site: string, prefix: string): string {
  const re = new RegExp(`<com:value lang="es">${prefix}:\\s*([^<]*)<`);
  return decode(first(site, re) ?? "");
}

export function parseSite(site: string): EvSite | null {
  const id = first(site, /^[^>]*id="([^"]+)"/);
  const lat = Number(first(site, /<loc:latitude>([^<]+)</));
  const lon = Number(first(site, /<loc:longitude>([^<]+)</));
  if (!id || !Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) return null;

  const connectors = parseConnectors(site);
  if (connectors.length === 0) return null;

  const name = decode(first(site, /<fac:name>\s*<com:values>\s*<com:value lang="es">([^<]*)</) ?? "");
  const operatorBlock = site.match(/<fac:operator [\s\S]*?<\/fac:operator>/)?.[0] ?? "";
  const operator = decode(first(operatorBlock, /<com:value lang="es">([^<]*)</) ?? "");
  const hoursLabel = decode(first(site, /<fac:label>([^<]*)</) ?? "");

  return {
    id,
    name,
    operator,
    lat,
    lon,
    address: addressLine(site, "Dirección"),
    town: addressLine(site, "Municipio"),
    province: addressLine(site, "Provincia"),
    hours: hoursLabel,
    connectors,
    lastUpdated: first(site, /<fac:lastUpdated>([^<]+)</) ?? "",
  };
}

export interface ParsedDatex {
  publicationTime: string;
  sites: EvSite[];
}

export function parseDatex(xml: string): ParsedDatex {
  const publicationTime = first(xml.slice(0, 5000), /<com:publicationTime>([^<]+)</);
  if (!publicationTime || !xml.includes("energyInfrastructureTable")) {
    throw new Error("El fichero del NAP no tiene el formato DATEX II esperado");
  }
  const sites: EvSite[] = [];
  const open = "<egi:energyInfrastructureSite ";
  const close = "</egi:energyInfrastructureSite>";
  let pos = xml.indexOf(open);
  while (pos !== -1) {
    const end = xml.indexOf(close, pos);
    if (end === -1) break;
    const site = parseSite(xml.slice(pos + open.length, end));
    if (site) sites.push(site);
    pos = xml.indexOf(open, end);
  }
  return { publicationTime, sites };
}
