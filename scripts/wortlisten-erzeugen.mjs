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
};

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
  if (bester && besteQuote >= 0.34) return bester.wort;
  return null;
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
    if (worteImSatz.length < 5 || worteImSatz.length > 15) continue;

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

  // Je Wort den kuerzesten Kandidaten behalten.
  const jeWort = new Map();
  for (const [w, liste] of kandidaten) {
    liste.sort((a, b) => a.laenge - b.laenge);
    if (liste.length) jeWort.set(w, liste[0]);
  }
  ausgabe(`  ${jeWort.size} Worte mit eng-Kandidat`);

  // Nur die deutschen Satzids lesen, die wir wirklich brauchen.
  const gebraucht = new Set();
  for (const k of jeWort.values()) gebraucht.add(links.get(k.id));

  ausgabe(`  deutsche Uebersetzungen (${gebraucht.size} Satzids) lesen ...`);
  const deutsch = new Map();
  for (const zeile of lesePlain(pfad(quellen, "deu_sentences.tsv"))) {
    const tab = zeile.split("\t");
    const id = tab[0];
    if (!gebraucht.has(id)) continue;
    deutsch.set(id, tab[2]);
  }

  const ergebnis = new Map();
  for (const [w, k] of jeWort) {
    const deuText = deutsch.get(links.get(k.id));
    if (!deuText) continue;
    ergebnis.set(w, { eng: k.text, deu: deuText });
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
    const ka = uebersetzungen.get(wort);
    const sa = saetze.get(wort);
    if (!ka || !sa) continue;

    let uebersetzung = null;
    if (ka.gesetzt) {
      // Von Hand gesetzt (Funktionswoerter) – die passen ohne Pruefung.
      uebersetzung = ka.kandidaten[0].wort;
    } else {
      uebersetzung = waehleBedeutung(ka.kandidaten, sa);
    }
    if (!uebersetzung) {
      ohnePassendeBedeutung++;
      continue;
    }

    karten.push({
      frage: uebersetzung,
      antwort: w.Lemma,
      beispielsatz: sa.eng,
      beispiel_uebersetzung: sa.deu,
    });
  }
  ausgabe(`  ${ohnePassendeBedeutung} Worte ohne zur deutschen Satzuebersetzung passende Bedeutung`);

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

  console.log(
    `\n${TIEFE}Ergebnis: ${karten.length} von ${worte.length} Worten komplett (${Math.round((karten.length / worte.length) * 100)}%).\n${TIEFE}JSON: ${jsonPfad}`,
  );
}

main().catch(fehler => {
  console.error(`Fehler: ${fehler.message}`);
  process.exit(1);
});