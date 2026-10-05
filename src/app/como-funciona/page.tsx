import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/ContentPage";
import { MARGINAL_THRESHOLD_EUR, DEFAULT_ROAD_FACTOR } from "@/lib/netSavings";

export const metadata: Metadata = {
  title: "Cómo calculamos el ahorro neto",
  description:
    "La fórmula exacta de GasolinaNeta: ahorro en el surtidor menos el coste de llegar a la gasolinera. Fuentes de datos, supuestos y limitaciones.",
  alternates: { canonical: "/como-funciona" },
};

const factor = String(DEFAULT_ROAD_FACTOR).replace(".", ",");
const threshold = MARGINAL_THRESHOLD_EUR.toFixed(2).replace(".", ",");

export default function HowItWorks() {
  return (
    <ContentPage
      title="Cómo calculamos el ahorro neto"
      intro="Sin cajas negras: esta es exactamente la cuenta que hace la calculadora, con sus supuestos y sus límites."
    >
      <h2>1. La referencia: la gasolinera a la que irías igualmente</h2>
      <p>
        Todo ahorro se mide respecto a algo. Por defecto, tomamos como referencia <strong>la gasolinera más cercana</strong>{" "}
        que vende tu combustible. Si siempre repostas en otra (por ejemplo, porque tienes un descuento), puedes marcarla
        como &quot;mi gasolinera habitual&quot; y la usaremos como referencia.
      </p>

      <h2>2. La fórmula</h2>
      <pre>{`ahorro por litro      = precio referencia − precio candidata
ahorro en surtidor    = ahorro por litro × litros a repostar

km extra (viaje dedicado) = ida y vuelta a la candidata − ida y vuelta a la referencia
km extra (de camino)      = 0

coste de llegar       = km extra / 100 × consumo (l/100 km) × precio referencia
ahorro neto           = ahorro en surtidor − coste de llegar`}</pre>
      <p>
        Ordenamos las gasolineras por <strong>ahorro neto</strong>, no por precio. Cuando la más barata por litro y la que
        más ahorra no coinciden, te lo señalamos expresamente.
      </p>

      <h3>¿Por qué el coste de llegar usa el precio de la referencia?</h3>
      <p>
        Porque el combustible que gastas para llegar sale del depósito que llenaste la última vez, y la mejor estimación
        de lo que te cuesta reponerlo es lo que pagarías sin desviarte: el precio de tu referencia.
      </p>

      <h2>3. Las distancias</h2>
      <p>
        Calculamos la <strong>ruta real por carretera</strong> desde tu ubicación hasta las gasolineras que pueden decidir
        el resultado (las más cercanas, las de más ahorro y las más baratas) con OSRM, un motor de rutas libre que usa
        el callejero de OpenStreetMap. Así un río sin puente o una autovía sin salida cerca no te engañan. También
        mostramos el tiempo estimado en coche, sin tráfico.
      </p>
      <p>
        Mientras se calcula la ruta, o si el servicio no responde, usamos una estimación: la distancia en línea recta
        multiplicada por <strong>{factor}</strong>. Esas distancias se marcan con «≈». La referencia (la gasolinera más
        cercana) se elige por distancia real por carretera, no en línea recta.
      </p>
      <p>
        Para la vuelta suponemos el mismo recorrido que para la ida. En el modo &quot;me pilla de camino&quot; aún no
        calculamos el desvío exacto sobre tu ruta: lo tratamos como cero.
      </p>

      <h2>4. Los horarios</h2>
      <p>
        Interpretamos el horario que cada gasolinera declara al Ministerio y, por defecto, ocultamos las que están
        cerradas en este momento (puedes mostrarlas desmarcando la opción). Si una cierra antes de que llegues según el
        tiempo de ruta, te avisamos. Algunos horarios vienen incompletos o ambiguos en los datos oficiales (por ejemplo,
        solo &quot;L: 07:00-22:00&quot;); en esos casos mostramos &quot;horario sin confirmar&quot; en lugar de
        suponer nada. Tenemos en cuenta la hora de Canarias.
      </p>

      <h2>5. Los colores</h2>
      <ul>
        <li>
          <strong>Azul:</strong> tu referencia.
        </li>
        <li>
          <strong>Verde:</strong> compensa (ahorro neto de {threshold} € o más).
        </li>
        <li>
          <strong>Ámbar:</strong> apenas compensa (ahorro neto positivo pero menor de {threshold} €). Probablemente no
          merece tu tiempo.
        </li>
        <li>
          <strong>Rojo:</strong> no compensa: perderías dinero o, como mucho, te quedarías igual.
        </li>
      </ul>

      <h2>6. Los precios y su frescura</h2>
      <p>
        Usamos los precios oficiales que las gasolineras comunican al Ministerio y que este publica en el Geoportal de
        Gasolineras, que se actualiza cada media hora. Nuestro servidor los vuelve a descargar en cuanto tienen más de 30
        minutos y, si dejas la página abierta, tu navegador los pide de nuevo cada 10 minutos. Junto a los resultados
        verás cuándo se descargaron y un botón para actualizarlos. Excluimos las gasolineras de venta restringida a socios y los precios claramente
        erróneos. Más detalles en{" "}
        <Link href="/blog/de-donde-salen-los-precios-de-las-gasolineras">de dónde salen los precios</Link>.
      </p>

      <h2>7. Lo que no tenemos en cuenta</h2>
      <ul>
        <li>Tu tiempo ni el desgaste del coche (neumáticos, mantenimiento). El ahorro real es algo menor que el que mostramos.</li>
        <li>Descuentos de tarjetas de fidelización o apps de cada marca.</li>
        <li>El tráfico en tiempo real ni cierres puntuales que la gasolinera no haya declarado.</li>
        <li>
          El consumo exacto de tu coche, salvo que lo introduzcas. Si quieres medirlo, te explicamos{" "}
          <Link href="/blog/como-calcular-el-consumo-real-de-tu-coche">cómo hacerlo</Link>.
        </li>
      </ul>
      <p>
        Las cifras son estimaciones orientativas para ayudarte a decidir. Comprueba siempre el precio en el surtidor.
      </p>

      <h2>8. Tu privacidad</h2>
      <p>
        Tu ubicación solo se usa para buscar gasolineras cercanas y calcular las rutas: la redondeamos a unos 10 metros,
        no la guardamos y no la asociamos a ti. Tus preferencias (combustible, litros, consumo) se quedan en tu navegador. Más
        en la <Link href="/privacidad">política de privacidad</Link>.
      </p>

      <h2 id="electrico">9. Modo eléctrico: qué cambia</h2>
      <p>
        Con un coche eléctrico, el tiempo importa tanto como el dinero: cargar puede llevar desde 20 minutos hasta varias
        horas según la potencia del punto. Por eso en este modo te damos <strong>dos cifras separadas</strong>, el ahorro
        neto en euros y los minutos extra en total, y nunca las mezclamos en una sola: ponerle precio a tu tiempo lo
        decides tú.
      </p>
      <pre>{`kWh a cargar          = batería × (% objetivo − % actual)
ahorro en el cargador = (precio referencia − precio punto) × kWh
coste de llegar       = km extra / 100 × consumo (kWh/100 km) × precio referencia
ahorro neto (€)       = ahorro en el cargador − coste de llegar

potencia media        = AC: mín(punto, cargador de a bordo)
                        DC: mín(punto, máximo DC del coche) × 0,75
tiempo de carga       = kWh / potencia media
minutos extra         = conducción extra (ida y vuelta) + diferencia de tiempo de carga`}</pre>
      <h3>De dónde salen los puntos</h3>
      <p>
        Ubicación, operador, conectores, potencia y horario vienen del dataset oficial &quot;Puntos de recarga eléctrica
        para vehículos&quot; del Punto de Acceso Nacional de la DGT (licencia CC BY), que se actualiza a diario. Ese
        dataset no incluye ni precios ni ocupación en tiempo real.
      </p>
      <h3>Los precios son orientativos (y te lo decimos siempre)</h3>
      <p>
        A diferencia de la gasolina, ningún organismo publica el precio de cada punto de recarga: cada operador fija el
        suyo. Mantenemos a mano una tabla con la tarifa sin suscripción que cada operador publica en su propia web, con la
        fecha en que la revisamos. Si un operador no publica tabla (por ejemplo, Endesa X Way remite a su app y cambia el
        precio según la hora), usamos un precio genérico: la mediana de los operadores verificados para esa velocidad. Cada
        resultado indica cuál de los dos casos es. El precio real puede variar según la hora, tu suscripción o promociones:
        compruébalo en la app del operador antes de cargar.
      </p>
      <h3>Los tiempos de carga son estimaciones</h3>
      <p>
        Usamos la potencia máxima que admiten a la vez el punto y tu coche. En corriente continua el coche no mantiene su
        pico durante toda la carga (la potencia baja según se llena la batería), así que aplicamos un 75 % de media, una
        aproximación razonable para cargas hasta el 80 %. Por encima del 80 % la carga rápida se ralentiza mucho más, y la
        estimación será optimista.
      </p>
    </ContentPage>
  );
}
