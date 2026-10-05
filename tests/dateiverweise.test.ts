import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/*
 * Jeder Dateiverweis im Projekt muss auf eine Datei zeigen, die es gibt.
 *
 * Warum: Beim Umzug der Migrationen nach `supabase/migrations/` (Phase 4)
 * sind 19 Stellen in ausgeliefertem Code mitgewandert, ohne mitzugehen. Sie
 * stehen in Fehlermeldungen, die Nutzern angezeigt werden:
 *
 *   "Datenbank ist nicht aktuell. Bitte supabase/003-auth-und-user-daten.sql
 *    im Supabase SQL Editor ausführen."        (lib/db-fehler.ts)
 *
 * Genau dann, wenn jemand auf einen Datenbankfehler stößt und die Anleitung
 * befolgt, gibt es die genannte Datei nicht. Das ist der Moment, in dem man
 * aufgibt. Dieselben vier kaputten Pfade standen in `SUPABASE-SETUP.md`, wo
 * sie beim psql-Aufruf als `file not found` enden.
 *
 * Gefunden wurde das nicht durch systematisches Suchen, sondern weil
 * zufällig die richtige Datei gelesen wurde. Genau das ist der Punkt: Doku
 * und Fehlertexte veralten still. Ein Gate, das nur existiert, nachdem man
 * einmal darauf gestoßen ist, verhindert die nächste Runde.
 *
 * Zwei Ausnahmen, bewusst eng gefasst:
 *
 *   - Verweise auf Dateien, die absichtlich nicht existieren. In den
 *     Dokumenten steht davon eine Menge: gelöschte Bäume, Gegenproben, die es
 *     nur zum Gegenbeweis gab. Solche Verweise tragen im Absatz das Wort
 *     "gelöscht", "Gegenprobe" o. Ä. — sichtbar für jeden Leser, nicht in
 *     einer Ausnahmeliste, die verrottet.
 *   - Verweise in Kurzform wie `lernen/route.ts` oder `lernlogik.ts:36-37`.
 *     Die stehen ohne Wurzelverzeichnis da und werden hier *nicht* geprüft.
 *     Sie nach repo-Wurzel aufzulösen ginge nur mit Raten, und Raten erzeugt
 *     Fehlalarme, die man dann wegdrückt. Diese Lücke ist bekannt und
 *    Absicht; die geprüften Verweise sind die, bei denen ein Tippfehler
 *     nachweislich wehtut.
 */

const OBERE = ["supabase", "app", "scripts", "tests", "lib", "components", "public", "docs"];
const VERWEIS = /[A-Za-z0-9_.\-/()[\]äöüÄÖÜß]+\.(?:sql|tsx|ts|mjs|json|css|md|mdx)/g;
const MARKIERER = [
  "gelöscht",
  "entfernt",
  "tote",
  "Leichen",
  "Gegenprobe",
  "angelegt",
  "existiert nicht",
  "kein Import",
  "war einmal",
  "geplant",
];

interface Fund {
  pfad: string;
  quelle: string;
}

/**
 * Umlaute ausschreiben, damit "gelöscht" und "geloescht" dasselbe sind.
 * Der Quellcode schreibt Kommentare konsequent in ASCII, die Dokumente in
 * Umlauten — ein Markierungswort, das nur in einer Schreibweise existiert,
 * wäre eine Fehlerquelle ohne Nutzen.
 */
function ohneUmlaute(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
}

/** Dateien unterhalb von `wurzel`, ohne node_modules, .next und .git. */
function sammle(wurzel: string, endungen: string[], auslassen: string[] = []): string[] {
  const gefunden: string[] = [];
  for (const eintrag of readdirSync(wurzel, { withFileTypes: true })) {
    if (eintrag.name === "node_modules" || eintrag.name.startsWith(".")) continue;
    const voll = join(wurzel, eintrag.name);
    if (eintrag.isDirectory()) {
      if (auslassen.includes(eintrag.name)) continue;
      gefunden.push(...sammle(voll, endungen, auslassen));
    } else if (endungen.some((e) => eintrag.name.endsWith(e))) {
      gefunden.push(voll);
    }
  }
  return gefunden;
}

