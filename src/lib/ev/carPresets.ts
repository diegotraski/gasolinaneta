import type { ConnectorType } from "./types";

/**
 * Perfiles orientativos para no obligar a nadie a saberse la ficha técnica de su coche.
 * Son valores redondos de referencia, no los de un modelo concreto; el usuario puede ajustarlos todos.
 */
export const EV_PRESETS = [
  { id: "small", label: "Utilitario (~42 kWh)", batteryKwh: 42, consumptionKwh100: 15, maxAcKw: 11, maxDcKw: 75 },
  { id: "compact", label: "Compacto (~60 kWh)", batteryKwh: 60, consumptionKwh100: 16, maxAcKw: 11, maxDcKw: 120 },
  { id: "large", label: "SUV / berlina (~80 kWh)", batteryKwh: 80, consumptionKwh100: 19, maxAcKw: 11, maxDcKw: 170 },
] as const;

export const CONNECTOR_LABEL: Record<ConnectorType, string> = {
  T2: "Tipo 2",
  CCS: "CCS",
  CHAdeMO: "CHAdeMO",
  Schuko: "Schuko",
  T1: "Tipo 1",
  other: "Otro",
};

/** Conectores que se pueden filtrar en la interfaz (los demás son residuales en el dataset). */
export const SELECTABLE_CONNECTORS: ConnectorType[] = ["T2", "CCS", "CHAdeMO", "Schuko"];
