import type { MetadataRoute } from "next";
import { POSTS } from "@/content/posts";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/como-funciona", "/blog", "/aviso-legal", "/privacidad", "/cookies"];
  return [
    ...pages.map((p) => ({
      url: `${SITE_URL}${p}`,
      changeFrequency: p === "" ? ("daily" as const) : ("monthly" as const),
      priority: p === "" ? 1 : p.startsWith("/blog") || p === "/como-funciona" ? 0.7 : 0.2,
    })),
    ...POSTS.map((p) => ({ url: `${SITE_URL}/blog/${p.slug}`, lastModified: p.date, changeFrequency: "monthly" as const, priority: 0.6 })),
  ];
}
