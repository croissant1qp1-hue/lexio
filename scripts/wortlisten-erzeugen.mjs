#!/usr/bin/env node
/**
 * Wortlisten aus den vier Freie-Quellen-Funden erzeugen.
 *
 * Wofuer das da ist
 * -----------------
 * Phase 2 des Planes braucht echte Wortlisten statt der geloeschten
 * Platzhalter. Die Roh-Quellen dafuer sind gross (Kaikki ist etwa halber
 * Gigabyte komprimiert) und werden nicht ins Repo gelegt – das Skript liest
 * sie aus einem Quellen-Ordner, den der Aufrufer angibt.
 *
 *   npm run wortlisten:erzeugen -- --quellen /tmp/opencode --top 100
 *
 * erwartet im Quellen-Ordner (alles aus/ab dem Web; einzeln herunterladen):
 *
 *   ngsl.json                     NGSL 1.2 (Lemma, Rank, SFI, Frequency)
 *   kelly.json                    Kelly frequency list (word, cefr, ...)
 *   kaikki.jsonl.gz               kaikki.org Dictionary of English, JSONL
 *   eng_sentences.tsv             Tatoeba: englische Saetze
 *   deu_sentences.tsv             Tatoeba: deutsche Saetze
 *   eng_deu_links.tsv             Tatoeba: eng_id -> deu_id Verknuepfungen
 *
 * Ausgabe (Standard scripts/wortlisten/):
 *
 *   <name>.json   fertige Karten im Import-Format der App
 *   <name>.csv    dieselben Karten als CSV (frage;antwort;beispielsatz;...)
 *
 * Was eine Karte ist
 * ------------------
 * Das Layout der App: Vorderseite ist die deutsche Uebersetzung, Rueckseite
 * der englische Begriff, dazu ein Beispielsatz auf Englisch mit deutscher
 * Uebersetzung. Damit die Karte fuers Lernen taugt, braucht sie alle vier
 * Teile. Fehlt einer (z. B. kein deutscher Beispielsatz zu diesem Wort in
 * Tatoeba), faellt das Wort still heraus – eine halbe Karte waere schlechter
 * als keine. Am Ende steht in der Ausgabe, wie viele Worte komplett waren.
 *
 * Abbruch
 * -------
 * Fehlende Quelldatei = Abbruch mit klarer Meldung. Ein Generator, der halbe
 * Datensaetze still erzeugt, verursacht nur Spaeteres-Entfernen.
 */

import fs from "node:fs";
import zlib from "node:zlib";
import { createInterface } from "node:readline";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const TIEFE = "  ";

function argumente() {
  const a = process.argv.slice(2);
  const hol = (schluessel, standard) => {
    const i = a.indexOf(schluessel);
    return i >= 0 && a[i + 1] ? a[i + 1] : standard;
  };
  return {
    quellen: hol("--quellen", path.join(WURZEL, "scripts", "quellen")),
    ausgabe: hol("--ausgabe", path.join(WURZEL, "scripts", "wortlisten")),
    top: Number(hol("--top", "0")),           // 0 = volle NGSL (2809 Worte)
    name: hol("--name", "ngsl-grundlagen"),
    // --mengen: zusaetzlich die vier Lern-Sets (Alltag I/II, Ausbau I/II)
    // nach NGSL-Frequenzrang schreiben. Ohne den Schalter bleibt es bei
    // einer Datei, damit der kleine Starter-Lauf unveraendert bleibt.
    mengen: a.includes("--mengen"),
  };
}

function ausgabe(name) {
  console.log(`${TIEFE}${name}`);
}

function pfad(quellen, datei) {
  const p = path.join(quellen, datei);
  if (!fs.existsSync(p)) {
    console.error(`Quelldatei fehlt: ${p}`);
    process.exit(1);
  }
  return p;
}

function lesePlain(datei) {
  return fs.readFileSync(datei, "utf8").split("\n").filter(Boolean);
}

/**
 * Tatoeba-Links: eng_id -> erste deutsche Satz-id.
 * Eine englische Satz-id hat meist mehrere deutsche Uebersetzungen; es
 * genuegt eine, und die erste ist so gut wie jede andere.
 */
function baueLinks(quellen) {
  ausgabe("Tatoeba-Links lesen ...");
  const links = new Map();
  for (const zeile of lesePlain(pfad(quellen, "eng_deu_links.tsv"))) {
    const [eng, deu] = zeile.split("\t");
    if (eng && deu && !links.has(eng)) links.set(eng, deu);
  }
  ausgabe(`  ${links.size} eng->deu Verknuepfungen`);
  return links;
}

/**
 * NGSL bis --top Worte. top = 0 heisst: alle 2809.
 */
function ngsl(quellen, top) {
  ausgabe("NGSL lesen ...");
  const alle = JSON.parse(fs.readFileSync(pfad(quellen, "ngsl.json"), "utf8"));
  const worte = top > 0 ? alle.slice(0, top) : alle;
  ausgabe(`  ${worte.length} Worte ausgewaehlt`);
  return worte;
}

/**
 * Kelly würde das CEFR-Level je Wort liefern. Der erste Wurf braucht es
 * nicht; es bleibt als auskommentierter Hinweis, dass die Quelle da ist,
 * wenn Phase 2 die Listen nach Niveau schneidet.
 */
// function cefrMap(quellen) { ... }

