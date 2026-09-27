import Uebersicht from "@/components/uebersicht/uebersicht";

/**
 * Startseite.
 *
 * Frueher stand hier <KarteikartenUebersicht /> + <Stats />. Beide Komponenten
 * holten dieselben Daten von derselben Route und zeigten sie in zwei
 * verschiedenen Rasterformen an – zweimal dieselbe Information auf einer
 * Seite, an zwei Stellen mit zwei Zahlen, die auseinanderlaufen konnten,
 * weil sie zu zwei verschiedenen Zeitpunkten geladen waren.
 *
 * Die alte Startseiten-Komponente components/cards/karteikarten-uebersicht.tsx
 * ist geloescht. Sie war der Grund fuer den Doppeleintrag im Menü; die
 * Plus-Kachel, die es dort gab, steht jetzt in components/uebersicht und wird
 * von dort auch benutzt.
 *
 * Die Seite ist ein Server Component ohne eigene Daten: die Uebersicht holt
 * ihre Daten clientseitig, ueber /api/karteikarten und /api/profil. Das ist
 * hier richtig, weil beide Routen personenbezogen sind und der Server
 * Component sonst zweimal dieselbe Abfrage machen wuerde.
 */
export default function Home() {
    return <Uebersicht />;
}
