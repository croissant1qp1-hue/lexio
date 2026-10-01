/**
 * Der Name, den eine Kopie bekommt.
 *
 * "Italienisch"          -> "Italienisch (Kopie)"
 * "Italienisch (Kopie)"  -> "Italienisch (Kopie 2)"
 * "Italienisch (Kopie 2)"-> "Italienisch (Kopie 3)"
 *
 * Steht hier und nicht in der Route, weil es zwei Aufrufer gibt: die
 * Duplizieren-Route speichert diesen Namen, und der Wizard zeigt ihn im
 * Namensfeld an. Zwei Kopien dieser Regel fallen irgendwann auseinander –
 * man hat dann ein Set "(Kopie)" und daneben eines "(Kopie 2)" und kann sich
 * nicht mehr erinnern, warum.
 *
 * DIE REGEL IN EINEM SATZ: eine Kopie erhoeht die Nummer im Namensende, und
 * wenn keine Nummer da ist, entsteht die 1. Das heisst auch: die Kopie einer
 * Kopie ist " (Kopie 3)", nicht noch ein "(Kopie)".
 *
 * Diese Regel stand zuerst nur in der Route und hat dort nur den Zusatz
 * angehaengt. Der Effekt war ein Set "Italienisch (Kopie) (Kopie)" neben
 * einem anderen, das genauso hieß. Der Test
 * "eine Kopie kopiert sich nicht ein zweites Mal mit demselben Zusatz" steht
 * seitdem hier, weil das eine echte Wirkung dieses Moduls ist.
 */

/**
 * Die Laengengrenze aus /api/sets.
 *
 * Hier festgeschrieben statt importiert, weil die Route ihre Konstante
 * lokal hat und ein Import aus einer Route-Datei Next.js nicht erlaubt
 * (Route-Dateien duerfen nur HTTP-Methoden und `config` exportieren).
 * Beide muessen gleich sein – ein zu langer Name scheitert am DB-Insert
 * mit einer Postgres-Meldung, die dem Nutzer nichts sagt.
 */
export const MAX_SET_NAME = 60;

/** Nur Ziffern aus einer Kopienummer, 0 wenn es keine gibt. */
const NUMMER = /\(Kopie(?:\s+(\d+))?\)/;

/**
 * Die hoechste Nummer, die in einem Namensende steckt – 0 bei "Italienisch".
 *
 * Gezielt wird auf das ENDE des Namens. "Liste (Kopie) 2" hat keine
 * Kopienummer, sondern eine Nummer, die jemand an den Namen gehaengt hat.
 * Wer diese beiden Faelle nicht trennt, erzeugt aus "Liste (Kopie) 2" die
 * Kopie "Liste (Kopie) 2 (Kopie 3)", und beim naechsten Kopieren
 * "(Kopie 4)".
 *
 * Mehrere Marker hintereinander zaehlen alle, und gewonnen wird die
 * GROESSTE. "X (Kopie 2) (Kopie)" ist ein Name, den eine aeltere Version
 * dieser Funktion erzeugt hat. Gelesen als "Kopie 1" waere die naechste
 * Kopie "X (Kopie 2)" – also genau der Name, den es schon gibt. Gelesen als
 * "Kopie 2" wird es "X (Kopie 3)", und der Name ist neu. Falsch lesen
 * kostet hier einen Namen doppelt, richtig lesen nie etwas.
 */
function nummerAusName(name: string): number {
  let rest = name;
  let hoechste = 0;

  for (let i = 0; i < 3; i++) {
    const treffer = new RegExp(`\\s*${NUMMER.source}\\s*$`).exec(rest);
    if (!treffer) break;
    const wert = treffer[1] ? Number(treffer[1]) : 1;
    if (wert > hoechste) hoechste = wert;
    rest = rest.slice(0, treffer.index);
  }

  return hoechste;
}

/**
 * Entfernt ein "(Kopie)" oder "(Kopie 7)" am Ende – auch mehrere hintereinander.
 *
 * Mehrfach, weil "X (Kopie) (Kopie)" nicht sauber ist und der Name sonst
 * in jeder weiteren Kopie mitwaechst. Der Loop ist auf zwei Durchlaege
 * begrenzt, nicht auf eine Zahl: die Grenze ist eine Versicherung gegen
 * einen Fehler im Muster, nicht gegen viele Kopien.
 */
export function ohneKopieEndung(name: string): string {
  let rest = name;
  for (let i = 0; i < 2; i++) {
    const ohne = rest.replace(new RegExp(`\\s*${NUMMER.source}\\s*$`), "").trim();
    if (ohne === rest) break;
    rest = ohne;
  }
  return rest;
}

/**
 * Der Kopiename. Ohne `nummer` wird sie aus dem Ausgangsnamen hochgezaehlt.
 *
 *   kopieName("Auto (Konversation)")     -> "Auto (Konversation) (Kopie)"
 *   kopieName("Auto (Konversation)", 3)  -> "Auto (Konversation) (Kopie 3)"
 *
 * Das `ohneKopieEndung(...) || name.trim()` faengt den Fall, in dem NICHTS
 * uebrig bleibt – der Name war genau "(Kopie)". Dann steht eben der
 * Originalname drin und die Nummer wird hochgezaehlt: "(Kopie) (Kopie 2)".
 * Der Weg ist inelegant, aber ein leerer Name waere schlimmer und ein
 * doppelter Name waere schlimmer als ein uneleganter.
 */
export function kopieName(name: string, nummer?: number): string {
  const basis = ohneKopieEndung(name) || name.trim();
  const n = nummer ?? nummerAusName(name) + 1;

  const endung = n === 1 ? " (Kopie)" : ` (Kopie ${n})`;

  /*
   * Gekuerzt wird VOR dem Anhaengen des Suffixes. Andernfalls wuerde
   * "(Kopie 12)" hinten abgeschnitten und die Kopie haette den Namen ihres
   * Originals – zwei Sets mit demselben Namen, was genau das Problem ist,
   * das diese Funktion loesen soll.
   */
  const platz = MAX_SET_NAME - endung.length;
  if (platz < 1) return endung.trim().slice(0, MAX_SET_NAME);

  return `${basis.slice(0, platz).trimEnd()}${endung}`;
}

/**
 * Der Name der naechsten Kopie, wenn schon welche existieren.
 *
 * Nimmt die Namen der vorhandenen Kopien, nicht den Zaehler der Klicks:
 * Wer erst " (Kopie 2)" loescht und dann wieder kopiert, soll nicht wieder
 * bei 1 anfangen. Ein Aufrufer, der die vorhandenen Slugs hat, übergibt sie
 * hier.
 */
export function naechsterKopieName(ursprung: string, vorhandeneNamen: string[]): string {
  const basis = ohneKopieEndung(ursprung) || ursprung.trim();

  const nummern = vorhandeneNamen
    .filter((n) => n.startsWith(basis))
    .map((n) => nummerAusName(n))
    .filter((n) => n > 0);

  if (nummern.length === 0) return kopieName(basis, 1);

  return kopieName(basis, Math.max(...nummern) + 1);
}