/*
 * Datei einlesen statt tippen (Feature 3).
 *
 * Wofuer das da ist
 * -----------------
 * Der Textblock-Import (lib/einzelimport.ts) nimmt Text, den jemand
 * eingefuegt hat. Aus einer Datei ist der Text aber nicht eingefuegt –
 * er ist gelesen, und gelesene Dateien sehen anders aus als eingefuegter
 * Text. Wer in Excel oder in Google Sheets eine Wortliste gebaut hat, hat
 * genau diese vier Stolpersteine:
 *
 *   1. BYTE ORDER MARK. Excel speichert UTF-8 mit drei unsichtbaren Bytes
 *      am Anfang (U+FEFF). Ohne Abschneiden wird das ERSTE Wort zu
 *      "﻿Haus" – ein Zeichen, das man nicht sieht, aber das beim
 *      Lernen dauerhaft dasteht.
 *   2. TRENNZEICHEN. Deutsches Excel trennt mit Semikolon, englisches mit
 *      Komma, der Tabellenexport mit Tabulator. Alle drei muessen gehen.
 *   3. ANFUEHRUNGSZEICHEN. `Begriff;Beispiel` heisst in Excel
 *      `"Begriff, mit Komma";"The house, that is big"`. Wer naiv an den
 *      Trennern schneidet, zerlegt beide Felder in der Mitte.
 *   4. KOPFZEILE. `Begriff;Uebersetzung` steht als erste Zeile in der
 *      Datei und ist KEINE Vokabel. Ohne Erkennen wird daraus die Karte
 *      "Begriff" / "Uebersetzung" – genau die Karte, die jeder beim ersten
 *      Blick auf sein Set fuer eine Datenverdopplung haelt.
 *
 * Was dieses Modul tut
 * --------------------
 * Es liest KEINE Vokabeln. Es bringt eine Datei auf genau die Form, die der
 * vorhandene Parser schon versteht: eine Zeile je Vokabel, Felder durch
 * Tabulator getrennt. Die Erkennung der Vokabeln bleibt damit an EINER
 * Stelle – in `textblockEinlesen`. Zwei Parser fuer dieselbe Aufgabe waere
 * die Art von Doppelarbeit, die sich bei der naechsten Erweiterung raecht.
 *
 * Ohne React und ohne Next, wie die anderen: reine Funktionen.
 */

import { textblockEinlesen, type EinzelErgebnis } from "./einzelimport";

/**
 * Woerter, die in einer Kopfzeile stehen koennen, ohne dass es Daten sind.
 *
 * Alle Eintraege stehen in ASCII-Form: kein Umlaut, kein ss-Zeichen, nur
 * a-z. "Uebersetzung" steht hier also als "uebersetzung".
 *
 * `istKopfwort` uebersetzt Umlaute genauso: ae, oe, ue, ss. Dadurch fallen
 * beide Schreibweisen auf denselben Schluessel:
 *
 *   "Uebersetzung"  ->  uebersetzung
 *   "Ue-bersetzung"  ->  uebersetzung
 *
 * Der Unterschied faellt in der Liste unsichtbar weg und macht den Vergleich
 * trotzdem richtig. Das ist der ganze Trick, und er ist nicht verhandelbar:
 * eine erste Fassung ersetzte Umlaute einfach (UE geht zu u) und erkannte
 * "Wort / Meaning" aus Google Sheets als Vokabel. Wer ASCII schreibt, tippt
 * "Woerter", wer Umlaute schreibt, "Woerter" – die Liste muss beides auf
 * denselben Schluessel bringen, sonst fehlt jedes zweite Kopfzeile.
 */
const KOPFWOERTER = [
  "begriff", "begriffe", "wort", "woerter", "vokabel", "vokabeln",
  "deutsch", "englisch", "frage", "antwort", "term", "word", "translation",
  "uebersetzung", "uebersetzungen", "bedeutung", "lernfeld", "wortschatz",
  /*
   * Die englischen Spaltennamen fehlten in der ersten Fassung. Wer eine
   * Liste in Google Sheets anlegt, nennt sie "Word | Meaning | Example" –
   * und genau diese drei Wörter wurden als Vokabel importiert. Die Folge war
   * eine Karte "Wort / Meaning", die jeder als Datenverdopplung erkennt.
   */
  "meaning", "meanings", "example", "examples", "sentence", "sentences",
  "lernwort", "zielwort", "muttersprache", "sprache", "language",
  "beispielsatz", "beispielsaetze", "beispiel", "satz", "note", "notiz",
  "kommentar", "bemerkung", "anmerkung", "hinweis", "hinweise", "quelle",
  "autor", "author", "kategorie", "category", "gruppe", "group", "typ", "type",
  "schwierigkeit", "difficulty", "pos", "level", "cefr", "tags", "unit",
  "kapitel", "chapter", "nr", "nummer", "id", "lfd", "seite", "page",
];

