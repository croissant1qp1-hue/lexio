import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dateiEinlesen,
  dateiZuGross,
  groesseText,
  istKopfzeile,
  istTextdatei,
  trennerErkennen,
  zellenSchneiden,
} from "../lib/datei-import";

/*
 * Jeder Fall hier ist eine Kopierform, die in der Praxis vorkommt – kein
 * erfundener Sonderfall. Die vier Datei-Stolpersteine aus dem Modulkopf
 * (BOM, Trennzeichen, Anfuehrungszeichen, Kopfzeile) haben je einen Test.
 */

test("Semikolon-Export aus deutschem Excel", () => {
  const csv = "Haus;house\nBaum;tree\nFluss;river";
  const e = dateiEinlesen(csv, "woerter.csv");
  assert.equal(e.trennerGefunden, ";");
  assert.deepEqual(e.paare.map((p) => [p.frage, p.antwort]), [
    ["Haus", "house"],
    ["Baum", "tree"],
    ["Fluss", "river"],
  ]);
});

test("Kommaseparator aus englischem Excel und Google Sheets", () => {
  const csv = "Haus,house\nBaum,tree\nFluss,river";
  const e = dateiEinlesen(csv);
  assert.equal(e.trennerGefunden, ",");
  assert.equal(e.paare.length, 3);
  assert.equal(e.paare[0].frage, "Haus");
  assert.equal(e.paare[0].antwort, "house");
});

test("Tabulator-Export einer Tabelle", () => {
  const tsv = "Haus\thouse\nBaum\ttree";
  const e = dateiEinlesen(tsv);
  assert.equal(e.trennerGefunden, "Tabulator");
  assert.deepEqual(e.paare.map((p) => p.antwort), ["house", "tree"]);
});

test("Byte Order Mark am Dateianfang landet nicht im ersten Wort", () => {
  // U+FEFF steht fuer die drei unsichtbaren Bytes, die Excel schreibt.
  const mitBom = "﻿Haus;house\nBaum;tree";
  const e = dateiEinlesen(mitBom);
  assert.equal(e.paare[0].frage, "Haus");
  assert.equal(e.paare[0].frage.charCodeAt(0), "H".charCodeAt(0));
});

test("Anfuehrungszeichen: Komma im Feld zerlegt die Zeile nicht", () => {
  const csv = '"Baum, gross";tree\n"Haus, klein";house';
  const e = dateiEinlesen(csv);
  assert.equal(e.trennerGefunden, ";");
  assert.deepEqual(e.paare.map((p) => p.frage), ["Baum, gross", "Haus, klein"]);
  assert.deepEqual(e.paare.map((p) => p.antwort), ["tree", "house"]);
});

test("Escapete Anfuehrungszeichen bleiben ein Anfuehrungszeichen", () => {
  assert.deepEqual(zellenSchneiden('"a ""b"" c";x', ";"), ['a "b" c', "x"]);
});

test("Windows-Zeilenenden landen nicht in der Uebersetzung", () => {
  const csv = "Haus;house\r\nBaum;tree\r\n";
  const e = dateiEinlesen(csv);
  assert.deepEqual(e.paare.map((p) => p.antwort), ["house", "tree"]);
  for (const p of e.paare) {
    assert.equal(p.antwort.includes("\r"), false);
  }
});

test("Kopfzeile wird erkannt und weggelassen", () => {
  const csv = "Begriff;Übersetzung\nHaus;house\nBaum;tree";
  const e = dateiEinlesen(csv);
  assert.equal(e.kopfzeileWeg, true);
  assert.deepEqual(e.paare.map((p) => p.frage), ["Haus", "Baum"]);
});

test("Kopfzeile in englischen Labels", () => {
  const csv = "Word;Translation\nhouse;Haus";
  assert.equal(dateiEinlesen(csv).kopfzeileWeg, true);
});

test("'Wort;word' in erster Zeile ist nicht eindeutig – Kopfzeile mit Namen melden", () => {
  /*
   * Ein ehrlicher Grenzfall: "Wort;word" kann die Kopfzeile einer Datei
   * sein ODER eine echte Vokabel. Die Regel kann das nicht unterscheiden,
   * also gewinnt die Kopfzeile – aber sie wird mit Namen gemeldet, damit
   * der Nutzer sie notfalls von Hand nachtraegt. Ein stiller Verlust
   * waere schlimmer als eine Korrektur.
   */
  const e = dateiEinlesen("Wort;word\nHaus;house");
  assert.equal(e.kopfzeileWeg, true);
  assert.deepEqual(e.kopfzeile, ["Wort", "word"]);
  assert.deepEqual(e.paare.map((p) => p.frage), ["Haus"]);
});

