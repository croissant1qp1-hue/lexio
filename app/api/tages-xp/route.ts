import { NextResponse } from "next/server";
import { mitUserOder401 } from "@/lib/supabase/user";
import type { TagesXpTyp } from "@/lib/types";

/** Tagesziel, wenn fuer heute noch keine Zeile existiert. */
const STANDARD_ZIEL = 20;

export async function GET() {
  const { supabase, antwort: nichtAngemeldet } = await mitUserOder401();
  if (nichtAngemeldet) return nichtAngemeldet;

  const heute = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("xp_pro_tag")
    .select("xp, ziel")
    .eq("datum", heute)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  /*
   * Kein Eintrag fuer heute heisst: heute noch nichts gelernt. Kein Fehler.
   *
   * Das ziel war `data?.ziel ?? 0`. Damit stand vor dem ersten Klick "0 von
   * 0" da, und ein Balken, dessen Fuellung 0/0 ist, ist in jedem Browser
   * entweder voll oder leer – meistens voll. Der Nutzer sieht eine fertige
   * Tagesleistung, die er nicht gebracht hat. Deshalb der Standardwert.
   */
  const tagesXp: TagesXpTyp = {
    erreicht: data?.xp ?? 0,
    ziel: data?.ziel || STANDARD_ZIEL,
    updatedAt: new Date().toISOString(),
  };

  return NextResponse.json(tagesXp, { headers: { "Cache-Control": "no-store" } });
}
