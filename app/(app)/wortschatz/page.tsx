import WortschatzSeite from "./wortschatz-seite";

/**
 * /wortschatz ist seit Phase 2.4 eine echte Wortliste, kein Redirect mehr.
 *
 * Davor zeigte der Eintrag auf /karteikarten, und /wortschatz selbst leitete
 * dorthin weiter – zwei Seiten fuer denselben Inhalt, und der Menueeintrag
 * versprach eine Wortliste, die es nicht gab. Seit 2.4 ist die Arbeit
 * getrennt: /karteikarten ist die Set-Uebersicht mit Fortschritt, /wortschatz
 * die Wortsicht quer durch alle Sets mit Suche. Diese Datei ist ein Server
 * Component ohne eigene Daten – die Liste holt ihr Inhalt clientseitig ueber
 * /api/wortschatz, weil die Route den angemeldeten Nutzer braucht.
 */
export default function WortschatzSeiteRoh() {
    return <WortschatzSeite />;
}