test("Kopfzeile mit drei und vier Spalten wird erkannt", () => {
  assert.equal(dateiEinlesen("Wort;Translation;Sentence;Hinweis\nhouse;Haus;a;b").kopfzeileWeg, true);
  assert.equal(dateiEinlesen("Nr;Wort;Bedeutung\n1;Haus;house").kopfzeileWeg, true);
});

test("Vier Spalten: Beispielsatz und Uebersetzung kommen mit", () => {
  const csv = "Haus;house;The house is big.;Das Haus ist groß.";
  const p = dateiEinlesen(csv).paare[0];
  assert.equal(p.beispiel, "The house is big.");
  assert.equal(p.beispielUebersetzung, "Das Haus ist groß.");
});

test("Ohne Trennzeichen: reine Wortliste geht auch", () => {
  const e = dateiEinlesen("Haus\nBaum\nFluss", "worte.txt");
  assert.equal(e.trennerGefunden, "keins");
  assert.equal(e.paare.length, 3);
  assert.equal(e.ohneUebersetzung, 3);
});

test("Ein Komma in einer Zeile macht nicht die ganze Datei kommagetrennt", () => {
  // Das Komma steht in EINER Zeile, das Semikolon in dreien. Der Modus
  // entscheidet, nicht das erste Vorkommen.
  const csv = "Haus;house\nBaum;tree\nKönig, der grosse;king";
  const e = dateiEinlesen(csv);
  assert.equal(e.trennerGefunden, ";");
  assert.equal(e.paare.length, 3);
});

test("Zellen mit Tabulator bleiben unangetastet", () => {
  const zellen = zellenSchneiden('"a\tb";x', ";");
  assert.deepEqual(zellen, ["a\tb", "x"]);
});

test("Trenner-Erkennung direkt", () => {
  assert.equal(trennerErkennen(["a;b", "c;d"]), ";");
  assert.equal(trennerErkennen(["a\tb", "c\td"]), "\t");
  assert.equal(trennerErkennen(["a,b", "c,d"]), ",");
  assert.equal(trennerErkennen(["Haus", "Baum"]), null);
});

test("Kopfzeilen-Erkennung direkt", () => {
  assert.equal(istKopfzeile(["Begriff", "Übersetzung", "Beispielsatz"]), true);
  assert.equal(istKopfzeile(["Haus", "house"]), false);
  assert.equal(istKopfzeile(["Begriff"]), false); // eine Zelle ist keine Zeile
});

test("Dateigrenze und Groessenangabe", () => {
  assert.equal(dateiZuGross(1024), false);
  assert.equal(dateiZuGross(500 * 1024), false);
  assert.equal(dateiZuGross(500 * 1024 + 1), true);
  assert.equal(groesseText(800), "800 Bytes");
  assert.equal(groesseText(2048), "2 kB");
});

test("Leere Datei ergibt keine Vokabeln und keinen Absturz", () => {
  const e = dateiEinlesen("", "leer.txt");
  assert.equal(e.paare.length, 0);
  assert.equal(e.zeilenInDatei, 0);
});
/*
 * ---------------------------------------------------------------
 * Dateityp-Pruefung: Bilder und Binaerdateien gehoeren nicht hierher.
 * Das `accept`-Attribut ist nur ein Filter im Dateidialog und faengt
 * nichts – per Drag-and-drop oder mit gedrueckter Umschalt-Taste kommt
 * alles durch.
 * ---------------------------------------------------------------
 */

test("istTextdatei akzeptiert die drei erlaubten Endungen", () => {
  const txt = "Haus;house\nBaum;tree\n";
  assert.equal(istTextdatei(txt, "liste.txt"), true);
  assert.equal(istTextdatei(txt, "liste.csv"), true);
  assert.equal(istTextdatei(txt, "liste.tsv"), true);
});

test("istTextdatei ignoriert die Gross-/Kleinschreibung", () => {
  assert.equal(istTextdatei("Haus;house\n", "LISTE.CSV"), true);
});

test("istTextdatei lehnt ein Bild ab", () => {
  assert.equal(istTextdatei("PNG-Daten", "foto.png", "image/png"), false);
});

test("istTextdatei lehnt eine als .txt benannte PNG-Datei am Inhalt ab", () => {
  // Genau der Fall, den das accept-Attribut nicht faengt.
  const png = "\u0000\u0000\u0000\u0000IHDR\u0000\u0000\u0000\u0000";
  assert.equal(istTextdatei(png, "foto.txt", ""), false);
});

