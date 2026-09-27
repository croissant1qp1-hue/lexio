/**
 * Die Sprachliste auf der Serverseite holen.
 *
 * public.sprachen ist die einzige Quelle für Sprachnamen und -farben. Der Code
 * liest sie an zwei Stellen: /api/sets (beim Anlegen eines Sets) und
 * /api/lernen (für die Kopfzeile der Lernansicht). Beide brauchen dieselbe
 * Liste, und beide brauchen sie als Zusicherung – ein Client, der einen
 * erfundenen Code mitsendet, darf keine erfundene Sprache bekommen.
 *
 * Zwölf Zeilen sind ein sehr kleines Ergebnis, deshalb wird es für fünf
 * Minuten im Prozess gehalten. Das ist kein geteilter Zustand zwischen
 * Nutzern: die Liste ist öffentlich, für alle identisch, und ändert sich nur,
 * wenn jemand eine Sprache pflegt. Fünf Minuten später ist sie von allein
 * aktuell, ohne dass ein Neustart nötig wäre.
 */

import type { SupabaseServerClient } from "./supabase/server";
import type { Sprache } from "./sprachen";

/** Fünf Minuten. Kurz genug, dass eine neue Sprache nicht tagelang fehlt. */
const HALTE_MS = 5 * 60 * 1000;

let zwischenspeicher: { geholt: number; sprachen: Sprache[] } | null = null;

/** Ein Datensatz aus der Datenbank, mit den Farben als Text. */
type Zeile = {
  code: string;
  name: string;
  flaeche: string;
  akzent: string;
  sortierung: number;
};

/**
 * Alle Sprachen, in der Reihenfolge der Sprachliste.
 *
 * Bei einem Fehler wird `[]` geliefert, nicht geworfen. Der Aufrufer soll
 * einen klaren Fehler an den Nutzer geben können – "Sprachen konnten nicht
 * geladen werden" – und nicht an einem Supabase-Ausfall scheitern. Deshalb
 * wird der Fehler hier nicht verschluckt, sondern im Ergebnis mitgeliefert.
 */
export async function holeSprachen(
  supabase: SupabaseServerClient,
): Promise<{ sprachen: Sprache[]; fehler: string | null }> {
  if (zwischenspeicher && Date.now() - zwischenspeicher.geholt < HALTE_MS) {
    return { sprachen: zwischenspeicher.sprachen, fehler: null };
  }

  const { data, error } = await supabase
    .from("sprachen")
    .select("code, name, flaeche, akzent, sortierung")
    .order("sortierung");

  if (error) {
    return { sprachen: [], fehler: error.message };
  }

  const sprachen: Sprache[] = ((data ?? []) as Zeile[]).map((z) => ({
    code: z.code,
    name: z.name,
    flaeche: z.flaeche,
    akzent: z.akzent,
  }));

  zwischenspeicher = { geholt: Date.now(), sprachen };

  return { sprachen, fehler: null };
}

/**
 * Die Sprache mit diesem Code, oder `undefined`.
 *
 * Absichtlich kein „erster Treffer, dessen Name ähnlich passt". Der Code
 * kommt aus einer Fremdschlüsselung in der Datenbank, und ein Code, den es
 * nicht gibt, ist ein Fehler in der Anfrage – kein Anlass zu raten.
 */
export function spracheNachCode(
  sprachen: Sprache[],
  code: string | null | undefined,
): Sprache | undefined {
  if (!code) return undefined;
  return sprachen.find((s) => s.code === code);
}

/**
 * Erzwingt eine gültige Sprache und liefert ihren Namen mit.
 *
 * Der Name geht nach `karteikarten_sets.sprache`, weil diese Spalte NOT NULL
 * ist und erst in Phase 4 verschwindet. Sie wird ab hier nicht mehr als Freitext
 * gepflegt, sondern als Ableitung des Codes geschrieben: dieselbe Sprache kann
 * dadurch nicht zweimal verschieden geschrieben werden.
 */
export function verlangteSprache(
  sprachen: Sprache[],
  code: unknown,
): Sprache | { fehler: string } {
  if (typeof code !== "string" || !code.trim()) {
    return { fehler: "Sprache fehlt" };
  }
  const sprache = spracheNachCode(sprachen, code.trim());
  if (!sprache) {
    return { fehler: `Unbekannte Sprache: ${code}` };
  }
  return sprache;
}
