export type ConnectorType = "T2" | "CCS" | "CHAdeMO" | "Schuko" | "T1" | "other";

export interface EvConnector {
  type: ConnectorType;
  /** Potencia máxima del conector, en kW. */
  powerKw: number;
  /** Corriente continua (carga rápida) o alterna. */
  dc: boolean;
  /** Cuántos conectores iguales hay en el emplazamiento. */
  count: number;
}

/** Un emplazamiento de recarga (puede tener varios puntos y conectores). */
export interface EvSite {
  id: string;
  name: string;
  operator: string;
  lat: number;
  lon: number;
  address: string;
  town: string;
  province: string;
  /** Horario tal cual lo publica el NAP ("Lunes (00:00 - 23:59) …"). */
  hours: string;
  connectors: EvConnector[];
  /** Última actualización del registro según el NAP (ISO). */
  lastUpdated: string;
}

export interface NearbyEvSite extends EvSite {
  straightKm: number;
  timeZone: string;
}