export type DateiErgebnis = EinzelErgebnis & {
  /** Name der Datei, nur fuer die Meldung. */
  datei: string;
  /** Das Trennzeichen, das erkannt wurde – zur Anzeige fuer den Nutzer. */
  trennerGefunden: string;
  /** Zeilen in der Datei, die zu Vokabeln wurden. */
  zeilenInDatei: number;
  /** true, wenn die erste Zeile eine Kopfzeile war und weggelassen wurde. */
  kopfzeileWeg: boolean;
  /**
   * Die weggelassene Kopfzeile, Zelle fuer Zelle.
   *
   * Nicht nur `true`: wenn eine Zeile wegfällt, muss der Nutzer erfahren,
   * WELCHE. Sonst ist das stille Datenverlust, und im schlimmsten Fall
   * war die Zeile keine Kopfzeile, sondern eine echte Vokabel – die
   * faellt dann ungesehen weg. Mit dem Namen kann er sie von Hand
   * nachragen.
   */
  kopfzeile: string[];
  /** Groesse der Datei in Bytes, fuer die Grenzpruefung. */
  bytes: number;
};

const MAX_BYTES = 500 * 1024;

/**
 * Zu gross? Eine Wortliste ist eine Textdatei. Wer eine 40-MB-Tabelle
 * auswaehlt, hat sich vermutlich verschlafen – und der Browser wuerde
 * minutenlang blockieren. Also freundlich sagen, was erlaubt ist.
 */
export function dateiZuGross(bytes: number): boolean {
  return bytes > MAX_BYTES;
}

/** "0,5 MB" statt "524288 Bytes". */
export function groesseText(bytes: number): string {
    if (bytes < 1024) return `${bytes} Bytes`;
    return `${(bytes / 1024).toFixed(0)} kB`;
}

/** Die Endungen, die das `accept`-Attribut im Markup nennt. */
export const ERLAUBTE_ENDUNGEN = [".txt", ".csv", ".tsv"] as const;

/**
 * Passt die Datei ueberhaupt zu einer Wortliste?
 *
 * Das `accept`-Attribut ist KEIN Schutz. Es ist ein Filter im Dateidialog –
 * man kann es mit gedrueckter Umschalt-Taste umgehen, und manche Browser
 * bieten per Drag-and-drop jede Datei an. Ein Foto als `.png` mit der
 * Endung `.txt` benannt kommt also durch und wird zu drei Zeilen Muell,
 * weil irgendein Byte Folge dem Trenner aehnlich sieht.
 *
 * Zwei Pruefungen, weil jede allein zu schwach ist:
 *
 *   1. ENDUNG ODER MIME-TYP. Faengt das umbenannte Foto von aussen ab.
 *   2. NULLBYTE. Gilt als NUL-Zeichen irgendwo im Text, ist es keine
 *      Textdatei. Das faengt die Datei, die sich als .txt ausgibt, und
 *      faellt unter Windows auf, wo jemand eine .csv im Latin-1 speichert
 *      und der Rest als Muell aussieht.
 *
 * Der Inhaltstest ist der wichtigere. Eine .txt-Datei, die eine .png ist,
 * ist kein Tippfehler von der Sorte "Endung vergessen", sondern die Frage,
 * ob hier ueberhaupt die richtige Datei ausgewaehlt wurde.
 */
export function istTextdatei(inhalt: string, dateiname: string, mimeTyp = ""): boolean {
    const punkt = dateiname.lastIndexOf(".");
    const endung = punkt >= 0 ? dateiname.slice(punkt).toLowerCase() : "";

    /*
     * Ohne Endfall: nur der MIME-Typ darf retten.
     *
     * Der umgekehrte Fall – Endung `.txt`, aber der Browser meldet einen
     * Unsinn wie `application/vnd.ms-excel` – ist in freier Wildbahn und darf
     * nicht blockieren. Fehlt die Endung dagegen GANZ, ist das keine
     * gerettete .csv, sondern eine Datei ohne Verabredung. Der Nutzer hat
     * sie aus einem Download-Ordner gezogen, und ein Verzeichnis voll
     * Dateien ohne Endung gehoert nicht hierher.
     */
    if (endung === "") {
        return (
            mimeTyp === "text/plain" ||
            mimeTyp === "text/csv" ||
            mimeTyp === "text/tab-separated-values"
        );
    }

    const endungOk = (ERLAUBTE_ENDUNGEN as readonly string[]).includes(endung);
    if (!endungOk) return false;

    // NUL-Byte: der klarste Beweis fuer "das ist keine Textdatei".
    if (inhalt.includes("\u0000")) return false;

    /*
     * Kontrollzeichen ausser Tab, Zeilenumbruch und Wagenruecklauf. In einer
     * normalen Wortliste kommen sie nicht vor – in einem PNG-Bild ueberall.
     * Ueber 1 Prozent Anteil, sonst kann ein einzelnes kaputtes Byte aus
     * einer echten Wortliste keine falsche Ablehnung bauen.
     */
    let verdaechtig = 0;
    for (let i = 0; i < inhalt.length; i++) {
        const code = inhalt.charCodeAt(i);
        if (code < 32 && code !== 9 && code !== 10 && code !== 13) verdaechtig += 1;
    }
    if (verdaechtig / Math.max(inhalt.length, 1) > 0.01) return false;

    return true;
}

