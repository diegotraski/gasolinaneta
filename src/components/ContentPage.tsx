import type { ReactNode } from "react";

export function ContentPage({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 pt-10 sm:pt-14">
      <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{title}</h1>
      {intro && <div className="mt-4 text-lg text-ink-2">{intro}</div>}
      <div className="prose-gn mt-8">{children}</div>
    </article>
  );
}

/** Marca visible de dato pendiente: el titular debe rellenarlo antes de publicar. */
export function Todo({ children }: { children: ReactNode }) {
  return <mark className="rounded bg-accent-soft px-1 font-medium text-ink">[{children}]</mark>;
}
