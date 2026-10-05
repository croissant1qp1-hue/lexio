import { NextResponse } from "next/server";
import { mitUserOder401 } from "@/lib/supabase/user";
import { holeSprachen, verlangteSprache } from "@/lib/sprachen-server";
import { migrationsMeldung } from "@/lib/db-fehler";

const MAX_NAME = 60;

type SetZeile = { id: string; name: string; user_id: string | null };

/**
 * Holt das Set und prueft, ob es dem angemeldeten Nutzer gehoert.
 *
 * Der Besitz wird zweimal geprueft, und das ist Absicht:
 *
 *  1. Hier, per user_id. Das ist die Prüfung, die dem Nutzer eine
 *     verständliche Meldung gibt ("das ist nicht dein Set").
 *  2. In der UPDATE- und DELETE-Policy der Migration 003. Das ist die
 *     Prüfung, die auch dann greift, wenn jemand die Route umgeht – etwa
 *     indem er die PostgREST-Adresse direkt aufruft. Ohne die zweite wäre
 *     das hier nur ein Hindernis, das man umgehen kann.
 *
 * PATCH und DELETE benutzen dieselbe Pruefung, sonst wäre es moeglich,
 * dass ein Set beim Umbenennen bearbeitbar ist und beim Loeschen nicht.
 */
async function eigenesSetOderFehler(
  supabase: Awaited<ReturnType<typeof mitUserOder401>>["supabase"],
  userId: string,
  slug: string,
): Promise<{ set: SetZeile } | { antwort: NextResponse }> {
  if (!slug) {
    return {
      antwort: NextResponse.json({ error: "Parameter 'slug' fehlt" }, { status: 400 }),
    };
  }

  const { data, error } = await supabase
    .from("karteikarten_sets")
    .select("id, name, user_id")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    return { antwort: NextResponse.json({ error: error.message }, { status: 500 }) };
  }
  if (!data) {
    return { antwort: NextResponse.json({ error: "Set nicht gefunden" }, { status: 404 }) };
  }

  /*
   * Demosets haben user_id = null. Sie sind fuer alle da und gehoeren
   * niemandem, also sind sie auch nicht bearbeitbar – weder ueber diese
   * Route noch ueber die Policy. "user_id = meins" allein wuerde ein
   * fremdes privates Set durchlassen; deshalb wird null getrennt
   * abgefangen.
   */
  if (data.user_id === null) {
    return {
      antwort: NextResponse.json(
        { error: "Vorgefertigte Sets lassen sich nicht bearbeiten." },
        { status: 403 },
      ),
    };
  }
  if (data.user_id !== userId) {
    return { antwort: NextResponse.json({ error: "Set nicht gefunden" }, { status: 404 }) };
  }

  return { set: data };
}

