import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/meta";

/**
 * sitemap.xml.
 *
 * Aktuell gibt es keine oeffentlich, von Suchmaschinen indexierbare Seite:
 * /anmelden, /passwort-aendern und /passwort-zuruecksetzen sind per
 * `robots: { index: false }` noindex, und der gesamte (app)-Bereich liegt
 * hinter einer Anmeldung. Eine Sitemap, die nur noindex-Seiten auflistet,
 * hilft niemandem – sie sagt Google nur, wo nichts zu indexieren ist.
 *
 * Sobald eine oeffentliche Landing-/Inhaltsseite existiert (Phase SEO,
 * Punkt 2), wird sie hier eingetragen. Die Schleife unten rechnet jede
 * spaetere Route selbst um, damit hier nie eine URL auseinanderfaehlt.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const routes: string[] = [];
  const now = new Date();

  return routes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: now,
  }));
}