/** Menge der Zielworte (lowercase) fuer den Tatoeba-Filter. */
function zielSet(worte) {
  const menge = new Set();
  for (const w of worte) menge.add(w.Lemma.toLowerCase());
  return menge;
}

/**
 * Kaikki: fuer jedes Zielwort die deutsche(n) Uebersetzung(en) der ersten
 * passenden Bedeutung. Kaikki listet pro Wort mehrere Eintraege (Wortarten);
 * wir nehmen den ersten mit einer de-Uebersetzung.
 */
async function kaikkiUebersetzungen(quellen, ziele, worte) {
  ausgabe("Kaikki lesen (dauert, groesse Datei) ...");
  const ergebnis = new Map();

  const zielZuLemma = new Map();
  for (const w of worte) zielZuLemma.set(w.Lemma.toLowerCase(), w.Lemma);

  await gzipZeilen(pfad(quellen, "kaikki.jsonl.gz"), zeile => {
    if (ergebnis.size === ziele.size) return;
    let eintrag;
    try {
      eintrag = JSON.parse(zeile);
    } catch {
      return;
    }
    const wort = (eintrag.word || "").toLowerCase();
    if (!zielZuLemma.has(wort)) return;
    if (ergebnis.has(wort)) return;

    const kandidaten = leseKandidaten(eintrag, wort);
    if (!kandidaten.length) return;

    ergebnis.set(wort, { lemma: zielZuLemma.get(wort), kandidaten });
  });

  // Sonderfaelle anwenden: vorhandene Uebersetzungen korrigieren UND fehlende
  // Woerter ergaenzen. I/could/would haben in Kaikki keinen brauchbaren
  // Eintrag, alle anderen hier gelisteten eine irrefuehrende erste Bedeutung.
  for (const [wort, uebersetzung] of Object.entries(SONDERFAELLE)) {
    const schluessel = wort.toLowerCase();
    if (!zielZuLemma.has(schluessel)) continue;
    ergebnis.set(schluessel, {
      lemma: zielZuLemma.get(schluessel),
      kandidaten: [{ wort: uebersetzung, beispiele: [] }],
      gesetzt: true,
    });
  }

  ausgabe(`  ${ergebnis.size} deutsche Uebersetzungen, davon ${Object.keys(SONDERFAELLE).filter(w => zielZuLemma.has(w.toLowerCase())).length} Sonderfaelle`);
  return ergebnis;
}

/**
 * Kuratierte Uebersetzungen fuer haeufige Funktionswoerter.
 *
 * Kaikki sortiert die Bedeutungen nicht nach Haeufigkeit: die erste Sense
 * kann eine archaische Spezialbedeutung sein ("she" -> Schiff, "only" ->
 * einzigartig, "that" -> sodass). Bei den allerhaeufigsten Woertern holt
 * keine Filterlogik das raus, weil es strukturell ist. Diese Liste ueberschreibt
 * die Kaikki-Uebersetzung fuer genau die Woerter, die dadurch falsch waeren –
 * auch fuer Woerter ohne brauchbare Kaikki-Uebersetzung (I, could, would).
 *
 * Nur fuer das Starterset gedacht; beim vollen Lauf entscheidet die Abnahme,
 * ob die Liste waechst oder die Quelle verbessert wird.
 */
