import Link from "next/link";
import { AdSlot } from "@/components/AdSlot";
import { CalculatorModes } from "@/components/calculator/CalculatorModes";
import { POSTS } from "@/content/posts";
import { eur, km, signedEur } from "@/lib/format";
import { computeNetSavings } from "@/lib/netSavings";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

// Ejemplo ilustrativo con la misma fórmula que la calculadora (distancias ya por carretera, factor 1).
const EXAMPLE = [
  { id: "A", name: "La de tu barrio", price: 1.849, straightKm: 1 },
  { id: "B", name: "La del polígono", price: 1.749, straightKm: 4 },
  { id: "C", name: "La low cost de la autovía", price: 1.689, straightKm: 18 },
];
const exampleResult = computeNetSavings(EXAMPLE, { liters: 40, consumptionL100: 6, mode: "dedicated", roadFactor: 1 })!;

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  applicationCategory: "UtilitiesApplication",
  operatingSystem: "Web",
  inLanguage: "es-ES",
  offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
};

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="mx-auto max-w-6xl px-4 pb-10 pt-10 sm:pt-16">
        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="mb-3 inline-block rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand">
              Calculadora de ahorro neto en combustible
            </p>
            <h1 className="text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl">
              La más barata no siempre es la que más ahorra.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-ink-2">
              Comparamos las gasolineras de tu zona con precios oficiales y les restamos lo que gastas en llegar. Así
              sabes si de verdad compensa el viaje.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#calculadora" className="rounded-lg bg-brand px-5 py-3 font-medium text-brand-ink">
                Calcular mi ahorro
              </a>
              <Link href="/como-funciona" className="rounded-lg border border-line px-5 py-3 font-medium hover:bg-surface">
                Cómo lo calculamos
              </Link>
            </div>
          </div>

          <figure className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <figcaption className="mb-3 text-sm text-ink-2">
              <strong className="text-ink">Ejemplo:</strong> 40 litros, coche de 6 l/100 km, viaje solo para repostar.
            </figcaption>
            <table className="w-full text-[13px] tabular sm:text-sm [&_td]:whitespace-nowrap [&_td:first-child]:whitespace-normal">
              <thead>
                <tr className="text-left text-xs text-ink-3">
                  <th className="pb-2 font-medium">Gasolinera</th>
                  <th className="pb-2 font-medium">€/l</th>
                  <th className="pb-2 font-medium">Ahorro</th>
                  <th className="pb-2 font-medium">Llegar</th>
                  <th className="pb-2 text-right font-medium">Neto</th>
                </tr>
              </thead>
              <tbody>
                {EXAMPLE.map((s) => {
                  const r = exampleResult.ranked.find((x) => x.id === s.id)!;
                  const best = r.id === exampleResult.best.id;
                  return (
                    <tr key={s.id} className={`border-t border-line ${best ? "bg-brand-soft" : ""}`}>
                      <td className="py-2.5 pr-2">
                        <span className="block font-medium">{s.name}</span>
                        <span className="text-xs text-ink-3">a {km(s.straightKm)}</span>
                      </td>
                      <td className="pr-2">{s.price.toFixed(3).replace(".", ",")}</td>
                      <td className="pr-2">{r.isReference ? "—" : eur(r.grossSaving)}</td>
                      <td className="pr-2">{r.isReference ? "—" : `−${eur(r.travelCost)}`}</td>
                      <td className="text-right font-semibold">{r.isReference ? "—" : signedEur(r.netSaving)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-3 text-sm text-ink-2">
              La de la autovía es <strong className="text-ink">la más barata</strong>, pero los{" "}
              {km(exampleResult.cheapest.extraKm)} extra de ida y vuelta se comen parte del ahorro. La del polígono te deja{" "}
              <strong className="text-brand">{eur(exampleResult.best.netSaving - exampleResult.cheapest.netSaving)} más</strong> en
              el bolsillo.
            </p>
          </figure>
        </div>
      </section>

      <section id="calculadora" className="mx-auto max-w-6xl scroll-mt-20 px-4">
        <h2 className="mb-5 text-2xl font-bold tracking-tight">Calcula tu ahorro neto</h2>
        <CalculatorModes />
      </section>

      <section className="mx-auto mt-16 max-w-6xl px-4">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            [
              "Precios oficiales",
              "Usamos los precios que las gasolineras comunican al Ministerio, que los publica y actualiza a lo largo del día.",
            ],
            [
              "Te enseñamos las cuentas",
              "Cada resultado muestra el ahorro por litro, los kilómetros extra y lo que cuestan. Sin cajas negras.",
            ],
            [
              "Tu coche, tus números",
              "El ahorro depende de cuánto repostes y de cuánto consuma tu coche. Ajusta ambos y el ranking cambia.",
            ],
          ].map(([title, text]) => (
            <div key={title} className="rounded-2xl border border-line bg-surface p-5">
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-ink-2">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4">
        <AdSlot slot="inline" />
      </div>

      <section className="mx-auto mt-12 max-w-6xl px-4">
        <div className="mb-5 flex items-baseline justify-between">
          <h2 className="text-2xl font-bold tracking-tight">Para repostar con cabeza</h2>
          <Link href="/blog" className="text-sm font-medium text-brand hover:underline">
            Ver todos los artículos
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {POSTS.slice(0, 3).map((p) => (
            <Link
              key={p.slug}
              href={`/blog/${p.slug}`}
              className="group rounded-2xl border border-line bg-surface p-5 hover:border-ink-3"
            >
              <h3 className="font-semibold leading-snug group-hover:text-brand">{p.title}</h3>
              <p className="mt-2 text-sm text-ink-2">{p.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
