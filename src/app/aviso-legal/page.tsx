import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage, Todo } from "@/components/ContentPage";

export const metadata: Metadata = { title: "Aviso legal", alternates: { canonical: "/aviso-legal" } };

// PLANTILLA: completa los datos marcados entre corchetes y haz revisar el texto antes de publicar.
export default function LegalNotice() {
  return (
    <ContentPage title="Aviso legal">
      <h2>Titular del sitio web</h2>
      <p>
        En cumplimiento del artículo 10 de la Ley 34/2002, de Servicios de la Sociedad de la Información y de Comercio
        Electrónico (LSSI-CE), se informa de los datos del titular de este sitio web:
      </p>
      <ul>
        <li>
          Titular: <Todo>nombre y apellidos o razón social</Todo>
        </li>
        <li>
          NIF: <Todo>NIF/CIF</Todo>
        </li>
        <li>
          Domicilio: <Todo>dirección postal</Todo>
        </li>
        <li>
          Correo electrónico: <Todo>email de contacto</Todo>
        </li>
      </ul>

      <h2>Objeto</h2>
      <p>
        GasolinaNeta es una herramienta gratuita que estima el ahorro neto de repostar en distintas gasolineras a partir
        de precios públicos oficiales y de los datos que introduce el usuario. Se financia mediante publicidad.
      </p>

      <h2>Naturaleza de la información</h2>
      <p>
        Los resultados son estimaciones orientativas. Los precios proceden del Geoportal de Gasolineras del Ministerio
        para la Transición Ecológica y el Reto Demográfico y pueden no coincidir con el precio vigente en el surtidor. Las
        distancias son aproximadas. El titular no garantiza la exactitud de los resultados ni se responsabiliza de las
        decisiones tomadas a partir de ellos.
      </p>

      <h2>Reutilización de datos públicos</h2>
      <p>
        Los precios de carburantes se reutilizan conforme a la Ley 37/2007, sobre reutilización de la información del
        sector público, citando su fuente y fecha de actualización. La cartografía procede de OpenStreetMap (© sus
        colaboradores, licencia ODbL).
      </p>

      <h2>Propiedad intelectual</h2>
      <p>
        Los textos, el diseño y el código de este sitio son titularidad de <Todo>titular</Todo>, salvo los datos y
        materiales de terceros indicados. No se permite su reproducción sin autorización.
      </p>

      <h2>Enlaces</h2>
      <p>
        Este sitio puede contener enlaces a sitios de terceros (por ejemplo, para calcular la ruta a una gasolinera). El
        titular no se responsabiliza de sus contenidos.
      </p>

      <p>
        Consulta también la <Link href="/privacidad">política de privacidad</Link> y la{" "}
        <Link href="/cookies">política de cookies</Link>.
      </p>
    </ContentPage>
  );
}
