// MapLibre GL v6 carga su worker con `new URL(..., import.meta.url)`, que el bundler de Next no resuelve.
// Copiamos el worker (y el módulo compartido que importa) a public/, en una carpeta por versión
// para que la caché del navegador no sirva un worker viejo tras actualizar.
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const pkgPath = require.resolve("maplibre-gl/package.json");
const { version } = JSON.parse(readFileSync(pkgPath, "utf8"));
const src = path.join(path.dirname(pkgPath), "dist");
const dest = path.join(process.cwd(), "public", "maplibre", version);
mkdirSync(dest, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) copyFileSync(path.join(src, file), path.join(dest, file));
console.log(`maplibre-gl ${version}: worker copiado a public/maplibre/${version}/`);
