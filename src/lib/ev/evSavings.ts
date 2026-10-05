import { DEFAULT_ROAD_FACTOR, type TripMode } from "../netSavings";
import { estimatePrice, speedClass, type PriceEstimate, type SpeedClass } from "./operatorPrices";
import type { ConnectorType, EvConnector } from "./types";

/**
 * "¿Compensa?" para coches eléctricos. A diferencia de la gasolina, aquí el tiempo importa tanto como el dinero,
 * así que devolvemos DOS resultados separados y nunca los mezclamos en una sola cifra:
 *
 *   kwh                 = batería × (% objetivo − % actual)
 *   ahorro_por_kwh      = precio_referencia − precio_candidato          (precios orientativos por operador)
 *   ahorro_bruto        = ahorro_por_kwh × kwh
 *   km_extra            = ida y vuelta a la candidata − ida y vuelta a la referencia   (0 si "de camino")
 *   coste_desplazamiento= km_extra / 100 × consumo_kWh_100km × precio_referencia
 *   ahorro_neto (€)     = ahorro_bruto − coste_desplazamiento
 *
 *   potencia_efectiva   = AC: min(conector, cargador de a bordo)
 *                         DC: min(conector, máximo DC del coche) × DC_AVERAGE_FACTOR (curva de carga)
 *   tiempo_carga        = kwh / potencia_efectiva × 60
 *   minutos_extra       = (tiempo de ida y vuelta extra) + (tiempo_carga_candidata − tiempo_carga_referencia)
 *
 * Referencia = el punto compatible más cercano por carretera (o el que elija el usuario).
 */

/**
 * En carga rápida DC el coche no mantiene su potencia máxima: baja a medida que se llena la batería.
 * Entre ~10 % y ~80 % la potencia media suele rondar el 70-80 % del pico; usamos 0,75.
 * Es una aproximación declarada en la interfaz, no un dato de cada modelo.
 */
export const DC_AVERAGE_FACTOR = 0.75;
/** Velocidad media para estimar minutos cuando aún no hay ruta real (km/h). */
const FALLBACK_SPEED_KMH = 40;

export interface EvCar {
  batteryKwh: number;
  currentPct: number;
  targetPct: number;
  consumptionKwh100: number;
  /** Potencia máxima del cargador de a bordo en alterna (kW). */
  maxAcKw: number;
  /** Potencia máxima de carga en continua (kW). */
  maxDcKw: number;
  connectors: ConnectorType[];
}

export interface EvCandidate {
  id: string;
  operator: string;
  connectors: EvConnector[];
  straightKm: number;
  /** Distancia por carretera (solo ida), si ya la conocemos. */
  roadKm?: number;
  /** Minutos de conducción (solo ida), si ya los conocemos. */
  roadMin?: number;
}

export interface EvParams {
  car: EvCar;
  mode: TripMode;
  speeds: SpeedClass[];
  referenceId?: string;
  roadFactor?: number;
}

export interface EvBreakdown {
  id: string;
  connector: EvConnector;
  speed: SpeedClass;
  price: PriceEstimate;
  effectiveKw: number;
  chargeMin: number;
  roadKm: number;
  driveMin: number;
  estimated: boolean;
  savingPerKwh: number;
  grossSaving: number;
  extraKm: number;
  travelCost: number;
  netSaving: number;
  extraDriveMin: number;
  chargeDiffMin: number;
  /** Minutos extra en total frente a la referencia (puede ser negativo: ahorras tiempo). */
  extraMin: number;
  isReference: boolean;
}

export interface EvResult {
  kwh: number;
  reference: EvBreakdown;
  /** Ordenadas por ahorro neto en euros. */
  ranked: EvBreakdown[];
  /** La de mayor ahorro neto (o la referencia si ninguna ahorra). */
  best: EvBreakdown;
  /** La que menos minutos extra suma (desplazamiento + carga). */
  fastest: EvBreakdown;
  /** La de menor precio orientativo por kWh. */
  cheapest: EvBreakdown;
}

