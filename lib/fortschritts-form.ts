/**
 * Formpruefung fuer das Ergebnis der eingebetteten Fortschrittsabfrage.
 *
 * Worum es geht: `GET /api/lernen` fragt die Karten mit
 *
 *   select("id, fortschritt:karten_fortschritt!…(stufe, gelernt, …)")
 *
 * und bekommt fuer jede Karte die Fortschrittszeile eingebettet – oder null,
 * wenn es keine gibt. TypeScript kann das nicht pruefen, `data` ist `any` aus
 * dem Supabase-Client, und der Alias im select-String ist ein String. Also
 * stand hier lange `as unknown as RohKarte[]`.
 *
 * Der Cast war begründet und ist trotzdem eine stille Gefahr. Er sagt nichts
 * ueber die Wirklichkeit, nur ueber die Absicht des Schreibers. Wird der Alias
 * umbenannt, gibt die Abfrage den Fehler PGRST200 und wird gefangen. Wird er
 * nur richtig geschrieben und liefert trotzdem etwas anderes – ein Objekt statt
 * eines Arrays, `stufe` als String, ein verschobenes Feld –, dann ist der Cast
 * weiterhin gluecklich, und `zeile?.stufe ?? 0` macht aus jeder Karte eine
 * neue. Der Nutzer bekommt dann keine Fehlermeldung, sondern sein gesamtes
 * Set erneut als Anfangsrunde: alles Stufe 0, nichts gelernt, nichts
 * faellig. Genau das ist der stillschweigende Fehler, den der Cast versteckt.
 *
 * Diese Funktion macht den Zweifel laut. Sie ersetzt den Cast nicht durch
 * eine zweite Vermutung, sondern fragt ab: ist das ueberhaupt eine
 * Fortschrittszeile? Ein Nein ist kein Drama, sondern ein Fehler im Code, und
 * der gehoert gemeldet statt in eine Runde uebersetzt, die falsch ist.
 *
 * Bewusst NICHT geprueft wird der Inhalt im Detail (ist `z_gut` eine Zahl?).
 * Das sind Optimierungen der Lernreihenfolge: ein falscher Wert dort ist
 * eine schlechtere Sortierung, kein falscher Lernstand. `stufe` dagegen ist
 * die einzige Zahl, aus der der ganze Fortschritt berechnet wird, und die
 * wird geprueft.
 */

/** Eine Fortschrittszeile, wie die eingebettete Abfrage sie zurueckgibt. */
export type FortschrittsZeile = {
  stufe: number;
  gelernt: boolean;
  faellig_am: string;
  /** Seit 003 vorhanden; seit 1.7 fuer Leech-Erkennung im Einsatz. */
  fehler?: number;
  treffer?: number;
  /** Seit 010: Bewertungs-Zaehler fuer die schlaue Reihenfolge (1.8). */
  z_nochmal?: number;
  z_schwer?: number;
  z_gut?: number;
  z_einfach?: number;
};

/** Eine Karte mit ihrem Fortschritt. Leer heisst: noch nie gesehen. */
export type RohKarte = {
  id: string;
  fortschritt: FortschrittsZeile[] | FortschrittsZeile | null;
};

export type FormErgebnis =
  | { ok: true; karten: RohKarte[] }
  | { ok: false; grund: string };

/** Wie eine Zeile von PostgREST aussieht, wenn sie keine ist. */
function istObjekt(wert: unknown): wert is Record<string, unknown> {
  return typeof wert === "object" && wert !== null && !Array.isArray(wert);
}

/**
 * Prueft die Zeilen und gibt sie unveraendert zurueck – nur eben geprueft.
 *
 * Drei Faelle werden unterschieden, weil sie etwas Unterschiedes bedeuten:
 *
 *  1. `fortschritt` fehlt, ist null oder ein leeres Array: die Karte ist neu.
 *     Das ist der Normalfall bei einem frischen Set und darf kein Fehler sein.
 *  2. `fortschritt` ist ein Objekt oder ein Array mit genau einem Objekt mit
 *     numerischer `stufe`: das ist eine Fortschrittszeile.
 *  3. Alles andere: die Abfrage liefert etwas anderes als erwartet. Dann
 *     `ok: false` mit einem Grund, den man in einer Logzeile wiedererkennt.
 */
export function pruefeRohKarten(data: unknown): FormErgebnis {
  if (data === null || data === undefined) return { ok: true, karten: [] };

  if (!Array.isArray(data)) {
    return {
      ok: false,
      grund: `erwartet wurde eine Liste von Karten, geliefert wurde ${typeof data}`,
    };
  }

  const karten: RohKarte[] = [];

  for (const [index, roh] of data.entries()) {
    if (!istObjekt(roh)) {
      return { ok: false, grund: `Karte ${index} ist kein Objekt (${typeof roh})` };
    }
    if (typeof roh.id !== "string" || roh.id === "") {
      return { ok: false, grund: `Karte ${index} hat keine id` };
    }

    const eingebettet = roh.fortschritt;

    // Fall 1: keine Zeile. PostgREST liefert null, beim Array-Embed auch [].
    if (
      eingebettet === null ||
      eingebettet === undefined ||
      (Array.isArray(eingebettet) && eingebettet.length === 0)
    ) {
      karten.push({ id: roh.id, fortschritt: null });
      continue;
    }

    // Fall 2: eine Zeile, als Objekt oder als einelementiges Array.
    const zeile = Array.isArray(eingebettet) ? eingebettet[0] : eingebettet;
    if (!istObjekt(zeile)) {
      return {
        ok: false,
        grund:
          `Karte ${index} hat einen Fortschritt vom Typ ${typeof zeile}, ` +
          `erwartet wurde ein Objekt`,
      };
    }
    if (typeof zeile.stufe !== "number" || !Number.isFinite(zeile.stufe)) {
      return {
        ok: false,
        grund:
          `Karte ${index} hat eine Fortschrittszeile ohne brauchbare stufe ` +
          `(${JSON.stringify(zeile.stufe ?? null)})`,
      };
    }

    karten.push({ id: roh.id, fortschritt: zeile as unknown as FortschrittsZeile });
  }

  return { ok: true, karten };
}
