import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { SprachStat } from "@/lib/types";

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("statistik_pro_sprache")
    .select("sprache, gelernt, total, xp")
    .order("sprache");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const stats: SprachStat[] = data.map((row) => ({
    id: row.sprache.toLowerCase(),
    sprache: row.sprache,
    gelernt: row.gelernt ?? 0,
    total: row.total ?? 0,
    xp: row.xp ?? 0,
  }));

  return NextResponse.json(stats);
}
