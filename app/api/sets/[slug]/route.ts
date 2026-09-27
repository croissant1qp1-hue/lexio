import { NextResponse } from "next/server";
import { mitUserOder401 } from "@/lib/supabase/user";

/**
 * Loescht ein eigenes Vokabel-Set samt aller Karten.
 *
 * Die Karten verschwinden ueber ON DELETE CASCADE in public.karten – die
 * Tabelle braucht dafuer keine eigene Policy.
 *
 * Der Besitz wird zweimal geprueft, und das ist Absicht:
 *
 *  1. Hier, per user_id. Das ist die Prüfung, die dem Nutzer eine
 *     verständliche Meldung gibt ("das ist nicht dein Set").
 *  2. In der DELETE-Policy der Migration 003. Das ist die Prüfung, die
 *     auch dann greift, wenn jemand die Route umgeht – etwa indem er die
 *     PostgREST-Adresse direkt aufruft. Ohne die zweite wäre das hier nur
 *     ein Hindernis, das man umgehen kann.
 *
 * Bewusst kein undo: Postgres kennt keine Transaktionen ueber HTTP. Wer
 * versehentlich loescht, hat das Set weg. Die Uebersicht fragt deshalb vor
 * dem Loeschen per confirm() nach.
 */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { supabase, user, antwort: nichtAngemeldet } = await mitUserOder401();
  if (nichtAngemeldet) return nichtAngemeldet;

  const { slug } = await context.params;

  if (!slug) {
    return NextResponse.json({ error: "Parameter 'slug' fehlt" }, { status: 400 });
  }

  // Erst das Set holen, damit die Antwort weiss, was verschwunden ist.
  const { data: set, error: setFehler } = await supabase
    .from("karteikarten_sets")
    .select("id, name, user_id")
    .eq("slug", slug)
    .maybeSingle();

  if (setFehler) {
    return NextResponse.json({ error: setFehler.message }, { status: 500 });
  }
  if (!set) {
    return NextResponse.json({ error: "Set nicht gefunden" }, { status: 404 });
  }

  /*
   * Demosets haben user_id = null. Sie sind fuer alle da und gehoeren
   * niemandem, also sind sie auch nicht loeschbar – weder ueber diese
   * Route noch ueber die Policy. "user_id = meins" allein wuerde ein
   * fremdes privates Set durchlassen; deshalb wird null getrennt
   * abgefangen.
   */
  if (set.user_id === null) {
    return NextResponse.json(
      { error: "Vorgefertigte Sets lassen sich nicht löschen." },
      { status: 403 },
    );
  }
  if (set.user_id !== user.id) {
    return NextResponse.json({ error: "Set nicht gefunden" }, { status: 404 });
  }

  const { count: kartenAnzahl } = await supabase
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
          "Migration supabase/003-auth-und-user-daten.sql ausführen.",
      },
      { status: 403 },
    );
  }

  return NextResponse.json({ geloescht: { slug, name: set.name, karten: kartenAnzahl ?? 0 } });
}
