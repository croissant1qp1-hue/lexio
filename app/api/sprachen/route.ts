import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { holeSprachen } from "@/lib/sprachen-server";

/**
 * Die Sprachliste, nach public.sprachen.
 *
 * Öffentlich, und das ist Absicht: public.sprachen ist öffentlich lesbar
 * (005:212-219), und die Liste ist kein Nutzerbezug. Eine Anmeldungspflicht
 * hätte nur den Effekt, dass das Sprachfeld beim Import für nicht
 * angemeldete Besucher leer bliebe – also genau dort, wo man die Liste
 * braucht, um zu sehen, dass es sie gibt.
 *
 * Zwölf Zeilen, ohne Geheimnis darin. Was hier nicht steht, ist die Sets-
 * Tabelle: die bleibt hinter der Anmeldung (003).
 */
export async function GET() {
  const supabase = await createClient();

  const { sprachen, fehler } = await holeSprachen(supabase);

  if (fehler) {
    /*
     * PGRST205 heißt "die Tabelle gibt es nicht". Praktisch heisst das:
     * Migration 005 ist nicht gelaufen. Der Klartext ist wichtig – ohne ihn
     * sieht ein leeres Sprachfeld nach einem Fehler in der App aus, und der
     * Nutzer kann nichts daran machen.
     */
    if (fehler.includes("PGRST205") || fehler.includes("sprachen")) {
      return NextResponse.json(
        {
          error:
            "Die Sprachliste fehlt in der Datenbank. Bitte " +
            "supabase/005-sprachen-und-beisatz.sql im Supabase SQL Editor ausführen.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: fehler }, { status: 500 });
  }

  return NextResponse.json(sprachen, {
    // Kurz im Browser, zehn Minuten davor. Die Liste ändert sich selten, und
    // jeder Aufruf von hier ist ein Aufruf bei Supabase.
    headers: { "Cache-Control": "public, max-age=60, s-maxage=600" },
  });
}