test("istTextdatei lehnt eine Datei ohne Endung ab", () => {
  assert.equal(istTextdatei("Haus;house\n", "wortliste", ""), false);
});

test("istTextdatei vertraut einer .txt auch bei kaputtem MIME-Typ", () => {
  // Browser melden bei .csv manchmal application/vnd.ms-excel.
  assert.equal(istTextdatei("Haus;house\n", "liste.txt", "application/vnd.ms-excel"), true);
});

test("istTextdatei kommt mit Tabs und Zeilenumbruechen klar", () => {
  assert.equal(istTextdatei("Haus\thouse\r\nBaum\ttree\n", "l.tsv"), true);
});

test("istTextdatei lehnt NUL im Text ab", () => {
  assert.equal(istTextdatei("Haus;house\nBaum;tree\n\u0000", "l.csv"), false);
});

/*
 * ---------------------------------------------------------------
 * Nur-Kopfzeile: kein Phantomwort.
 * Ein leerer `textblockEinlesen("")` liefert eine offene Zeile ohne
 * Text. Ohne diese Faelle ergibt eine Datei mit nur "Begriff;Uebersetzung"
 * ein Set mit genau einem leeren Eintrag.
 * ---------------------------------------------------------------
 */

test("nur Kopfzeile liefert keine Paare", () => {
  const e = dateiEinlesen("Begriff;Übersetzung\n", "nur-kopf.csv");
  assert.equal(e.paare.length, 0);
  assert.equal(e.kopfzeileWeg, true);
  assert.deepEqual(e.kopfzeile, ["Begriff", "Übersetzung"]);
});

test("nur Kopfzeile behaelt alle Spaltennamen", () => {
  const e = dateiEinlesen("Wort;Meaning;Beispiel\n", "k.csv");
  assert.equal(e.kopfzeile.length, 3);
  assert.equal(e.paare.length, 0);
});

/*
 * ---------------------------------------------------------------
 * Kopfzeile mit Umlaut und in ASCII-Form.
 *
 * Die erste Fassung ersetzte Umlaute einfach (UE geht zu u) und erkannte
 * "Uebersetzung" aus einem deutschen Excel nicht – die wichtigste Kopfzeile
 * der App fiel genau dann durch, wenn sie mit Umlaut geschrieben war.
 * Beide Schreibweisen muessen denselben Schluessel treffen.
 * ---------------------------------------------------------------
 */

test("Kopfzeile mit Umlaut wird erkannt", () => {
  assert.equal(istKopfzeile(["Begriff", "Übersetzung"]), true);
  assert.equal(istKopfzeile(["Begriff", "Uebersetzung"]), true);
  assert.equal(istKopfzeile(["Wörter", "Wort"]), true);
});

test("Kopfzeile in ASCII-Form wird erkannt", () => {
  assert.equal(istKopfzeile(["Begriff", "Uebersetzung"]), true);
  assert.equal(istKopfzeile(["Woerter", "Wort"]), true);
});

test("deutsche Datei mit Umlaut-Kopfzeile laesst die Zeile wirklich weg", () => {
  const e = dateiEinlesen("Begriff;Übersetzung\nHaus;house\n", "de.csv");
  assert.equal(e.kopfzeileWeg, true);
  assert.equal(e.paare.length, 1);
  assert.equal(e.paare[0].frage, "Haus");
  assert.equal(e.paare[0].antwort, "house");
});

test("englische Google-Sheets-Kopfzeile wird erkannt", () => {
  const e = dateiEinlesen("Word;Translation;Example\nHaus;house;The house is big.\n", "g.csv");
  assert.equal(e.kopfzeileWeg, true);
  assert.equal(e.kopfzeile.length, 3);
  assert.equal(e.paare.length, 1);
});

test("echte Vokabeln verschwinden nicht", () => {
  // Woerter mit ae/oe/ue, die KEINE Kopfwerter sind.
  assert.equal(istKopfzeile(["Uebermut", "Kuehnheit"]), false);
  assert.equal(istKopfzeile(["Groesse", "Laenge"]), false);
  assert.equal(istKopfzeile(["Haus", "house"]), false);
});

test("Vokabel 'Vokabel' bleibt eine Vokabel", () => {
  // Der Nutzer lernt selbst Sprachwissenschaft. "Vokabel / Karte" ist eine
  // echte Zeile, keine Kopfzeile – die erste Zelle allein entscheidet das
  // nicht, weil "vokabel" im Kopfwort-Register steht.
  const e = dateiEinlesen("Vokabel;Karte\n", "selten.csv");
  assert.equal(e.kopfzeileWeg, false);
  assert.equal(e.paare.length, 1);
});
