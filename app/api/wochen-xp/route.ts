import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { WochenXpTyp } from "@/lib/types";

//Index 0 = Sonntag, wie bei Date.getUTCDay()
const WOCHENTAGE = ["so", "mo", "di", "mi", "do", "fr", "sa"] as const;

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("xp_pro_tag")
    .select("datum, xp")
    .order("datum");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const wochenXp: WochenXpTyp = { mo: 0, di: 0, mi: 0, do: 0, fr: 0, sa: 0, so: 0 };

  for (const row of data) {
    //UTC verhindert, dass ein Datum near Mitternacht in den falschen Wochentag rutscht
    const tagIndex = new Date(`${row.datum}T00:00:00Z`).getUTCDay();
    wochenXp[WOCHENTAGE[tagIndex]] = row.xp ?? 0;
  }

  return NextResponse.json(wochenXp);
}
