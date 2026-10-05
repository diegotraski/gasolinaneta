import { describe, expect, it } from "vitest";
import { computeEvSavings, DC_AVERAGE_FACTOR, kwhNeeded, pickConnector, type EvCar } from "../evSavings";
import type { EvConnector } from "../types";

const car: EvCar = {
  batteryKwh: 60,
  currentPct: 20,
  targetPct: 80,
  consumptionKwh100: 17,
  maxAcKw: 11,
  maxDcKw: 100,
  connectors: ["T2", "CCS"],
};
const T2_22: EvConnector = { type: "T2", powerKw: 22, dc: false, count: 2 };
const CCS_50: EvConnector = { type: "CCS", powerKw: 50, dc: true, count: 1 };
const CCS_150: EvConnector = { type: "CCS", powerKw: 150, dc: true, count: 1 };
const CHADEMO_50: EvConnector = { type: "CHAdeMO", powerKw: 50, dc: true, count: 1 };

describe("computeEvSavings", () => {
  it("energía a cargar: 60 kWh × (80 % − 20 %) = 36 kWh", () => {
    expect(kwhNeeded(car)).toBe(36);
  });

  it("elige el conector compatible más rápido y respeta los filtros", () => {
    expect(pickConnector([T2_22, CCS_150, CHADEMO_50], car, ["slow", "fast", "ultra"])).toEqual(CCS_150);
    // CHAdeMO no es compatible con este coche.
    expect(pickConnector([CHADEMO_50], car, ["slow", "fast", "ultra"])).toBeNull();
    // Filtro de velocidad: solo lenta.
    expect(pickConnector([T2_22, CCS_150], car, ["slow"])).toEqual(T2_22);
  });

  it("calcula ahorro en euros y minutos extra por separado (cálculo a mano)", () => {
    const r = computeEvSavings(
      [
        // Referencia: Iberdrola 150 kW a 1 km por carretera → tramo 61-200 kW = 0,60 €/kWh.
        { id: "ref", operator: "IBERDROLA CLIENTES S.A.U", connectors: [CCS_150], straightKm: 1, roadKm: 1, roadMin: 3 },
        // Repsol 50 kW a 4 km → «rápida desde» 0,48 €/kWh.
        { id: "repsol", operator: "REPSOL SOLUCIONES ENERGÉTICAS SA", connectors: [CCS_50], straightKm: 3, roadKm: 4, roadMin: 8 },
      ],
      { car, mode: "dedicated", speeds: ["slow", "fast", "ultra"] },
    )!;
    expect(r.reference.id).toBe("ref");
    const repsol = r.ranked.find((x) => x.id === "repsol")!;
    // (0,60 − 0,48) × 36 = 4,32 €
    expect(repsol.grossSaving).toBeCloseTo(4.32, 6);
    // 2 × (4 − 1) = 6 km extra; 6/100 × 17 × 0,60 = 0,612 €
    expect(repsol.travelCost).toBeCloseTo(0.612, 6);
    expect(repsol.netSaving).toBeCloseTo(3.708, 6);
    // Carga: 36 / (50 × 0,75) × 60 = 57,6 min frente a 36 / (100 × 0,75) × 60 = 28,8 min → +28,8 min
    expect(repsol.chargeDiffMin).toBeCloseTo((36 / (50 * DC_AVERAGE_FACTOR)) * 60 - (36 / (100 * DC_AVERAGE_FACTOR)) * 60, 6);
    // Conducción: 2 × (8 − 3) = 10 min extra
    expect(repsol.extraDriveMin).toBeCloseTo(10, 6);
    expect(repsol.extraMin).toBeCloseTo(38.8, 6);
    expect(r.best.id).toBe("repsol");
    expect(r.fastest.id).toBe("ref");
  });

  it("en alterna el límite es el cargador de a bordo", () => {
    const r = computeEvSavings(
      [{ id: "ac", operator: "WENEA EMOBILITY", connectors: [T2_22], straightKm: 1, roadKm: 1, roadMin: 2 }],
      { car, mode: "dedicated", speeds: ["slow"] },
    )!;
    // 36 kWh / 11 kW = 196,4 min
    expect(r.reference.chargeMin).toBeCloseTo((36 / 11) * 60, 6);
    expect(r.reference.price.eurPerKwh).toBe(0.39);
  });

  it("operador sin tabla publicada → precio genérico marcado como tal", () => {
    const r = computeEvSavings([{ id: "e", operator: "ENDESA X WAY, S.L.", connectors: [CCS_150], straightKm: 1 }], {
      car,
      mode: "dedicated",
      speeds: ["ultra"],
    })!;
    expect(r.reference.price.basis).toBe("generic");
    expect(r.reference.estimated).toBe(true);
  });

  it("'de camino' no cuenta desplazamiento pero sí la diferencia de carga", () => {
    const r = computeEvSavings(
      [
        { id: "a", operator: "IBERDROLA", connectors: [CCS_150], straightKm: 1, roadKm: 1, roadMin: 3 },
        { id: "b", operator: "REPSOL", connectors: [CCS_50], straightKm: 9, roadKm: 12, roadMin: 15 },
      ],
      { car, mode: "onTheWay", speeds: ["fast", "ultra"] },
    )!;
    const b = r.ranked.find((x) => x.id === "b")!;
    expect(b.travelCost).toBe(0);
    expect(b.extraDriveMin).toBe(0);
    expect(b.chargeDiffMin).toBeGreaterThan(0);
  });

  it("devuelve null si no hay nada que cargar o ningún punto compatible", () => {
    expect(computeEvSavings([], { car, mode: "dedicated", speeds: ["fast"] })).toBeNull();
    expect(
      computeEvSavings([{ id: "x", operator: "", connectors: [CCS_50], straightKm: 1 }], {
        car: { ...car, currentPct: 90, targetPct: 80 },
        mode: "dedicated",
        speeds: ["fast"],
      }),
    ).toBeNull();
  });
});
