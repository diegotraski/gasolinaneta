/**
 * Precios de referencia por operador y potencia: TABLA CURADA A MANO.
 *
 * No existe ninguna fuente pública con el precio en vivo de cada punto de recarga: cada operador fija el suyo
 * y no tiene obligación de comunicarlo a un registro central. Estos precios son ORIENTATIVOS, se muestran
 * siempre como tales y hay que revisarlos cada pocas semanas.
 *
 * Reglas de esta tabla:
 *  - Solo se incluye un operador si su precio sin suscripción aparece en SU PROPIA web oficial.
 *  - Cada entrada lleva la URL exacta y la fecha en que se consultó.
 *  - Precios con IVA incluido, pago por uso (sin suscripción, sin descuentos de fidelización).
 *  - Los operadores que no publican tabla (p. ej. Endesa X Way, que remite a su app y varía el precio
 *    según la hora de inicio) usan el precio GENÉRICO, calculado como la mediana de los verificados.
 *
 * Para actualizar: revisa cada URL, cambia los precios y la fecha `checkedOn`. Los tests comprueban
 * que ninguna entrada tenga más de 60 días (src/lib/ev/__tests__/operatorPrices.test.ts).
 */

export interface PriceTier {
  /** Hasta esta potencia (kW, incluida). La última fila de cada operador usa Infinity. */
  upToKw: number;
  eurPerKwh: number;
}

export interface OperatorPrice {
  key: string;
  label: string;
  /** Cómo reconocer al operador en el campo "operator" del NAP. */
  match: RegExp;
  tiers: PriceTier[];
  /** "desde": el operador publica un precio mínimo, puede ser algo mayor en algunos puntos. */
  isMinimum?: boolean;
  source: string;
  checkedOn: string;
  note?: string;
}

export const OPERATOR_PRICES: OperatorPrice[] = [
  {
    key: "iberdrola",
    label: "Iberdrola | bp pulse",
    match: /IBERDROLA/i,
    tiers: [
      { upToKw: 7.4, eurPerKwh: 0.35 },
      { upToKw: 22, eurPerKwh: 0.39 },
      { upToKw: 60, eurPerKwh: 0.45 },
      { upToKw: 200, eurPerKwh: 0.6 },
      { upToKw: Infinity, eurPerKwh: 0.67 },
    ],
    source: "https://www.iberdrola.es/movilidad-electrica/productos/puntos-de-recarga",
    checkedOn: "2026-10-05",
    note: "La web indica que son orientativos y que el precio aplicable es el de la app.",
  },
  {
    key: "repsol",
    label: "Repsol",
    match: /REPSOL/i,
    tiers: [
      { upToKw: 22, eurPerKwh: 0.36 },
      { upToKw: 149, eurPerKwh: 0.48 },
      { upToKw: Infinity, eurPerKwh: 0.56 },
    ],
    source: "https://www.repsol.es/particulares/vehiculos/movilidad-electrica/pago-por-recarga/",
    checkedOn: "2026-10-05",
    note: "Publica «recarga normal», «rápida (desde)» y «ultrarrápida»; asignamos ≤22 kW, 23–149 kW y ≥150 kW.",
  },
  {
    key: "wenea",
    label: "Wenea",
    match: /WENEA/i,
    tiers: [
      { upToKw: 22, eurPerKwh: 0.39 },
      { upToKw: 150, eurPerKwh: 0.49 },
      { upToKw: Infinity, eurPerKwh: 0.59 },
    ],
    source: "https://wenea.com/carga-con-wenea/tarifas-de-carga/",
    checkedOn: "2026-10-05",
  },
  {
    key: "zunder",
    label: "Zunder",
    match: /ZUNDER|EASYCHARG/i,
    tiers: [{ upToKw: Infinity, eurPerKwh: 0.59 }],
    source: "https://www.zunder.com/usuario-ve/#tarifas",
    checkedOn: "2026-10-05",
    note: "Precio plano en toda su red (sin plan).",
  },
  {
    key: "ionity",
    label: "IONITY",
    match: /IONITY/i,
    tiers: [{ upToKw: Infinity, eurPerKwh: 0.62 }],
    isMinimum: true,
    source: "https://www.ionity.eu/es",
    checkedOn: "2026-10-05",
    note: "Publica «actualmente desde 0,62 €/kWh» con la app sin suscripción.",
  },
];

/** Velocidades de carga, como las muestra la interfaz. */
export type SpeedClass = "slow" | "fast" | "ultra";
export const SPEED_LABEL: Record<SpeedClass, string> = {
  slow: "Lenta (≤22 kW)",
  fast: "Rápida (23–149 kW)",
  ultra: "Ultrarrápida (≥150 kW)",
};
export const speedClass = (kw: number): SpeedClass => (kw <= 22 ? "slow" : kw < 150 ? "fast" : "ultra");

function tierPrice(op: OperatorPrice, kw: number): number {
  return (op.tiers.find((t) => kw <= t.upToKw) ?? op.tiers[op.tiers.length - 1]).eurPerKwh;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Potencia representativa de cada velocidad para calcular el precio genérico. */
const SPEED_SAMPLE_KW: Record<SpeedClass, number> = { slow: 22, fast: 100, ultra: 300 };

/**
 * Precio genérico por velocidad: mediana de los operadores verificados, redondeada al céntimo.
 * Para la carga lenta solo cuentan los operadores con tarifa por tramos: los de precio plano
 * (Zunder, IONITY) son redes de carga rápida y no tienen puntos lentos.
 */
export const GENERIC_PRICE: Record<SpeedClass, number> = Object.fromEntries(
  (Object.keys(SPEED_SAMPLE_KW) as SpeedClass[]).map((s) => {
    const ops = s === "slow" ? OPERATOR_PRICES.filter((op) => op.tiers.length > 1) : OPERATOR_PRICES;
    return [s, Math.round(median(ops.map((op) => tierPrice(op, SPEED_SAMPLE_KW[s]))) * 100) / 100];
  }),
) as Record<SpeedClass, number>;

export interface PriceEstimate {
  eurPerKwh: number;
  /** "operator": tarifa publicada por el operador. "generic": operador sin tabla pública → mediana del mercado. */
  basis: "operator" | "generic";
  operatorKey?: string;
  operatorLabel?: string;
  isMinimum?: boolean;
  checkedOn: string;
}

export function operatorFor(operatorName: string): OperatorPrice | undefined {
  return OPERATOR_PRICES.find((op) => op.match.test(operatorName));
}

export const PRICES_CHECKED_ON = OPERATOR_PRICES.map((o) => o.checkedOn).sort()[0];

export function estimatePrice(operatorName: string, connectorKw: number): PriceEstimate {
  const op = operatorFor(operatorName);
  if (op) {
    return {
      eurPerKwh: tierPrice(op, connectorKw),
      basis: "operator",
      operatorKey: op.key,
      operatorLabel: op.label,
      isMinimum: op.isMinimum,
      checkedOn: op.checkedOn,
    };
  }
  return { eurPerKwh: GENERIC_PRICE[speedClass(connectorKw)], basis: "generic", checkedOn: PRICES_CHECKED_ON };
}
