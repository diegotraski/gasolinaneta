"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MLMap } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import type { OpenStatus } from "@/lib/hours";
import type { Verdict } from "@/lib/netSavings";
import { VERDICT_COLOR } from "./verdictColors";

/**
 * Mapa vectorial (MapLibre GL + teselas de OpenFreeMap: gratis, sin clave, uso comercial permitido).
 * Todas las gasolineras van en una capa WebGL; las mejores llevan además una etiqueta con precio y ahorro.
 */

export interface MapItem {
  id: string;
  lat: number;
  lon: number;
  price: number;
  netSaving: number;
  verdict: Verdict;
  open: OpenStatus;
  /** Texto principal de la etiqueta (por defecto, el precio por litro). */
  pinTitle?: string;
  /** Texto secundario de la etiqueta (por defecto, el ahorro neto). */
  pinSub?: string;
}

interface Props {
  center: { lat: number; lon: number };
  radiusKm: number;
  items: MapItem[];
  /** Ids con etiqueta de precio, en orden de prioridad (la primera gana si se solapan). */
  pinnedIds: string[];
  bestId?: string;
  referenceId?: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Trazado [lon, lat][] de la ruta hasta la gasolinera seleccionada. */
  route: [number, number][] | null;
  /** Espacio inferior ocupado por la tarjeta flotante, para encuadrar por encima de ella. */
  bottomInset: number;
}

// Ver scripts/copy-maplibre-worker.mjs.
maplibregl.setWorkerUrl(`/maplibre/${maplibregl.getVersion()}/maplibre-gl-worker.mjs`);

const STYLE_LIGHT = "https://tiles.openfreemap.org/styles/positron";
const STYLE_DARK = "https://tiles.openfreemap.org/styles/dark";
const darkQuery = () => window.matchMedia("(prefers-color-scheme: dark)");

const DRAW_ORDER: Verdict[] = ["notWorth", "marginal", "worth", "reference"];
const order = (v: Verdict) => DRAW_ORDER.indexOf(v);

const priceFmt = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const netFmt = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function circlePolygon(lat: number, lon: number, radiusKm: number, steps = 96): GeoJSON.Feature<GeoJSON.Polygon> {
  const coords: [number, number][] = [];
  const dLat = radiusKm / 110.574;
  const dLon = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    coords.push([lon + dLon * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [coords] } };
}

function boundsFor(lat: number, lon: number, radiusKm: number): maplibregl.LngLatBoundsLike {
  const dLat = radiusKm / 110.574;
  const dLon = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  return [
    [lon - dLon, lat - dLat],
    [lon + dLon, lat + dLat],
  ];
}

function pinElement(item: MapItem, kind: "best" | "reference" | "normal"): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "gn-pin";
  el.dataset.kind = kind;
  el.dataset.verdict = item.verdict;
  el.setAttribute("aria-label", `Gasolinera a ${priceFmt.format(item.price)} euros por litro`);
  if (kind === "best") {
    const badge = document.createElement("span");
    badge.className = "gn-pin__badge";
    badge.textContent = "Mejor";
    el.appendChild(badge);
  }
  const price = document.createElement("span");
  price.className = "gn-pin__price";
  price.textContent = item.pinTitle ?? priceFmt.format(item.price);
  const net = document.createElement("span");
  net.className = "gn-pin__net";
  net.textContent =
    kind === "reference"
      ? "Referencia"
      : (item.pinSub ?? `${item.netSaving >= 0 ? "+" : "−"}${netFmt.format(Math.abs(item.netSaving))} €`);
  el.append(price, net);
  return el;
}

