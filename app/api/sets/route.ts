import { NextResponse } from "next/server";
import { mitUserOder401 } from "@/lib/supabase/user";
import { slugifySetzName } from "@/lib/set-slug";

const MAX_NAME = 60;

/**
 * Grenze fuer die Sprache. Der Wert wird fuer die Sprachfarbe benutzt
 * (lib/sprachen-farbe.ts) und steht als Beschriftung auf der Kachel. 40
 * Zeichen reichen fuer "Italienisch (Suedtirol)" und halten die Kachel
 * lesbar. Muss mit der Grenze im Wizard uebereinstimmen – sonst schlaegt der
 * Server eine Eingabe ab, die das Formular als gueltig durchgelassen hat.
 */
const MAX_SPRACHE = 40;

/**
 * Legt ein neues Vokabel-Set an.
 *
 * Wird der Name schon vergeben, bekommt das Set ein numerisches Suffix
 * ("italienisch-urlaub-2"). Ohne das wuerde der unique-Constraint auf slug
 * bei jedem zweiten "Reise" ins Bild scheitern, und der Nutzer muesste den
 * Fehler erraten, statt eine klare Meldung zu bekommen.
 *
 * `user_id` wird aus der Session gesetzt, nicht aus dem Body. Ein Feld, das
 * der Aufrufer selbst setzen darf, ist ein Feld, in das jeder seine eigene
 * uid schreiben und damit die Anonymfilterung umgehen kann.
 */
export async function POST(request: Request) {
  const { supabase, user, antwort: nichtAngemeldet } = await mitUserOder401();
  if (nichtAngemeldet) return nichtAngemeldet;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const { name, sprache } = (body ?? {}) as { name?: unknown; sprache?: unknown };

  const setzName = typeof name === "string" ? name.trim() : "";
  const setzSprache = typeof sprache === "string" && sprache.trim() ? sprache.trim() : "";

  if (!setzName) {
    return NextResponse.json({ error: "Name fehlt" }, { status: 400 });
  }
  if (setzName.length > MAX_NAME) {
    return NextResponse.json({ error: `Maximal ${MAX_NAME} Zeichen` }, { status: 400 });
  }
  if (!setzSprache) {
    return NextResponse.json({ error: "Sprache fehlt" }, { status: 400 });
  }
  if (setzSprache.length > MAX_SPRACHE) {
    return NextResponse.json({ error: `Maximal ${MAX_SPRACHE} Zeichen` }, { status: 400 });
  }

  const basis = slugifySetzName(setzName);

  // Bis zu 20 Varianten probieren. Danach ist der Name entweder absurd
  // spezifisch oder es liegt ein anderes Problem vor.
  for (let versuch = 1; versuch <= 20; versuch++) {
    const slug = versuch === 1 ? basis : `${basis}-${versuch}`;

    const { data: vorhanden } = await supabase
      .from("karteikarten_sets")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (vorhanden) continue;

    const { data, error } = await supabase
      .from("karteikarten_sets")
      .insert({
        slug,
        name: setzName,
        sprache: setzSprache,
        anzahl_karten: 0,
        eigenes_set: true,
        user_id: user.id,
      })
      .select("id, slug, name, sprache")
      .single();

    if (error) {
      /*
       * 42501 = insufficient_privilege, also RLS hat blockiert. Kommt vor,
       * wenn 003 nicht gelaufen ist, denn dann kennt die Tabelle user_id
       * noch gar nicht. Die Meldung sagt das so, statt "Internal Server
       * Error" – der Nutzer kann mit "Serverfehler" nichts anfangen, mit dem
       * Namen der Migration schon.
       */
      if (error.code === "42501") {
        return NextResponse.json(
          {
            error:
              "Set konnte nicht angelegt werden. Bitte die Migration " +
              "supabase/003-auth-und-user-daten.sql ausführen.",
          },
          { status: 403 },
        );
      }

      // 23505 = unique verletzt. Kann ein Wettlauf zweier Tabs sein; dann
      // einfach die naechste Variante versuchen statt den Nutzer zu stoeren.
      if (error.code === "23505") continue;

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ set: data }, { status: 201 });
  }

  return NextResponse.json(
    { error: "Es konnte kein freier Name gefunden werden. Bitte einen anderen Namen wählen." },
    { status: 409 },
  );
}