/**
 * Zaehlt, wie oft ein Trennzeichen AUSSERHALB von Anfuehrungszeichen
 * vorkommt. Getrennt, weil `"Baum, gross";"tree"` einen Komma-Treffer
 * enthaelt, der keiner ist.
 */
function trefferAusserhalb(zeile: string, trenner: string): number {
  let anzahl = 0;
  let inAnfuehrung = false;
  for (let i = 0; i < zeile.length; i++) {
    const z = zeile[i];
    if (z === '"') {
      if (inAnfuehrung && zeile[i + 1] === '"') i += 1;
      else inAnfuehrung = !inAnfuehrung;
    } else if (z === trenner && !inAnfuehrung) {
      anzahl += 1;
    }
  }
  return anzahl;
}

/**
 * Schneidet eine Zeile an einem Trennzeichen in Zellen – und beachtet dabei
 * Anfuehrungszeichen. `"Baum, gross";"The tree"` wird zu zwei Zellen, nicht
 * zu drei. `""` innerhalb eines Feldes ist ein escaped Anfuehrungszeichen.
 */
export function zellenSchneiden(zeile: string, trenner: string): string[] {
  const zellen: string[] = [];
  let aktuell = "";
  let inAnfuehrung = false;

  for (let i = 0; i < zeile.length; i++) {
    const z = zeile[i];
    if (z === '"') {
      if (inAnfuehrung && zeile[i + 1] === '"') {
        aktuell += '"';
        i += 1;
      } else {
        inAnfuehrung = !inAnfuehrung;
      }
    } else if (z === trenner && !inAnfuehrung) {
      zellen.push(aktuell);
      aktuell = "";
    } else {
      aktuell += z;
    }
  }
  zellen.push(aktuell);
  return zellen.map((z) => z.trim());
}

/**
 * Welches Trennzeichen benutzt die Datei?
 *
 * Nicht das erste, das irgendwo auftaucht, sondern das, das in den meisten
 * Zeilen gleich oft vorkommt. Grund: eine Wortliste "Haus;house" und ein
 * einzelner Begriff mit Komma darin ("König(in), die") duerfen nicht
 * entscheiden, dass die ganze Datei kommagetrennt ist. Der Modus der
 * Spaltenzahl ist das ehrlichere Mass – und Tabulator gewinnt bei
 * Gleichstand, weil er der einzige Trenner ist, der in einem Satz niemals
 * vorkommt.
 */
export function trennerErkennen(zeilen: string[]): string | null {
  const kandidaten = ["\t", ";", ",", "|"] as const;
  let bester: { trenner: string; punkte: number } | null = null;

  for (const kandidat of kandidaten) {
    const haeufigkeiten = new Map<number, number>();
    for (const zeile of zeilen) {
      if (!zeile.trim()) continue;
      const anzahl = trefferAusserhalb(zeile, kandidat);
      if (anzahl === 0) continue;
      haeufigkeiten.set(anzahl, (haeufigkeiten.get(anzahl) ?? 0) + 1);
    }
    if (haeufigkeiten.size === 0) continue;

    let punkte = 0;
    for (const [anzahl, mal] of haeufigkeiten) {
      // Punkte = Zeilen mit dieser Spaltenzahl, leicht gewichtet nach der
      // Spaltenzahl selbst: drei Spalten in vielen Zeilen sind ein
      // belastbareres Muster als ein Komma in zwei Zeilen.
      punkte = Math.max(punkte, mal * (anzahl + 1));
    }
    if (bester === null || punkte > bester.punkte) {
      bester = { trenner: kandidat, punkte };
    }
  }

  return bester?.trenner ?? null;
}

/** Ist eine Zelle ein Kopfzeilen-Label und keine echte Vokabel? */
function istKopfwort(zelle: string): boolean {
  const normiert = zelle
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z]/g, "");
  return normiert.length > 0 && KOPFWOERTER.includes(normiert);
}

