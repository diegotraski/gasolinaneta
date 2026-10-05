import { describe, expect, it } from "vitest";
import { normalizeResponse, parseSpanishNumber, type RawStation } from "../ministry";
import { findNearby, postalCodeCentroid } from "../nearby";

// Registro real recortado de la API (05/10/2026).
const raw = (over: Partial<RawStation> = {}): RawStation => ({
  "C.P.": "02250",
  "Dirección": "AVENIDA CASTILLA LA MANCHA, 26",
  "Horario": "L-D: 07:00-22:00",
  "Latitud": "39,211417",
  "Localidad": "ABENGIBRE",
  "Longitud (WGS84)": "-1,539167",
  "Municipio": "Abengibre",
  "Provincia": "ALBACETE",
  "Rótulo": "Nº 10.935",
  "Tipo Venta": "P",
  "IDEESS": "4375",
  "Precio Gasoleo A": "1,849",
  "Precio Gasolina 95 E5": "1,749",
  "Precio Gasolina 98 E5": "",
  "Precio Gasoleo Premium": "",
  ...over,
});

describe("parseSpanishNumber", () => {
  it("convierte coma decimal", () => {
    expect(parseSpanishNumber("1,749")).toBe(1.749);
    expect(parseSpanishNumber("-1,539167")).toBe(-1.539167);
  });
  it("devuelve null en vacío o basura", () => {
    expect(parseSpanishNumber("")).toBeNull();
    expect(parseSpanishNumber(undefined)).toBeNull();
    expect(parseSpanishNumber("n/d")).toBeNull();
  });
});

describe("normalizeResponse", () => {
  const snap = normalizeResponse({
    Fecha: "05/10/2026 11:06:43",
    ResultadoConsulta: "OK",
    Nota: "",
    ListaEESSPrecio: [
      raw(),
      raw({ IDEESS: "restringida", "Tipo Venta": "R" }),
      raw({ IDEESS: "sin-coords", Latitud: "" }),
      raw({ IDEESS: "sin-precios", "Precio Gasoleo A": "", "Precio Gasolina 95 E5": "" }),
      raw({ IDEESS: "precio-cero", "Precio Gasoleo A": "0,000", "Precio Gasolina 95 E5": "" }),
    ],
  });

  it("mapea los campos y los precios", () => {
    expect(snap.stations).toHaveLength(1);
    expect(snap.stations[0]).toMatchObject({
      id: "4375",
      brand: "Nº 10.935",
      town: "ABENGIBRE",
      lat: 39.211417,
      lon: -1.539167,
      prices: { g95: 1.749, diesel: 1.849 },
    });
    expect(snap.stations[0].prices.g98).toBeUndefined();
  });

  it("rechaza respuestas que no son OK", () => {
    expect(() =>
      normalizeResponse({ Fecha: "", ResultadoConsulta: "ERROR", Nota: "", ListaEESSPrecio: [] }),
    ).toThrow();
  });

  it("encuentra cercanas y centro de código postal", () => {
    expect(findNearby(snap.stations, 39.21, -1.54, "g95", 5)).toHaveLength(1);
    expect(findNearby(snap.stations, 39.21, -1.54, "g98", 5)).toHaveLength(0);
    expect(findNearby(snap.stations, 40.4, -3.7, "g95", 5)).toHaveLength(0);
    expect(postalCodeCentroid(snap.stations, "02250")?.label).toBe("02250 ABENGIBRE");
  });
});
