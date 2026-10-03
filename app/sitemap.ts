import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/meta";

/**
 * sitemap.xml.
 *
 * /anmelden, /passwort-aendern und /passwort-zuruecksetzen sind per
 * `robots: { index: false }` noindex, und der gesamte (app)-Bereich liegt
 * hinter einer Anmeldung. Die Sitemap listet deshalb nur die Seiten, die
 * ohne Konto abrufbar sind: die Startseite und /quellen.
 *
 * /quellen steht mit drin, weil die Quellenangabe nicht nur dekorativ ist.
 * Die Wortlisten sind Bearbeitungen fremder Quellen unter CC BY-SA; wer sie
 * weitergibt, muss sagen, woher sie kommen. Eine Quellenangabe, die nur in
 * einer nicht gelisteten Seite steht, ist fuer niemanden auffindbar.
 *
 * Die Schleife unten rechnet jede spaetere Route selbst um, damit hier nie
 * eine URL auseinanderfaehlt.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  /*
   * Nur die oeffentlichen Seiten. Alles andere liegt hinter der Anmeldung
   * und traegt zentral `robots: { index: false }` – eine Sitemap mit noindex-
   * Adressen sagt Suchmaschinen nur, wo nichts zu finden ist.
   */
  const routes: string[] = ["/", "/quellen"];
  const now = new Date();

  return routes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: now,
  }));
}