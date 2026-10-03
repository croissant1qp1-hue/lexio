import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/meta";

/**
 * sitemap.xml.
 *
 * /anmelden, /passwort-aendern und /passwort-zuruecksetzen sind per
 * `robots: { index: false }` noindex, und der gesamte (app)-Bereich liegt
 * hinter einer Anmeldung. Die Sitemap listet deshalb genau eine Route: die
 * oeffentliche Startseite. Die Schleife unten rechnet jede spaetere Route
 * selbst um, damit hier nie eine URL auseinanderfaehlt.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  /*
   * Nur die oeffentliche Startseite. Alles andere liegt hinter der Anmeldung
   * und traegt zentral `robots: { index: false }` – eine Sitemap mit noindex-
   * Adressen sagt Suchmaschinen nur, wo nichts zu finden ist.
   */
  const routes: string[] = ["/"];
  const now = new Date();

  return routes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: now,
  }));
}