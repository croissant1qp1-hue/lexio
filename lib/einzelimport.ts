/*
 * Zweiter Parser fuer Eingaben OHNE Trennzeichen (Feature 1).
 *
 * Das Problem
 * -----------
 * `textblock-import.ts` setzt voraus, dass der Nutzer weiss, in welchem
 * Format er einfuegt: eine Zeile je Vokabel, Trennzeichen dazwischen. Das
 * ist der einzige Weg, bei dem eine automatische Zuordnung sicher ist.
 *
 * Die Praxis sieht anders aus. Wer eine Liste aus dem Kopf, aus einem Buch
 * oder aus einer fremden App uebernimmt, hat oft nur:
 *
 *     Haus
 *     Baum
 *     Fluss
 *
 * oder eine Nummerierung davor, oder "Haus = house", oder eine deutsche
 * Wortliste im Fliesstext. Jede dieser Formen scheitert heute an der
 * Meldung "Kein Trennzeichen gefunden" – der Nutzer darf die Liste noch
 * einmal von Hand in die richtige Form bringen. Das ist genau die Arbeit,
 * die ihm die App abnehmen soll.
 *
 * Die Regel, die alles zusammenhaelt
 * ----------------------------------
 * In ALLEN diesen Faellen steht die Uebersetzung am ENDE der Zeile:
 *
 *     der Hund                ->  frage "der Hund", antwort ""
 *     der Hund = Hund         ->  frage "der Hund", antwort "Hund"
 *     der Hund / Hund         ->  frage "der Hund", antwort "Hund"
 *     der Hund means dog      ->  frage "der Hund", antwort "dog"
 *
 * Daraus folgt die Regel, die dieses Modul umsetzt: Wenn eine Zeile EINEN
 * Begriff und sonst nichts traegt, ist die Uebersetzung noch nicht da –
 * die Karte ist unvollstaendig, aber nicht kaputt. Sie wird als Zeile
 * mit leerer Uebersetzung durchgereicht und in der Vorschau als
 * "Uebersetzung fehlt" markiert.
 *
 * Warum NICHT raten
 * -----------------
 * Der verlockende Reflex ist, aus einem deutschen Begriff eine Uebersetzung
 * zu machen. Das ist aus zwei Gruenden falsch:
 *
 *   1. Es gibt keine lokale Wörterbuchdatei, und ein Cloud-Uebersetzer
 *      braucht einen Schluessel, den die App nicht hat.
 *   2. Es waere geraten. "Bank" heisst Bank und Bank, "Schloss" heisst
 *      Schloss und Schloss. Ein still falsches Wort in einer Vokabelkarte
 *      ist schlimmer als eine leere, sichtbare Luecke.
 *
 * Der Nutzer fuellt die Luecken in der Vorschau selbst – das ist schneller,
 * als sie von Anfang an zu tippen, weil er sie nur ueberschreiben muss und
 * nicht beide Seiten.
 *
 * Ohne React und ohne Next, wie der erste Parser: reine Funktionen, und
 * `node lib/einzelimport.ts` fuehrt die Beispiele aus.
 */

import type { TextblockErgebnis, TextblockPaar } from "./textblock-import";

/*
 * Woerter, die zwischen Begriff und Uebersetzung stehen. Deutsch und
 * Englisch, weil beide Sprachen in Lexio vorkommen und die Wortliste
 * erfahrungsgemaess in der Sprache ist, die man gerade lernt.
 *
 * KEIN "bedeutet" absichtlich: "das bedeutet mir viel" ist ein Satz, keine
 * Wortpaarzeile. Wer es meint, schreibt es ohnehin mit Doppelpunkt oder
 * Gleichheitszeichen – beides wird ohnehin erkannt.
 */
const ZWOERT = [
  "means", "mean", "ist", "sind", "heißt", "heisst",
  "=", "->", "=>", ":", "|", ";",
] as const;

/*
 * KEIN Bindestrich als Trenner ohne Leerzeichen drumherum.
 *
 * Die erste Fassung enthielt " - ", und damit zerfiel jeder Beispielsatz
 * mit Gedankenstrich: "Der Weg nach Hause - lang und windig" wurde zu
 * Begriff "Der Weg nach Hause" und Uebersetzung "lang und windig". Bei
 * einem Wortpaar ist genau das richtig, bei einem Satz ist es falsch, und
 * der Parser kann den Unterschied nicht kennen.
 *
 * Deshalb gilt der Bindestrich NUR, wenn er zwischen zwei Wörtern steht und
 * das Trennzeichen der Zeile ist – nicht wenn mitten im Satz etwas
 * gestrichelt wird. Ein Wortpaar "Haus - house" hat genau einen Trenner
 * und einen Begriff auf jeder Seite; das ist unterscheidbar, und genau
 * darauf kommt es an.
 *
 * Der Punkt: "·" und ";" sind hier ebenfalls draussen. Ein Mittelpunkt
 * steht in deutschen Texten als Satzzeichen ("Er sagte: ·Ja·"), und ein
 * Semikolon in einem Beispielsatz waere wieder eine falsche Aufteilung.
 * Wer wirklich damit trennt, nutzt die Datei- oder Tab-Form.
 */