const SONDERFAELLE = {
  a: "ein, eine",
  I: "ich",
  it: "es",
  she: "sie",
  they: "sie",
  you: "du, Sie",
  for: "für",
  that: "das, dass",
  this: "dieser, diese, dieses",
  do: "machen, tun",
  at: "bei, an",
  will: "werden",
  would: "würde",
  could: "könnte",
  can: "können",
  so: "so, also",
  there: "dort",
  when: "wann, als",
  now: "jetzt",
  only: "nur",
  just: "gerade, nur",
  after: "nach, nachdem",
  even: "sogar",
  here: "hier",
  is: "ist",
  be: "sein",
  on: "an, auf",

  /*
   * Zweite Runde, aus demselben Grund wie oben – aber discovered an den
   * Karten, die die satzbezogene Auswahl jetzt verwirft. Bei
   * Funktionswoertern ist die strenge Pruefung falsch: "Ich war in den
   * Bergen" enthaelt "der" nicht, und doch ist "der" die richtige Antwort
   * auf "the". Sie zu verwerfen heisst, haeufige Woerter zu verlieren.
   *
   * Und beim Nachsehen der alten Top-100 standen dort vier falsche Karten,
   * die derselbe Fehler eingebaut hat, den diese Auswahl jetzt behebt:
   *
   *   use   -> "Benutzung" bei "Du kannst diesen Wagen benutzen."
   *   work  -> "Arbeit"     bei "Ich arbeite sogar sonntags."
   *   see   -> "verstehen"  bei "Ich bin gespannt dich zu sehen."
   *   take  -> "einnehmen"  bei "Pass gut auf dich auf."
   *
   * Eine falsche Karte ist schlimmer als keine: sie wird als richtig
   * gelernt. Diese Liste ist deshalb von Hand geschrieben und deckt genau
   * die Woerter ab, bei denen sich die Automatik nicht vertrauen laesst.
   */
  the: "der, die, das",
  of: "von",
  to: "zu",
  have: "haben",
  as: "als, wie",
  by: "von, durch, bei, mit",
  if: "wenn, falls",
  one: "eins, eine",
  about: "über, von",
  know: "wissen, kennen",
  more: "mehr",
  see: "sehen",
  what: "was",
  up: "auf, hoch",
  some: "einige, manche",
  other: "andere",
  take: "nehmen",
  no: "nein, kein",
  because: "weil",
  work: "arbeiten, Arbeit",
  use: "benutzen, verwenden",
  first: "erste, zuerst",
  new: "neu",
  over: "über, vorbei",
  should: "sollen",
  much: "viel",
  may: "können, mögen",
  such: "solch",
  from: "von, aus",
  say: "sagen",
  all: "alle",
  which: "welche, welcher",
  get: "bekommen, holen",
  think: "denken",
  out: "aus, heraus",
  look: "sehen, aussehen",
  thing: "Ding, Sache",
  right: "richtig, rechts",

  /*
   * Die zweite Kurationsrunde, 2026-10-04.
   *
   * Ausgeloest wurde sie von `scripts/wortlisten-qualitaet.mjs`, nicht von
   * einem Gefuehl beim Lesen. Die Pruefung "Substantiv auf der Vorderseite,
   * aber das Wort kommt im deutschen Beispielsatz nicht vor" lieferte 130
   * Treffer; nach Durchsicht blieben rund 60 Karten uebrig, in denen die
   * Uebersetzung schlicht zur falschen Bedeutung gehoert.
   *
   * Das Muster ist immer dasselbe: Kaikki nennt zuerst die Substantiv-
   * Bedeutung, der englische Satz benutzt das Wort als Verb oder in einer
   * Redewendung, und die Karte behauptet trotzdem das Substantiv.
   *
   *   need   = Notwendigkeit   bei "Du brauchst mich nicht anzurufen."
   *   watch  = Wache           bei "Hast du das Spiel gesehen?"
   *   bit    = Gebiss          bei "Sie biss in den Apfel."
   *   bar    = Block           bei "Tom ist an der Bar."
   *   match  = Spiel           bei "Hast du ein Streichholz?"
   *
   * Acht dieser Faelle sind Homonyme oder Redewendungen, bei denen es
   * keine brauchbare Vorderseite gibt – dafuer gibt es AUSSCHLUSS weiter
   * unten.
   */
  need: "brauchen",
  interest: "Interesse",
  home: "Zuhause",
  experience: "Erfahrung",
  watch: "ansehen, zusehen",
  mind: "Sinn, Verstand",
  record: "aufnehmen",
  bit: "beißen",
  condition: "Zustand, Verfassung",
  site: "Seite",
  charge: "berechnen, aufladen",
  sign: "Zeichen",
  amount: "Betrag",
  benefit: "nützen, helfen",
  total: "gesamt",
  bank: "sich verlassen",
  notice: "bemerken",
  addition: "zusätzlich, extra",
  lack: "fehlen",
  review: "überprüfen",
  aim: "Ziel, Absicht",
  bar: "Bar",
  operation: "Operation",
  match: "Streichholz",
  officer: "Offizier",
  agent: "Makler, Agent",
  exchange: "Kurs, Wechsel",
  scene: "Anblick, Szene",
  decline: "sich verschlechtern, ablehnen",
  partner: "Partner",
  heat: "Hitze, erhitzen",
  presence: "Gegenwart, Anwesenheit",
  waste: "Verschwendung",
  fan: "Fan, Anhänger",
  host: "Gastgeber, ausrichten",
  consideration: "Überlegung, Rücksicht",
  code: "Code, Vorschrift",
  accident: "Zufall, Unfall",
  location: "Ort, Standort",
  sight: "Sicht",
  assessment: "Beurteilung",
  plenty: "genug, Menge",
  ear: "Ohr",
  lake: "See",
  interpretation: "Interpretation, Auslegung",
  extension: "Endung, Ausdehnung",
  tune: "Melodie, stimmen",
  pen: "Stift",
  drag: "ziehen, schleppen",
  charity: "Barmherzigkeit, Wohltätigkeit",
  stroke: "Glücksfall, Schlag",
  brush: "Bürste",
  twist: "drehen, verdrehen",
  imagination: "Vorstellungskraft, Einbildung",
  possession: "Besitz",
  cheek: "Wange, frech",
  implication: "Bedeutung, Folgerung",
  counter: "Schalter, Theke",
  champion: "Champion, Meister",
  dear: "lieb, teuer",
  baby: "Baby, Kind",
  retire: "in den Ruhestand gehen",
  vision: "Vision, Vorstellung",
  breath: "Atem",
  shout: "Schrei, Ruf",

  // `back` ist mit Rang 34 haeufig genug fuer das Starter-Set, scheitert aber
  // an der Satzpruefung: es ist Richtungswort und Adverb zugleich
  // ("Put your shoes back on" / "Zieh deine Schuhe wieder an"), und keine
  // der acht Kandidatensaetze nennt das Wort auf der deutschen Seite so, dass
  // die Aehnlichkeit ueber die Schwelle kommt. Ohne Kuration faellt damit das
  // zweithaeufigste der hundert Startwoerter ersatzlos weg – und das waere
  // ein Fehler der Technik, kein des Wortes.
  back: "zurück, hinten",

  /*
   * Dritte Runde: die Woerter, die der verschaerfte Generator
   * (Zeilen 201-207) nicht mehr liefert.
   *
   * Die Stichprobe aus den 62 Ausfaellen war erstaunlich ergiebig. Sie
   * zerfiel in drei Gruppen:
   *
   * 1. Echte Fehler, die seit dem Import in Produktion liegen und die der
   *    strengere Lauf endlich aussortiert hat. Das sind die besten Funde:
   *
   *      milk     = ausschöpfen   bei "Do you have some milk?"
   *      please   = gefallen      bei "Where are the eggs, please?"
   *      mistake  = fehlen        bei "Anyone can make a mistake."
   *      except   = widersprechen bei "Everyone will go except you."
   *      unlike   = unähnlich     bei "Unlike her, you are hard-working."
   *      slight   = schlank       bei "I have a slight fever."
   *
   *    Genau die Wortart, die Kaikki zuerst nennt, wurde auch geliefert –
   *    unabhaengig davon, was der Satz brauchte.
   *
   * 2. Brauchbare Karten, die nur an der verschraerften Pruefung
   *    gescheitert sind (Synonym im deutschen Satz, andere Wortart).
   *    Die kriegen ihre Uebersetzung hier – meist dieselbe wie vorher,
   *    aber ohne Schnitzer wie `double: "doppel-"` (abgeschnittene
   *    Kompositionsform) oder `yellow: "Gelb"` (Substantiv statt Adjektiv).
   *
   * 3. Woerter ohne brauchbare Karte -> AUSSCHLUSS.
   */
  few: "wenig, wenige",
  able: "imstande, fähig",
  major: "wichtig, bedeutend",
  please: "bitte",
  single: "einzeln, ledig",
  finish: "fertig werden, fertig machen",
  poor: "arm, schlecht",
  wonder: "sich wundern",
  whatever: "egal, was auch immer",
  hit: "schlagen, treffen",
  purpose: "Zweck, Absicht",
  indicate: "anzeigen, bedeuten",
  anyway: "sowieso, jedenfalls",
  complex: "kompliziert",
  extra: "zusätzlich, Extra",
  alternative: "Alternative",
  double: "doppelt",
  mistake: "Fehler, Irrtum",
  smoke: "Rauch, rauchen",
  cultural: "kulturell",
  actual: "tatsächlich",
  decrease: "abnehmen, nachlassen",
  basically: "im Prinzip",
  moral: "moralisch, Moral",
  considerable: "erheblich",
  unlike: "anders als",
  emotion: "Gefühl, Emotion",
  milk: "Milch",
  yellow: "gelb",
  complicate: "komplizieren",
  classic: "klassisch, Klassiker",
  nearby: "in der Nähe, nah",
  southern: "südlich",
  sufficient: "genügend, ausreichend",
  slight: "leicht, gering",
  awful: "schrecklich, furchtbar",
  dealer: "Händler",
  exposure: "Exposition, Kontakt",
  rough: "rau, unangenehm",
  flash: "Blitz, aufblitzen",
  craft: "Handwerk, Kunst",
  civilian: "Zivilist, zivil",
  bunch: "Bund, Menge",
  exhaust: "erschöpfen, Abgase",
  transportation: "Transport, Beförderung",
  storage: "Lagerung, Abstellraum",
  reasonably: "vernünftig, einigermaßen",
  ownership: "Eigentum, Besitz",
  alongside: "längsseits, entlang",
  royal: "königlich",
  ashamed: "beschämt, sich schämen",

  // Drei Nachzuegler aus demselben Abgleich. `complete` stand mit "beenden"
  // auf der Vorderseite, obwohl der Satz das Adjektiv braucht ("It was a
  // complete failure"); `except` wurde als "widersprechen" geliefert, was
  // die Wendung "except you" zerlegt; `premise` war eine gute Karte und fiel
  // nur durch das Raster.
  complete: "vollständig, komplett",
  except: "außer",
  premise: "Voraussetzung, Annahme",
};

