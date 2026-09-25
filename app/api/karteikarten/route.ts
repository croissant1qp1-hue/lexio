import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("karteikarten_sets_uebersicht")
    .select("slug, name, sprache, anzahl_karten, karten_gesamt, karten_gelernt, karten_faellig, fortschritt_prozent")
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const sets = data.map((row) => ({
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
  }));

  return NextResponse.json(sets);
}
