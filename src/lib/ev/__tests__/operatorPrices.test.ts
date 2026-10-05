import { describe, expect, it } from "vitest";
import { estimatePrice, GENERIC_PRICE, OPERATOR_PRICES } from "../operatorPrices";

describe("tabla de precios de referencia", () => {
  it("cada operador tiene fuente oficial y fecha de consulta", () => {
    for (const op of OPERATOR_PRICES) {
      expect(op.source).toMatch(/^https:\/\//);
      expect(op.checkedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(op.tiers.at(-1)!.upToKw).toBe(Infinity);
    }
  });

  it("asigna los tramos de Iberdrola según su web", () => {
    expect(estimatePrice("IBERDROLA CLIENTES S.A.U", 7.4).eurPerKwh).toBe(0.35);
    expect(estimatePrice("IBERDROLA CLIENTES S.A.U", 22).eurPerKwh).toBe(0.39);
    expect(estimatePrice("IBERDROLA CLIENTES S.A.U", 50).eurPerKwh).toBe(0.45);
    expect(estimatePrice("IBERDROLA CLIENTES S.A.U", 150).eurPerKwh).toBe(0.6);
    expect(estimatePrice("IBERDROLA CLIENTES S.A.U", 350).eurPerKwh).toBe(0.67);
  });

  it("precio genérico = mediana de los verificados", () => {
    expect(GENERIC_PRICE).toEqual({ slow: 0.39, fast: 0.59, ultra: 0.59 });
  });

  // Alarma de mantenimiento: si falla, toca revisar las webs de los operadores y actualizar la tabla.
  it("ningún precio lleva más de 60 días sin revisar", () => {
    const now = Date.now();
    for (const op of OPERATOR_PRICES) {
      const days = (now - new Date(op.checkedOn).getTime()) / 86_400_000;
      expect(days, `${op.label}: revisar ${op.source}`).toBeLessThan(60);
    }
  });
});
