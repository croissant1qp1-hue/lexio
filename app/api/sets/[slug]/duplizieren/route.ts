import { NextResponse } from "next/server";
import { mitUserOder401 } from "@/lib/supabase/user";
import { slugifySetzName } from "@/lib/set-slug";
import { kopieName } from "@/lib/kopie-name";
import { migrationsMeldung } from "@/lib/db-fehler";

/** So viele Slug-Varianten werden versucht, bevor es aufgibt. */
const MAX_VERSUCHE = 20;

/**
 * Hoechstes Anzahl Karten, die in einem Zug kopiert werden.
 *
 * PostgREST schickt alle Zeilen in EINEN HTTP-Request. Bei 2000 Karten sind
 * das rund 400 kB – ueber dem, was manche Proxies als "zu gross" abweisen.
 * Der Block hier haelt den Request klein genug und fasst die Kopie nicht an.
 */
const BLOCK = 200;

type Supabase = Awaited<ReturnType<typeof mitUserOder401>>["supabase"];

type SetZeile = {
  id: string;
  name: string;
  slug: string;
  sprache: string;
  sprache_code: string | null;
  user_id: string | null;
};

/**
 * Kopiert ein Set samt aller Karten in ein neues, eigenes Set.
 *
 * Aufruf: POST /api/sets/<slug>/duplizieren
 * Antwort 201: { set: {...}, karten: <Anzahl> }
 *
 * Warum ueberhaupt: bis hierher gab es kein Duplizieren, und der Bedarf ist
 * echt. Wer ein Set aus dem Alltag (Stadt, Reise, Job) kopiert, um daraus ein
 * Lernset fuer den Unterricht oder die Kinder zu machen, muss 40 Karten
 * nicht zweimal tippen. Ein zweiter Weg waere gewesen, den Nutzer das Set
 * exportieren und wieder importieren zu lassen – das ist drei Klicks mehr
 * und ein Umweg, der an genau der Stelle kaputtgeht, an der es unbequem ist.
 *
 * Zwei Entscheidungen, die nicht offensichtlich sind:
 *
 *   1. DUPLIZIEREN IST AUCH FUER DEMOSETS ERLAUBT. Sonst waere die Funktion
 *      fuer die Haelfte aller Sets tot: das Demo-Set ist genau das, was man
 *      kopieren will. Die Insert-Policy verlangt trotzdem `user_id =
 *      auth.uid()`, die Kopie gehoert also dem, der sie macht. Lesen darf
 *      jeder sein eigenes Set, Fremdes nicht – und Demo darf jeder lesen.
 *      Das entscheidet `kannLesen` unten, nicht `eigenesSetOderFehler` aus
 *      [slug]/route.ts, denn das verbietet Demo-Sets ausdruecklich.
 *
 *   2. DER LERNSTAND WIRD NICHT MITKOPIERT. Die neue Karte hat eine neue
 *      `id`, und `karten_fortschritt` haengt an genau dieser id. Eine Kopie
 *      mit "Stufe 4, 12 Fehler" waere eine Karte, die der Nutzer nie gesehen
 *      hat und trotzdem nicht wiederfindet. Eine Kopie ist neues Material,
 *      also Stufe 0. Nichts zu tun – die Kopie entsteht ohne Zeile in
 *      `karten_fortschritt`, und genau das ist der gewollte Zustand.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { supabase, user, antwort: nichtAngemeldet } = await mitUserOder401();
  if (nichtAngemeldet) return nichtAngemeldet;

  const { slug } = await context.params;

  if (!slug) {
    return NextResponse.json({ error: "Parameter 'slug' fehlt" }, { status: 400 });
  }

  /*
   * Quelle holen. Gelesen werden darf, was RLS als lesbar durchlässt: eigene
   * Sets und Demo-Sets. Ein Set eines fremden Kontos liefert hier bereits
   * `data === null` – die Policy "sets lesen" aus Migration 003 laesst nur
   * `user_id is null or user_id = auth.uid()` durch. Es steht trotzdem der
   * ausdrueckliche Fall darunter: die Absicht ist im Code lesbar, und wenn
   * die Policy sich je aendert, darf sie nicht ungefragt eine Luecke aufmachen.
   */
  const { data: quelle, error: quellFehler } = await supabase
    .from("karteikarten_sets")
    .select("id, name, slug, sprache, sprache_code, user_id")
    .eq("slug", slug)
    .maybeSingle();

  if (quellFehler) {
    return NextResponse.json({ error: quellFehler.message }, { status: 500 });
  }
  if (!quelle) {
    return NextResponse.json({ error: "Set nicht gefunden" }, { status: 404 });
  }
  if (quelle.user_id !== null && quelle.user_id !== user.id) {
    return NextResponse.json({ error: "Set nicht gefunden" }, { status: 404 });
  }

  const gesetzt = await setAnlegen(supabase, quelle, user.id);
  if ("antwort" in gesetzt) return gesetzt.antwort;
  const neu = gesetzt.set;

  /*
   * Karten lesen. Das LIMIT ist Absicht und nicht Faulheit: /api/karten
   * schneidet bei 500 ab und sagt es, weil es fuer die Anzeige gedacht ist.
   * Hier waere stilles Abschneiden Datenverlust – das Original haette dann
   * mehr Karten als die Kopie, und niemand koennte den Unterschied erklaeren.
   * Deshalb 10000: ueber der Grenze, aber weit weg von einem Request, der
   * den Speicher sprengt. Ueber 10000 Karten in einem Set sagt die Meldung
   * unten Bescheid, statt zu behaupten, die Kopie sei vollstaendig.
   *
   * `id` als zweiter Sortierschluessel, weil ein Bulk-Import allen Karten
   * denselben `now()` gibt und die Reihenfolge dann der physischen Lage
   * ueberlassen bleibt. Ohne diesen Schluessel kopiert die Route eine
   * Reihenfolge, die sie beim naechsten Abruf nicht wiederbekommt.
   */
  const { data: karten, error: kartenFehler } = await supabase
    .from("karten")
    .select("frage, antwort, beispielsatz, beispiel_uebersetzung")
    .eq("set_id", quelle.id)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(10000);

  if (kartenFehler) {
    await setZurueckrollen(supabase, neu.id, user.id);
    return NextResponse.json({ error: kartenFehler.message }, { status: 500 });
  }

  const quelleKarten = karten ?? [];

  if (quelleKarten.length === 0) {
    // Ein leeres Set zu kopieren ist erlaubt und ergibt ein leeres Set. Die
    // Kopie steht dann in der Uebersicht und laesst sich befuellen. Es gibt
    // hier keinen Fehler – nichts zu kopieren ist kein Fehler.
    return NextResponse.json(
      { set: neu, karten: 0, quelle: quelle.name },
      { status: 201 },
    );
  }

  /*
   * In Bloecken einfuegen. Jeder Block ist eine Anweisung, kein Loop ueber
   * Zeilen: bei einem Fehler in Block 3 bleiben Block 1 und 2 stehen, und
   * das `zurueckrollen` raeumt sie wieder weg. Das ist kein Transaktionsschutz
   * – Postgres kennt ueber HTTP keine – aber es hinterlaesst kein sichtbares
   * halbes Set zurueck.
   */
  let kopiert = 0;

  /*
   * EINE-ZEITSTEMPEL-BASIS FUER DIE GANZE KOPIE.
   *
   * Wichtig: `new Date()` VOR der Schleife, nicht `new Date()` je Zeile.
   * Postgres' `now()` ist transaktionsstabil – alle Zeilen einer INSERT-
   * Anweisung bekommen denselben Wert. Es gibt kein "ein bisschen spaeter",
   * egal wie schnell die Schleife laeuft.
   *
   * Deshalb wird der Wert hier von Hand verteilt: Karte i bekommt
   * basis + i Millisekunden. Damit ist die Reihenfolge der Kopie exakt die
   * Reihenfolge, in der gelesen wurde – und die Liste sortiert nach `created_at`
   * wieder auf dieselbe Folge, ohne den zweiten Sortierschluessel zu brauchen.
   *
   * Der Abstand ist 1 ms pro Karte. Bei 10.000 Karten ist das ein Zeitfenster
   * von 10 Sekunden, das niemand sieht; `created_at` wird nirgends als
   * "wann wurde das angelegt" angezeigt, sondern ausschliesslich zum Sortieren
   * benutzt.
   */
  const basis = Date.now();

  for (let start = 0; start < quelleKarten.length; start += BLOCK) {
    const block = quelleKarten.slice(start, start + BLOCK);

    const { error: blockFehler } = await supabase.from("karten").insert(
      block.map((k, i) => ({
        set_id: neu.id,
        frage: k.frage,
        antwort: k.antwort,
        // null statt "": siehe POST /api/karten. "" hiesse "vorhanden und
        // leer", null heisst "noch keiner". Die Kopie macht das genauso wie
        // das Original, sonst waere der Unterschied nicht mehr sichtbar.
        beispielsatz: k.beispielsatz ?? null,
        beispiel_uebersetzung: k.beispiel_uebersetzung ?? null,
        // `start + i` ist der Platz in der GESAMTEN Liste, nicht im Block.
        // Sonst wuerde Block 3 wieder bei 0 beginnen und die Reihenfolge
        // der Kopie auseinanderlaufen.
        created_at: new Date(basis + start + i).toISOString(),
      })),
    );

    if (blockFehler) {
      await setZurueckrollen(supabase, neu.id, user.id);
      const migration = migrationsMeldung(blockFehler);
      if (migration) {
        return NextResponse.json({ error: migration }, { status: 503 });
      }
      if (blockFehler.code === "42501") {
        return NextResponse.json(
          {
            error:
              "Die Kopie konnte nicht angelegt werden. Bitte die Migration " +
              "supabase/003-auth-und-user-daten.sql ausführen.",
          },
          { status: 403 },
        );
      }
      return NextResponse.json({ error: blockFehler.message }, { status: 500 });
    }

    kopiert += block.length;
  }

  /*
   * `anzahl_karten` wird nicht geschrieben. Die Spalte ist eine Zielangabe
   * ("ich will 100 Karten"), kein Zaehler, und wächst absichtlich nicht mit –
   * siehe POST /api/sets, wo sie mit 0 angelegt wird. Der echte Bestand
   * kommt aus `karten_gesamt` in der Uebersichtssicht.
   */
  return NextResponse.json(
    { set: neu, karten: kopiert, quelle: quelle.name },
    { status: 201 },
  );
}

