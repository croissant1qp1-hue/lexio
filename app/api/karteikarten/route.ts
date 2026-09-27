import { NextResponse } from "next/server";
import { mitUserOder401 } from "@/lib/supabase/user";

/**
 * Die Spalten, die die View seit 003 liefert.
 */
const SPALTEN =
  "slug, name, sprache, anzahl_karten, karten_gesamt, karten_gelernt, karten_faellig, fortschritt_prozent, eigenes_set, zuletzt_gelernt, user_id";

type Zeile = {
  slug: string;
  name: string;
  sprache: string;
  anzahl_karten: number;
  karten_gesamt: number | null;
  karten_gelernt: number | null;
  karten_faellig: number | null;
  fortschritt_prozent: number | null;
  eigenes_set: boolean | null;
  zuletzt_gelernt: string | null;
  user_id: string | null;
};

/**
 * Was die Oberflaeche bekommt. `eigen` heisst: gehoert dieser Person.
 */
type SetAntwort = {
  id: string;
  name: string;
  sprache: string;
  anzahlKarten: number;
  zielKarten: number;
  fortschrittProzent: number;
  kartenGesamt: number;
  kartenGelernt: number;
  kartenFaellig: number;
  eigenesSet: boolean;
  eigen: boolean;
  zuletztGelernt: string | null;
};

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
    if (error.code === "42703" || error.code === "PGRST204") {
      return NextResponse.json(
        {
          error:
            "Datenbank ist nicht aktuell. Bitte supabase/003-auth-und-user-daten.sql " +
            "im Supabase SQL Editor ausführen.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const sets: SetAntwort[] = (data as Zeile[] | null ?? []).map((row) => ({
    id: row.slug,
    name: row.name,
    sprache: row.sprache,
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
    eigenesSet: row.eigenes_set ?? false,
    // false heisst: Demoset. Nicht loeschbar, nicht ergaenzbar.
    eigen: row.user_id === user.id,
    // null, wenn das Set noch nie gelernt wurde. Die Wortschatz-Tabelle
    // zeigt dafuer "–" statt eines erfundenen Datums.
    zuletztGelernt: row.zuletzt_gelernt ?? null,
  }));

  return NextResponse.json(sets, { headers: { "Cache-Control": "no-store" } });
}
