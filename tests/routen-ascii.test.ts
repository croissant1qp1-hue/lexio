import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * Next 16.3.4 findet im App Router keine Route, deren Pfadsegment
 * Nicht-ASCII-Zeichen enthält — und dasselbe gilt für `redirects()` in
 * next.config.ts. Beides ist keine Vermutung, sondern am 2026-10-04
 * gemessen, mit zwei Seiten, die bis auf den Ordnernamen identisch waren:
 *
 *   /probe/ascii-redirect          (ASCII)   -> 307
 *   /prüfung/ascii-redirect        (Umlaut)  -> 404
 *
 * Dieselbe Seite, derselbe Inhalt, nur ein `ü` im Pfad. Einziger Unterschied
 * in der Umgebung: der Elternordner. Und es liegt nicht am `redirect()` —
 * eine Seite mit Inhalt im Umlaut-Ordner ist ebenfalls nicht erreichbar.
 * `next dev` verhält sich genauso wie `next start`, es ist also kein
 * Build-Problem, sondern die Zuordnung.
 *
 * Zwei Dinge, die diese Messung *nicht* einschließt, weil man sie leicht
 * mit dem Problem verwechselt:
 *
 *   - Next kann Nicht-ASCII-URLs sehr wohl ausliefern. Eine Bilddatei aus
 *     `public/` mit Umlauten im Pfad (`images/vokabel-karten-hinzufügen/…`)
 *     liefert 200. Der Ordner `legacy/` voller Umlautpfade ist deshalb kein
 *     Problem, sondern nur nicht erreichbar.
 *   - Der `proxy` kommt vor der Routenzuordnung und kann solche Pfade sehr
 *     wohl umleiten (gemessen: 308). Damit ist „geht im Framework nicht"
 *     nicht ganz richtig — es geht nur in der Routenzuordnung nicht. Für die
 *     eine betroffene URL im Projekt hat das nichts geändert, weshalb hier
 *     auch keine_proxy-Regel entstanden ist.
 *
 * Was dieser Test verhindert: dass jemand einen Ordner `seite-mit-ä`
 * anlegt, Next brav bauen lässt, die Route im Manifest findet, sich freut
 * und in der App toten Link auf eine 404 legt. Der Build meldet sie
 * nämlich, und das ist die eigentliche Falle.
 */

/** Alle Unterordner von `app/`, als Pfadsegmente. */
function ordnerUnterhalb(wurzel: string, tiefe = 0): string[] {
  const gefunden: string[] = [];
  if (tiefe > 6) return gefunden;

  for (const eintrag of readdirSync(wurzel, { withFileTypes: true })) {
    if (!eintrag.isDirectory()) continue;
    gefunden.push(eintrag.name);
    gefunden.push(...ordnerUnterhalb(join(wurzel, eintrag.name), tiefe + 1));
  }
  return gefunden;
}

const ascii = /^[ -~]*$/;

test("Kein Ordner unter app/ hat ein Umlaut im Namen", () => {
  const verdaechtig = ordnerUnterhalb(join(process.cwd(), "app")).filter(
    (name) => !ascii.test(name),
  );

  assert.deepEqual(
    verdaechtig,
    [],
    `Diese Ordner ergeben eine Adresse, die Next nicht findet (404): ${verdaechtig.join(", ")}. ` +
      `Umbenennen: "sprache-auswählen" wird zu "sprache-auswaehlen".`,
  );
});

test("Keine Umleitungsquelle in next.config.ts hat ein Umlaut", () => {
  const quelle = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");
  const regeln = [...quelle.matchAll(/source:\s*"([^"]+)"/g)].map((m) => m[1]);
  const verdaechtig = regeln.filter((s) => !ascii.test(s));

  assert.deepEqual(
    verdaechtig,
    [],
    `redirects() findet keine Quelle mit Umlaut — sie wird nie greifen: ${verdaechtig.join(", ")}`,
  );
});