/**
 * Woerter, die keine brauchbare Karte ergeben.
 *
 * Fuenf Faelle, alle aus der zweiten Kurationsrunde. Sie stehen nicht in
 * SONDERFAELLE, weil es ihnen an einer richtigen Uebersetzung fehlt – nicht
 * an der falschen:
 *
 *   matter  "I'll go no matter what." – die Redewendung ist "auf jeden
 *           Fall". Eine Karte mit "Masse" ist falsch, eine mit "auf jeden
 *           Fall" ist keine Wortkarte mehr.
 *   range   "She only eats free-range chicken." – der Satz benutzt das Wort
 *           als Adjektiv vor einem Substantiv. "Bereich, Spanne" passt zum
 *           Wort, nicht zum Satz.
 *   check   "When should we check out?" – die Hot Meaning. "Kontrolle"
 *           stimmt zum Wort und nicht zum Satz; die Karte lehrt einen
 *           Sonderfall, den niemand braucht.
 *   account "This is my account book." – der englische Satz ist selbst
 *           holprig, und "Begründung" ist die falsche Lesart.
 *   bell    "What was invented by Bell?" – Bell ist hier ein Nachname. Der
 *           Satz testet kein Wort.
 *
 * Bewusst als Liste und nicht als Eintrag mit Sonderwert: eine Karte, die
 * nicht gebaut wird, ist ein anderes Ergebnis als eine mit richtigem Text.
 */
const AUSSCHLUSS = new Set([
  "matter",
  "range",
  "check",
  "account",
  "bell",
  "county",
  "respectively",
  // Tatoeba uebersetzt hier "The amendment was first proposed in 1789" mit
  // "Die Novelle wurde ..." – und verwechselt dabei amendment mit dem
  // englischen Wort novel. Eine falsche Uebersetzung in der Quelle laesst
  // sich durch bessere Vorderseiten nicht reparieren.
  "amendment",
]);

