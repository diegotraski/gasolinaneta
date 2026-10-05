import Link from "next/link";
import type { ReactNode } from "react";

export interface Post {
  slug: string;
  title: string;
  description: string;
  /** ISO (aaaa-mm-dd) */
  date: string;
  readingMinutes: number;
  body: () => ReactNode;
}

const Calc = ({ children = "nuestra calculadora" }: { children?: ReactNode }) => (
  <Link href="/#calculadora">{children}</Link>
);

export const POSTS: Post[] = [
  {
    slug: "compensa-ir-a-la-gasolinera-mas-barata-si-esta-lejos",
    title: "¿Compensa ir a la gasolinera más barata si está lejos? Las cuentas, paso a paso",
    description:
      "Una gasolinera 10 céntimos más barata no siempre te ahorra dinero. Te explicamos cómo calcular cuántos kilómetros puedes desviarte antes de perder.",
    date: "2026-10-05",
    readingMinutes: 6,
    body: () => (
      <>
        <p>
          Todas las apps de gasolineras te dicen cuál es la más barata. Pocas te dicen si merece la pena ir hasta allí. Y
          la diferencia importa: para llegar a esa gasolinera gastas combustible, y ese combustible lo pagas al precio de
          tu depósito actual. Si el desvío es largo, el ahorro en el surtidor se evapora.
        </p>

        <h2>La fórmula, sin trampa</h2>
        <p>
          Parte siempre de una <strong>referencia</strong>: la gasolinera a la que irías de todas formas (normalmente, la
          más cercana). Para cualquier otra candidata:
        </p>
        <pre>{`ahorro en surtidor   = (precio referencia − precio candidata) × litros
km extra             = ida y vuelta a la candidata − ida y vuelta a la referencia
coste de llegar      = km extra / 100 × consumo (l/100 km) × precio referencia
ahorro neto          = ahorro en surtidor − coste de llegar`}</pre>
        <p>
          Si el ahorro neto es positivo, compensa. Si es negativo, estás pagando por pasear. Así de simple, y así es como
          lo calcula <Calc />.
        </p>

        <h2>Un ejemplo real</h2>
        <p>
          Vas a echar 40 litros. Tu coche gasta 6 l/100 km. La gasolinera de tu barrio está a 1 km y cobra 1,849 €/l. Hay
          otra a 18 km que cobra 1,689 €/l: 16 céntimos menos por litro.
        </p>
        <ul>
          <li>Ahorro en surtidor: 0,16 × 40 = <strong>6,40 €</strong></li>
          <li>Km extra: (18 + 18) − (1 + 1) = 34 km</li>
          <li>Coste de llegar: 34 / 100 × 6 × 1,849 = <strong>3,77 €</strong></li>
          <li>
            Ahorro neto: 6,40 − 3,77 = <strong>2,63 €</strong>
          </li>
        </ul>
        <p>
          Compensa, pero mucho menos de lo que parecía. Y si hubiera otra gasolinera a 4 km a 1,749 €/l, esa te dejaría
          3,33 € netos: <strong>más ahorro siendo más cara</strong>. Por eso la más barata no siempre es la que más
          ahorra.
        </p>

        <h2>Regla rápida: ¿cuántos km puedes desviarte?</h2>
        <p>
          Despejando la fórmula sale la distancia extra máxima (solo ida, por carretera) a partir de la cual pierdes
          dinero:
        </p>
        <pre>{`km máximos de desvío (ida) = ahorro por litro × litros / (2 × consumo/100 × precio)`}</pre>
        <p>Para un coche que gasta 6 l/100 km con el combustible a 1,80 €/l, queda así:</p>
        <table>
          <thead>
            <tr>
              <th>Diferencia de precio</th>
              <th>20 litros</th>
              <th>40 litros</th>
              <th>60 litros</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>5 céntimos/l</td>
              <td>4,6 km</td>
              <td>9,3 km</td>
              <td>13,9 km</td>
            </tr>
            <tr>
              <td>10 céntimos/l</td>
              <td>9,3 km</td>
              <td>18,5 km</td>
              <td>27,8 km</td>
            </tr>
            <tr>
              <td>15 céntimos/l</td>
              <td>13,9 km</td>
              <td>27,8 km</td>
              <td>41,7 km</td>
            </tr>
            <tr>
              <td>20 céntimos/l</td>
              <td>18,5 km</td>
              <td>37,0 km</td>
              <td>55,6 km</td>
            </tr>
          </tbody>
        </table>
        <p>
          Esa es la distancia en la que <em>empatas</em>. Para que el viaje merezca la pena tienes que quedarte bien por
          debajo. Fíjate en dos cosas:
        </p>
        <ul>
          <li>
            <strong>Repostar poco y lejos casi nunca compensa.</strong> Con 20 litros y 5 céntimos de diferencia, a partir
            de 4,6 km de desvío ya pierdes.
          </li>
          <li>
            <strong>Llenar el depósito multiplica el margen.</strong> Si vas a ir a una gasolinera lejana, que sea para
            llenar.
          </li>
        </ul>

        <h2>Lo que la fórmula no cuenta (y deberías tener en cuenta)</h2>
        <ul>
          <li>
            <strong>Tu tiempo.</strong> Veinte minutos de desvío para ahorrar 1,50 € es una mala hora de trabajo.
          </li>
          <li>
            <strong>El desgaste del coche.</strong> Neumáticos, aceite, mantenimiento: cada kilómetro cuesta algo más que
            el combustible. Nuestra calculadora no lo incluye, así que su resultado es, si acaso, optimista.
          </li>
          <li>
            <strong>Si te pilla de camino.</strong> Si la gasolinera barata está en una ruta que vas a hacer igualmente,
            el desvío es casi cero y la cuenta cambia por completo. En la calculadora puedes marcarlo.
          </li>
        </ul>
        <p>
          <Calc>Prueba con tu ubicación y tu coche</Calc>: verás el desglose completo de cada gasolinera, no solo el
          resultado.
        </p>
      </>
    ),
  },
  {
    slug: "mas-barata-o-la-que-mas-ahorra-analisis-seis-ciudades",
    title: "Analizamos 6 ciudades: ¿cuándo la gasolinera más barata no es la que más ahorra?",
    description:
      "Con precios oficiales reales de Madrid, Barcelona, Valencia, Sevilla, Zaragoza y Albacete comprobamos cuándo ir a la más barata te hace perder dinero.",
    date: "2026-10-05",
    readingMinutes: 5,
    body: () => (
      <>
        <p>
          Antes de lanzar GasolinaNeta quisimos comprobar algo: ¿de verdad pasa a menudo que la gasolinera más barata no
          es la que más te ahorra? Si casi nunca ocurre, nuestra herramienta sobraría. Así que descargamos los precios
          oficiales del Ministerio (datos del <strong>5 de octubre de 2026 a las 11:06</strong>, 11.314 gasolineras de
          venta al público) y lo calculamos para seis puntos de España.
        </p>

        <h2>Cómo lo medimos</h2>
        <ul>
          <li>Punto de partida: el centro de cada ciudad (Sol, Plaça de Catalunya, el Ayuntamiento de Valencia, la Catedral de Sevilla, el Pilar y el centro de Albacete).</li>
          <li>Referencia: la gasolinera más cercana a ese punto.</li>
          <li>Viaje dedicado solo a repostar (se cuenta la ida y vuelta extra).</li>
          <li>Distancia por carretera estimada como línea recta × 1,3.</li>
        </ul>

        <h2>Resultado: depende sobre todo de cuánto repuestas y de lo lejos que busques</h2>
        <table>
          <thead>
            <tr>
              <th>Escenario</th>
              <th>Ciudades donde la más barata NO es la que más ahorra</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Gasolina 95, 40 l, coche de 6 l/100 km, radio 15 km</td>
              <td>1 de 6</td>
            </tr>
            <tr>
              <td>Gasolina 95, 40 l, 6 l/100 km, radio 30 km</td>
              <td>2 de 6</td>
            </tr>
            <tr>
              <td>Gasolina 95, 20 l, coche de 8 l/100 km, radio 30 km</td>
              <td>3 de 6</td>
            </tr>
            <tr>
              <td>Diésel, 40 l, 6 l/100 km, radio 30 km</td>
              <td>3 de 6</td>
            </tr>
          </tbody>
        </table>
        <p>
          Con un radio corto y el depósito lleno, la más barata suele ser también la mejor opción: las diferencias de
          precio en ciudad son grandes y las distancias, cortas. Pero en cuanto amplías la búsqueda o repuestas poco, la
          más barata empieza a quedar demasiado lejos.
        </p>

        <h2>Tres casos concretos</h2>
        <h3>Madrid: la más barata te hace perder 4,47 €</h3>
        <p>
          Desde Sol, echando 20 litros con un coche de 8 l/100 km y buscando en 30 km, la gasolina 95 más barata estaba en
          Ciempozuelos, a 1,549 €/l. Ahorras 6,00 € en el surtidor, pero son unos 71 km extra de ida y vuelta, que
          cuestan 10,47 €. <strong>Resultado neto: −4,47 €.</strong> La que más ahorraba estaba a menos de 2 km, a 1,748
          €/l: +1,98 € netos.
        </p>
        <h3>Valencia: 2 céntimos más cara, 0,71 € más de ahorro</h3>
        <p>
          Con 40 litros y radio de 15 km, la más barata (1,629 €/l, en Quart de Poblet, a unos 14 km) dejaba 6,46 € netos.
          Una en Alboraya, a unos 8 km y 2 céntimos más cara, dejaba 7,17 €.
        </p>
        <h3>Barcelona: ganar por poco</h3>
        <p>
          Repostando 20 litros, la más barata (1,599 €/l, en Sant Adrià de Besòs, a unos 9 km) dejaba 2,48 € netos; otra
          dentro de Barcelona, a 3 km y 1,669 €/l, dejaba 2,69 €. Diferencia pequeña, pero en la dirección contraria a la
          intuición.
        </p>

        <h2>Lo que más nos sorprendió</h2>
        <p>
          En las seis ciudades, la gasolinera más cercana al centro estaba entre las caras (en torno a 1,84–1,87 €/l para
          gasolina 95), y había alternativas 15–25 céntimos por debajo a pocos kilómetros. Es decir: <strong>casi siempre
          compensa moverse algo</strong>; la pregunta útil no es &quot;¿cuál es la más barata?&quot; sino &quot;¿hasta dónde me
          compensa ir?&quot;.
        </p>
        <p>
          Los precios cambian varias veces al día, así que estos números son una foto de un momento concreto. Para tu caso,
          con tu coche y tu ubicación de hoy, usa <Calc />.
        </p>
      </>
    ),
  },
  {
    slug: "como-calcular-el-consumo-real-de-tu-coche",
    title: "Cómo calcular el consumo real de tu coche (y por qué el del ordenador de a bordo no basta)",
    description:
      "El método de lleno a lleno, paso a paso, para saber cuántos litros cada 100 km gasta de verdad tu coche.",
    date: "2026-10-05",
    readingMinutes: 4,
    body: () => (
      <>
        <p>
          Para saber si compensa ir a una gasolinera lejana necesitas un dato que casi nadie conoce con precisión: cuánto
          consume tu coche. El valor homologado del fabricante se mide en un ciclo de laboratorio y el ordenador de a
          bordo hace una estimación. Ambos pueden diferir de lo que de verdad gastas con tu forma de conducir y tus
          trayectos.
        </p>

        <h2>El método de lleno a lleno</h2>
        <ol>
          <li>
            <strong>Llena el depósito hasta que salte el surtidor.</strong> No sigas apretando: lo importante es que el
            punto de llenado sea siempre el mismo.
          </li>
          <li>
            <strong>Pon a cero el cuentakilómetros parcial</strong> (el &quot;trip&quot;) justo después.
          </li>
          <li>
            <strong>Conduce con normalidad</strong> hasta gastar al menos medio depósito. Cuantos más kilómetros, más
            preciso.
          </li>
          <li>
            <strong>Vuelve a llenar hasta que salte</strong>, a ser posible en la misma gasolinera y el mismo surtidor, y
            apunta los litros exactos del ticket.
          </li>
          <li>
            Calcula: <code>consumo = litros repostados / km recorridos × 100</code>
          </li>
        </ol>
        <p>
          Ejemplo: has hecho 512 km y al llenar entran 31,7 litros. Consumo = 31,7 / 512 × 100 = <strong>6,2 l/100 km</strong>.
        </p>

        <h2>Consejos para que el dato sea útil</h2>
        <ul>
          <li>
            <strong>Repite la medida dos o tres veces</strong> y quédate con la media. Una sola medición puede verse
            afectada por un atasco, un viaje con el coche cargado o el aire acondicionado a tope.
          </li>
          <li>
            <strong>Si haces trayectos muy distintos</strong> (ciudad entre semana, autovía el fin de semana), mide cada
            tipo por separado. Para ir a repostar en ciudad, el que te interesa es el urbano, que suele ser el más alto.
          </li>
          <li>
            <strong>Compara con el ordenador de a bordo.</strong> Si ves que siempre marca algo menos que tu medición,
            ya sabes cuánto corregirle en el futuro.
          </li>
        </ul>

        <h2>¿Y si no quiero medir nada?</h2>
        <p>
          En <Calc /> puedes elegir un valor orientativo según el tipo de coche. Es una aproximación razonable para
          decidir si compensa un desvío, porque la decisión rara vez cambia por medio litro arriba o abajo. Pero si
          repostas lejos a menudo, medirlo una vez te dará cuentas más fiables.
        </p>
      </>
    ),
  },
  {
    slug: "gasolina-95-o-98-diesel-o-diesel-premium",
    title: "¿Gasolina 95 o 98? ¿Diésel normal o premium? Qué pagas y cuándo tiene sentido",
    description:
      "Cuánto más cuestan de media la gasolina 98 y el diésel premium según los precios oficiales, y qué dice tu coche sobre si los necesitas.",
    date: "2026-10-05",
    readingMinutes: 5,
    body: () => (
      <>
        <p>
          En casi todas las gasolineras hay dos opciones de cada combustible, y la &quot;buena&quot; siempre es más cara. La
          pregunta es si ese sobreprecio te aporta algo. Empecemos por cuánto es.
        </p>

        <h2>Cuánto cuesta de más (datos oficiales)</h2>
        <p>
          Con los precios publicados por el Ministerio el 5 de octubre de 2026, comparando dentro de la misma gasolinera
          (para no mezclar zonas caras con baratas):
        </p>
        <table>
          <thead>
            <tr>
              <th>Comparación</th>
              <th>Gasolineras con ambas</th>
              <th>Diferencia mediana</th>
              <th>Rango habitual*</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Gasolina 98 vs 95</td>
              <td>5.492</td>
              <td>+0,130 €/l</td>
              <td>+0,10 a +0,17 €/l</td>
            </tr>
            <tr>
              <td>Diésel premium vs diésel</td>
              <td>5.867</td>
              <td>+0,070 €/l</td>
              <td>+0,03 a +0,105 €/l</td>
            </tr>
          </tbody>
        </table>
        <p className="text-sm">* Entre el 10 % y el 90 % de las gasolineras.</p>
        <p>
          En un depósito de 50 litros, eso son unos 6,50 € más por llenar con 98 y unos 3,50 € más con diésel premium. Al
          año, si llenas dos veces al mes, la diferencia ronda los 155 € y los 85 € respectivamente.
        </p>

        <h2>Gasolina 95 o 98: lo que significa el número</h2>
        <p>
          El número es el <strong>índice de octano</strong>: mide la resistencia de la gasolina a autoinflamarse antes de
          tiempo dentro del cilindro (la llamada detonación o &quot;picado&quot;). No indica más energía ni más
          &quot;calidad&quot; en general.
        </p>
        <ul>
          <li>
            Si tu fabricante indica <strong>95</strong>, poner 98 no hará que tu motor rinda más de lo que fue diseñado
            para rendir. Pagas más por una resistencia a la detonación que tu motor no aprovecha.
          </li>
          <li>
            Si indica <strong>98</strong> (habitual en algunos motores de alta compresión o deportivos), usa 98. Algunos
            de esos motores admiten 95 ajustando el encendido, pero a costa de rendimiento.
          </li>
          <li>
            Si dice &quot;95, o 98 para mejores prestaciones&quot;, la decisión es tuya: el beneficio existe, pero rara vez
            compensa económicamente el sobreprecio para un uso normal.
          </li>
        </ul>
        <p>
          ¿Dónde mirarlo? En el manual y, en la mayoría de coches, en una etiqueta en la tapa del depósito. Los surtidores
          en la UE usan etiquetas armonizadas (E5, E10…) que puedes comparar con la del coche.
        </p>

        <h2>Diésel o diésel premium</h2>
        <p>
          Los gasóleos &quot;premium&quot; de cada marca llevan aditivos adicionales (detergentes, anticorrosivos y otros)
          y en algunos casos un índice de cetano mayor. Las marcas destacan su efecto limpiador sobre inyectores. Lo que
          no está claro es que un motor en buen estado y que usa gasóleo normal de forma habitual note una diferencia que
          compense 7 céntimos por litro.
        </p>
        <p>
          Si tu fabricante no lo exige, lo razonable es usar gasóleo normal y, si quieres, alternar con premium de vez en
          cuando. En cualquier caso, la decisión de calidad va antes que la de gasolinera: en <Calc /> eliges el
          combustible y comparamos solo ese.
        </p>

        <h2>Ojo con comparar entre combustibles</h2>
        <p>
          Una curiosidad de los datos de ese día: la mediana del diésel (1,939 €/l) estaba por encima de la de la gasolina
          95 (1,819 €/l). No siempre ha sido así, y no tiene por qué seguir siéndolo: las relaciones de precio entre
          combustibles cambian con el mercado. Por eso conviene mirar los precios del día y no fiarse de lo que
          &quot;siempre ha sido&quot;.
        </p>
      </>
    ),
  },
  {
    slug: "consejos-para-gastar-menos-combustible-conduciendo",
    title: "9 hábitos al volante que reducen lo que gastas en combustible",
    description:
      "Elegir bien la gasolinera ahorra céntimos por litro; conducir mejor ahorra litros. Hábitos sencillos, explicados sin mitos.",
    date: "2026-10-05",
    readingMinutes: 5,
    body: () => (
      <>
        <p>
          Elegir la gasolinera adecuada te ahorra unos céntimos por litro. Conducir de forma eficiente te ahorra litros.
          Las dos cosas se suman. Estos son los hábitos con más fundamento, explicados para que entiendas el porqué.
        </p>

        <h2>1. Acelera con suavidad y cambia pronto de marcha</h2>
        <p>
          Los motores son más eficientes a bajas revoluciones con carga moderada. Acelerar de forma progresiva y subir de
          marcha sin estirar las revoluciones reduce el consumo, sobre todo en ciudad.
        </p>

        <h2>2. Anticipa para frenar menos</h2>
        <p>
          Cada frenazo convierte en calor una energía que pagaste en combustible. Mirar lejos, dejar distancia y levantar
          el pie con antelación ante un semáforo en rojo te permite mantener la inercia.
        </p>

        <h2>3. Deja rodar el coche con la marcha metida</h2>
        <p>
          En la mayoría de coches modernos de inyección, al levantar el pie del acelerador con una marcha engranada el
          motor corta la inyección: consumo prácticamente nulo mientras dure la retención. En punto muerto, en cambio,
          el motor sigue gastando para mantener el ralentí.
        </p>

        <h2>4. Vigila la velocidad en autovía</h2>
        <p>
          La resistencia del aire crece con el cuadrado de la velocidad. Por eso los últimos 10-20 km/h por encima de
          cierta velocidad se pagan caros en consumo. Bajar un poco el ritmo en un viaje largo suele notarse en el
          depósito más que en el reloj.
        </p>

        <h2>5. Comprueba la presión de los neumáticos</h2>
        <p>
          Un neumático con poca presión se deforma más y aumenta la resistencia a la rodadura. Revisa la presión en frío
          una vez al mes, con los valores que indica el fabricante (suelen estar en el marco de la puerta del conductor o
          en la tapa del depósito).
        </p>

        <h2>6. Quita peso y resistencia que no uses</h2>
        <p>
          El maletero lleno de trastos o una baca vacía sobre el techo suponen consumo extra en cada trayecto. La baca y
          los portabicicletas de techo afectan especialmente en carretera, por la resistencia aerodinámica.
        </p>

        <h2>7. Usa el aire acondicionado con cabeza</h2>
        <p>
          El compresor del aire acondicionado consume energía del motor. En ciudad y a poca velocidad, bajar las
          ventanillas puede ser más eficiente; en autovía, las ventanillas abiertas aumentan la resistencia aerodinámica
          y el aire acondicionado suele ser la mejor opción.
        </p>

        <h2>8. Evita el ralentí largo</h2>
        <p>
          Un motor parado en ralentí gasta sin moverte. Si vas a estar detenido un rato (esperando a alguien, por
          ejemplo), apágalo. Muchos coches ya lo hacen solos con el sistema start-stop.
        </p>

        <h2>9. Agrupa recados y evita trayectos cortos en frío</h2>
        <p>
          Con el motor frío el consumo es mayor. Encadenar varios recados en una salida, en lugar de varias salidas
          cortas, reduce el tiempo que el coche pasa en esa fase. Y si vas a repostar, aprovecha un trayecto que ya
          hagas: en <Calc /> puedes marcar que la gasolinera te pilla &quot;de camino&quot;.
        </p>
      </>
    ),
  },
  {
    slug: "de-donde-salen-los-precios-de-las-gasolineras",
    title: "¿De dónde salen los precios de las gasolineras que ves en las apps?",
    description:
      "Todas las webs y apps de precios de carburantes en España usan la misma fuente oficial. Te contamos cuál es, cada cuánto se actualiza y qué limitaciones tiene.",
    date: "2026-10-05",
    readingMinutes: 4,
    body: () => (
      <>
        <p>
          Si has comparado varias apps de precios de gasolina, habrás visto que los números coinciden. No es casualidad:
          casi todas beben de la misma fuente pública.
        </p>

        <h2>La fuente: el Geoportal de Gasolineras</h2>
        <p>
          Las estaciones de servicio en España tienen la obligación de comunicar sus precios a la Administración, que los
          publica en el <strong>Geoportal de Gasolineras</strong> del Ministerio para la Transición Ecológica y el Reto
          Demográfico. Además del mapa web, el Ministerio ofrece un servicio de datos abierto y gratuito que cualquiera
          puede consultar sin registrarse. GasolinaNeta usa ese servicio.
        </p>
        <p>
          Según la nota que acompaña a los propios datos, la actualización de precios se realiza cada media hora, con los
          precios en vigor en ese momento.
        </p>

        <h2>Qué datos incluye</h2>
        <ul>
          <li>Rótulo (la marca o el nombre de la gasolinera), dirección, municipio y provincia.</li>
          <li>Coordenadas para situarla en el mapa.</li>
          <li>Horario.</li>
          <li>
            El precio de cada combustible que vende: gasolina 95 y 98, gasóleo A, gasóleo premium, GLP, gas natural y
            otros.
          </li>
          <li>Si la venta es al público en general o restringida (por ejemplo, a socios de una cooperativa).</li>
        </ul>

        <h2>Cómo los tratamos en GasolinaNeta</h2>
        <ul>
          <li>
            <strong>Los guardamos en nuestro servidor</strong> y los refrescamos periódicamente, en vez de consultar el
            servicio público en cada visita. Así la web va más rápida y no sobrecargamos un servicio gratuito.
          </li>
          <li>
            <strong>Excluimos las gasolineras de venta restringida</strong>, porque no puedes repostar en ellas si no eres
            socio.
          </li>
          <li>
            <strong>Descartamos precios claramente erróneos</strong> (por ejemplo, 0 €).
          </li>
          <li>
            <strong>Mostramos siempre la fecha de los datos</strong> junto a los resultados.
          </li>
        </ul>

        <h2>Limitaciones que conviene conocer</h2>
        <ul>
          <li>
            <strong>Puede haber desfase.</strong> Si una gasolinera cambia el precio, puede pasar un tiempo hasta que se
            refleje. Confirma siempre el precio en el surtidor antes de repostar.
          </li>
          <li>
            <strong>No incluye descuentos personales.</strong> Tarjetas de fidelización, apps de la marca o descuentos
            por compra no aparecen en el precio oficial. Si tienes uno en tu gasolinera habitual, márcala como referencia
            en <Calc /> y ten en cuenta el descuento al comparar.
          </li>
          <li>
            <strong>El horario es el declarado.</strong> Festivos y cambios puntuales pueden no estar reflejados.
          </li>
        </ul>
        <p>
          Si quieres ver exactamente cómo usamos estos datos para calcular el ahorro neto, lo explicamos en{" "}
          <Link href="/como-funciona">cómo funciona</Link>.
        </p>
      </>
    ),
  },
];

export function getPost(slug: string): Post | undefined {
  return POSTS.find((p) => p.slug === slug);
}
