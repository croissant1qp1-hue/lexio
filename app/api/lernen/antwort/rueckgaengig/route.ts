import { NextResponse } from "next/server";
import { mitUserOder401 } from "@/lib/supabase/user";

/**
 * Nimmt die zuletzt gespeicherte Antwort einer Karte zurueck (Plan 1.7).
 *
 * Der Server stellt den VORHER-Zustand der Zeile in karten_fortschritt aus
 * dem Snapshot wieder her, den antwort_verbuchen bei der Antwort gelegt hat,
 * und zieht die XP des Tages ab. Der Client merkt sich parallel den Stand
 * seiner Runde; was hier zurueckkommt (xpGesamt, streak), ist die Zahl nach
 * der Ruecknahme.
 *
 * Es gibt keinen Hollerithmus fuer "die zweitletzte Antwort": der Snapshot
 * wird bei jeder neuen Antwort ueberschrieben.
 */
export async function POST(request: Request) {
  const { supabase, antwort: nichtAngemeldet } = await mitUserOder401();
  if (nichtAngemeldet) return nichtAngemeldet;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const { kartenId } = (body ?? {}) as { kartenId?: unknown };

  if (typeof kartenId !== "string" || !kartenId) {
    return NextResponse.json({ error: "kartenId fehlt" }, { status: 400 });
  }

  const { data: ergebnis, error: rpcFehler } = await supabase.rpc("antwort_rueckgaengig", {
    p_karte_id: kartenId,
  });

  if (rpcFehler) {
    /*
     * Fehlerbild identisch zur Antwort-Route: P0002 ist die Karte, die diese
     * Person nicht sehen darf (oder die es nicht gibt), 42501 die fehlende
     * Migration, 42883/42P01 dasselbe fuer Funktion und Tabelle.
     */
    if (rpcFehler.code === "P0002") {
      return NextResponse.json({ error: "Karte nicht gefunden" }, { status: 404 });
    }
    if (rpcFehler.code === "42501") {
      return NextResponse.json(
        {
          error:
            "Antwort konnte nicht zurückgenommen werden. Bitte die Migration " +
            "supabase/migrations/009-leech-und-rueckgaengig.sql ausführen.",
        },
        { status: 403 },
      );
    }
    if (rpcFehler.code === "42883" || rpcFehler.code === "42P01") {
      // Funktion oder Tabelle fehlt: 009 nicht gelaufen.
      return NextResponse.json(
        { error: "Rückgängig ist nicht eingerichtet – Migration 009 fehlt." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: rpcFehler.message }, { status: 500 });
  }

  const werte = (ergebnis ?? {}) as { erledigt?: boolean; xpGesamt?: number };

  /*
   * Streak nachziehen, wie in der Antwort-Route: der Streak haengt an den
   * XP des Tages, und die Ruecknahme kann genau die erste Zahl des Tages
   * wieder abbauen. Fehlt die View (Migration 003), ist streak null – der
   * Client haelt seinen alten Wert.
   */
  const { data: stand } = await supabase
    .from("mein_fortschritt")
    .select("streak")
    .maybeSingle();

  return NextResponse.json({
    erledigt: werte.erledigt === true,
    xpGesamt: werte.xpGesamt ?? 0,
    streak: typeof stand?.streak === "number" ? stand.streak : null,
  });
}