"use client";

import { useEffect, useState } from "react";
import { Calculator } from "./Calculator";
import { EvCalculator } from "./EvCalculator";
import { LocationPicker, type Location } from "./shared";

type Mode = "fuel" | "ev";
const MODE_KEY = "gn-mode-v1";

/** Selector "Gasolina / Diésel" ↔ "Eléctrico". La ubicación se comparte entre los dos modos. */
export function CalculatorModes() {
  const [mode, setMode] = useState<Mode>("fuel");
  const [location, setLocation] = useState<Location | null>(null);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(MODE_KEY) === "ev") setMode("ev");
    } catch {
      /* sin almacenamiento */
    }
  }, []);

  const choose = (m: Mode) => {
    setMode(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      /* sin almacenamiento */
    }
  };

  const picker = <LocationPicker location={location} onChange={setLocation} />;

  return (
    <div>
      <div role="tablist" aria-label="Tipo de vehículo" className="mb-5 inline-flex rounded-xl border border-line bg-surface p-1">
        {(
          [
            ["fuel", "Gasolina / Diésel", "M7 21V5a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v16M6 21h11M7 11h7M16 8h1.5A1.5 1.5 0 0 1 19 9.5V16a1 1 0 0 0 2 0V8l-3-3"],
            ["ev", "Eléctrico", "M13 2 4 14h7l-1 8 9-12h-7l1-8Z"],
          ] as const
        ).map(([value, label, icon]) => (
          <button
            key={value}
            role="tab"
            aria-selected={mode === value}
            onClick={() => choose(value)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              mode === value ? "bg-brand text-brand-ink shadow-sm" : "text-ink-2 hover:text-ink"
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d={icon} />
            </svg>
            {label}
          </button>
        ))}
      </div>
      {mode === "fuel" ? (
        <Calculator location={location} locationPicker={picker} />
      ) : (
        <EvCalculator location={location} locationPicker={picker} />
      )}
    </div>
  );
}
