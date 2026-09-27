import { NextResponse } from "next/server";
import { mitUserOder401 } from "@/lib/supabase/user";
import type { SprachStat } from "@/lib/types";
import { UNBEKANNTE_SPRACHE } from "@/lib/sprachen";

/**
 * Gelernte Karten und XP je Sprache.
 *
 * Die View statistik_pro_sprache ist in 003 auf security_invoker umgestellt
 * worden: sie addiert nur, was die angemeldete Person selbst gelernt hat.
 * Ohne Anmeldung liefert sie 0 Zeilen, nicht fremde Daten – die Route bleibt
 * trotzdem an einer Session, weil "0 Karten gelernt" bei niemandem stimmt.
 *
 * Seit 006 gruppiert die View nach `sprache_code` statt nach dem Freitext und
 * liefert die Farben mit. Damit braucht diese Route keinen eigenen Blick in
 * public.sprachen, und es kann nicht mehr passieren, dass die Statistik eine
 * andere Farbe zeigt als die Kachel desselben Sets.
 */
export async function GET() {
  const { supabase, antwort: nichtAngemeldet } = await mitUserOder401();
  if (nichtAngemeldet) return nichtAngemeldet;

  const { data, error } = await supabase
    .from("statistik_pro_sprache")
    .select("sprache_code, sprache, sprache_flaeche, sprache_akzent, gelernt, total, xp")
    .order("sprache");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type Zeile = {
    sprache_code: string | null;
    sprache: string | null;
    sprache_flaeche: string | null;
    sprache_akzent: string | null;
    gelernt: number | null;
    total: number | null;
    xp: number | null;
  };

  const stats: SprachStat[] = ((data ?? []) as Zeile[]).map((row) => ({
    /*
     * `code` statt `id`. Der Schlüssel, über den die Wortschatz-Tabelle ihre
     * XP zuordnet, ist seit 0.1 genau das hier – vorher stand dort
     * `row.sprache.toLowerCase()`, also der Name, und die Tabelle suchte
     * wiederum das erste Wort davon. Bei Sets wie "Italienisch Alltag" und
     * "Italienisch Urlaub" fiel das nur deshalb nicht auf, weil beide Teile
     * zufällig gleich begannen.
     */
    code: row.sprache_code,
    sprache: row.sprache || UNBEKANNTE_SPRACHE.name,
    flaeche: row.sprache_flaeche || UNBEKANNTE_SPRACHE.flaeche,
    akzent: row.sprache_akzent || UNBEKANNTE_SPRACHE.akzent,
    gelernt: row.gelernt ?? 0,
    total: row.total ?? 0,
    xp: row.xp ?? 0,
  }));

  return NextResponse.json(stats, { headers: { "Cache-Control": "no-store" } });
}
