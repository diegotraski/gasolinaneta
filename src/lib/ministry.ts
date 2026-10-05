import { FUELS, FUEL_IDS } from "./fuels";
import type { Snapshot, Station } from "./types";

export const MINISTRY_URL =
  "https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/";

/** Esquema verificado con una llamada real el 05/10/2026 (11.478 estaciones). Solo tipamos los campos que usamos. */
export interface RawStation {
  "C.P.": string;
  "Dirección": string;
  "Horario": string;
  "Latitud": string;
  "Localidad": string;
  "Longitud (WGS84)": string;
  "Municipio": string;
  "Provincia": string;
  "Rótulo": string;
  "Tipo Venta": string;
  "IDEESS": string;
  [field: string]: string;
}

export interface RawResponse {
  Fecha: string;
  ListaEESSPrecio: RawStation[];
  Nota: string;
  ResultadoConsulta: string;
}

/** La API usa coma decimal ("1,749"). Devuelve null si el campo está vacío o no es un número válido. */
export function parseSpanishNumber(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number(value.trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function normalizeStation(raw: RawStation): Station | null {
  const lat = parseSpanishNumber(raw["Latitud"]);
  const lon = parseSpanishNumber(raw["Longitud (WGS84)"]);
  if (lat === null || lon === null) return null;
  // "R" = venta restringida a socios/cooperativistas: no sirve a un conductor cualquiera.
  if (raw["Tipo Venta"] && raw["Tipo Venta"] !== "P") return null;

  const prices: Station["prices"] = {};
  for (const id of FUEL_IDS) {
    const price = parseSpanishNumber(raw[FUELS[id].apiField]);
    // Descarta precios a 0 o absurdos que a veces aparecen por errores de carga.
    if (price !== null && price > 0.3 && price < 5) prices[id] = price;
  }
  if (Object.keys(prices).length === 0) return null;

  return {
    id: raw["IDEESS"],
    brand: raw["Rótulo"].trim(),
    address: raw["Dirección"].trim(),
    town: raw["Localidad"].trim() || raw["Municipio"].trim(),
    province: raw["Provincia"].trim(),
    postalCode: raw["C.P."].trim(),
    lat,
    lon,
    hours: raw["Horario"].trim(),
    prices,
  };
}

export function normalizeResponse(raw: RawResponse, fetchedAt = new Date()): Snapshot {
  if (raw.ResultadoConsulta !== "OK" || !Array.isArray(raw.ListaEESSPrecio)) {
    throw new Error(`Respuesta inesperada de la API del Ministerio: ${raw.ResultadoConsulta}`);
  }
  const stations: Station[] = [];
  for (const r of raw.ListaEESSPrecio) {
    const s = normalizeStation(r);
    if (s) stations.push(s);
  }
  return { ministryDate: raw.Fecha, fetchedAt: fetchedAt.toISOString(), stations };
}

/** Descarga el listado completo (~12 MB). Solo debe llamarse desde el servidor (cron o primer arranque). */
export async function fetchMinistrySnapshot(): Promise<Snapshot> {
  const res = await fetch(MINISTRY_URL, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`La API del Ministerio respondió ${res.status}`);
  return normalizeResponse((await res.json()) as RawResponse);
}
