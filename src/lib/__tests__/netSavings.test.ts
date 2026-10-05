import { describe, expect, it } from "vitest";
import { computeNetSavings, verdictFor, type Candidate } from "../netSavings";

// Casos de la Fase 0 (datos reales del Ministerio, 05/10/2026, Gasolina 95, viaje dedicado).
// Las distancias son en línea recta; el factor carretera 1,3 se aplica dentro de la fórmula.
const valencia: Candidate[] = [
  { id: "repsol-valencia", price: 1.865, straightKm: 1.1 / 1.3 },
  { id: "alcampo-alboraya", price: 1.649, straightKm: 7.6 / 1.3 },
  { id: "galp-quart", price: 1.629, straightKm: 14.4 / 1.3 },
];

describe("computeNetSavings", () => {
  it("calcula el desglose a mano: Valencia, 40 l, 6 l/100 km", () => {
    const r = computeNetSavings(valencia, { liters: 40, consumptionL100: 6, mode: "dedicated" })!;
    const alcampo = r.ranked.find((x) => x.id === "alcampo-alboraya")!;
    // (1,865 − 1,649) × 40 = 8,64 €
    expect(alcampo.grossSaving).toBeCloseTo(8.64, 6);
    // 2 × 7,6 − 2 × 1,1 = 13,0 km extra
    expect(alcampo.extraKm).toBeCloseTo(13.0, 6);
    // 13 / 100 × 6 × 1,865 = 1,4547 €
    expect(alcampo.travelCost).toBeCloseTo(1.4547, 4);
    expect(alcampo.netSaving).toBeCloseTo(7.1853, 4);

    const galp = r.ranked.find((x) => x.id === "galp-quart")!;
    // (1,865 − 1,629) × 40 = 9,44 € ; 2 × (14,4 − 1,1) = 26,6 km ; 26,6/100 × 6 × 1,865 = 2,97654 €
    expect(galp.netSaving).toBeCloseTo(9.44 - 2.97654, 4);
  });

  it("detecta cuando la más barata no es la que más ahorra", () => {
    const r = computeNetSavings(valencia, { liters: 40, consumptionL100: 6, mode: "dedicated" })!;
    expect(r.cheapest.id).toBe("galp-quart");
    expect(r.best.id).toBe("alcampo-alboraya");
    expect(r.cheapestIsNotBest).toBe(true);
    expect(r.ranked.map((x) => x.id)).toEqual(["alcampo-alboraya", "galp-quart", "repsol-valencia"]);
  });

  it("la más barata puede hacerte perder dinero (Madrid, 20 l, 8 l/100 km)", () => {
    const madrid: Candidate[] = [
      { id: "ref", price: 1.849, straightKm: 1.3 },
      { id: "lejana", price: 1.549, straightKm: 28.5 },
      { id: "vecina", price: 1.748, straightKm: 1.4 },
    ];
    const r = computeNetSavings(madrid, { liters: 20, consumptionL100: 8, mode: "dedicated" })!;
    const lejana = r.ranked.find((x) => x.id === "lejana")!;
    // ahorro 0,30 × 20 = 6 € ; extra 2 × (28,5 − 1,3) × 1,3 = 70,72 km ; coste 70,72/100 × 8 × 1,849 = 10,461 €
    expect(lejana.netSaving).toBeCloseTo(6 - 10.4609, 3);
    expect(verdictFor(lejana)).toBe("notWorth");
    expect(r.best.id).toBe("vecina");
  });

  it("'de camino' no cobra el desplazamiento", () => {
    const r = computeNetSavings(valencia, { liters: 40, consumptionL100: 6, mode: "onTheWay" })!;
    expect(r.ranked.every((x) => x.travelCost === 0 && x.extraKm === 0)).toBe(true);
    expect(r.best.id).toBe("galp-quart");
    expect(r.cheapestIsNotBest).toBe(false);
  });

  it("si nada compensa, recomienda quedarse en la referencia", () => {
    const r = computeNetSavings(
      [
        { id: "cerca", price: 1.7, straightKm: 0.5 },
        { id: "lejos-y-cara", price: 1.75, straightKm: 5 },
        { id: "lejos-casi-igual", price: 1.699, straightKm: 10 },
      ],
      { liters: 40, consumptionL100: 6, mode: "dedicated" },
    )!;
    expect(r.best.id).toBe("cerca");
    expect(r.best.isReference).toBe(true);
    expect(verdictFor(r.best)).toBe("reference");
  });

  it("respeta una referencia elegida a mano y no cobra km a las que están más cerca que ella", () => {
    const r = computeNetSavings(valencia, {
      liters: 40,
      consumptionL100: 6,
      mode: "dedicated",
      referenceId: "alcampo-alboraya",
    })!;
    expect(r.reference.id).toBe("alcampo-alboraya");
    const repsol = r.ranked.find((x) => x.id === "repsol-valencia")!;
    expect(repsol.extraKm).toBe(0);
    expect(repsol.netSaving).toBeCloseTo((1.649 - 1.865) * 40, 6);
  });

  it("devuelve null sin candidatas", () => {
    expect(computeNetSavings([], { liters: 40, consumptionL100: 6, mode: "dedicated" })).toBeNull();
  });

  it("clasifica el ahorro marginal", () => {
    const r = computeNetSavings(
      [
        { id: "ref", price: 1.7, straightKm: 1 },
        { id: "marginal", price: 1.69, straightKm: 1 },
      ],
      { liters: 40, consumptionL100: 6, mode: "dedicated" },
    )!;
    expect(verdictFor(r.ranked.find((x) => x.id === "marginal")!)).toBe("marginal");
  });
});

describe("distancias reales por carretera", () => {
  it("usa roadKm cuando existe y elige la referencia por carretera", () => {
    const r = computeNetSavings(
      [
        // Más cerca en línea recta, pero hay que rodear un río: 4 km por carretera.
        { id: "otro-lado-del-rio", price: 1.8, straightKm: 0.8, roadKm: 4 },
        { id: "misma-orilla", price: 1.8, straightKm: 1.5, roadKm: 1.7 },
        { id: "barata", price: 1.7, straightKm: 5 },
      ],
      { liters: 40, consumptionL100: 6, mode: "dedicated" },
    )!;
    expect(r.reference.id).toBe("misma-orilla");
    expect(r.reference.estimated).toBe(false);
    const barata = r.ranked.find((x) => x.id === "barata")!;
    expect(barata.estimated).toBe(true);
    // extra = 2 × 5 × 1,3 − 2 × 1,7 = 9,6 km
    expect(barata.extraKm).toBeCloseTo(9.6, 6);
  });
});
