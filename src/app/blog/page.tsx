import type { Metadata } from "next";
import Link from "next/link";
import { POSTS } from "@/content/posts";

export const metadata: Metadata = {
  title: "Blog: ahorrar en combustible con cuentas claras",
  description:
    "Artículos para repostar con cabeza: cuándo compensa ir a una gasolinera lejana, cómo medir el consumo de tu coche, 95 o 98 y más.",
  alternates: { canonical: "/blog" },
};

const dateFmt = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric" });

export default function BlogIndex() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-10 sm:pt-14">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Blog</h1>
      <p className="mt-3 text-lg text-ink-2">Cuentas claras para gastar menos en combustible.</p>
      <ul className="mt-8 space-y-4">
        {POSTS.map((p) => (
          <li key={p.slug}>
            <Link href={`/blog/${p.slug}`} className="group block rounded-2xl border border-line bg-surface p-5 hover:border-ink-3">
              <h2 className="text-lg font-semibold leading-snug group-hover:text-brand">{p.title}</h2>
              <p className="mt-2 text-sm text-ink-2">{p.description}</p>
              <p className="mt-3 text-xs text-ink-3">
                {dateFmt.format(new Date(p.date))} · {p.readingMinutes} min de lectura
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