/*
 * Nummerierungen: "1.", "12)", "3 -", "- 5." und aehnliches. Das ist die
 * haeufigste Stoerung, wenn eine Liste aus einem Buch oder PDF kopiert
 * wurde. Abgeschnitten wird nur, was eindeutig eine Nummer ist.
 */
const NUMMER = /^\s*(?:\d{1,3}\s*[.)\]]|\d{1,3}\s+-\s+|[•·–—-]\s+)/;

/** Aufraeumen: doppelte Leerzeichen, Leerzeichen vor Satzzeichen. */
function putzig(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
}

/** Ein Begriff, der als Begriff taugt: nicht leer, nicht zu lang. */
function istBegriff(text: string): boolean {
  return text.length > 0 && text.length <= 200;
}

/**
 * Zaehlt, wie viele Woerter eine Zeile hat. Fliesstext hat viele, ein
 * Wortpaar wenige. Der Schnitt bei 6 ist willkuerlich, aber wichtig:
 * "Haus Baum Fluss" in EINER Zeile ist eine Fehlausgabe, keine Wortliste.
 */
function woerter(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/*
 * Das Bindestrich-Trennzeichen, getrennt von den anderen.
 *
 * " - " zaehlt NUR als Trenner, wenn die Zeile dadurch in genau zwei
 * sinnvolle Haelften zerfaellt. Das ist der Unterschied zwischen
 *
 *     Haus - house              ->  zwei Teile, ein Wortpaar
 *     Der Weg - lang und windig  ->  drei Teile, ein Satz, also KEIN Paar
 *
 * Bei "Der Weg nach Hause - lang und windig" waere die rechte Seite kein
 * Begriff, sondern ein Satz. Genau daran erkennt man den Unterschied:
 * eine Uebersetzung hat keine Leerzeichen und selten einen Punkt.
 *
 * Das Muster selbst steht in `spuren` in anTrenner – hier steht nur, warum
 * es so streng ist. Ohne Leerzeichen wird bewusst NICHT getrennt: "Haus-Garten"
 * ist im Deutschen ein eigenes Wort und keine Aufteilung in "Haus" und
 * "Garten".
 */
/**
 * Zerlegt eine Zeile an einem Trennerzeichen in zwei Teile.
 *
 * Zurueckhaltend bei den Suchwoertern: gesucht wird in der Mitte der
 * Zeile. "der Hund means Hund" soll an "means" teilen, nicht an einem
 * frueheren Trenner. Und eine Zeile, die am Ende anfängt ("Haus ="),
 * lieber gar nicht teilen – eine halbe Karte ist besser als zwei, von
 * denen eine falsch zugeordnet ist.
 */
function anTrenner(zeile: string): TextblockPaar | null {
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Zwei Spuren, in dieser Reihenfolge: die Woerter ("means", "ist", ...) sind
  // ein starkes Signal, der Bindestrich nur mit Leerzeichen drumherum ein
  // schwaches. Eine Uebersetzung hat zudem keine Leerzeichen und selten
  // einen Punkt – daran scheitert ein Satz mit Gedankenstrich.
  const spuren: RegExp[] = [
    new RegExp(`\\s*(?:${ZWOERT.map(esc).join("|")})\\s*`, "g"),
    /\s+[-–—]\s+/g,
  ];

  for (const spur of spuren) {
    const treffer = [...zeile.matchAll(spur)];
    if (treffer.length === 0) continue;

    // Von hinten nach vorn: die Uebersetzung steht am Ende, also ist der
    // letzte Trenner der richtige. Am Anfang kann auch mal ein Doppelpunkt
    // im Begriff stehen.
    for (const t of [...treffer].reverse()) {
      const frage = putzig(zeile.slice(0, t.index!));
      const antwort = putzig(zeile.slice(t.index! + t[0].length));
      if (istBegriff(frage) && istBegriff(antwort) && istUebersetzung(antwort)) {
        return { frage, antwort, beispiel: "", beispielUebersetzung: "" };
      }
    }
  }
  return null;
}

/**
 * Sieht eine Uebersetzung aus? Kurz, ohne Punkt am Ende, hoechstens ein
 * Wort. Das ist die Regel, die einen Satz von einer Uebersetzung trennt –
 * "lang und windig" hat drei Woerter, "house" hat eins.
 */
function istUebersetzung(text: string): boolean {
  if (text.length > 60) return false;
  if (/[.!?]$/.test(text)) return false;
  return woerter(text) <= 2;
}

/**
 * Die zweite Spalte aus mehreren Trennern: "Haus | house | The house is big"
 * wird zu Begriff + Uebersetzung + Beispielsatz + Beispieluebersetzung.
 * Die letzten beiden bleiben leer, wenn sie nicht da sind.
 */
function ausTraegerSpalten(teile: string[]): TextblockPaar {
  return {
    frage: putzig(teile[0] ?? ""),
    antwort: putzig(teile[1] ?? ""),
    beispiel: putzig(teile[2] ?? ""),
    beispielUebersetzung: putzig(teile[3] ?? ""),
  };
}

export type EinzelErgebnis = TextblockErgebnis & {
  /** Zeilen, die nur einen Begriff tragen und eine Übersetzung brauchen. */
  ohneUebersetzung: number;
};

/**
 * Der Einstieg fuer die Oberflaeche: probiert erst den strengen Parser
 * (mit Trennzeichen), und wenn der nichts findet, den lenienten.
 *
 * Der strenge Parser hat Vorrang, weil er mehr Information gewinnt
 * (Beispielsatz und Übersetzung aus vier Spalten). Der milde laeuft nur
 * dort, wo der strenge scheitert – dort gibt es nichts zu verlieren.
 */
export function textblockEinlesen(text: string): EinzelErgebnis {
  const zeilen = text
    .split(/\r?\n/)
    .map((z) => z.trim())
    .filter((z) => z.length > 0);

  const paare: TextblockPaar[] = [];
  let ohneUebersetzung = 0;
  let uebersprungen = 0;

  for (const roh of zeilen) {
    // Nummerierung weg, BEVOR getrennt wird: "1. Haus = house" darf nicht
    // am Bindestrich der Nummer zerrissen werden.
    const zeile = roh.replace(NUMMER, "").trim();

    /*
     * Schritt 1: harte Spaltentrenner.
     *
     * Tabulator, Pipe und Semikolon sind unambiguous – wenn sie dastehen,
     * ist die Zeile eine Zeile aus einer Tabelle, und die Spalten sind die
     * Felder. Es wird NICHT erst nach Trennwoertern gesucht: der Weg
     * "Der Weg nach Hause\tlang und windig" ist ein Satz mit Tabulator,
     * und jeder Versuch, darin noch ein Trennwort zu finden, produziert
     * Muell.
     *
     * Fuenf oder mehr Spalten sind eine Tabelle und keine Wortliste.
     */
    const spalten = zeile
      .split(/\t|\s*\|\s*|\s*;\s*/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (spalten.length >= 2) {
      if (spalten.length <= 4) {
        paare.push(ausTraegerSpalten(spalten));
      } else {
        uebersprungen += 1;
      }
      continue;
    }

    // Schritt 2: weiche Trenner ("means", "ist", " - ", "->").
    const allein = anTrenner(zeile);
    if (allein) {
      paare.push(allein);
      continue;
    }

    /*
     * Schritt 3: eine Zeile, ein Begriff.
     *
     * Der Schnitt bei sechs Woertern trennt Einzelwort von Satz. "Haus",
     * "zum Bahnhof" und "ich habe kein Geld" kommen durch, ein Absatz
     * nicht. Das ist eine Gussform: "ich habe kein Geld" wird als Begriff
     * ohne Uebersetzung aufgenommen, was harmlos ist – es steht ja sichtbar
     * in der Liste und wird beim Speichern abgefangen, falls es leer bleibt.
     */
    if (woerter(zeile) > 6) {
      uebersprungen += 1;
      continue;
    }

    const begriff = putzig(zeile);
    if (!istBegriff(begriff)) {
      uebersprungen += 1;
      continue;
    }

    paare.push({ frage: begriff, antwort: "", beispiel: "", beispielUebersetzung: "" });
    ohneUebersetzung += 1;
  }

  return {
    paare,
    ohneUebersetzung,
    uebersprungen,
    // Der erste Parser nennt hier das Trennzeichen. Hier gibt es keines
    // mehr, das zaehlt: die Oberflaeche braucht nur die Zahl der Zeilen
    // und die Zahl der offenen. `trenner` bleibt null, damit kein Code, der
    // auf "Trenner gefunden" prueft, eine falsche Auskunft bekommt.
    ohneTrenner: 0,
    trenner: null,
  };
}

/**
 * Was der Oberflaeche angezeigt wird. Bewusst als Text und nicht als Zahl,
 * weil die Zahl allein nicht erklaert, was zu tun ist.
 */
export function meldungFuer(ergebnis: EinzelErgebnis): string {
  const n = ergebnis.paare.length;
  if (n === 0) return "Keine Vokabel erkannt.";

  const basis = `${n} Zeile${n === 1 ? "" : "n"} erkannt.`;
  if (ergebnis.ohneUebersetzung === 0) return basis;

  return (
    `${basis} Davon fehlt bei ${ergebnis.ohneUebersetzung} ` +
    `${ergebnis.ohneUebersetzung === 1 ? "Zeile" : "Zeilen"} die Übersetzung – ` +
    "ergänze sie in der Liste, bevor du speicherst."
  );
}