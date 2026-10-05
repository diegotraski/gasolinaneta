import type { Metadata } from "next";
import { ContentPage, Todo } from "@/components/ContentPage";
import { CookieSettingsLink } from "@/components/consent";

export const metadata: Metadata = { title: "Política de cookies", alternates: { canonical: "/cookies" } };

// PLANTILLA: revisa que las tablas coincidan con los servicios que actives (AdSense, analítica).
export default function Cookies() {
  return (
    <ContentPage title="Política de cookies">
      <p>
        Las cookies y tecnologías similares (como el almacenamiento local del navegador) permiten guardar información en
        tu dispositivo. Esta página explica cuáles usamos.
      </p>

      <h2>Necesarias (no requieren consentimiento)</h2>
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Tipo</th>
            <th>Finalidad</th>
            <th>Duración</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>gn-prefs-v1</td>
            <td>Almacenamiento local, propio</td>
            <td>Recordar combustible, litros, consumo y modo de la calculadora</td>
            <td>Hasta que lo borres</td>
          </tr>
          <tr>
            <td>gn-consent-v1</td>
            <td>Almacenamiento local, propio</td>
            <td>Recordar tu elección sobre cookies</td>
            <td>Hasta que lo borres</td>
          </tr>
        </tbody>
      </table>

      <h2>Publicidad (solo con tu consentimiento)</h2>
      <p>
        Usamos Google AdSense para mostrar anuncios que financian el sitio. Google y sus socios pueden usar cookies para
        mostrar anuncios, medir su rendimiento y, si lo aceptas, personalizarlos. Más información en{" "}
        <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener noreferrer">
          cómo usa Google las cookies en publicidad
        </a>
        . Si no das tu consentimiento, no cargamos AdSense.
      </p>

      <h2>Analítica</h2>
      <p>
        <Todo>
          Indica aquí la herramienta usada. Si es Plausible: no usa cookies ni recoge datos personales. Si es Google
          Analytics: cookies _ga y _ga_*, de Google, con duración de hasta 2 años, solo con consentimiento.
        </Todo>
      </p>

      <h2>Cambiar tu elección</h2>
      <p>
        Puedes cambiar tus preferencias en cualquier momento desde el enlace &quot;Preferencias de cookies&quot; del pie
        de página, y borrar las cookies y el almacenamiento local desde la configuración de tu navegador.
      </p>
      <p>
        <CookieSettingsLink />
      </p>
    </ContentPage>
  );
}
