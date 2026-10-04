import { NextResponse } from "next/server";
import { mitUserOder401 } from "@/lib/supabase/user";
import { slugifySetzName } from "@/lib/set-slug";
import { holeSprachen, verlangteSprache } from "@/lib/sprachen-server";
import { migrationsMeldung } from "@/lib/db-fehler";

const MAX_NAME = 60;

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
 *
 * Die Sprache kommt als CODE und wird gegen public.sprachen geprueft. Vorher
 * stand hier ein Freitext mit einer Grenze von 40 Zeichen, und alles, was
 * oben eintraf, wurde als Sprache gespeichert: "Englisch", "englisch",
 * "Englisch Unterricht", "Englischkenntnisse". Vier Sets, vier Farben, von
 * denen keine zuordenbar war. Der Name ist damit abgeleitet und nicht mehr
 * eingegeben – dieselbe Sprache laesst sich nicht zweimal verschieden
 * schreiben.
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

  const { name, spracheCode } = (body ?? {}) as { name?: unknown; spracheCode?: unknown };

  const setzName = typeof name === "string" ? name.trim() : "";

  if (!setzName) {
    return NextResponse.json({ error: "Name fehlt" }, { status: 400 });
  }
  if (setzName.length > MAX_NAME) {
    return NextResponse.json({ error: `Maximal ${MAX_NAME} Zeichen` }, { status: 400 });
  }

  const { sprachen: sprachListe, fehler: sprachFehler } = await holeSprachen(supabase);

  if (sprachFehler) {
    /*
     * Kein Sprachcode, keine Sets. public.sprachen ist die Quelle fuer die
     * Sprache, also ist ein Ausfall dort kein Detail – ohne sie laesst sich
     * kein Set anlegen, und die Meldung muss das sagen.
     */
    return NextResponse.json(
      {
        error:
          "Die Sprachliste konnte nicht geladen werden. Bitte " +
          "supabase/005-sprachen-und-beisatz.sql im Supabase SQL Editor ausführen.",
      },
      { status: 503 },
    );
  }

  const sprache = verlangteSprache(sprachListe, spracheCode);
  if ("fehler" in sprache) {
    return NextResponse.json({ error: sprache.fehler, felder: { sprache: sprache.fehler } }, { status: 400 });
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
        // Die Freitextspalte ist NOT NULL und wird erst in Phase 4 entfernt.
        // Sie bekommt ab hier den Namen aus der Sprachliste geschrieben und
        // ist damit nur noch ein Abkömmling von sprache_code.
        sprache: sprache.name,
        sprache_code: sprache.code,
        anzahl_karten: 0,
        eigenes_set: true,
        user_id: user.id,
      })
      .select("id, slug, name, sprache_code, sprache")
      .single();


    if (error) {
      /*
       * Der Insert schreibt seit 0.1 auch `sprache_code`. Fehlt die Spalte
       * (005 nicht gelaufen), kommt 42703 mit dem Spaltennamen im Text – und
       * dann muss die Meldung 005 nennen, nicht 003.
       *
       * `migrationsMeldung` entscheidet das an EINER Stelle fuer die ganze
       * App: 42501 (RLS), 42703 und PGRST204 (Spalte fehlt), PGRST205 (Tabelle
       * fehlt). Auch 42501 ist damit schon behandelt – der Kommentar
       * behauptete hier etwas anderes und rief eine Meldung auf, die nie
       * erreicht wurde.
       *
       * Der 42501-Zweig ist deshalb weg. Nicht weil RLS nicht mehr zuschlagen
       * koennte, sondern weil die Antwort dann zweimal an zwei Orten
       * gepflegt wuerde und die Orte auseinanderlaufen.
       */
      const migration = migrationsMeldung(error);
      if (migration) {
        return NextResponse.json({ error: migration }, { status: 503 });
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
