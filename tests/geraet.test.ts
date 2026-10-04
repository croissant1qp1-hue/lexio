/**
 * Was dieses Gerät merkt – und was es ausdrücklich nicht.
 *
 * `lib/geraet.ts` hat keine Tests, obwohl in der Datei selbst die Regeln
 * stehen: Die Anmeldung wird hier *nicht* gespeichert, nur Bequemlichkeit
 * (zuletzt benutzte E-Mail, Wunsch "angemeldet bleiben"), und beides wird
 * beim Abmelden wieder gelöscht. Genau diese Regeln sind beim Lesen nicht
 * mehr von den Regeln zu unterscheiden, und ein Fehler darin ist nicht
 * sichtbar: Es steht kein Geheimnis im localStorage, sondern Bequemlichkeit
 * oder Privatsphäre – beides leise.
 *
 * Zwei Fehler waren hier tatsächlich möglich:
 *
 *   1. `setzeMerken(true)` schrieb den Eintrag neu, ohne die Adresse zu
 *      uebernehmen. Wer den Schalter einmal aus- und wieder einschaltete,
 *      hatte die Adresse endgueltig weg, obwohl der Schalter sie verspricht.
 *   2. Wer den Schalter einschaltet, ohne angemeldet zu sein, darf keine
 *      Adresse bekommen. Sonst schreibt ein Aufrufer eine fremde Adresse ins
 *      Geraet.
 *
 * Getestet wird gegen einen einfachen localStorage-Ersatz: Die Datei braucht
 * nichts als `window.localStorage`, sonst nichts vom Browser.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GERAET_SPEICHER,
  gemerkteEmail,
  liesStand,
  merkeAnmeldung,
  setzeMerken,
  vergissAnmeldung,
} from "../lib/geraet.ts";

/** Minimaler localStorage-Ersatz, absichtlich ohne Protokoll. */
function mitSpeicher(): {
  auslesen: () => Record<string, string>;
  zuruecksetzen: () => void;
} {
  const inhalt = new Map<string, string>();
  const kaputt = { werfe: false };

  const speicher = {
    getItem: (k: string) => (kaputt.werfe ? null : (inhalt.get(k) ?? null)),
    setItem: (k: string, w: string) => {
      if (kaputt.werfe) throw new Error("QuotaExceededError");
      inhalt.set(k, w);
    },
    removeItem: (k: string) => void inhalt.delete(k),
    clear: () => inhalt.clear(),
    key: (i: number) => [...inhalt.keys()][i] ?? null,
    get length() {
      return inhalt.size;
    },
  };

  (globalThis as unknown as { window: { localStorage: Storage } }).window = {
    localStorage: speicher as unknown as Storage,
  };

  return {
    auslesen: () => Object.fromEntries(inhalt),
    zuruecksetzen: () => {
      inhalt.clear();
      kaputt.werfe = false;
    },
  };
}

test("Anmelden mit Merken speichert die Adresse, ohne Merken nicht", () => {
  const s = mitSpeicher();

  merkeAnmeldung("  Nora@Beispiel.de ", true);
  assert.equal(gemerkteEmail(), "nora@beispiel.de", "muss klein und ohne Rand stehen");
  assert.equal(liesStand().merken, true);

  // Ohne "angemeldet bleiben" bleibt die Adresse nicht liegen.
  merkeAnmeldung("nora@beispiel.de", false);
  assert.equal(gemerkteEmail(), "", "ohne Merken darf keine Adresse stehen");
  assert.equal(liesStand().merken, false);

  s.zuruecksetzen();
});

test("Aus- und wieder Einschalten holt die Adresse zurueck", () => {
  const s = mitSpeicher();

  merkeAnmeldung("nora@beispiel.de", true);
  setzeMerken(false);
  assert.equal(gemerkteEmail(), "", "ausgeschaltet heisst: weg");

  setzeMerken(true, "Nora@Beispiel.de");
  assert.equal(gemerkteEmail(), "nora@beispiel.de", "eingeschaltet heisst: wieder da");
  assert.equal(liesStand().merken, true);

  s.zuruecksetzen();
});

test("Einschalten ohne Adresse speichert auch keine", () => {
  const s = mitSpeicher();

  // Kein Argument: verhaelt sich wie vorher, erfindet nichts.
  setzeMerken(true);
  assert.equal(gemerkteEmail(), "");
  assert.equal(liesStand().merken, true);

  // Leere Zeichenkette ist dasselbe wie gar keine.
  setzeMerken(true, "   ");
  assert.equal(gemerkteEmail(), "");

  s.zuruecksetzen();
});

