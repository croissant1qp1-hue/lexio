import { NextResponse } from "next/server";
import { mitUserOder401 } from "@/lib/supabase/user";
import {
  faelligAb,
  istBewertung,
  stufeNachAntwort,
  xpFuerBewertung,
} from "@/lib/lernlogik";

/**
 * Verbucht eine Antwort: Fortschritt der Karte und XP des Tages.
 *
 * Beides passiert in einem Aufruf an public.antwort_verbuchen und damit in
 * einer Transaktion. Vorher waren es zwei HTTP-Aufrufe: der Fortschritt
 * wurde geschrieben, dann die XP. Klickte man schnell genug, war der
 * Zaehler leer, obwohl die Karte weitergewandert war – oder umgekehrt.
 *
 * Die Stufenlogik bleibt hier in TypeScript, damit die Regeln an einer
 * Stelle stehen. Die Funktion in der Datenbank schreibt nur, sie rechnet
 * nicht.
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

  /*
   * Die Karte lesen, um die aktuelle Stufe zu kennen. Das ist kein Schreib-
   * Zugriff, sondern die Grundlage fuer die Berechnung: ohne den Wert ginge
   * "gut" von einem falschen Ausgangspunkt aus.
   *
   * Die RLS-Policy auf public.karten filtert fremde Karten heraus. Ein
   * fremdes Set liefert daher `null` – und die Karte ist fuer diese Person
   * genauso nicht existent wie eine, die es nicht gibt.
   */
  const { data: karte, error: leseFehler } = await supabase
    .from("karten")
    .select("id, set_id")
    .eq("id", kartenId)
    .maybeSingle();

  if (leseFehler) {
    return NextResponse.json({ error: leseFehler.message }, { status: 500 });
  }
  if (!karte) {
    return NextResponse.json({ error: "Karte nicht gefunden" }, { status: 404 });
  }

  /*
   * Den eigenen Fortschritt lesen, nicht den der Karte. public.karten.stufe
   * ist seit 003 Altlast: sie beschreibt niemanden mehr, seit alle denselben
   * Wert fuer alle sehen wuerden.
   */
  const { data: eigener, error: fortschrittFehler } = await supabase
    .from("karten_fortschritt")
    .select("stufe")
    .eq("karte_id", kartenId)
    .maybeSingle();

  if (fortschrittFehler) {
    return NextResponse.json({ error: fortschrittFehler.message }, { status: 500 });
  }

  const aktuelleStufe = eigener?.stufe ?? 0;
  const neueStufe = stufeNachAntwort(aktuelleStufe, bewertung);

  /*
   * gelernt ist seit Migration 007 ehrlich: erst ab Stufe 2 zaehlt eine
   * Karte. Vorher war `gelernt = bewertung !== "nochmal"`, und eine mit
   * "schwer" beantwortete Karte stand auf Stufe 0, war heute noch faellig
   * und fuellte trotzdem den Balken. gesehen ist eine eigene Sache: die
   * Karte wurde beantwortet, ob sie sitzt, weiss die Stufe.
   */
  const gelernt = neueStufe >= 2;
  const gesehen = true;
  const xp = xpFuerBewertung(bewertung);

  const { data: ergebnis, error: rpcFehler } = await supabase.rpc("antwort_verbuchen", {
    p_karte_id: kartenId,
    p_set_id: karte.set_id,
    p_bewertung: bewertung,
    p_neue_stufe: neueStufe,
    p_gelernt: gelernt,
    p_faellig_am: faelligAb(neueStufe),
    p_xp: xp,
    p_gesehen: gesehen,
  });

  if (rpcFehler) {
    /*
     * 42501 = insufficient_privilege, P0002 = raise_exception aus der
     * Funktion. Im zweiten Fall sagt die Meldung der Funktion mehr als
     * "Internal Server Error" – die wird deshalb durchgereicht.
     */
    if (rpcFehler.code === "P0002") {
      return NextResponse.json({ error: "Karte nicht gefunden" }, { status: 404 });
    }
    if (rpcFehler.code === "42501") {
      return NextResponse.json(
        {
          error:
            "Antwort konnte nicht gespeichert werden. Bitte die Migration " +
            "supabase/migrations/003-auth-und-user-daten.sql ausführen.",
        },
        { status: 403 },
      );
    }
    if (rpcFehler.code === "42883" || rpcFehler.code === "42P01") {
      // Funktion oder Tabelle fehlt: 003 nicht gelaufen.
      return NextResponse.json(
        { error: "Lernfortschritt ist nicht eingerichtet – Migration 003 fehlt." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: rpcFehler.message }, { status: 500 });
  }

  const werte = (ergebnis ?? {}) as { xp?: number; neueStufe?: number; xpGesamt?: number };

  /*
   * Streak nachziehen.
   *
   * Der Streak haengt daran, ob es heute schon XP gab, und diese Zeile in
   * public.xp_events entsteht erst durch den Aufruf von eben. Die Kopfzeile
   * der Lernansicht zeigte deshalb nach der ersten Antwort des Tages noch
   * eine Serie von 0 – bei 30 angezeigten XP. Die Navbar hatte die Zahl
   * richtig, weil sie ihre Daten beim Rendern holt.
   *
   * Deshalb geht hier ein zweiter, winziger Select an die View. Fehlt sie
   * (Migration 003 nicht gelaufen), ist `streak` null: der Client haelt dann
   * seinen alten Wert, statt auf 0 zurueckzuspringen. Bewusst kein Fehler –
   * die Antwort selbst ist ja gespeichert.
   */
  const { data: stand } = await supabase
    .from("mein_fortschritt")
    .select("streak")
    .maybeSingle();

  return NextResponse.json({
    xp: werte.xp ?? xp,
    neueStufe: werte.neueStufe ?? neueStufe,
    xpGesamt: werte.xpGesamt ?? 0,
    streak: typeof stand?.streak === "number" ? stand.streak : null,
    naechsteWiederholung: faelligAb(werte.neueStufe ?? neueStufe),
    // Erfolgreich gespeichert. Frueher stand hier ein `xpGespeichert`, das
    // false sein konnte, ohne dass der Client etwas getan haette – der
    // Punktestand war dann weg und niemand wusste warum.
    xpGespeichert: true,
  });
}
