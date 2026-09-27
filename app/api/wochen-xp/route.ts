import { NextResponse } from "next/server";
import { mitUserOder401 } from "@/lib/supabase/user";
import type { WochenXpTyp } from "@/lib/types";

// Index 0 = Sonntag, wie bei Date.getUTCDay()
const WOCHENTAGE = ["so", "mo", "di", "mi", "do", "fr", "sa"] as const;

type Wochenschluessel = keyof WochenXpTyp;

/**
 * XP der aktuellen Kalenderwoche, Montag bis Sonntag.
 *
 * Vorher wurden ALLE sieben zurueckliegenden Tage gelesen und ueber
 * `wochenXp[WOCHENTAGE[tagIndex]] = ...` in dieselbe Tasche gepackt. Diese
 * Tasche hat sieben Felder, das Datum siebenmal – und der Montag von
 * vorletzter Woche landete im selben Feld wie der Montag von dieser. Was
 * uebrig blieb, waren die juengsten sieben Tage, nicht die Woche. Der
 * Dienstag zeigte den XP-Wert des Dienstags von vor sieben Tagen.
 *
 * Die Grenzen kommen deshalb aus dem Datum, nicht aus der Liste.
 */
export async function GET() {
  const { supabase, antwort: nichtAngemeldet } = await mitUserOder401();
  if (nichtAngemeldet) return nichtAngemeldet;

  const jetzt = new Date();

  /*
   * UTC ueberall. Mit lokaler Zeit passiert zweimal im Jahr der aehnliche
   * Fehler: Sonntag 23:30 Ortszeit ist in UTC schon Montag, die Woche
   * springt, und der Samstag faellt aus dem Diagramm.
   */
  const heute = new Date(
    Date.UTC(jetzt.getUTCFullYear(), jetzt.getUTCMonth(), jetzt.getUTCDate()),
  );

  // getUTCDay(): 0 = Sonntag. Montag ist damit -1, nicht 1.
  const montag = new Date(heute);
  montag.setUTCDate(montag.getUTCDate() - ((heute.getUTCDay() + 6) % 7));

  const sonntag = new Date(montag);
  sonntag.setUTCDate(sonntag.getUTCDate() + 6);

  const alsIso = (d: Date) => d.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("xp_pro_tag")
    .select("datum, xp")
    .gte("datum", alsIso(montag))
    .lte("datum", alsIso(sonntag))
    .order("datum");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const wochenXp: WochenXpTyp = { mo: 0, di: 0, mi: 0, do: 0, fr: 0, sa: 0, so: 0 };

  for (const row of data ?? []) {
    const schluessel = WOCHENTAGE[new Date(`${row.datum}T00:00:00Z`).getUTCDay()] as Wochenschluessel;
    wochenXp[schluessel] = row.xp ?? 0;
  }

  return NextResponse.json(wochenXp, {
    headers: { "Cache-Control": "no-store" },
  });
}
