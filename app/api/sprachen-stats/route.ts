import { NextResponse } from "next/server";
import { mitUserOder401 } from "@/lib/supabase/user";
import type { SprachStat } from "@/lib/types";

/**
 * Gelernte Karten und XP je Sprache.
 *
 * Die View statistik_pro_sprache ist in 003 auf security_invoker umgestellt
 * worden: sie addiert nur, was die angemeldete Person selbst gelernt hat.
 * Ohne Anmeldung liefert sie 0 Zeilen, nicht fremde Daten – die Route bleibt
 * trotzdem an einer Session, weil "0 Karten gelernt" bei niemandem stimmt.
 */
export async function GET() {
  const { supabase, antwort: nichtAngemeldet } = await mitUserOder401();
  if (nichtAngemeldet) return nichtAngemeldet;

  const { data, error } = await supabase
    .from("statistik_pro_sprache")
    .select("sprache, gelernt, total, xp")
    .order("sprache");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const stats: SprachStat[] = (data ?? []).map((row) => ({
    id: row.sprache.toLowerCase(),
    sprache: row.sprache,
    gelernt: row.gelernt ?? 0,
    total: row.total ?? 0,
    xp: row.xp ?? 0,
  }));

  return NextResponse.json(stats, { headers: { "Cache-Control": "no-store" } });
}
