/**
 * La fórmula "¿compensa o no?" — el corazón del producto.
 *
 * Referencia = la gasolinera más cercana (a la que irías de todos modos).
 * Para cada candidata:
 *   ahorro_por_litro      = precio_referencia − precio_candidata
 *   ahorro_total          = ahorro_por_litro × litros
 *   distancia_extra_km    = ida_y_vuelta(candidata) − ida_y_vuelta(referencia)   (viaje dedicado)
 *                         = 0                                                     (de camino; fase 2: desvío real)
 *   coste_desplazamiento  = distancia_extra_km / 100 × consumo × precio_referencia
 *   ahorro_neto           = ahorro_total − coste_desplazamiento
 *
 * Si una candidata trae `roadKm` (distancia real por carretera, de OSRM) se usa tal cual; si no,
 * se estima como línea recta × `roadFactor` (1,3 por defecto) y se marca como estimada.
 */

export type TripMode = "dedicated" | "onTheWay";

export const DEFAULT_ROAD_FACTOR = 1.3;

export interface Candidate {
  id: string;
  price: number;
  /** Distancia en línea recta desde el usuario, en km. */
  straightKm: number;
  /** Distancia real por carretera (solo ida), si ya la conocemos. */
  roadKm?: number;
}

export interface NetSavingsParams {
  liters: number;
  consumptionL100: number;
  mode: TripMode;
  roadFactor?: number;
  /** Fuerza una gasolinera concreta como referencia (p. ej. "mi habitual"). Por defecto, la más cercana. */
  referenceId?: string;
}

export interface Breakdown {
  id: string;
  price: number;
  roadKm: number;
  /** true si roadKm es una estimación (línea recta × factor) y no una ruta real. */
  estimated: boolean;
  savingPerLiter: number;
  grossSaving: number;
  extraKm: number;
  travelCost: number;
  netSaving: number;
  isReference: boolean;
}

export interface NetSavingsResult {
  reference: Breakdown;
  /** Ordenadas de mayor a menor ahorro neto. */
  ranked: Breakdown[];
  /** La de menor precio por litro (empate: la más cercana). */
  cheapest: Breakdown;
  /** La de mayor ahorro neto. Si ninguna supera a la referencia, es la propia referencia. */
  best: Breakdown;
  /** true cuando la más barata por litro NO es la que más ahorra: el momento en que la herramienta demuestra su valor. */
  cheapestIsNotBest: boolean;
}

export function computeNetSavings(candidates: Candidate[], params: NetSavingsParams): NetSavingsResult | null {
  if (candidates.length === 0) return null;
  const { liters, consumptionL100, mode, roadFactor = DEFAULT_ROAD_FACTOR, referenceId } = params;

  const kmOf = (c: Candidate) => c.roadKm ?? c.straightKm * roadFactor;
  // La referencia es la más cercana por carretera (o por estimación si aún no hay ruta).
  const byDistance = [...candidates].sort((a, b) => kmOf(a) - kmOf(b));
  const ref = (referenceId && candidates.find((c) => c.id === referenceId)) || byDistance[0];
  const refRoundTripKm = 2 * kmOf(ref);

  const rows: Breakdown[] = candidates.map((c) => {
    const roadKm = kmOf(c);
    const savingPerLiter = ref.price - c.price;
    const grossSaving = savingPerLiter * liters;
    // Con una referencia elegida a mano puede haber candidatas más cerca que ella: ir allí no "cuesta" extra.
    const extraKm = mode === "dedicated" ? Math.max(0, 2 * roadKm - refRoundTripKm) : 0;
    const travelCost = (extraKm / 100) * consumptionL100 * ref.price;
    return {
      id: c.id,
      price: c.price,
      roadKm,
      estimated: c.roadKm === undefined,
      savingPerLiter,
      grossSaving,
      extraKm,
      travelCost,
      netSaving: grossSaving - travelCost,
      isReference: c.id === ref.id,
    };
  });

  const ranked = [...rows].sort((a, b) => b.netSaving - a.netSaving || a.roadKm - b.roadKm);
  const reference = rows.find((r) => r.isReference)!;
  const cheapest = [...rows].sort((a, b) => a.price - b.price || a.roadKm - b.roadKm)[0];
  const best = ranked[0].netSaving > 0 ? ranked[0] : reference;

  return { reference, ranked, cheapest, best, cheapestIsNotBest: cheapest.id !== best.id };
}

/** Clasificación para colorear el mapa y la lista. */
export type Verdict = "reference" | "worth" | "marginal" | "notWorth";

/** Por debajo de este ahorro neto (€) consideramos que "apenas compensa" el paseo. */
export const MARGINAL_THRESHOLD_EUR = 0.5;

export function verdictFor(row: Pick<Breakdown, "isReference" | "netSaving">): Verdict {
  if (row.isReference) return "reference";
  if (row.netSaving >= MARGINAL_THRESHOLD_EUR) return "worth";
  if (row.netSaving > 0) return "marginal";
  return "notWorth";
}