test("Einschalten haelt den alten Zeitstempel", () => {
  const s = mitSpeicher();

  // Die Uhr laeuft hier absichtlich weiter. Ohne das besteht der Test nur,
  // wenn alle drei Aufrufe in derselben Millisekunde passieren — er ist
  // dann 28 von 30 Mal gruen gewesen und hat den Fehler nie gesehen. Ein
  // Test, der manchmal danebenliegt, ist schlimmer als keiner: Man laesst
  // ihn neu laufen, statt nachzusehen. Also wird `Date.now` hier ersetzt,
  // sodass "ein Schalter ist keine Anmeldung" bei jedem Lauf falsch waere,
  // wenn es falsch ist.
  const echtesNow = Date.now;
  let t = 1_700_000_000_000;
  Date.now = () => (t += 1000);

  try {
    merkeAnmeldung("nora@beispiel.de", true);
    const vorher = liesStand().zuletztAngemeldet;
    setzeMerken(false);
    setzeMerken(true, "nora@beispiel.de");
    assert.equal(
      liesStand().zuletztAngemeldet,
      vorher,
      "der Zeitstempel darf nicht springen",
    );
  } finally {
    Date.now = echtesNow;
    s.zuruecksetzen();
  }
});

test("Abmelden loescht die Adresse, behält aber den Wunsch", () => {
  const s = mitSpeicher();

  merkeAnmeldung("nora@beispiel.de", true);
  vergissAnmeldung();
  assert.equal(gemerkteEmail(), "", "auf einem gemeinsamen Rechner bleibt die Person nicht stehen");
  assert.equal(liesStand().merken, true, "der Wunsch bleibt fuer das naechste Anmelden");

  // Und mit ausgeschaltetem Wunsch bleibt der ebenfalls aus.
  merkeAnmeldung("nora@beispiel.de", false);
  vergissAnmeldung();
  assert.equal(liesStand().merken, false);

  s.zuruecksetzen();
});

test("Der alte Zeitstempel ueberlebt das Abmelden als Merkwert", () => {
  const s = mitSpeicher();

  merkeAnmeldung("nora@beispiel.de", true);
  vergissAnmeldung();
  // Nach dem Abmelden ist `zuletztAngemeldet` weg, `merken` auch nicht neu.
  // Beides wird erst beim naechsten Einschalten wieder gesetzt.
  assert.equal(typeof liesStand().zuletztAngemeldet, "undefined");

  s.zuruecksetzen();
});

test("Kaputter Eintrag landet in der Vorgabe, nicht im Absturz", () => {
  const s = mitSpeicher();
  const window = (globalThis as unknown as { window: { localStorage: Storage } }).window;

  window.localStorage.setItem(GERAET_SPEICHER, "{kein json");
  assert.deepEqual(liesStand(), { v: 1, merken: true });

  // Fremde Version wird verworfen, nicht halb gelesen.
  window.localStorage.setItem(GERAET_SPEICHER, JSON.stringify({ v: 99, email: "fremd@x.de" }));
  assert.deepEqual(liesStand(), { v: 1, merken: true });

  s.zuruecksetzen();
});

test("Ein Speicher, der ablehnt, ist kein Fehler", () => {
  const s = mitSpeicher();
  const fenster = (globalThis as unknown as { window: { localStorage: Storage } }).window;

  const kaputt = {
    getItem: () => null,
    setItem: () => {
      throw new Error("SecurityError");
    },
  } as unknown as Storage;
  fenster.localStorage = kaputt;

  // Im privaten Modus von Safari und bei blockierten Cookies wirft der
  // erste Zugriff. Die App muss daran gehindert werden, sich zu verweigern.
  assert.doesNotThrow(() => setzeMerken(true, "nora@beispiel.de"));
  assert.doesNotThrow(() => merkeAnmeldung("nora@beispiel.de", true));
  assert.equal(liesStand().merken, true, "Vorgabe, nicht Absturz");

  s.zuruecksetzen();
});

test("Ohne Fenster (Server) gibt es Speicherzugriffe, aber keinen Fehler", () => {
  const s = mitSpeicher();
  delete (globalThis as unknown as { window?: unknown }).window;

  assert.deepEqual(liesStand(), { v: 1, merken: true });
  assert.equal(gemerkteEmail(), "");
  assert.doesNotThrow(() => setzeMerken(true, "nora@beispiel.de"));

  s.zuruecksetzen();
});

test("Gespeichert wird nur Bequemlichkeit, nie ein Sitzungsnachweis", () => {
  const s = mitSpeicher();

  merkeAnmeldung("nora@beispiel.de", true);
  const roh = JSON.stringify(s.auslesen());

  // Der ganze Sinn der Datei: kein Token, kein JWT, kein Refresh-Geheimnis.
  assert.ok(!/eyJ[A-Za-z0-9_-]{8,}/.test(roh), "darf kein JWT enthalten");
  for (const verboten of ["token", "refresh", "access_token", "password", "passwort"]) {
    assert.ok(!roh.includes(verboten), `darf "${verboten}" nicht enthalten`);
  }

  s.zuruecksetzen();
});