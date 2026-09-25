import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { KarteikartenSet } from "@/lib/types";

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("karteikarten_sets_uebersicht")
    .select("slug, name, sprache, anzahl_karten, karten_gesamt, karten_gelernt, fortschritt_prozent")
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const sets: KarteikartenSet[] = data.map((row) => ({
    id: row.slug,
    name: row.name,
    sprache: row.sprache,
    anzahlKarten: row.anzahl_karten,
    fortschrittProzent: row.fortschritt_prozent ?? 0,
    updatedAt: new Date().toISOString(),
  }));

  return NextResponse.json(sets);
}
