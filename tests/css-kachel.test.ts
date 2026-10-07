/**
 * Kachel-Regeln aus dem responsiven Audit, festgeschrieben.
 *
 * Zwei Regeln wurden zweimal stillschweigend verletzt, weil CSS sie
 * absorbierte statt anzuzeigen: Ein Text kleiner als 14 px (Phase-5-Abnahme:
 * "kein Text kleiner als 14 px") und ein Ueberlauf in der quadratischen
 * Kachel, den `overflow: hidden` verschluckte.
 *
 * Der Responsive-Audit misst beides am laufenden System – gut, aber er
 * braucht Server, Zweitkonto und Chromium und ist kein Teil von `npm test`.
 * Dieser Test liest stattdessen die Regeln aus dem Quelltext, damit eine
 * Aenderung im CSS die Verletzung beim naechsten `npm test` anzeigt, nicht
 * erst beim naechsten Durchlauf der Messung.
 *
 * - `.kachelName` klemmen auf zwei Zeilen: ohne die Grenze frisst ein langer
 *   Set-Name den Platz fuer Level-Zeile und Leiter, und die Kachel schneidet
 *   ihn still ab (gemessen 2026-10-06, gefixt als Variante F).
 * - `.kachelGelernt` mindestens die Schriftgroesse 0.875rem (14 px): war
 *   0.72rem (11.52 px) und wurde vom Audit als "Text unter 14px" gemeldet –
 *   auf Startseite und Uebersicht je 5 Fundstellen.
 *
 * Bemessung: 0.875rem = 14 px nur bei einem Root-Wert von 16 px. Steht der
 * irgendwann anders, faellt die Pruefung durch Scheitern auf – gewollt.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const CSS = readFileSync(
  join(import.meta.dirname, "..", "components", "uebersicht", "uebersicht.module.css"),
  "utf8",
);

/**
 * CSS-Regelsatz parsen: Selector-Grenzen, Kommentare und geschachtelte
 * Klammern benoetigt ein Scanner, kein Regex ueber den ganzen Text.
 */
function regeln(css: string): Map<string, string> {
  const treffer = new Map<string, string>();
  let i = 0;
  while (i < css.length) {
    if (css[i] === "/" && css[i + 1] === "*") {
      const ende = css.indexOf("*/", i + 2);
      if (ende === -1) break;
      i = ende + 2;
      continue;
    }
    if (css[i] === "}") {
      const zeile = css.slice(0, i).split("\n").at(-1) ?? "";
      if (zeile.trim()) {
        treffer.set(zeile.trim(), css.slice(0, i));
      }
      i += 1;
      continue;
    }
    if (css[i] === "{") {
      let tiefe = 1;
      let j = i + 1;
      while (j < css.length && tiefe > 0) {
        if (css[j] === "/" && css[j + 1] === "*") {
          const ende = css.indexOf("*/", j + 2);
          j = ende === -1 ? css.length : ende + 2;
          continue;
        }
        if (css[j] === "{") tiefe += 1;
        if (css[j] === "}") tiefe -= 1;
        j += 1;
      }
      const selector = css.slice(0, i).split("\n").at(-1)?.trim() ?? "";
      const body = css.slice(i + 1, j - 1);
      treffer.set(selector, body);
      i = j;
      continue;
    }
    i += 1;
  }
  return treffer;
}

const REGELN = regeln(CSS);

test("Der Set-Name ist in der Kachel auf zwei Zeilen geklemmt", () => {
  const name = REGELN.get(".kachelName");
  assert.ok(name, "Regel .kachelName fehlt");
  assert.match(name, /-webkit-line-clamp:\s*2;/);
  assert.match(name, /display:\s*-webkit-box;/);
  assert.match(name, /overflow:\s*hidden;/);
});

test("Die Deckungs-Zeile unter dem Level bleibt mindestens 14 px gross", () => {
  const gelernt = REGELN.get(".kachelGelernt");
  assert.ok(gelernt, "Regel .kachelGelernt fehlt");
  assert.match(gelernt, /font-size:\s*0\.875rem\s*;/);
});