export function kwhNeeded(car: EvCar): number {
  return Math.max(0, (car.batteryKwh * (car.targetPct - car.currentPct)) / 100);
}

export function effectiveKw(c: EvConnector, car: EvCar): number {
  return c.dc ? Math.min(c.powerKw, car.maxDcKw) * DC_AVERAGE_FACTOR : Math.min(c.powerKw, car.maxAcKw);
}

/** El conector que usarías en ese punto: compatible, de una velocidad permitida y el que más rápido carga. */
export function pickConnector(connectors: EvConnector[], car: EvCar, speeds: SpeedClass[]): EvConnector | null {
  let best: EvConnector | null = null;
  for (const c of connectors) {
    if (!car.connectors.includes(c.type) || !speeds.includes(speedClass(c.powerKw))) continue;
    if (!best || effectiveKw(c, car) > effectiveKw(best, car)) best = c;
  }
  return best;
}

export function computeEvSavings(candidates: EvCandidate[], params: EvParams): EvResult | null {
  const { car, mode, speeds, referenceId, roadFactor = DEFAULT_ROAD_FACTOR } = params;
  const kwh = kwhNeeded(car);
  if (kwh <= 0) return null;

  const usable = candidates
    .map((c) => ({ c, connector: pickConnector(c.connectors, car, speeds) }))
    .filter((x): x is { c: EvCandidate; connector: EvConnector } => x.connector !== null);
  if (usable.length === 0) return null;

  const kmOf = (c: EvCandidate) => c.roadKm ?? c.straightKm * roadFactor;
  const minOf = (c: EvCandidate) => c.roadMin ?? (kmOf(c) / FALLBACK_SPEED_KMH) * 60;
  const byDistance = [...usable].sort((a, b) => kmOf(a.c) - kmOf(b.c));
  const ref = (referenceId && usable.find((u) => u.c.id === referenceId)) || byDistance[0];

  const refPrice = estimatePrice(ref.c.operator, ref.connector.powerKw).eurPerKwh;
  const refChargeMin = (kwh / effectiveKw(ref.connector, car)) * 60;
  const refKm = kmOf(ref.c);
  const refMin = minOf(ref.c);

  const rows: EvBreakdown[] = usable.map(({ c, connector }) => {
    const price = estimatePrice(c.operator, connector.powerKw);
    const eff = effectiveKw(connector, car);
    const chargeMin = (kwh / eff) * 60;
    const roadKm = kmOf(c);
    const driveMin = minOf(c);
    const savingPerKwh = refPrice - price.eurPerKwh;
    const grossSaving = savingPerKwh * kwh;
    const extraKm = mode === "dedicated" ? Math.max(0, 2 * roadKm - 2 * refKm) : 0;
    const travelCost = (extraKm / 100) * car.consumptionKwh100 * refPrice;
    const extraDriveMin = mode === "dedicated" ? Math.max(0, 2 * driveMin - 2 * refMin) : 0;
    const chargeDiffMin = chargeMin - refChargeMin;
    return {
      id: c.id,
      connector,
      speed: speedClass(connector.powerKw),
      price,
      effectiveKw: eff,
      chargeMin,
      roadKm,
      driveMin,
      estimated: c.roadKm === undefined,
      savingPerKwh,
      grossSaving,
      extraKm,
      travelCost,
      netSaving: grossSaving - travelCost,
      extraDriveMin,
      chargeDiffMin,
      extraMin: extraDriveMin + chargeDiffMin,
      isReference: c.id === ref.c.id,
    };
  });

  const ranked = [...rows].sort((a, b) => b.netSaving - a.netSaving || a.extraMin - b.extraMin);
  const reference = rows.find((r) => r.isReference)!;
  return {
    kwh,
    reference,
    ranked,
    best: ranked[0].netSaving > 0 ? ranked[0] : reference,
    fastest: [...rows].sort((a, b) => a.extraMin - b.extraMin || b.netSaving - a.netSaving)[0],
    cheapest: [...rows].sort((a, b) => a.price.eurPerKwh - b.price.eurPerKwh || a.roadKm - b.roadKm)[0],
  };
}
