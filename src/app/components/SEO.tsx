import { useEffect } from "react";

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  ogImage?: string;
  canonical?: string;
  robots?: string;
  lang?: string;
}

export function SEO({
  title = "Pessy - Ecosistema de Identidad Digital para Mascotas",
  description = "La informacion de tu mascota, siempre organizada y siempre disponible. Historial, vacunas, tratamientos y documentos en un solo lugar.",
  keywords = "mascota, identidad digital, historial medico, vacunas, medicacion, pet care, veterinario, salud animal",
  ogImage = "https://pessy.app/pessy-logo.svg",
  canonical,
  robots = "index,follow",
  lang = "es",
}: SEOProps) {
  useEffect(() => {
    document.title = title;
    document.documentElement.lang = lang;

    updateMeta("name", "description", description);
    updateMeta("name", "keywords", keywords);
    updateMeta("name", "robots", robots);
    updateMeta("name", "googlebot", robots);

    updateMeta("property", "og:title", title);
    updateMeta("property", "og:description", description);
    updateMeta("property", "og:type", "website");
    updateMeta("property", "og:image", ogImage);
    if (canonical) {
      updateMeta("property", "og:url", canonical);
      updateLink("canonical", canonical);
    }

    updateMeta("name", "twitter:card", "summary_large_image");
    updateMeta("name", "twitter:title", title);
    updateMeta("name", "twitter:description", description);
    updateMeta("name", "twitter:image", ogImage);
  }, [title, description, keywords, ogImage, canonical, robots, lang]);

  return null;
}

function updateMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function updateLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}
