import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/meta";

/**
 * robots.txt – was Crawler sehen sollen.
 *
 * Der oeffentliche Teil von Lexio sind die Anmelde- und Passwort-Seiten
 * (alle drei tragen selbst `robots: { index: false }`). Die eigentliche App
 * liegt vollstaendig hinter einer Anmeldung: /lernen, /wortschatz,
 * /statistiken … Bis es eine oeffentliche Landing-Page gibt (Phase,
 * SEO-Punkt 2), ist fuer Google nichts Nennenswertes zu indexieren.
 *
 * Deshalb hier der pragmatische Mittelweg: die Pfade, die ohne Sitzung
 * ueberhaupt erreichbar sind, werden ausdruecklich ausgeschlossen; alles
 * andere bleibt standardmaessig erlaubt, damit eine spaetere oeffentliche
 * Seite nicht an einer zu strengen robots.txt scheitert.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/anmelden",
        "/passwort-aendern",
        "/passwort-zuruecksetzen",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}