/**
 * Sieht die erste Zeile nach einer Kopfzeile aus?
 *
 * Bewusst streng: NUR wenn jede nicht-leere Zelle ein bekanntes Label ist.
 * Eine Liste, die zufällig mit dem Wort "Wort" beginnt, ist eine
 * Wortliste, und die darf nicht verschwinden. Ein Blick auf die erste
 * Zeile "Haus;house" verwechselt nichts – keine der Zellen ist ein Label.
 */
export function istKopfzeile(zellen: string[]): boolean {
  const gefuellt = zellen.filter((z) => z.length > 0);
  if (gefuellt.length < 2) return false;
  return gefuellt.every(istKopfwort);
}

/**
 * Der Einstieg fuer die Oberflaeche: Dateitext lesen, auf die Form bringen,
 * die `textblockEinlesen` versteht, und dann dieses aufrufen.
 *
 * Der Rückgabewert ist bewusst ein vollstaendiges `EinzelErgebnis`, damit
 * die Oberflaeche nicht wissen muss, dass es zwei Stufen gab.
 */
export function dateiEinlesen(text: string, dateiname = "Datei"): DateiErgebnis {
  /*
   * 1. BOM abschneiden.
   *
   * Muss vor allem anderen passieren, auch vor dem Zeilenumbruch: das BOM
   * haengt am ersten Byte der Datei, also am Anfang der ersten Zeile. Wer
   * es erst spaeter abschneidet, hat das erste Wort schon beschaedigt.
   */
  const ohneBom = text.replace(/^﻿/, "");

  /*
   * 2. Zeilen. Windows-Dateien haben \r\n, das reicht `split(/\r?\n/)`
   * mit auf. Ein einzelnes \r am Zeilenende (alte Mac-Zeilen) wird
   * zusätzlich abgeschnitten, sonst hiesse die Uebersetzung "house\r" und
   * das taucht beim Lernen mitten im Wort auf.
   */
  const zeilen = ohneBom
    .split(/\r\n|\n|\r/)
    .map((z) => z.replace(/﻿/g, "").trimEnd())
    .filter((z) => z.trim().length > 0);

  const trenner = trennerErkennen(zeilen);

  /*
   * 3. Ohne Trennzeichen ist die Datei eine Wortliste – dann bitte den
   *    Parser mit dem Originaltext, der weiss auch ohne Trenner etwas.
   */
  if (!trenner) {
    const ergebnis = textblockEinlesen(ohneBom);
    return {
      ...ergebnis,
      datei: dateiname,
      trennerGefunden: "keins",
      zeilenInDatei: zeilen.length,
      kopfzeileWeg: false,
      kopfzeile: [],
      bytes: text.length,
    };
  }

  /*
   * 4. Zellen schneiden und in die Parser-Form bringen. Der Tabulator als
   *    Zieltrenner ist Absicht: `textblockEinlesen` zerlegt ihn als harten
   *    Spaltentrenner und weiss dann, dass die Zeile eine Tabellenzeile ist
   *    und nicht an einem Trennwort zerrissen werden darf.
   */
  const normiert: string[] = [];
  let kopfzeileWeg = false;
  let kopfzeile: string[] = [];

  zeilen.forEach((zeile, index) => {
    let zellen = zellenSchneiden(zeile, trenner);
    if (index === 0 && istKopfzeile(zellen)) {
      kopfzeileWeg = true;
      kopfzeile = zellen.filter((z) => z.length > 0);
      return;
    }
    // Zu viele Spalten: die Zeile gehoert hier nicht hin (sie bleibt aber
    // unten als "uebersprungen" sichtbar, der Parser zaehlt sie mit).
    zellen = zellen.filter((z) => z.length > 0);
    if (zellen.length === 0) return;
    normiert.push(zellen.join("\t"));
  });

  /*
   * Nur noch die Kopfzeile in der Datei? Dann ist die Liste leer, und ein
   * leerer `textblockEinlesen("")` liefert eine offene Zeile ohne Text –
   * eine Vokabel, die es nicht gibt. Der Nutzer speichert dann ein Set mit
   * genau einem leeren Eintrag und wundert sich hinterher.
   */
  if (normiert.length === 0) {
    return {
      paare: [],
      uebersprungen: 0,
      ohneTrenner: 0,
      trenner: null,
      ohneUebersetzung: 0,
      datei: dateiname,
      trennerGefunden: trenner === "\t" ? "Tabulator" : trenner,
      zeilenInDatei: zeilen.length,
      kopfzeileWeg,
      kopfzeile,
      bytes: text.length,
    };
  }

  const ergebnis = textblockEinlesen(normiert.join("\n"));

  return {
    ...ergebnis,
    datei: dateiname,
    trennerGefunden: trenner === "\t" ? "Tabulator" : trenner,
    zeilenInDatei: zeilen.length,
    kopfzeileWeg,
    kopfzeile,
    bytes: text.length,
  };
}