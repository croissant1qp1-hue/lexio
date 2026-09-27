/**
 * Welche Migration fehlt?
 *
 * Seit 003 gibt es in den API-Routen Stellen, an denen eine fehlende Migration
 * nicht als 500 mit einem Postgres-Satz auftauchen soll. Jede dieser Stellen
 * hat bisher ihre eigene Meldung gebaut, und jede nannte 003 – auch dann, wenn
 * 005 fehlte. Das ist die schlimmste Variante: Die Meldung ist verständlich,
 * benennt aber die falsche Datei, und wer ihr folgt, repariert nichts und
 * hält es für ein Datenbankproblem.
 *
 * Diese Datei ordnet einmal zu, was PostgREST sagt, welcher Zustand fehlt. Sie
 * wurde gegen die echte Datenbank geprueft (2026-09-27), nicht aus der Doku
 * abgeleitet:
 *
 *   fehlende Spalte     -> 42703 "column … does not exist"
 *   fehlende Beziehung  -> PGRST200 / PGRST201
 *   fehlende Tabelle    -> PGRST205
 *   RLS blockiert       -> 42501
 *
 * Alle vier codes nennen eine Datei aus `supabase/`. Geprueft wurde nur, was
 * ein echter Lauf gegen die Live-Datenbank zurueckgibt; ein Fehlerbild, das
 * hier nicht vorkommt, bekommt die allgemeine Meldung statt einer erfundenen.
 */

type PostgrestFehler = { code?: string | null; message?: string | null } | null | undefined;

/** Die Basisrechte fehlen: 003 ist nicht gelaufen. */
const M_003 =
  "Datenbank ist nicht aktuell. Bitte supabase/003-auth-und-user-daten.sql " +
  "im Supabase SQL Editor ausführen.";

/** Die Sprachliste fehlt: 005. */
const M_005 =
  "Sprachliste fehlt in der Datenbank. Bitte supabase/005-sprachen-und-beisatz.sql " +
  "im Supabase SQL Editor ausführen.";

/** Die Spalten fehlen, die 005 bringt: 005, bei der View auch 006. */
const M_005_006 =
  "Datenbank ist nicht aktuell. Bitte supabase/005-sprachen-und-beisatz.sql und " +
  "supabase/006-views-auf-sprachcode.sql im Supabase SQL Editor ausführen.";

/** Woran man 005 bzw. 006 im Text erkennt. */
const SPALTEN_005 = ["sprache_code", "beispielsatz", "beispiel_uebersetzung", "sprachen"];

/**
 * Die Meldung fuer diesen Fehler, oder `null`, wenn es kein Migrationsproblem
 * ist und die Route ihre eigene Meldung bauen soll.
 *
 * Das `null` ist wichtig: Es gibt Fehler, die keine Migration betreffen – ein
 * echter Datenbankausfall zum Beispiel. Dafuer hat die Route eine bessere
 * Meldung als jede allgemeine Aussage ueber Migrationen.
 */
export function migrationsMeldung(fehler: PostgrestFehler): string | null {
  const code = fehler?.code ?? "";
  const text = fehler?.message ?? "";

  switch (code) {
    /*
     * RLS hat zugeschlagen. Kommt vor, wenn 003 nicht gelaufen ist: dann kennt
     * die Tabelle user_id noch gar nicht und es gibt keine Policies. 005 und
     * 006 aendern daran nichts.
     */
    case "42501":
      return M_003;

    case "PGRST205":
      // "Could not find the table 'public.sprachen'" – die Sprachliste fehlt.
      return text.includes("sprachen") ? M_005 : M_003;

    case "42703":
    case "PGRST204": {
      const nennt005 = SPALTEN_005.some((spalte) => text.includes(spalte));
      return nennt005 ? M_005_006 : M_003;
    }

    default:
      return null;
  }
}