/**
 * Die erste brauchbare deutsche Uebersetzung eines Eintrags.
 *
 * Kaikki haengt an jede Bedeutung mehrere Uebersetzungen an – und darunter
 * stehen oft regionale Varianten ("net", "nit", "nüt" fuer "nicht"),
 * Satzfragmente oder die Buchstabensense ("a" -> "A"). Deshalb die Regeln:
 *
 * 1. Nur die erste saubere Uebersetzung der ersten passenden Bedeutung
 *    (nicht "Schritt 1 bis 4, alle hintereinander").
 * 2. Verwerfen, was kein Wort ist: laenger als 60 Zeichen, mit Satzzeichen
 *    drin oder mehr als zwei Woerter. Beispiel: "In the winters" ist der
 *    Anfang eines Beispielsatzes, keine Uebersetzung von "would".
 * 3. Verwerfen, was die Buchstabensense ist: ein einzelnes Zeichen, das
 *    identisch mit dem Eintrag ist ("a" -> "A").
 */
function leseKandidaten(eintrag, wort) {
  const raus = [];
  const gesehen = new Set();
  for (const sinn of eintrag.senses || []) {
    // Die Beispiele der Bedeutung sind der zweite Weg zur Auswahl: sie sind
    // englisch, also direkt mit dem Tatoeba-Satz vergleichbar.
    // Kaikki liefert Beispiele als Objekte (`{text, bold_text_offsets, type}`),
    // nicht als Strings. Wer auf typeof "string" filtert, bekommt keine – und
    // wundert sich ueber eine Auswahl, die gar nicht stattfindet.
    const beispiele = (sinn.examples || [])
      .map(e => (typeof e === "string" ? e : e && typeof e.text === "string" ? e.text : ""))
      .filter(t => t.trim().length > 3);
    for (const t of sinn.translations || []) {
      if (t.code !== "de" || typeof t.word !== "string") continue;
      const text = t.word.trim();
      if (!text) continue;
      if (text.length > 60 || /[.!?;|]/.test(text)) continue;
      if (text.split(/\s+/).length > 2) continue;
      if (wort.length <= 1 && text.toLowerCase() === wort) continue;
      const schluessel = text.toLowerCase();
      if (gesehen.has(schluessel)) continue;
      gesehen.add(schluessel);
      raus.push({ wort: text, beispiele: beispiele.slice(0, 3) });
      if (raus.length >= 6) return raus;
    }
  }
  return raus;
}

/* Woerter, die in fast jedem Satz stehen und darum nichts ueber die
   Bedeutung verraten. */
const STOPPWOERTER = new Set(("a an and are as at be but by for from had has have he her his i if in into is it its me my no not of on or our out she so than that the their them then there these they this to was we were what when where which who will with would you your"
).split(" "));

