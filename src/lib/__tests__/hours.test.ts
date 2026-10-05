import { describe, expect, it } from "vitest";
import { minuteOfWeek, openStateAt, parseHours, timeZoneForProvince } from "../hours";

const at = (day: number, hh: number, mm = 0) => day * 1440 + hh * 60 + mm; // día 0 = lunes

describe("parseHours", () => {
  it("24 h todos los días", () => {
    expect(parseHours("L-D: 24H")).toEqual([[0, 7 * 1440]]);
    expect(openStateAt(parseHours("L-D: 24H"), at(3, 3)).status).toBe("open");
  });

  it("horario diario simple, con y sin cero inicial", () => {
    const s = parseHours("L-D: 7:00-22:00");
    expect(openStateAt(s, at(2, 6, 59)).status).toBe("closed");
    expect(openStateAt(s, at(2, 7)).status).toBe("open");
    expect(openStateAt(s, at(2, 21, 45))).toMatchObject({ status: "closingSoon", minutes: 15 });
    expect(openStateAt(s, at(2, 22)).label).toBe("Cerrada · abre el jueves a las 07:00");
    expect(openStateAt(s, at(2, 5)).label).toBe("Cerrada · abre a las 07:00");
  });

  it("días distintos y jornada partida", () => {
    const s = parseHours("L-S: 07:00-14:00 y 16:00-21:00; D: 08:00-14:00");
    expect(openStateAt(s, at(0, 15)).status).toBe("closed");
    expect(openStateAt(s, at(0, 16, 30)).status).toBe("open");
    expect(openStateAt(s, at(6, 15)).status).toBe("closed");
    expect(openStateAt(s, at(6, 9)).label).toBe("Abierta · cierra a las 14:00");
  });

  it("tolera espacios raros ('8:00 -21:00')", () => {
    expect(parseHours("L-S: 8:00 -21:00; D: 08:00-14:00 y 16:00-21:00")).not.toBeNull();
  });

  it("cruza la medianoche, también de domingo a lunes", () => {
    const s = parseHours("L-D: 22:00-06:00");
    expect(openStateAt(s, at(6, 23)).label).toBe("Abierta · cierra a las 06:00");
    expect(openStateAt(s, at(0, 3)).status).toBe("open");
    expect(openStateAt(s, at(0, 12)).status).toBe("closed");
  });

  it("devuelve null (sin confirmar) en datos ambiguos o erróneos", () => {
    expect(parseHours("L: 07:00-22:00")).toBeNull();
    expect(parseHours("L-D: 00:01-00:02")).toBeNull();
    expect(parseHours("Consultar")).toBeNull();
    expect(openStateAt(null, 0).status).toBe("unknown");
  });
});

describe("zonas horarias", () => {
  it("Canarias va una hora por detrás", () => {
    expect(timeZoneForProvince("PALMAS (LAS)")).toBe("Atlantic/Canary");
    expect(timeZoneForProvince("SANTA CRUZ DE TENERIFE")).toBe("Atlantic/Canary");
    expect(timeZoneForProvince("MADRID")).toBe("Europe/Madrid");
    // Lunes 5 de octubre de 2026, 10:00 UTC = 12:00 en Madrid (CEST) y 11:00 en Canarias (WEST).
    const d = new Date("2026-10-05T10:00:00Z");
    expect(minuteOfWeek(d, "Europe/Madrid")).toBe(at(0, 12));
    expect(minuteOfWeek(d, "Atlantic/Canary")).toBe(at(0, 11));
  });
});
