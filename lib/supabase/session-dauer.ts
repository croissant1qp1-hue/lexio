/**
 * Lebensdauer des Session-Cookies.
 *
 * Wofür: "Auf diesem Gerät angemeldet bleiben" soll zwei verschiedene Dinge
 * bedeuten können, und der Unterschied ist ein echter:
 *
 *   merken: true  → Cookie mit 400 Tagen Laufzeit. Überlebt den Neustart
 *                    des Browsers, das Neuschließen des Tabs, den Wechsel
 *                    aufs Handy.
 *   merken: false → Cookie ohne Ablaufdatum. Es lebt nur, solange der
 *                    Browser läuft. Wer den Rechner abschaltet, muss sich
 *                    neu anmelden.
 *
 * Warum das nicht über die Bibliothek läuft: `createBrowserClient` ist ein
 * Singleton pro Modul. Eine Änderung der Cookie-Optionen würde einen zweiten
 * Client mit eigener Sitzungsverwaltung erzeugen – zwei Instanzen, die
 * dieselbe Sitzung abwechselnd überschreiben. Deshalb wird nicht der Client
 * neu gebaut, sondern genau ein Attribut an dem Cookie gedreht, das er
 * selbst geschrieben hat.
 *
 * Sicherheitsregel für diese Datei: Es wird ausschließlich der Wert
 * zurückgeschrieben, der schon da ist. Es wird nichts erzeugen, nichts
 * umrechnen, nichts erraten. Wenn der Zustand unerwartet ist, passiert
 * nichts – ein Fehler hier darf im schlimmsten Fall eine erneute Anmeldung
 * kosten, niemals aber eine fremde Sitzung.
 */

import { SUPABASE_URL } from "./config";

/** Wie lange @supabase/ssr sein Cookie selbst setzt. */
const VIERHUNDERT_TAGE = 400 * 24 * 60 * 60;

/**
 * Der Name, den supabase-js aus der Projekt-URL bildet. Gleiche Formel wie
 * im Client, sonst schreibt diese Datei ins Leere.
 */
function cookieName(): string {
  return `sb-${new URL(SUPABASE_URL).hostname.split(".")[0]}-auth-token`;
}

/**
 * Alle Teile des Cookies einsammeln.
 *
 * Ab etwa 3 KB zerlegt der Browser ein Cookie in `name.0`, `name.1`, … Wird
 * nur der erste Teil gefunden und der zweite ignoriert, ist der Wert
 * unbrauchbar – und die Person wird aus der App geworfen. Deshalb wird
 * nach der Lücke gesucht, nicht nach einer festen Anzahl.
 */
function liesTeile(): { name: string; wert: string }[] {
  if (typeof document === "undefined") return [];
  const basis = cookieName();
  const teile: { name: string; wert: string }[] = [];

  for (const roh of document.cookie.split(";")) {
    const gleich = roh.indexOf("=");
    if (gleich < 0) continue;
    const name = roh.slice(0, gleich).trim();
    if (name !== basis && !name.startsWith(`${basis}.`)) continue;
    const wert = decodeURIComponent(roh.slice(gleich + 1).trim());
    // Leere Teile sind Löschmarken. Sie zurückzuschreiben würde ein
    // herrenloses Cookie erzeugen, das beim nächsten Lesen als "Session
    // vorhanden, aber kaputt" endet.
    if (wert) teile.push({ name, wert });
  }

  // Ohne den ersten Teil ist der Rest unbrauchbar.
  return teile.some((t) => t.name === basis) ? teile : [];
}

function hausZusaetze(): string {
  const sicher = typeof location !== "undefined" && location.protocol === "https:";
  return `Path=/; SameSite=Lax${sicher ? "; Secure" : ""}`;
}

/**
 * Setzt die Lebensdauer auf dem, was gerade aussteht.
 *
 * `merken: true`  → `Max-Age=400d` (dauerhaft)
 * `merken: false` → kein `Max-Age`, kein `Expires` (nur diese Sitzung)
 *
 * Beim Überschreiben ersetzt der Browser das alte Cookie vollständig: gleicher
 * Name, gleicher Pfad, gleiche Domain. Deshalb genügt es, denselben Wert ohne
 * Ablaufdatum neu zu schreiben – der alte, langlebige Eintrag ist danach weg.
 */
export function setzeSessionDauer(merken: boolean): void {
  if (typeof document === "undefined") return;
  try {
    for (const teil of liesTeile()) {
      document.cookie = `${teil.name}=${encodeURIComponent(teil.wert)}; ${hausZusaetze()}${
        merken ? `; Max-Age=${VIERHUNDERT_TAGE}` : ""
      }`;
    }
  } catch {
    // Manche Browser lassen sich bei Cookie-Schreibzugriffen in
    // Tracking-Situationen nicht. Dann bleibt die Standarddauer – die
    // App funktioniert, es gilt nur eine andere als die gewünschte.
  }
}

/*
 * Es gibt hier bewusst KEINE Abfrage, die die aktuelle Lebensdauer
 * zurückgibt. document.cookie zeigt nur Name=Wert, nie das Ablaufdatum – eine
 * solche Funktion könnte nichts anderes liefern als eine Vermutung, und die
 * Einstellungen würden etwas anzeigen, das sie nicht wissen. Dort steht der
 * Wunsch aus lib/geraet.ts, der die tatsächliche Einstellung beschreibt.
 */