function inhalt(satz) {
  return new Set(
    (String(satz).toLowerCase().match(/[a-z']+/g) || []).filter(w => w.length > 2 && !STOPPWOERTER.has(w))
  );
}

/**
 * Welche Bedeutung meint der Satz? Zwei Wege, in dieser Reihenfolge:
 *
 *  1. Die deutsche Uebersetzung steht in der deutschen Satzuebersetzung.
 *     Das ist ein Treffer ohne Interpretation.
 *  2. Die Beispiele der Wiktionary-Bedeutung haben mit dem englischen
 *     Tatoeba-Satz mehrere Inhaltswoerter gemeinsam. Auch das ist ein
 *     Treffer, nur ein weicherer – deshalb der Schwellwert.
 *
 * Findet sich keiner von beiden, wird die Karte verworfen. Das ist
 * ausdruecklich so gewollt: eine fehlende Karte faellt nicht auf, eine
 * falsche dagegen sehr.
 */
function waehleBedeutung(kandidaten, sa) {
  for (const k of kandidaten) {
    if (passtZuSatz(k.wort, sa.deu)) return k.wort;
  }
  const satzWorte = inhalt(sa.eng);
  if (satzWorte.size < 2) return null;
  let bester = null;
  let besteQuote = 0;
  for (const k of kandidaten) {
    if (!k.beispiele.length) continue;
    const menge = new Set();
    for (const b of k.beispiele) for (const w of inhalt(b)) menge.add(w);
    let treffer = 0;
    for (const w of satzWorte) if (menge.has(w)) treffer++;
    const quote = treffer / satzWorte.size;
    if (quote > besteQuote) {
      besteQuote = quote;
      bester = k;
    }
  }
  /*
   * Der Notnagel war die Quelle der falschen Karten.
   *
   * "need not telephone me" hat zwei deutsche Uebersetzungen, "brauchen"
   * (passt in "Du brauchst mich nicht anzurufen") und "Notwendigkeit"
   * (Substantiv, im Satz nirgends). Die erste Kandidatin faellt durch
   * `passtZuSatz`, also griff die Ueberlappung der englischen
   * Wiktionary-Beispiele mit dem Satz – und die fand fuer die
   * Substantiv-Bedeutung 34 % gemeinsame Inhaltswoerter, weil ihre
   * Beispiele "need" als Nomen verwenden und "telephone" ebenfalls
   * enthalten. Das Ergebnis war eine Karte, die man falsch lernt.
   *
   * Also: 0.34 gilt nur noch, wenn der deutsche Satz die Uebersetzung
   * bestaetigt. Sonst muss die Ueberlappung klar ueberzeugen (0.6). Eine
   * Karte weniger ist ein Verlust, eine falsche Karte ist ein Fehler –
   * sie wird mitgelernt und merkt sich der Lernende als Lektion.
   */
  if (!bester) return null;
  const bestaetigt = passtZuSatz(bester.wort, sa.deu);
  const schwelle = bestaetigt ? 0.34 : 0.6;
  return besteQuote >= schwelle ? bester.wort : null;
}

/*
 * Passt eine deutsche Uebersetzung zur deutschen Uebersetzung des Satzes?
 *
 * Das ist der ganze Trick dieser Korrektur. Wiktionary fuehrt zu einem Wort
 * mehrere Bedeutungen, und die Beispielsatz stammt aus einem anderen Korpus
 * als die Wiktionary-Bedeutung. Nimmt man blind die erste, bekommt man
 * "bill -> Gesetzentwurf" und dazu den Satz "Give me the bill, please." mit
 * "Rechnung". Solche Karten lernen falsch – sie sind schlimmer als keine
 * Karte, weil der Lernende sie fuer richtig haelt.
 *
 * Also wird nicht die Bedeutung geraten, sondern geprueft: steht das deutsche
 * Wort in der deutschen Satzuebersetzung, dann ist es die Bedeutung, die der
 * Satz meint. Findet sich keine, faellt die Karte weg.
 */
function passtZuSatz(kandidat, satz) {
  const ziel = normalisiere(kandidat);
  if (!ziel) return false;
  const n = normalisiereSatz(satz);
  if (!n) return false;
  if (n.includes(` ${ziel} `) || n.startsWith(`${ziel} `)) return true;
  // Einfache Beugung mitnehmen: Woche -> Wochen, Hund -> Hunde, Kind -> Kinder.
  if (ziel.length >= 5) {
    for (const endung of ["en", "e", "er", "es", "em", "n"]) {
      if (ziel.length - endung.length < 4) continue;
      const stamm = ziel.slice(0, ziel.length - endung.length);
      if (n.includes(` ${stamm} `) || n.endsWith(` ${stamm}`)) return true;
    }
  }
  return false;
}

function normalisiere(wort) {
  return String(wort || "")
    .toLowerCase()
    .replace(/[^a-zäöüß\s-]/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalisiereSatz(satz) {
  return ` ${normalisiere(satz).replace(/\s+/g, " ")} `;
}

/** Gibt gunzipte Zeilen zeilenweise weiter. */
function gzipZeilen(datei, proZeile) {
  return new Promise((resolve, reject) => {
    const zeilen = createInterface({
      input: fs.createReadStream(datei).pipe(zlib.createGunzip()),
      crlfDelay: Infinity,
    });
    zeilen.on("line", zeile => {
      if (zeile) proZeile(zeile);
    });
    zeilen.on("close", resolve);
    zeilen.on("error", reject);
  });
}

/**
 * Beispielsaetze aus Tatoeba. Fuer jedes Zielwort wird der kuerzeste passende
 * englische Satz gesucht, zu dem eine deutsche Uebersetzung existiert.
 */
function beispielSaetze(quellen, ziele, links) {
  ausgabe("englische Beispielsaetze lesen ...");
  const kandidaten = new Map(); // wort -> [{id, text, laenge}]
  for (const w of ziele) kandidaten.set(w, []);

  for (const zeile of lesePlain(pfad(quellen, "eng_sentences.tsv"))) {
    const tab = zeile.split("\t");
    const id = tab[0];
    const text = tab[2];
    if (!id || !text || !links.has(id)) continue;
    const worteImSatz = text.split(/\s+/);
    /*
     * Obergrenze 13 statt 15 Worte, und kein Satz mit Auslassung, Zitat,
     * Zahl oder Link.
     *
     * Beides kam erst spät: als der Generator anfing, auch die zweiten bis
     * achten Kandidaten zu pruefen, nahm er Saetze, die vorher nie in Frage
     * kamen – und die waren die auffaelligeren. Fuenf Karten bekamen einen
     * Satz ueber 90 Zeichen ("to" am Ende einer Aufzaehlung etwa), der auf
     * dem Telefon zwei Zeilen der Karte fuellt. Ein Satz auf einer Karte ist
     * Beispielmaterial, kein Lesestueck.
     *
     * Die Grenze liegt bei 13, nicht bei 12: bei 12 verlor `premise` seinen
     * einzigen brauchbaren Satz und damit die ganze Karte. Der Pruefer in
     * `wortlisten-qualitaet.mjs` stuft erst ab 15 Worte oder 91 Zeichen als
     * zu lang ein – der Generator darf hier ruhig etwas strenger sein, aber
     * nicht strenger als das, was hinterher als gut beurteilt wird.
     */
    if (worteImSatz.length < 5 || worteImSatz.length > 13) continue;
    if (/\.\.\.|…|"|„|»|<|>|https?:|\d/.test(text)) continue;

    /*
     * Zeichengrenze und genau ein Satz.
     *
     * Die Wortzahl allein hat eine Karte durchgelassen, die 114 Zeichen und
     * zwei Saetze hatte ("There's nothing more difficult than to simplify.
     * There's nothing simpler than to complicate."). Zwei Saetze auf einer
     * Karte sind zwei Lernpunkte an einem Ort – der zweite verliert in der
     * App sowieso, weil der Satz oben abgeschnitten wird.
     */
    if (text.length > 90) continue;

    /*
     * Zwei Saetze sind auf einer Karte zwei Lernpunkte. Verboten wird das
     * aber erst ab 60 Zeichen: kurze Anreden kommen sonst ueberall vor
     * ("Hello! I'm a new user." – eine vollstaendige, brauchbare Karte, die
     * dabei sonst ersatzlos verloren ging). Die Grenze liegt bewusst dort, wo
     * der zweite Satz anfangen wuerde, ihn auf dem Telefon wegzudruecken.
     */
    if (text.length > 60 && /[.!?]\s+[A-Z]/.test(text)) continue;

    const worteImSatzLower = text.toLowerCase().match(/[a-z']+/g) || [];
    const treffer = new Set();
    for (const wt of worteImSatzLower) if (ziele.has(wt)) treffer.add(wt);
    if (!treffer.size) continue;

    // Alle getroffenen Worte bekommen denselben Kandidaten. Das ist fairer
    // als nur das erste: Woerter, die selten allein in einem Satz stehen,
    // verhungern sonst, obwohl der Satz fuer sie perfekt waere.
    for (const wt of treffer) {
      kandidaten.get(wt).push({ id, text, laenge: worteImSatz.length });
    }
  }

  /*
   * Je Wort die kuerzesten Kandidaten behalten – nicht nur den einen.
   *
   * Vorher stand hier `liste[0]`, also genau ein Satz je Wort. Damit war die
   * Bedeutungsauswahl eine Lotterie: passte der erste Satz nicht zu irgendeiner
   * deutschen Uebersetzung, war das Wort erledigt, obwohl Tausende weitere
   * Saetze in der Datei stehen. Nach der Verschärfung der Schwelle kostete
   * das 215 Karten – ersatzlos weggeworfene, brauchbare Woerter.
   *
   * Der Generator waehlt darum Satz und Uebersetzung gemeinsam aus: er geht
   * die Kandidaten der Reihe nach durch und nimmt das erste Paar, bei dem die
   * Uebersetzung zum deutschen Satz passt. Acht Kandidaten je Wort sind
   * genug; die Auswahl bevorzugt kurze Saetze, und die Mehrfachauswahl kostet
   * nur einen groesseren Satz-ID-Satz beim Einlesen der Deutschen.
   */
  const MAX_KANDIDATEN = 8;
  const jeWort = new Map();
  for (const [w, liste] of kandidaten) {
    liste.sort((a, b) => a.laenge - b.laenge);
    if (liste.length) jeWort.set(w, liste.slice(0, MAX_KANDIDATEN));
  }
  ausgabe(`  ${jeWort.size} Worte mit eng-Kandidat`);

  // Nur die deutschen Satzids lesen, die wir wirklich brauchen.
  const gebraucht = new Set();
  for (const liste of jeWort.values()) {
    for (const k of liste) gebraucht.add(links.get(k.id));
  }

  ausgabe(`  deutsche Uebersetzungen (${gebraucht.size} Satzids) lesen ...`);
  const deutsch = new Map();
  for (const zeile of lesePlain(pfad(quellen, "deu_sentences.tsv"))) {
    const tab = zeile.split("\t");
    const id = tab[0];
    if (!gebraucht.has(id)) continue;
    deutsch.set(id, tab[2]);
  }

  const ergebnis = new Map();
  for (const [w, liste] of jeWort) {
    const saetze = [];
    for (const k of liste) {
      const deuText = deutsch.get(links.get(k.id));
      if (deuText) saetze.push({ eng: k.text, deu: deuText });
    }
    if (saetze.length) ergebnis.set(w, saetze);
  }
  ausgabe(`  ${ergebnis.size} Worte mit eng+deu Beispielsatz`);
  return ergebnis;
}

async function main() {
  const a = argumente();
  const worte = ngsl(a.quellen, a.top);
  const ziele = zielSet(worte);

  const links = baueLinks(a.quellen);

  // Reihenfolge mit Grund: die Uebersetzung wird nach dem Beispielsatz
  // ausgewaehlt, also braucht sie den Satz. Vorher standen die Schritte in
  // der umgekehrten Reihenfolge und die Bedeutung wurde ohne Kenntnis des
  // Satzes festgelegt – daher die Karten, die richtig aussehen und falsch
  // gemeint sind.
  const saetze = beispielSaetze(a.quellen, ziele, links);
  const uebersetzungen = await kaikkiUebersetzungen(a.quellen, ziele, worte);

  const karten = [];
  let ohnePassendeBedeutung = 0;
  for (const w of worte) {
    const wort = w.Lemma.toLowerCase();
    if (AUSSCHLUSS.has(wort)) continue;
    const ka = uebersetzungen.get(wort);
    if (!ka || !saetze.get(wort)) continue;

    // Satz und Uebersetzung zusammen suchen: der erste Kandidat, bei dem
    // die Uebersetzung zum deutschen Satz passt, gewinnt. Von Hand gesetzte
    // Uebersetzungen (Funktionswoerter, kuratierte Sonderfaelle) gelten
    // ungeprueft – bei ihnen ist die Entscheidung ja schon gefallen.
    let treffer = null;
    let ersatz = null;
    for (const sa of saetze.get(wort) ?? []) {
      const uebersetzung = ka.gesetzt ? ka.kandidaten[0].wort : waehleBedeutung(ka.kandidaten, sa);
      if (!uebersetzung) continue;
      /*
       * Bei kuratierten Woertern ist die Uebersetzung fest, also steht nur
       * noch die Satzwahl offen. Dann bevorzugen wir den Satz, in dem die
       * deutsche Uebersetzung tatsaechlich vorkommt – "Milch" gehoert zu
       * "Hast du Milch?", nicht zu irgendeinem Kandidaten, der sonst besser
       * passt. Gibt es keinen bestaetigenden Satz, bleibt der kuerzeste
       * Kandidat: eine gute Uebersetzung mit schwachem Beispiel ist besser
       * als eine fehlende Karte.
       */
      if (ka.gesetzt && !passtZuSatz(uebersetzung, sa.deu)) {
        if (!ersatz) ersatz = { uebersetzung, sa };
        continue;
      }
      treffer = { uebersetzung, sa };
      break;
    }
    treffer ??= ersatz;
    if (!treffer) {
      ohnePassendeBedeutung++;
      continue;
    }

    karten.push({
      frage: treffer.uebersetzung,
      antwort: w.Lemma,
      beispielsatz: treffer.sa.eng,
      beispiel_uebersetzung: treffer.sa.deu,
    });
  }
  ausgabe(`  ${ohnePassendeBedeutung} Worte ohne Satz, der zur deutschen Uebersetzung passt`);

  if (!fs.existsSync(a.ausgabe)) fs.mkdirSync(a.ausgabe, { recursive: true });

  const jsonPfad = path.join(a.ausgabe, `${a.name}.json`);
  fs.writeFileSync(jsonPfad, JSON.stringify(karten, null, 2) + "\n");

  const csvZeilen = [
    "frage;antwort;beispielsatz;beispiel_uebersetzung",
    ...karten.map(k =>
      [k.frage, k.antwort, k.beispielsatz, k.beispiel_uebersetzung]
        .map(c => `"${(c || "").replace(/"/g, '""')}"`)
        .join(";"),
    ),
  ];
  fs.writeFileSync(path.join(a.ausgabe, `${a.name}.csv`), csvZeilen.join("\n") + "\n");

  if (a.mengen) schreibeMengen(karten, a.ausgabe, a.name, a.quellen);

  console.log(
    `\n${TIEFE}Ergebnis: ${karten.length} von ${worte.length} Worten komplett (${Math.round((karten.length / worte.length) * 100)}%).\n${TIEFE}JSON: ${jsonPfad}`,
  );
}

/**
 * Die vier Lern-Sets als Dateien schreiben (Schalter --mengen).
 *
 * Bisher wurden die vier Dateien per Inline-Skript erzeugt und einzeln
 * eingecheckt. Das funktioniert genau einmal: wer die Wortliste neu
 * erzeugt, bekam die Master-Datei und keine Sets mehr, und die vier Dateien
 * im Repo waren nicht mehr aus dem Generator herstellbar. Eine Datei, die
 * niemand neu erzeugen kann, ist eine Handwerksdatei – der Unterschied
 * merkt sich erst, wenn sich die Quellen einmal ändern.
 *
 * Die Grenzen sind Frequenzraenge, keine erfundenen Niveaus. NGSL kennt
 * keine CEFR-Stufen, also heissen die Sets "Alltag" und "Ausbau" und nicht
 * "A2" oder "B1". Rang 1–100 bleibt das Starter-Set und wird hier nicht
 * noch einmal geschrieben.
 */
const MENGEN = [
  { name: "alltag-1", von: 101, bis: 500 },
  { name: "alltag-2", von: 501, bis: 1000 },
  { name: "ausbau-1", von: 1001, bis: 1800 },
  { name: "ausbau-2", von: 1801, bis: 99999 },
];

function schreibeMengen(karten, ziel, name, quellen) {
  const ngsl = JSON.parse(fs.readFileSync(pfad(quellen, "ngsl.json"), "utf8"));
  const rang = new Map(ngsl.map(w => [w.Lemma.toLowerCase(), Number(w.Rank)]));
  const zeilen = [];

  for (const menge of MENGEN) {
    const teil = karten
      .filter(k => {
        const r = rang.get(k.antwort.toLowerCase());
        return r !== undefined && r >= menge.von && r <= menge.bis;
      })
      .sort((a, b) => rang.get(a.antwort.toLowerCase()) - rang.get(b.antwort.toLowerCase()));

    const basis = `${name}-${menge.name}`;
    fs.writeFileSync(path.join(ziel, `${basis}.json`), JSON.stringify(teil, null, 2) + "\n");
    fs.writeFileSync(
      path.join(ziel, `${basis}.csv`),
      [
        "frage;antwort;beispielsatz;beispiel_uebersetzung",
        ...teil.map(k =>
          [k.frage, k.antwort, k.beispielsatz, k.beispiel_uebersetzung]
            .map(c => `"${(c || "").replace(/"/g, '""')}"`)
            .join(";"),
        ),
      ].join("\n") + "\n",
    );
    zeilen.push(`  ${basis}: ${teil.length} Karten (Rang ${menge.von}–${menge.bis})`);
  }

  const gedeckt = new Set(
    karten
      .map(k => rang.get(k.antwort.toLowerCase()))
      .filter(r => r !== undefined && r > 100),
  );
  const fehlend = MENGEN.filter(
    m => [...gedeckt].some(r => r >= m.von && r <= m.bis) === false,
  );
  ausgabe(`Mengen geschrieben:\n${zeilen.join("\n")}`);
  if (fehlend.length) {
    console.error(`  Achtung: leere Bereiche: ${fehlend.map(f => f.name).join(", ")}`);
  }
}

main().catch(fehler => {
  console.error(`Fehler: ${fehler.message}`);
  process.exit(1);
});