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

    const uebersetzung = leseErsteUebersetzung(eintrag, wort);
    if (!uebersetzung) return;

    ergebnis.set(wort, { lemma: zielZuLemma.get(wort), uebersetzung });
  });

  // Sonderfaelle anwenden: vorhandene Uebersetzungen korrigieren UND fehlende
  // Woerter ergaenzen. I/could/would haben in Kaikki keinen brauchbaren
  // Eintrag, alle anderen hier gelisteten eine irrefuehrende erste Bedeutung.
  for (const [wort, uebersetzung] of Object.entries(SONDERFAELLE)) {
    const schluessel = wort.toLowerCase();
    if (!zielZuLemma.has(schluessel)) continue;
    ergebnis.set(schluessel, { lemma: zielZuLemma.get(schluessel), uebersetzung });
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
function leseErsteUebersetzung(eintrag, wort) {
  for (const sinn of eintrag.senses || []) {
    for (const t of sinn.translations || []) {
      if (t.code !== "de" || typeof t.word !== "string") continue;
      const text = t.word.trim();
      if (!text) continue;
      if (text.length > 60 || /[.!?;|]/.test(text)) continue;
      if (text.split(/\s+/).length > 2) continue;
      if (wort.length <= 1 && text.toLowerCase() === wort) continue;
      return text;
    }
  }
  return null;
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
  const uebersetzungen = await kaikkiUebersetzungen(a.quellen, ziele, worte);
  const saetze = beispielSaetze(a.quellen, ziele, links);

  const karten = [];
  for (const w of worte) {
    const wort = w.Lemma.toLowerCase();
    const ka = uebersetzungen.get(wort);
    const sa = saetze.get(wort);
    if (!ka || !sa) continue;
    karten.push({
      frage: ka.uebersetzung,
      antwort: w.Lemma,
      beispielsatz: sa.eng,
      beispiel_uebersetzung: sa.deu,
    });
  }

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