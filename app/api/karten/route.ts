import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MAX_LAENGE = 200;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const { setSlug, frage, antwort } = (body ?? {}) as {
    setSlug?: unknown;
    frage?: unknown;
    antwort?: unknown;
  };

  const frageText = typeof frage === "string" ? frage.trim() : "";
  const antwortText = typeof antwort === "string" ? antwort.trim() : "";
  const slug = typeof setSlug === "string" ? setSlug.trim() : "";

  const fehler: Record<string, string> = {};
  if (!slug) fehler.setSlug = "Sprache fehlt";
  if (!frageText) fehler.frage = "Begriff fehlt";
  if (frageText.length > MAX_LAENGE) fehler.frage = `Maximal ${MAX_LAENGE} Zeichen`;
  if (!antwortText) fehler.antwort = "Übersetzung fehlt";
  if (antwortText.length > MAX_LAENGE)
    fehler.antwort = `Maximal ${MAX_LAENGE} Zeichen`;

  if (Object.keys(fehler).length > 0) {
    return NextResponse.json({ error: "Eingabe unvollständig", felder: fehler }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: set, error: setFehler } = await supabase
    .from("karteikarten_sets")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (setFehler) {
    return NextResponse.json({ error: setFehler.message }, { status: 500 });
  }
  if (!set) {
    return NextResponse.json({ error: "Sprache nicht gefunden" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("karten")
    .insert({
      set_id: set.id,
      frage: frageText,
      antwort: antwortText,
      faellig_am: new Date().toISOString().slice(0, 10),
    })
    .select("id, frage, antwort")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ karte: data }, { status: 201 });
}
