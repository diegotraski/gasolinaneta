import type { FuelId } from "./fuels";

export interface Station {
  id: string;
  brand: string;
  address: string;
  town: string;
  province: string;
  postalCode: string;
  lat: number;
  lon: number;
  hours: string;
  prices: Partial<Record<FuelId, number>>;
}

export interface Snapshot {
  /** Fecha que devuelve la API ("dd/mm/aaaa hh:mm:ss", hora peninsular). */
  ministryDate: string;
  /** Momento en que nuestro servidor descargó los datos (ISO). */
  fetchedAt: string;
  stations: Station[];
}

/** Lo que devuelve /api/stations: una gasolinera con el precio del combustible pedido y su distancia en línea recta. */
export interface NearbyStation {
  id: string;
  brand: string;
  address: string;
  town: string;
  lat: number;
  lon: number;
  hours: string;
  /** Zona horaria para interpretar el horario (Canarias va una hora por detrás). */
  timeZone: string;
  price: number;
  straightKm: number;
}