export default function StationMap(props: Props) {
  const { center, radiusKm, items, pinnedIds, bestId, referenceId, selectedId, route, bottomInset } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const latest = useRef(props);
  const pins = useRef(new Map<string, { marker: maplibregl.Marker; el: HTMLButtonElement }>());
  const userMarker = useRef<maplibregl.Marker | null>(null);

  useEffect(() => {
    latest.current = props;
  });

  // ---------- Helpers que leen siempre las props más recientes ----------
  function addOverlayLayers(map: MLMap) {
    const empty: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
    for (const id of ["radius", "route", "stations"]) if (!map.getSource(id)) map.addSource(id, { type: "geojson", data: empty });
    const dark = darkQuery().matches;
    const brand = dark ? "#3ccf8e" : "#0f7a4f";

    map.addLayer({ id: "radius-fill", type: "fill", source: "radius", paint: { "fill-color": brand, "fill-opacity": 0.04 } });
    map.addLayer({
      id: "radius-line",
      type: "line",
      source: "radius",
      paint: { "line-color": brand, "line-width": 1.5, "line-opacity": 0.5, "line-dasharray": [2, 2] },
    });
    map.addLayer({
      id: "route-casing",
      type: "line",
      source: "route",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": dark ? "#0b1f15" : "#ffffff", "line-width": 9, "line-opacity": 0.9 },
    });
    map.addLayer({
      id: "route-line",
      type: "line",
      source: "route",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": brand, "line-width": 5 },
    });
    map.addLayer({
      id: "stations",
      type: "circle",
      source: "stations",
      paint: {
        "circle-color": ["get", "color"],
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 3, 12, 5.5, 15, 9],
        "circle-stroke-color": ["case", ["get", "selected"], dark ? "#ffffff" : "#17191c", dark ? "#1a1d20" : "#ffffff"],
        "circle-stroke-width": ["case", ["get", "selected"], 3, 1.5],
        "circle-opacity": ["case", ["==", ["get", "open"], "closed"], 0.3, ["==", ["get", "verdict"], "notWorth"], 0.6, 1],
        "circle-stroke-opacity": ["case", ["==", ["get", "open"], "closed"], 0.4, 1],
      },
    });
  }

  function syncRadius(map: MLMap) {
    const { center: c, radiusKm: r } = latest.current;
    (map.getSource("radius") as GeoJSONSource | undefined)?.setData(circlePolygon(c.lat, c.lon, r));
  }

  function syncStations(map: MLMap) {
    const { items: list, selectedId: sel } = latest.current;
    (map.getSource("stations") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      // El orden del array es el orden de dibujo: las que no compensan, debajo.
      features: [...list]
        .sort((a, b) => order(a.verdict) - order(b.verdict))
        .map((i) => ({
          type: "Feature",
          properties: { id: i.id, color: VERDICT_COLOR[i.verdict], verdict: i.verdict, open: i.open, selected: i.id === sel },
          geometry: { type: "Point", coordinates: [i.lon, i.lat] },
        })),
    });
  }

  function syncRoute(map: MLMap) {
    const r = latest.current.route;
    (map.getSource("route") as GeoJSONSource | undefined)?.setData(
      r ? { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: r } } : { type: "FeatureCollection", features: [] },
    );
  }

  /** Oculta etiquetas que se pisan, dejando visibles las de más prioridad. */
  function resolvePinCollisions(map: MLMap) {
    const { pinnedIds: ids, selectedId: sel } = latest.current;
    const priority = sel && pins.current.has(sel) ? [sel, ...ids.filter((i) => i !== sel)] : ids;
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    for (const id of priority) {
      const pin = pins.current.get(id);
      if (!pin) continue;
      const pt = map.project(pin.marker.getLngLat());
      // Tamaño real de la etiqueta (las del modo eléctrico son más anchas), con un pequeño margen.
      const p = { x: pt.x, y: pt.y, w: pin.el.offsetWidth + 6, h: pin.el.offsetHeight + 8 };
      const collides = placed.some((q) => Math.abs(q.x - p.x) < (q.w + p.w) / 2 && Math.abs(q.y - p.y) < (q.h + p.h) / 2);
      pin.el.style.visibility = collides ? "hidden" : "visible";
      pin.marker.getElement().style.zIndex = String(collides ? 0 : 1000 - placed.length);
      if (!collides) placed.push(p);
    }
  }

  function syncPins(map: MLMap) {
    const { items: list, pinnedIds: ids, bestId: best, referenceId: ref, selectedId: sel } = latest.current;
    const byId = new Map(list.map((i) => [i.id, i]));
    pins.current.forEach(({ marker }) => marker.remove());
    pins.current.clear();
    for (const id of ids) {
      const item = byId.get(id);
      if (!item) continue;
      const el = pinElement(item, id === best ? "best" : id === ref ? "reference" : "normal");
      if (id === sel) el.dataset.selected = "true";
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        latest.current.onSelect(id);
      });
      const marker = new maplibregl.Marker({ element: el, anchor: "bottom", offset: [0, -8] })
        .setLngLat([item.lon, item.lat])
        .addTo(map);
      pins.current.set(id, { marker, el });
    }
    resolvePinCollisions(map);
  }

  function syncUser(map: MLMap) {
    const c = latest.current.center;
    if (!userMarker.current) {
      const el = document.createElement("div");
      el.className = "gn-user";
      el.setAttribute("aria-label", "Tu ubicación");
      userMarker.current = new maplibregl.Marker({ element: el }).setLngLat([c.lon, c.lat]).addTo(map);
    } else {
      userMarker.current.setLngLat([c.lon, c.lat]);
    }
  }

  function fitArea(map: MLMap, duration = 600) {
    const { center: c, radiusKm: r, bottomInset: inset } = latest.current;
    map.fitBounds(boundsFor(c.lat, c.lon, r), { padding: { top: 24, left: 24, right: 64, bottom: 24 + inset }, duration });
  }

  // ---------- Crear / destruir el mapa ----------
  useEffect(() => {
    if (!containerRef.current) return;
    const { center: c } = latest.current;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: darkQuery().matches ? STYLE_DARK : STYLE_LIGHT,
      center: [c.lon, c.lat],
      zoom: 11,
      // La atribución (obligatoria) se muestra bajo el mapa, donde la tarjeta flotante no la tapa.
      attributionControl: false,
      cooperativeGestures: true,
      dragRotate: false,
      pitchWithRotate: false,
      locale: {
        "CooperativeGesturesHandler.WindowsHelpText": "Usa Ctrl + rueda para acercar el mapa",
        "CooperativeGesturesHandler.MacHelpText": "Usa ⌘ + rueda para acercar el mapa",
        "CooperativeGesturesHandler.MobileHelpText": "Usa dos dedos para mover el mapa",
      },
    });
    map.touchZoomRotate.disableRotation();
    mapRef.current = map;

    let first = true;
    // Cada vez que se carga un estilo (al inicio y al cambiar claro/oscuro) hay que volver a añadir nuestras capas.
    map.on("style.load", () => {
      addOverlayLayers(map);
      syncRadius(map);
      syncStations(map);
      syncRoute(map);
      syncPins(map);
      syncUser(map);
      if (first) fitArea(map, 0);
      first = false;
      setReady(true);
    });
    map.on("click", "stations", (e: maplibregl.MapLayerMouseEvent) => {
      const id = e.features?.[0]?.properties?.id;
      if (typeof id === "string") latest.current.onSelect(id);
    });
    map.on("mouseenter", "stations", () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", "stations", () => (map.getCanvas().style.cursor = ""));
    map.on("moveend", () => resolvePinCollisions(map));

    const mq = darkQuery();
    const onTheme = () => map.setStyle(mq.matches ? STYLE_DARK : STYLE_LIGHT, { diff: false });
    mq.addEventListener("change", onTheme);

    const pinMap = pins.current;
    return () => {
      mq.removeEventListener("change", onTheme);
      pinMap.forEach(({ marker }) => marker.remove());
      pinMap.clear();
      userMarker.current?.remove();
      userMarker.current = null;
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
    // El mapa se crea una sola vez; los cambios de datos se sincronizan en los efectos de abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Sincronización de datos ----------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    syncRadius(map);
    syncUser(map);
    fitArea(map);
  }, [ready, center.lat, center.lon, radiusKm]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    syncStations(map);
    syncPins(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, items, pinnedIds, bestId, referenceId, selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    syncRoute(map);
    if (route && route.length > 1) {
      const b = new maplibregl.LngLatBounds(route[0], route[0]);
      route.forEach((p) => b.extend(p));
      map.fitBounds(b, { padding: { top: 70, left: 50, right: 80, bottom: 50 + bottomInset }, maxZoom: 15, duration: 700 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, route]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === containerRef.current?.parentElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    const wrapper = containerRef.current?.parentElement;
    if (!wrapper) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void wrapper.requestFullscreen?.();
  };

  return (
    <>
      {/* h-full: maplibre-gl.css fuerza position:relative en el contenedor, así que no vale "absolute inset-0". */}
      <div ref={containerRef} className="h-full w-full" style={{ isolation: "isolate" }} />
      <div className="absolute right-3 top-3 z-10 flex flex-col gap-2">
        <div className="gn-map-ctrl">
          <button type="button" aria-label="Acercar" title="Acercar" onClick={() => mapRef.current?.zoomIn()}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <button type="button" aria-label="Alejar" title="Alejar" onClick={() => mapRef.current?.zoomOut()}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
              <path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="gn-map-ctrl">
          <button
            type="button"
            aria-label="Ver toda mi zona"
            title="Ver toda mi zona"
            onClick={() => mapRef.current && fitArea(mapRef.current)}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4" strokeLinecap="round" />
            </svg>
          </button>
          <button
            type="button"
            aria-label={fullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
            title={fullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
            onClick={toggleFullscreen}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              {fullscreen ? (
                <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" strokeLinecap="round" strokeLinejoin="round" />
              ) : (
                <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" strokeLinecap="round" strokeLinejoin="round" />
              )}
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}
