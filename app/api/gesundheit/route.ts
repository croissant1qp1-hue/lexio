import { NextResponse } from "next/server";
import { pruefeGesundheit } from "@/lib/gesundheit";

/**
 * GET /api/gesundheit – public, absichtlich.
 *
 * Diese Route wird von der Anmeldeseite aufgerufen, also von jemandem, der
 * noch nicht angemeldet ist. Sie sagt ausschliesslich, welche Schalter im
 * Supabase-Dashboard noch fehlen – keine Daten, keine Schluessel, keine
 * Namen. Wer sie aufruft, erfährt nichts, was er nicht auch durch Raten
 * wüsste: ob die Datenbank erreichbar ist, ob die Migration fehlt, ob
 * Registrierung offen ist.
 *
 * Ohne Session-Refresh im Proxy nötig: die Antwort ist für alle gleich.
 */
export async function GET() {
  try {
    const bericht = await pruefeGesundheit();
    return NextResponse.json(bericht, {
      // Kurz cachen. Nicht "no-store": auf jeder Seite ein neuer Aufruf
      // bedeutet auf dem Handy ein zweiter Roundtrip, bevor irgendetwas
      // erscheint. 30 Sekunden Verzoegerung beim Nachrueckleiten eines
      // Schalters im Dashboard sind kein Preis.
      headers: { "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=120" },
    });
  } catch {
    // Die Route darf nie der Grund sein, dass die Anmeldeseite leer bleibt.
    return NextResponse.json(
      { datenbankBereit: false, erreichbar: false, fehlend: ["Die Prüfung ist fehlgeschlagen."], aufgaben: [] },
      { status: 200 },
    );
  }
}
