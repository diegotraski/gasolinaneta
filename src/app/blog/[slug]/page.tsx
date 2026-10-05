import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdSlot } from "@/components/AdSlot";
import { getPost, POSTS } from "@/content/posts";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const post = getPost((await params).slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: { type: "article", title: post.title, description: post.description, publishedTime: post.date },
  };
}

const dateFmt = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric" });

export default async function PostPage({ params }: PageProps<"/blog/[slug]">) {
  const post = getPost((await params).slug);
  if (!post) notFound();
  const others = POSTS.filter((p) => p.slug !== post.slug).slice(0, 3);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    inLanguage: "es-ES",
    mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
    publisher: { "@type": "Organization", name: SITE_NAME },
  };

  return (
    <article className="mx-auto max-w-3xl px-4 pt-10 sm:pt-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Link href="/blog" className="text-sm text-ink-3 hover:text-ink">
        ← Blog
      </Link>
      <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{post.title}</h1>
      <p className="mt-3 text-sm text-ink-3">
        {dateFmt.format(new Date(post.date))} · {post.readingMinutes} min de lectura
      </p>
      <p className="mt-6 text-lg text-ink-2">{post.description}</p>
      <div className="prose-gn mt-6">{post.body()}</div>

      <AdSlot slot="article" />

      <div className="mt-10 rounded-2xl border border-brand/30 bg-brand-soft p-5">
        <p className="font-semibold">¿Compensa ir a la gasolinera más barata de tu zona?</p>
        <p className="mt-1 text-sm text-ink-2">Calcúlalo con tu ubicación, tu coche y los precios de hoy.</p>
        <Link href="/#calculadora" className="mt-3 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-ink">
          Abrir la calculadora
        </Link>
      </div>

      <aside className="mt-12">
        <h2 className="mb-3 font-semibold">Sigue leyendo</h2>
        <ul className="space-y-2">
          {others.map((p) => (
            <li key={p.slug}>
              <Link href={`/blog/${p.slug}`} className="text-brand hover:underline">
                {p.title}
              </Link>
            </li>
          ))}
        </ul>
      </aside>
    </article>
  );
}