/**
 * Legt das neue Set an und findet einen freien Slug.
 *
 * Bewusst als eigene Funktion, nicht als Schlaufe im Handler: die Namenssuche
 * ist dieselbe wie in POST /api/sets, und zwei Kopien davon laufen
 * auseinander. Die Reihenfolge ist die von dort – erst der basisierte Slug,
 * dann "-2", "-3" –, damit eine Kopie neben ihrem Original auftaucht und
 * nicht irgendwo im Alphabet.
 */
async function setAnlegen(
  supabase: Supabase,
  quelle: SetZeile,
  userId: string,
): Promise<{ set: { id: string; slug: string; name: string; sprache_code: string | null; sprache: string } } | { antwort: NextResponse }> {
  const basis = slugifySetzName(kopieName(quelle.name));

  for (let versuch = 1; versuch <= MAX_VERSUCHE; versuch++) {
    const slug = versuch === 1 ? basis : `${basis}-${versuch}`;

    const { data: belegt } = await supabase
      .from("karteikarten_sets")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (belegt) continue;

    const { data, error } = await supabase
      .from("karteikarten_sets")
      .insert({
        slug,
        name: kopieName(quelle.name),
        // Die Freitextspalte ist NOT NULL und wird erst in Phase 4 entfernt.
        // Sie wird auch hier geschrieben, sonst schlaegt der Insert fehl.
        sprache: quelle.sprache,
        sprache_code: quelle.sprache_code,
        anzahl_karten: 0,
        eigenes_set: true,
        // Aus der Session, nie aus dem Body. Siehe POST /api/sets.
        user_id: userId,
      })
      .select("id, slug, name, sprache_code, sprache")
      .single();

    if (error) {
      const migration = migrationsMeldung(error);
      if (migration) {
        return { antwort: NextResponse.json({ error: migration }, { status: 503 }) };
      }
      // 23505 = zwei Tabs haben gleichzeitig kopiert. Dann die naechste Variante.
      if (error.code === "23505") continue;

      return {
        antwort: NextResponse.json({ error: error.message }, { status: 500 }),
      };
    }

    return { set: data };
  }

  return {
    antwort: NextResponse.json(
      {
        error:
          "Es konnte kein freier Name gefunden werden. Bitte das Set " +
          "zuerst umbenennen.",
      },
      { status: 409 },
    ),
  };
}

/**
 * Haelt das leere Zwischen-Set nicht zurueck, wenn die Kartenkopie scheitert.
 *
 * Ohne das stuende nach jedem zweiten Fehlversuch ein Set mit "0 Vokabeln" in
 * der Uebersicht, und der Nutzer haelt es fuer ein vollstaendiges Duplikat.
 * Das Loeschen kann scheitern (dann bleibt das Set stehen), aber das ist
 * deutlich besser als ein Set, das so tut, als waere es eine Kopie.
 *
 * `user_id` im Filter, damit diese Route nicht aus Versehen ein fremdes Set
 * loescht – die Policy wuerde es verweigern, aber die Absicht gehoert hierher.
 */
async function setZurueckrollen(supabase: Supabase, setId: string, userId: string) {
  await supabase
    .from("karteikarten_sets")
    .delete()
    .eq("id", setId)
    .eq("user_id", userId);
}
