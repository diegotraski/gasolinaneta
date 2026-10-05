import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage, Todo } from "@/components/ContentPage";

export const metadata: Metadata = { title: "Política de privacidad", alternates: { canonical: "/privacidad" } };

// PLANTILLA: completa los datos marcados entre corchetes y haz revisar el texto antes de publicar.
export default function Privacy() {
  return (
    <ContentPage title="Política de privacidad">
      <h2>Responsable del tratamiento</h2>
      <p>
        <Todo>nombre o razón social</Todo>, con NIF <Todo>NIF</Todo> y correo electrónico <Todo>email</Todo>.
      </p>

      <h2>Qué datos tratamos y para qué</h2>
      <ul>
        <li>
          <strong>Ubicación aproximada.</strong> Si pulsas &quot;Usar mi ubicación&quot;, tu navegador nos facilita tus
          coordenadas, que redondeamos a unos 10 metros antes de enviarlas a nuestro servidor. Solo las usamos para
          buscar gasolineras cercanas y calcular las rutas por carretera; para esto último nuestro servidor envía esas
          coordenadas (sin ningún dato tuyo) al servicio de rutas OSRM. No las guardamos ni las asociamos a tu
          identidad. Base jurídica: tu consentimiento, que das al aceptar la solicitud del navegador.
        </li>
        <li>
          <strong>Dirección o código postal que escribas.</strong> Se usa solo para situarte en el mapa. Nuestro
          servidor la envía a Nominatim (OpenStreetMap Foundation) para obtener sus coordenadas. No la guardamos.
        </li>
        <li>
          <strong>Preferencias de la calculadora</strong> (combustible, litros, consumo) y tu elección de cookies. Se
          guardan solo en tu navegador (almacenamiento local) y no nos llegan.
        </li>
        <li>
          <strong>Datos técnicos de navegación</strong> (dirección IP, navegador) que registran automáticamente nuestro
          proveedor de alojamiento y, si los aceptas, los servicios de publicidad y analítica descritos en la{" "}
          <Link href="/cookies">política de cookies</Link>. Base jurídica: interés legítimo en la seguridad del servicio
          y, para publicidad y analítica, tu consentimiento.
        </li>
      </ul>

      <h2>Proveedores</h2>
      <ul>
        <li>
          Alojamiento: Vercel Inc. (puede implicar transferencias internacionales amparadas en el Marco de Privacidad de
          Datos UE-EE. UU. o en cláusulas contractuales tipo).
        </li>
        <li>Base de datos de precios: Supabase (no contiene datos personales).</li>
        <li>Mapas: el mapa se descarga de los servidores de OpenFreeMap, que reciben tu IP.</li>
        <li>
          Rutas: OSRM <Todo>servidor público de OSRM o instancia propia, según OSRM_URL</Todo>, que recibe coordenadas
          de origen y destino desde nuestro servidor, nunca tu IP.
        </li>
        <li>Publicidad, solo si la aceptas: Google Ireland Ltd. (AdSense).</li>
        <li>
          <Todo>analítica utilizada, p. ej. Plausible Analytics (sin cookies) o Google Analytics</Todo>
        </li>
      </ul>

      <h2>Conservación</h2>
      <p>
        No conservamos tu ubicación ni tus búsquedas. Los registros técnicos del alojamiento se conservan el tiempo que
        fije el proveedor por motivos de seguridad.
      </p>

      <h2>Tus derechos</h2>
      <p>
        Puedes ejercer tus derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad escribiendo
        a <Todo>email</Todo>. Si consideras que no hemos atendido tu solicitud, puedes reclamar ante la Agencia Española
        de Protección de Datos (aepd.es).
      </p>
    </ContentPage>
  );
}
