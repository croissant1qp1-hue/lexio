import { NextResponse } from "next/server";
import { mitUserOder401 } from "@/lib/supabase/user";
import type { SpracheInfo } from "@/lib/sprachen";
import { UNBEKANNTE_SPRACHE } from "@/lib/sprachen";
import { holeSprachen, spracheNachCode } from "@/lib/sprachen-server";

/**
 * Obergrenze fuer die Wortliste.
 *
 * Die Lern-Route zieht je Set bis zu 1000 Karten, jedes eigene Set darf diese
 * Grosse erreichen. Ueber mehrere Sets hinweg sind daher realistisch einige
 * tausend Eintraege moeglich. Die Wortliste ist eine Uebersicht mit Suche,
 * kein Lerndurchlauf; eine feste Obergrenze verhindert, dass eine einzelne
 * Abfrage die API sprengt. Uebertriebene Konten kommen spaeter auf
 * Paginierung.
 */
const MAX_KARTEN = 3000;

type KartenZeile = {
  id: string;
  frage: string;
  antwort: string;
  beispielsatz: string | null;
  beispiel_uebersetzung: string | null;
  set: {
    id: string;
    slug: string;
    name: string;
    sprache_code: string | null;
    sprache: string | null;
    eigenes_set: boolean | null;
    user_id: string | null;
  } | null;
};

type WortEintrag = {
  id: string;
  frage: string;
  antwort: string;
  beispielsatz: string | null;
  beispielUebersetzung: string | null;
  set: {
    id: string;
    name: string;
    sprache: SpracheInfo;
    eigen: boolean;
  } | null;
};

/**
 * Sprache aus dem eingebetteten Set, mit der Farbe aus public.sprachen.
 *
 * Die Farbspalten stehen nicht in der Tabelle `karteikarten_sets`, sondern
 * nur in der View `karteikarten_sets_uebersicht` (006). Bei `karten` ist die
 * eingebettete Beziehung die Tabelle ohne Farben – deshalb kommen Code und
 * Name aus dem Set und flaeche/akzent aus der Sprachliste, genau wie in der
 * Lern-Route. Fehlt der Code, ist die Sprache unbekannt: dann der Rückfall.
 */
function spracheAusSet(
  set: NonNullable<KartenZeile["set"]>,
  sprachen: Awaited<ReturnType<typeof holeSprachen>>["sprachen"],
): SpracheInfo {
  const bekannt = spracheNachCode(sprachen, set.sprache_code);
  if (bekannt) {
    return { code: bekannt.code, name: bekannt.name, flaeche: bekannt.flaeche, akzent: bekannt.akzent };
  }
  return { ...UNBEKANNTE_SPRACHE, name: set.sprache || UNBEKANNTE_SPRACHE.name };
}

/**
 * Alle Karten ueber alle sichtbaren Sets.
 *
 * Die Sichtbarkeit ruht auf der RLS-Policy von `karten` (003): eine Karte
 * ist lesbar, sobald ihr Set lesbar ist – und das sind globale und eigene
 * Sets, nie fremde private. Die Route muss deshalb keinen Besitz pruefen,
 * die Datenbank macht es auch gegen Direktaufrufe.
 */
export async function GET() {
  const { supabase, user, antwort: nichtAngemeldet } = await mitUserOder401();
  if (nichtAngemeldet) return nichtAngemeldet;

  const { data, error } = await supabase
    .from("karten")
    .select(
      "id, frage, antwort, beispielsatz, beispiel_uebersetzung, " +
        "set:karteikarten_sets(id, slug, name, sprache_code, sprache, eigenes_set, user_id)",
    )
    .order("frage", { ascending: true })
    .limit(MAX_KARTEN);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Sprachliste kommt in Ruhe, erst nach den Karten – bei einem Fehler dort
  // (z. B. Migration fehlt) bleiben die Wörter trotzdem sichtbar, nur ohne
  // Sprachfarbe. Die Karten sind wichtiger als ihre Farbe.
  const { sprachen } = await holeSprachen(supabase);

  const eintraege: WortEintrag[] = ((data ?? []) as unknown as KartenZeile[]).map((zeile) => ({
    id: zeile.id,
    frage: zeile.frage,
    antwort: zeile.antwort,
    beispielsatz: zeile.beispielsatz ?? null,
    beispielUebersetzung: zeile.beispiel_uebersetzung ?? null,
    set: zeile.set
      ? {
          id: zeile.set.slug,
          name: zeile.set.name,
          sprache: spracheAusSet(zeile.set, sprachen),
          // false heisst: Demoset. Die Oberflaeche darf eigene Sets
          // unterscheiden, z. B. fuer den Weg zur Set-Seite.
          eigen: zeile.set.user_id === user.id,
        }
      : null,
  }));

  return NextResponse.json(eintraege, { headers: { "Cache-Control": "no-store" } });
}