/** Alle pfadartigen Kandidaten einer Zeile, ohne Platzhalter und Verzeichnisse. */
function kandidaten(zeile: string): string[] {
  return [...zeile.matchAll(VERWEIS)]
    .map((m) => m[0])
    .filter((p) => {
      if (p.includes("*") || p.includes("<") || p.includes("…")) return false;
      if (!p.includes("/")) return false;
      if (p.endsWith("/")) return false;
      return OBERE.some((o) => p.startsWith(`${o}/`));
    });
}

/** Ist ein Verweis als absichtlich nicht existent markiert? */
function markiert(zeilen: string[], von: number, bis: number): boolean {
  const fenster = ohneUmlaute(zeilen.slice(Math.max(0, von), bis + 1).join(" "));
  return MARKIERER.some((m) => fenster.includes(ohneUmlaute(m)));
}

/**
 * Fehlende Verweise sammeln. `absatz` legt fest, wie weit der Kontext reicht:
 * im Quellcode ein paar Zeilen, in Markdown der ganze Absatz — dort steht die
 * Markierung ("Gegenprobe … angelegt … Danach entfernt") am Ende des Absatzes,
 * nicht in derselben Zeile wie der Verweis.
 */
function fehlende(datei: string, relativ: string, absatz: boolean): Fund[] {
  const zeilen = readFileSync(datei, "utf8").split("\n");
  const pro: Fund[] = [];

  for (const [i, zeile] of zeilen.entries()) {
    for (const pfad of kandidaten(zeile)) {
      if (existsSync(join(process.cwd(), pfad))) continue;

      if (absatz) {
        let von = i;
        let bis = i;
        while (von > 0 && zeilen[von - 1].trim() !== "") von--;
        while (bis < zeilen.length - 1 && zeilen[bis + 1].trim() !== "") bis++;
        if (markiert(zeilen, von, bis)) continue;
      } else if (markiert(zeilen, i - 2, i + 2)) {
        continue;
      }

      pro.push({ pfad, quelle: `${relativ}:${i + 1}` });
    }
  }
  return pro;
}

const code = sammle(process.cwd(), [".ts", ".tsx", ".mjs"], ["tests"]).filter(
  (d) => !d.endsWith(".test.ts"),
);
const dokumente = sammle(process.cwd(), [".md"]);

test("Jeder Dateiverweis im Quellcode zeigt auf eine existierende Datei", () => {
  const pro = code.flatMap((d) => fehlende(d, d.replace(`${process.cwd()}/`, ""), false));

  assert.deepEqual(
    pro,
    [],
    `Diese Verweise zeigen ins Leere:\n` +
      pro.map((f) => `  ${f.pfad}  (${f.quelle})`).join("\n") +
      `\n\nEntweder den Pfad richtigstellen (Dateien liegen seit Phase 4 unter ` +
      `supabase/migrations/) oder, wenn die Datei absichtlich fehlt, das Wort ` +
      `"gelöscht" in den Absatz schreiben.`,
  );
});

test("Jeder Dateiverweis in der Doku zeigt auf eine existierende Datei", () => {
  const pro = dokumente.flatMap((d) => fehlende(d, d.replace(`${process.cwd()}/`, ""), true));

  assert.deepEqual(
    pro,
    [],
    `Diese Verweise zeigen ins Leere:\n` +
      pro.map((f) => `  ${f.pfad}  (${f.quelle})`).join("\n") +
      `\n\nEntweder den Pfad richtigstellen oder im Absatz sagen, warum die ` +
      `Datei fehlt ("gelöscht", "Gegenprobe", "angelegt … entfernt").`,
  );
});

test("Der Scan sieht überhaupt Dateiverweise", () => {
  // Ohne diese Probe könnte der Test grün sein, weil er nichts findet.
  const anzahl = [...code, ...dokumente].reduce(
    (summe, d) => summe + kandidaten(readFileSync(d, "utf8")).length,
    0,
  );

  assert.ok(
    anzahl > 100,
    `Der Verweis-Scan findet nur ${anzahl} Verweise. Vorher waren es über 120. ` +
      `Entweder stimmt die Erkennung nicht mehr, oder jemand hat die ` +
      `Dokumentation stark verkürzt — bitte nachsehen, nicht den Wert hier ` +
      `nach unten setzen.`,
  );
});