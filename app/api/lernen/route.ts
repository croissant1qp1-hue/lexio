import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MAX_KARTEN = 20;

export async function GET(request: Request) {
  const setSlug = new URL(request.url).searchParams.get("set");

  if (!setSlug) {
    return NextResponse.json({ error: "Parameter 'set' fehlt" }, { status: 400 });
  }

  const supabase = await createClient();
  const heute = new Date().toISOString().slice(0, 10);

  const { data: set, error: setFehler } = await supabase
    .from("karteikarten_sets")
    .select("id, slug, name, sprache")
    .eq("slug", setSlug)
    .maybeSingle();

  if (setFehler) {
    return NextResponse.json({ error: setFehler.message }, { status: 500 });
  }
  if (!set) {
    return NextResponse.json({ error: "Sprache nicht gefunden" }, { status: 404 });
  }

  //Faellige zuerst, danach die mit der niedrigsten Stufe. Neue Karten haben
  //Stufe 0 und kommen dadurch vor, ohne eine zweite Query zu brauchen.
  const { data, error } = await supabase
    .from("karten")
    .select("id, frage, antwort, stufe, gelernt, treffer, fehler")
    .eq("set_id", set.id)
    .lte("faellig_am", heute)
    .order("stufe", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(MAX_KARTEN);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    set: { slug: set.slug, name: set.name, sprache: set.sprache },
    karten: data,
    faelligGesamt: data.length,
  });
}
