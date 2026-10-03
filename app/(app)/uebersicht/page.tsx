import Uebersicht from "@/components/uebersicht/uebersicht";

/**
 * Übersicht – früher die Startseite an "/".
 *
 * Die Seite ist am 2026-10-03 von "/" nach "/uebersicht" umgezogen, damit "/"
 * eine öffentliche Seite sein kann: ohne sie gab es im ganzen Auftritt keinen
 * einzigen indexierbaren Text, weil der gesamte (app)-Bereich hinter der
 * Anmeldung liegt und `noindex` trägt. Wer "/" aufruft und angemeldet ist, wird
 * hierher umgeleitet – alte Lesezeichen und geteilte Links laufen also nicht
 * ins Leere.
 *
 * Früher stand hier <KarteikartenUebersicht /> + <Stats />. Beide Komponenten
 * holten dieselben Daten von derselben Route und zeigten sie in zwei
 * verschiedenen Rasterformen an – zweimal dieselbe Information auf einer
 * Seite, an zwei Stellen mit zwei Zahlen, die auseinanderlaufen konnten,
 * weil sie zu zwei verschiedenen Zeitpunkten geladen waren.
 *
 * Die alte Startseiten-Komponente components/cards/karteikarten-uebersicht.tsx
 * ist gelöscht. Sie war der Grund für den Doppeleintrag im Menü; die
 * Plus-Kachel, die es dort gab, steht jetzt in components/uebersicht und wird
 * von dort auch benutzt.
 *
 * Die Seite ist ein Server Component ohne eigene Daten: die Übersicht holt
 * ihre Daten clientseitig, über /api/karteikarten und /api/profil. Das ist
 * hier richtig, weil beide Routen personenbezogen sind und der Server
 * Component sonst zweimal dieselbe Abfrage machen würde.
 */
export default function Home() {
    return <Uebersicht />;
}