/**
 * Aendert Name und/oder Sprache eines eigenen Vokabel-Sets.
 *
 * Der `slug` bleibt dabei absichtlich unangetastet. Er ist der stabile Teil
 * der Adresse: die Lernansicht wird ueber /lernen/[id] aufgerufen, aber alte
 * Lesezeichen und geteilte Links zeigen auf den Slug. Wuerde er sich mit dem
 * Namen mitbewegen, waeren diese Links nach dem ersten Rename tot. Ein Slug,
 * der nicht mehr zum Namen passt, ist nur unschoen; ein toter Link ist
 * unbrauchbar.
 *
 * Die Freitextspalte `sprache` wird mitgeschrieben, sonst stehen nach einem
 * Sprachwechsel Name und Sprache_code auseinander. Sie wird erst in Phase 4
 * entfernt.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { supabase, user, antwort: nichtAngemeldet } = await mitUserOder401();
  if (nichtAngemeldet) return nichtAngemeldet;

  const { slug } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const { name, spracheCode } = (body ?? {}) as { name?: unknown; spracheCode?: unknown };

  const willName = name !== undefined;
  const willSprache = spracheCode !== undefined;

  if (!willName && !willSprache) {
    return NextResponse.json(
      { error: "Nichts zu ändern – Name oder Sprache schicken." },
      { status: 400 },
    );
  }

  const aenderung: Record<string, string> = {};

  if (willName) {
    const setzName = typeof name === "string" ? name.trim() : "";
    if (!setzName) {
      return NextResponse.json({ error: "Name fehlt" }, { status: 400 });
    }
    if (setzName.length > MAX_NAME) {
      return NextResponse.json({ error: `Maximal ${MAX_NAME} Zeichen` }, { status: 400 });
    }
    aenderung.name = setzName;
  }

  if (willSprache) {
    const { sprachen: sprachListe, fehler: sprachFehler } = await holeSprachen(supabase);
    if (sprachFehler) {
      return NextResponse.json(
        {
          error:
            "Die Sprachliste konnte nicht geladen werden. Bitte " +
            "supabase/migrations/005-sprachen-und-beisatz.sql im Supabase SQL Editor ausführen.",
        },
        { status: 503 },
      );
    }

    const sprache = verlangteSprache(sprachListe, spracheCode);
    if ("fehler" in sprache) {
      return NextResponse.json(
        { error: sprache.fehler, felder: { sprache: sprache.fehler } },
        { status: 400 },
      );
    }
    aenderung.sprache_code = sprache.code;
    aenderung.sprache = sprache.name;
  }

  const geprueft = await eigenesSetOderFehler(supabase, user.id, slug);
  if ("antwort" in geprueft) return geprueft.antwort;

  const { data, error } = await supabase
    .from("karteikarten_sets")
    .update(aenderung)
    .eq("id", geprueft.set.id)
    .eq("user_id", user.id)
    .select("id, slug, name, sprache_code, sprache")
    .single();

  if (error) {
    const migration = migrationsMeldung(error);
    if (migration) {
      return NextResponse.json({ error: migration }, { status: 503 });
    }
    // 42501 = RLS hat blockiert, also fehlt die UPDATE-Policy aus 003.
    if (error.code === "42501") {
      return NextResponse.json(
        {
          error:
            "Set konnte nicht geändert werden. Bitte die Migration " +
            "supabase/migrations/003-auth-und-user-daten.sql ausführen.",
        },
        { status: 403 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ set: data });
}

/**
 * Loescht ein eigenes Vokabel-Set samt aller Karten.
 *
 * Die Karten verschwinden ueber ON DELETE CASCADE in public.karten – die
 * Tabelle braucht dafuer keine eigene Policy.
 *
 * Bewusst kein undo: Postgres kennt keine Transaktionen ueber HTTP. Wer
 * versehentlich loescht, hat das Set weg. Die Uebersicht fragt deshalb vor
 * dem Loeschen nach, und nennt die Anzahl der Karten, die mit verschwinden.
 */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { supabase, user, antwort: nichtAngemeldet } = await mitUserOder401();
  if (nichtAngemeldet) return nichtAngemeldet;

  const { slug } = await context.params;

  const geprueft = await eigenesSetOderFehler(supabase, user.id, slug);
  if ("antwort" in geprueft) return geprueft.antwort;
  const set = geprueft.set;

  /*
   * Die Zahl ist eine Beigabe: sie steht in der Antwort, damit der Aufrufer
   * sagen kann, wieviel mitverschwunden ist. Sie ist aber kein Beweis fuer
   * die Loeschung – das ist der `.select("id")` unten.
   *
   * Deshalb wird ein Fehler hier NICHT zum Fehler der ganzen Route. Die
   * Loeschung ist zu diesem Zeitpunkt noch nicht passiert, und sie zu
   * verweigern, nur weil eine Nebenabfrage ins Timeout gelaufen ist, waere die
   * schlechtere Taeuschung: der Nutzer behaelt das Set und glaubt, es sei weg.
   *
   * `null` statt `0`. Eine erfundene Null ist schlimmer als eine fehlende Zahl:
   * "0 Woerter geloescht" liest sich wie eine Tatsache.
   */
  const { count: kartenAnzahl, error: zaehlFehler } = await supabase
    .from("karten")
    .select("id", { count: "exact", head: true })
    .eq("set_id", set.id);

  /**
   * `.select("id")` ist hier nicht Kosmetik: ohne das gibt supabase-js nur ein
   * `error` zurueck, und ein von RLS stillschweigend auf 0 Zeilen
   * reduziertes DELETE gilt darin als Erfolg. Die Route meldete dann
   * "geloescht", obwohl das Set munter weiter existiert. Mit `.select()`
   * kommen die betroffenen Zeilen zurueck – wenn keine kommt, wurde nichts
   * geloescht, und das wird auch so gemeldet.
   */
  const { data: geloescht, error: loeschFehler } = await supabase
    .from("karteikarten_sets")
    .delete()
    .eq("id", set.id)
    .eq("user_id", user.id)
    .select("id");

  if (loeschFehler) {
    return NextResponse.json({ error: loeschFehler.message }, { status: 500 });
  }

  if (!geloescht || geloescht.length === 0) {
    return NextResponse.json(
      {
        error:
          "Set konnte nicht gelöscht werden. Die Löschrechte fehlen – bitte die " +
          "Migration supabase/migrations/003-auth-und-user-daten.sql ausführen.",
      },
      { status: 403 },
    );
  }

  return NextResponse.json({
    geloescht: {
      slug,
      name: set.name,
      karten: zaehlFehler ? null : (kartenAnzahl ?? 0),
    },
  });
}
