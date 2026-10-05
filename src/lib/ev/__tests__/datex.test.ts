import { describe, expect, it } from "vitest";
import { openStateAt } from "../../hours";
import { parseDatex, parseDatexHours } from "../datex";

// Fragmento real del NAP (05/10/2026), recortado.
const XML = `<?xml version="1.0"?><d2:payload><com:publicationTime>2026-10-05T10:16:29.551+02:00</com:publicationTime>
<egi:energyInfrastructureTable id="ELECTROLINERAS">
<egi:energyInfrastructureSite id="2023002088" version="">
 <fac:name><com:values><com:value lang="es">Centro Porsche Baleares CP2</com:value></com:values></fac:name>
 <fac:lastUpdated>2023-11-21T11:39:04.000+01:00</fac:lastUpdated>
 <fac:operatingHours><fac:label>Miercoles (08:30 - 17:30) Lunes (00:00 - 23:59) Jueves (08:30 - 17:30) Martes (08:30 - 17:30) Sabado (08:30 - 17:30) Viernes (08:30 - 17:30) Domingo (00:00 - 23:59) </fac:label></fac:operatingHours>
 <locx:address><locx:postcode>7011</locx:postcode>
  <com:value lang="es">Dirección: Camí dels Reis 166</com:value>
  <com:value lang="es">Municipio: Palma</com:value>
  <com:value lang="es">Provincia: Balears, Illes</com:value></locx:address>
 <loc:coordinatesForDisplay><loc:latitude>39.5948</loc:latitude><loc:longitude>2.63586</loc:longitude></loc:coordinatesForDisplay>
 <fac:operator xsi:type="fac:OrganisationSpecification" id="ES*915" version=""><fac:name><com:values><com:value lang="es">Motor Box Mallorca SL</com:value></com:values></fac:name></fac:operator>
 <egi:connector><egi:connectorType>iec62196T2COMBO</egi:connectorType><egi:chargingMode>mode4DC</egi:chargingMode><egi:maxPowerAtSocket>350000.0</egi:maxPowerAtSocket></egi:connector>
 <egi:connector><egi:connectorType>iec62196T2</egi:connectorType><egi:chargingMode>mode3AC3p</egi:chargingMode><egi:maxPowerAtSocket>22000.0</egi:maxPowerAtSocket></egi:connector>
 <egi:connector><egi:connectorType>iec62196T2</egi:connectorType><egi:chargingMode>mode3AC3p</egi:chargingMode><egi:maxPowerAtSocket>22000.0</egi:maxPowerAtSocket></egi:connector>
 <egi:connector><egi:connectorType>iec62196T2COMBO</egi:connectorType><egi:chargingMode>mode4DC</egi:chargingMode><egi:maxPowerAtSocket>1000000.0</egi:maxPowerAtSocket></egi:connector>
</egi:energyInfrastructureSite>
</egi:energyInfrastructureTable></d2:payload>`;

describe("parseDatex", () => {
  const { sites, publicationTime } = parseDatex(XML);

  it("lee el emplazamiento", () => {
    expect(publicationTime).toBe("2026-10-05T10:16:29.551+02:00");
    expect(sites).toHaveLength(1);
    expect(sites[0]).toMatchObject({
      id: "2023002088",
      name: "Centro Porsche Baleares CP2",
      operator: "Motor Box Mallorca SL",
      lat: 39.5948,
      lon: 2.63586,
      address: "Camí dels Reis 166",
      town: "Palma",
    });
  });

  it("agrupa conectores iguales y descarta potencias imposibles (1.000 kW)", () => {
    expect(sites[0].connectors).toEqual([
      { type: "CCS", powerKw: 350, dc: true, count: 1 },
      { type: "T2", powerKw: 22, dc: false, count: 2 },
    ]);
  });

  it("rechaza un fichero que no es DATEX", () => {
    expect(() => parseDatex("<html></html>")).toThrow();
  });
});

describe("parseDatexHours", () => {
  const s = parseDatexHours("Miercoles (08:30 - 17:30) Lunes (00:00 - 23:59) Martes (08:30 - 17:30)");

  it("interpreta días y 24 h", () => {
    expect(openStateAt(s, 0 * 1440 + 3 * 60).status).toBe("open"); // lunes 03:00
    expect(openStateAt(s, 1 * 1440 + 20 * 60).status).toBe("closed"); // martes 20:00
    expect(openStateAt(s, 2 * 1440 + 9 * 60).status).toBe("open"); // miércoles 09:00
    expect(openStateAt(s, 3 * 1440 + 9 * 60).status).toBe("closed"); // jueves: no aparece → cerrado
  });

  it("vacío → sin confirmar", () => {
    expect(parseDatexHours("")).toBeNull();
  });
});
