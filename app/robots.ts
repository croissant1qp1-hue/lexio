import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/meta";

/**
 * robots.txt – was Crawler sehen sollen.
 *
 * Oeffentlich ist inzwischen mehr als die Anmeldeseiten: "/" zeigt die
 * Landing-Page, "/quellen" die Herkunft der Wortlisten. Beide sind indexierbar
 * und stehen in der Sitemap. Hinter einer Anmeldung liegt weiterhin die
 * eigentliche App – /lernen, /wortschatz, /statistiken … und die
 * Anmelde- und Passwortseiten tragen selbst `robots: { index: false }`.
 *
 * (Frueher stand hier, es gebe keine oeffentliche Landing-Page. Das war
 * eine Zeitangabe, keine Beschreibung des Zustands – und eine Zeitangabe im
 * Quelltext veraltet von selbst. Seit der Umzug der Uebersicht auf
 * /uebersicht stimmt der Text nicht mehr, deshalb neu.)
 *
 * Der pragmatische Mittelweg bleibt: die Pfade, die ohne Sitzung
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