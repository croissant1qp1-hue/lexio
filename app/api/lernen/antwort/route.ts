import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  faelligAb,
  istBewertung,
  stufeNachAntwort,
  xpFuerBewertung,
} from "@/lib/lernlogik";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const { kartenId, bewertung } = (body ?? {}) as {
    kartenId?: unknown;
    bewertung?: unknown;
  };

  if (typeof kartenId !== "string" || !kartenId) {
    return NextResponse.json({ error: "kartenId fehlt" }, { status: 400 });
  }
  if (!istBewertung(bewertung)) {
    return NextResponse.json({ error: "Ungültige Bewertung" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: karte, error: leseFehler } = await supabase
    .from("karten")
    .select("id, stufe, set_id, treffer, fehler")
    .eq("id", kartenId)
    .maybeSingle();

  if (leseFehler) {
    return NextResponse.json({ error: leseFehler.message }, { status: 500 });
  }
  if (!karte) {
    return NextResponse.json({ error: "Karte nicht gefunden" }, { status: 404 });
  }

  const neueStufe = stufeNachAntwort(karte.stufe, bewertung);
  const richtig = bewertung !== "nochmal";
  const xp = xpFuerBewertung(bewertung);

  const { error: schreibFehler } = await supabase
    .from("karten")
    .update({
      stufe: neueStufe,
      gelernt: richtig,
      faellig_am: faelligAb(neueStufe),
      letzte_wiederholung: new Date().toISOString(),
      treffer: karte.treffer + (richtig ? 1 : 0),
      fehler: karte.fehler + (richtig ? 0 : 1),
    })
    .eq("id", kartenId);

  if (schreibFehler) {
    return NextResponse.json({ error: schreibFehler.message }, { status: 500 });
  }

  //XP brauchen eine angemeldete Person: xp_events verweist per Fremdschluessel
  //auf auth.users. Ohne Session wird nichts geschrieben, der Client zeigt den
  //Punktestand trotzdem sofort an. Sobald Auth laeuft, wandert er in die DB.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let xpGespeichert = false;
  if (user) {
    const heute = new Date().toISOString().slice(0, 10);
    const { data: bestehend } = await supabase
      .from("xp_events")
      .select("id, xp")
      .eq("user_id", user.id)
      .eq("datum", heute)
      .maybeSingle();

    if (bestehend) {
      const { error } = await supabase
        .from("xp_events")
        .update({ xp: bestehend.xp + xp })
        .eq("id", bestehend.id);
      xpGespeichert = !error;
    } else {
      const { error } = await supabase.from("xp_events").insert({
        user_id: user.id,
        set_id: karte.set_id,
        datum: heute,
        xp,
        ziel: 20,
      });
      xpGespeichert = !error;
    }
  }

  return NextResponse.json({
    xp,
    neueStufe,
    naechsteWiederholung: faelligAb(neueStufe),
    xpGespeichert,
  });
}
