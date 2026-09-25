import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { TagesXpTyp } from "@/lib/types";

export async function GET() {
  const supabase = await createClient();
  const heute = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("xp_pro_tag")
    .select("xp, ziel")
    .eq("datum", heute)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  //Kein Eintrag fuer heute heisst: heute noch nichts gelernt. Kein Fehler.
  const tagesXp: TagesXpTyp = {
    erreicht: data?.xp ?? 0,
    ziel: data?.ziel ?? 0,
    updatedAt: new Date().toISOString(),
  };

  return NextResponse.json(tagesXp);
}
