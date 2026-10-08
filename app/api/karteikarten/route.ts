import { NextResponse } from "next/server";
import { mitUserOder401 } from "@/lib/supabase/user";
import type { SpracheInfo } from "@/lib/sprachen";
import { UNBEKANNTE_SPRACHE } from "@/lib/sprachen";
import type { SetUebersicht } from "@/lib/types";
import { migrationsMeldung } from "@/lib/db-fehler";

/**
 * Die Spalten, die die View seit 006 liefert.
 *
 * `sprache_code`, `sprache`, `sprache_flaeche` und `sprache_akzent` sind seit
 * 006 dabei. Vorher stand hier nur `sprache`, und die Oberfläche leitete daraus
 * die Farbe ab, indem sie das erste Wort nahm (karteikarten-seite.tsx:129).
 */
const SPALTEN =
  "slug, name, sprache_code, sprache, sprache_flaeche, sprache_akzent, anzahl_karten, " +
  "karten_gesamt, karten_gelernt, karten_faellig, fortschritt_prozent, eigenes_set, " +
  "zuletzt_gelernt, user_id, stufe_durchschnitt, set_level, set_level_anteil";

type Zeile = {
  slug: string;
  name: string;
  sprache_code: string | null;
  sprache: string | null;
  sprache_flaeche: string | null;
  sprache_akzent: string | null;
  anzahl_karten: number;
  karten_gesamt: number | null;
  karten_gelernt: number | null;
  karten_faellig: number | null;
  fortschritt_prozent: number | null;
  eigenes_set: boolean | null;
  zuletzt_gelernt: string | null;
  user_id: string | null;
  stufe_durchschnitt: number | null;
  set_level: number | null;
  set_level_anteil: number | null;
};

/**
 * Sprache aus der View, ohne die Farbe zu erfinden.
 *
 * Die View liefert die Farben aus public.sprachen mit; fehlen sie, ist die
 * Sprache unbekannt, und dann steht der Rückfall da. `name` ist der Name aus
 * der Sprachliste, sonst der alte Freitext – beides kann die View, und es ist
 * nicht Aufgabe des Codes, hier zu raten.
 */
function spracheAusZeile(zeile: Zeile): SpracheInfo {
  if (!zeile.sprache_code) {
    return { ...UNBEKANNTE_SPRACHE, name: zeile.sprache || UNBEKANNTE_SPRACHE.name };
  }
  return {
    code: zeile.sprache_code,
    name: zeile.sprache || UNBEKANNTE_SPRACHE.name,
    flaeche: zeile.sprache_flaeche || UNBEKANNTE_SPRACHE.flaeche,
    akzent: zeile.sprache_akzent || UNBEKANNTE_SPRACHE.akzent,
  };
}


/**
 * Alle Sets, die diese Person sehen darf, mit ihrem Fortschritt.
 *
 * Die Sichtbarkeit macht die RLS-Policy auf karteikarten_sets: eigene und
 * globale Demosets. Die Zaehler kommen aus der View, die seit 003 per
 * security_invoker rechnet – karten_gelernt ist damit die Zahl DER
 * angemeldeten Person und nicht mehr eine Eigenschaft der Karte.
 *
 * `user_id` wandert als `eigen` mit. Die Oberflaeche braucht es, um einen
 * globalen Demoeintrag von einem eigenen zu unterscheiden: eigene Sets
 * duerfen geloescht und ergaenzt werden, Demodaten nicht.
 */
export async function GET() {
  const { supabase, user, antwort: nichtAngemeldet } = await mitUserOder401();
  if (nichtAngemeldet) return nichtAngemeldet;

  const { data, error } = await supabase
    .from("karteikarten_sets_uebersicht")
    .select(SPALTEN)
    .order("name");

  if (error) {
    /*
     * Frueher stand hier ein Rückfall auf eine schmalere Spaltenliste, falls
     * die "Zusatzspalten" aus 002 fehlten. Diese Rückfalllogik ist seit 003
     * schaedlich: 003 ist keine Erweiterung mehr, sondern Voraussetzung. Der
     * Rückfall lieferte globale Zaehler – also genau die falschen Zahlen, die
     * man nicht als falsche erkennt. Stattdessen eine klare Meldung.
     */
    /*
     * 42703 heisst "Spalte fehlt". Live geprueft am 2026-09-27 gegen die
     * echte Datenbank: `column karteikarten_sets_uebersicht.sprache_code does
     * not exist`. Welche Datei noetig ist, entscheidet der Text – vor 005/006
     * war es 003, jetzt ist es 005 und 006, und eine Meldung, die immer 003
     * nennt, fuehrt in die Irre.
     */
    const migration = migrationsMeldung(error);
    if (migration) {
      return NextResponse.json({ error: migration }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  /*
   * supabase-js leitet den Zeilentyp aus der Select-Zeichenkette ab. Die View
   * steht nicht im generierten Typ, also kommt ein Platzhalter zurueck, und
   * ein direkter Cast darauf ist nicht erlaubt (TS2352). Deshalb zuerst ueber
   * `unknown` – dieselbe Form wie in app/api/lernen/route.ts:171.
   */
  const sets: SetUebersicht[] = ((data ?? []) as unknown as Zeile[]).map((row) => ({
    id: row.slug,
    name: row.name,
    sprache: spracheAusZeile(row),
    // anzahl_karten ist die Zielgroesse des Sets (z. B. 80) und waechst
    // nicht, wenn eigene Vokabeln hinzugefuegt werden. Angezeigt wird
    // deshalb karten_gesamt, sonst zeigt die Kachel nach dem Speichern
    // weiterhin den alten Stand.
    anzahlKarten: row.karten_gesamt ?? 0,
    zielKarten: row.anzahl_karten,
    fortschrittProzent: row.fortschritt_prozent ?? 0,
    kartenGesamt: row.karten_gesamt ?? 0,
    kartenGelernt: row.karten_gelernt ?? 0,
    kartenFaellig: row.karten_faellig ?? 0,
    /*
     * Set-Level aus der View (017). 0 heisst "keine Karten", nicht "noch
     * nichts gelernt" – die Oberfläche unterscheidet das, indem sie bei
     * kartenGesamt = 0 gar keine Stufen zeichnet. Ohne diesen Rueckfall
     * auf 0 waere `null` in einem Zahl-React-Style und damit NaN.
     */
    setLevel: row.set_level ?? 0,
    setLevelAnteil: row.set_level_anteil ?? 0,
    stufeDurchschnitt: row.stufe_durchschnitt ?? 0,
    eigenesSet: row.eigenes_set ?? false,
    // false heisst: Demoset. Nicht loeschbar, nicht ergaenzbar.
    eigen: row.user_id === user.id,
    // null, wenn das Set noch nie gelernt wurde. Die Wortschatz-Tabelle
    // zeigt dafuer "–" statt eines erfundenen Datums.
    zuletztGelernt: row.zuletzt_gelernt ?? null,
  }));

  return NextResponse.json(sets, { headers: { "Cache-Control": "no-store" } });
}
