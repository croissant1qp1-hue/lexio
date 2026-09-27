import { NextResponse } from "next/server";
import { mitUserOder401 } from "@/lib/supabase/user";
import { holeSprachen, spracheNachCode } from "@/lib/sprachen-server";
import { UNBEKANNTE_SPRACHE, type SpracheInfo } from "@/lib/sprachen";
import { migrationsMeldung } from "@/lib/db-fehler";

const MAX_KARTEN = 20;

/**
 * So viele Karten eines Sets werden gelesen – eine Karte mehr, um zu merken,
 * dass es mehr gibt.
 *
 * Das ist keine Geschmacksfrage. Vorher wurden die Karten in zwei Schritten
 * geholt: erst alle Karten, dann deren IDs als `.in("karte_id", [...])` in der
 * Abfrage. Bei 120 Karten sind das schon rund 4,5 KB URL, ab etwa 200
 * Karten ist die Anfrage zu lang und die Lernseite antwortet gar nicht mehr –
 * nicht langsamer, sondern gar nicht. Der Fehler waere eine leere Seite
 * ohne erkennbaren Grund, und er tritt genau dann auf, wenn jemand die App
 * wirklich benutzt.
 *
 * Der jetzige Weg braucht keine IDs in der Adresse: die Karten kommen mit
 * ihrem Fortschritt in einer Anfrage. 1000 ist die Grenze, bei der die
 * Antwort noch in einem vernuenftigen Rahmen bleibt (rund 120 KB); der
 * Wizard schreibt 40 Woerter je Durchgang, das sind also 25 Durchgaenge.
 */
const MAX_SET_KARTEN = 1000;

/** Eine Fortschrittszeile, wie die eingebettete Abfrage sie zurueckgibt. */
type FortschrittsZeile = {
  stufe: number;
  gelernt: boolean;
  faellig_am: string;
};

/** Eine Karte mit ihrem Fortschritt. Leer heisst: noch nie gesehen. */
type RohKarte = {
  id: string;
  frage: string;
  antwort: string;
  /** Seit 005. Null, wenn die Karte ohne Satz angelegt wurde. */
  beispielsatz?: string | null;
  beispiel_uebersetzung?: string | null;
  fortschritt: FortschrittsZeile[] | FortschrittsZeile | null;
};

/**
 * Liefert die Karten, die fuer diese Person heute faellig sind.
 *
 * Der Fortschritt liegt seit Migration 003 in public.karten_fortschritt und
 * nicht mehr in public.karten. Pruefbar daran, dass hier kein `stufe` aus der
 * Kartentabelle mehr gelesen wird.
 *
 * Zwei Abfragen statt einem JOIN. Der JOIN koennte beides in einem liefern,
 * verlangt aber, die Regel "faellig" an zwei Stellen zu formulieren – im
 * WHERE zum Filtern und im Feld zum Sortieren. Fehlt sie an einer Stelle,
 * kommen Karten zurueck, die faellig sind und nicht gelernt werden, oder
 * genau andersrum. Zwei Abfragen koennen nicht auseinanderlaufen.
 */
export async function GET(request: Request) {
  const { supabase, user, antwort: nichtAngemeldet } = await mitUserOder401();
  if (nichtAngemeldet) return nichtAngemeldet;

  const setSlug = new URL(request.url).searchParams.get("set");

  if (!setSlug) {
    return NextResponse.json({ error: "Parameter 'set' fehlt" }, { status: 400 });
  }

  const heute = new Date().toISOString().slice(0, 10);

  /*
   * Sets sind ueber die RLS-Policy gefiltert: fremde private Sets ergeben
   * hier bereits `null`, nicht eine leere Liste. Der Besitz wird deshalb
   * nicht noch einmal im Code geprueft – die Datenbank ist die richtige
   * Stelle dafuer, weil sie auch dann greift, wenn jemand die Route
   * umgeht und die PostgREST-Adresse direkt aufruft.
   */
  const { data: set, error: setFehler } = await supabase
    .from("karteikarten_sets")
    .select("id, slug, name, sprache, sprache_code")
    .eq("slug", setSlug)
    .maybeSingle();

  if (setFehler) {
    /*
     * 42703 an dieser Stelle heisst: `sprache_code` fehlt, also ist 005 nicht
     * gelaufen. Ohne diese Unterscheidung kaeme hier ein 500 mit einem
     * Postgres-Satz, und wer danach sucht, findet nichts.
     */
    const migration = migrationsMeldung(setFehler);
    if (migration) {
      return NextResponse.json({ error: migration }, { status: 503 });
    }
    return NextResponse.json({ error: setFehler.message }, { status: 500 });
  }
  if (!set) {
    return NextResponse.json({ error: "Sprache nicht gefunden" }, { status: 404 });
  }

  /*
   * Die Sprache des Sets als Objekt, damit die Lernansicht weder eine Farbe
   * raten noch einen Code zaehlen muss. Sie braucht den Code fuer
   * speechSynthesis (1.3) und die Farbe fuer die Karte (006).
   *
   * Aus der Sprachliste und nicht aus dem Set: die Liste enthaelt die Farben,
   * und sie ist der Ort, an dem eine Sprache etwas ueber ihren Namen weiss.
   * Faellt die Liste aus, laeuft das Lernen trotzdem – dann steht der
   * Rueckfall da, und die Karten sind wichtiger als ihre Farbe.
   */
  const { sprachen: sprachListe } = await holeSprachen(supabase);
  const bekannt = spracheNachCode(sprachListe, set.sprache_code);
  const sprache: SpracheInfo = bekannt
    ? { code: bekannt.code, name: bekannt.name, flaeche: bekannt.flaeche, akzent: bekannt.akzent }
    : { ...UNBEKANNTE_SPRACHE, name: set.sprache || UNBEKANNTE_SPRACHE.name };

  /*
   * Eine Anfrage statt zwei.
   *
   * `fortschritt:` holt die Zeile aus karten_fortschritt dazu und filtert sie
   * auf diese Person. Der FK-Name steht ausdruecklich dabei: PostgREST rät
   * ihn sich sonst aus einer Mehrdeutigkeit und faellt dann auf eine Fehlermeldung
   * zurueck, die nichts mit dem eigentlichen Problem zu tun hat.
   *
   * Karten ohne Fortschrittszeile kommen trotzdem zurueck – mit einer leeren
   * Liste statt mit null. Das ist der Punkt, an dem diese Abfrage besser
   * ist als ein JOIN mit inner join: Eine neue Karte hat keine
   * Fortschrittszeile, und genau die ist fuer jemanden mit einem neuen Set
   * die einzige, die es zu lernen gibt. Ein inner join haette sie stillschweigend
   * wegsortiert, und die App haette bei einem frischen Set behauptet, es
   * gebe nichts zu lernen.
   */
  /*
   * supabase-js leitet den Typ einer Zeile aus der Select-Zeichenkette ab –
   * und die eingebettete Schreibweise mit Doppelpunkt und Ausrufezeichen
   * versteht sein simpler Parser nicht. Er liefert dann nicht "any", sondern
   * ein Platzhalter-Typ, der jeden Zugriff als Fehler markiert. Die Form wird
   * deshalb hier von Hand festgehalten; wie PostgREST sie tatsaechlich
   * beantwortet, wurde an der gleichartigen Beziehung xp_events.set_id gegen
   * die echte Datenbank geprueft: Elternzeilen kommen zurueck, das Kind ist
   * eine leere Liste, wenn der Filter nichts findet.
   */
  const { data, error: kartenFehler } = await supabase
    .from("karten")
    .select(
      /*
       * beispielsatz und beispiel_uebersetzung kommen mit, weil die Lernseite
       * den Satz zeigen soll. Sie sind nullable, also kommen sie als
       * `string | null` an – die Seite muss den Fall "kein Satz" auch kennen.
       */
      "id, frage, antwort, beispielsatz, beispiel_uebersetzung, " +
        "fortschritt:karten_fortschritt!karten_fortschritt_karte_id_fkey(stufe, gelernt, faellig_am)",
    )
    .eq("set_id", set.id)
    .eq("fortschritt.user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(MAX_SET_KARTEN + 1);

  if (kartenFehler) {
    /*
     * PGRST200 heisst "Beziehung nicht gefunden" – und das bedeutet zwei
     * voellig verschiedene Dinge, die man nicht miteinander verwechseln darf:
     *
     *   1. Die Tabelle karten_fortschritt fehlt, weil 003 nicht gelaufen ist.
     *      Dann wartet hier nichts auf sich selbst, und die Meldung muss zur
     *      Migration fuehren.
     *   2. Die Tabelle gibt es, PostgREST kennt sie nur noch nicht. Das
     *      passiert regelmaessig direkt nach dem SQL Editor-Lauf: die
     *      Datenbank ist geaendert, PostgREST arbeitet noch mit dem alten
     *      Schema. Das legt sich von selbst und braucht nur einen Reload.
     *
     * Beide melden dieselbe Nummer und denselben Text ("Could not find a
     * relationship"), unterscheiden sich aber daran, ob ein Zugriff auf die
     * Tabelle ueberhaupt fehlschlaegt. Genau das wird hier nachgefragt – nur
     * im Fehlerfall, also kostet es nichts, solange alles funktioniert.
     */
    if (kartenFehler.code === "PGRST200" || kartenFehler.code === "PGRST201") {
      const { error: direkt } = await supabase
        .from("karten_fortschritt")
        .select("karte_id")
        .limit(1);

      if (direkt) {
        return NextResponse.json(
          {
            error:
              "Die Tabelle für den eigenen Lernstand fehlt. Bitte " +
              "supabase/003-auth-und-user-daten.sql im Supabase SQL Editor " +
              "ausführen – ohne sie gibt es keine persönlichen Fortschritte.",
          },
          { status: 503 },
        );
      }
      return NextResponse.json(
        {
          error:
            "Die Datenbank kennt die neue Beziehung zwischen Karten und " +
            "Lernstand noch nicht. Das legt sich nach wenigen Sekunden von " +
            "selbst – sonst einmal neu laden. Die Migration selbst ist dabei " +
            "längst durch.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: kartenFehler.message }, { status: 500 });
  }

  const roh = (data ?? []) as unknown as RohKarte[];

  /*
   * Eine Karte mehr geholt als erlaubt, um zu erkennen, dass das Set die
   * Grenze ueberschreitet. Was dann zurueckkommt, wird nicht als
   * Lernrunde ausgegeben: lieber eine klare Meldung als ein Set, in dem
   * woertlich nichts mehr vorkommt, ohne dass man weiss warum.
   */
  const setZuGross = roh.length > MAX_SET_KARTEN;
  const alle = (setZuGross ? roh.slice(0, MAX_SET_KARTEN) : roh).map((karte) => {
    const zeile = Array.isArray(karte.fortschritt) ? karte.fortschritt[0] : karte.fortschritt;
    return {
      id: karte.id,
      frage: karte.frage,
      antwort: karte.antwort,
      beispielsatz: karte.beispielsatz ?? null,
      beispielUebersetzung: karte.beispiel_uebersetzung ?? null,
      stufe: zeile?.stufe ?? 0,
      gelernt: zeile?.gelernt ?? false,
      // Ohne Zeile: heute. Mit Zeile: ihr Datum.
      faelligAm: zeile?.faellig_am ?? heute,
    };
  });

  if (alle.length === 0) {
    // Nicht als Fehler: ein leeres Set ist ein gueltiger Zustand, und die
    // Oberflaeche zeigt dafuer "Noch keine Vokabeln" mit einem Knopf zum
    // Hinzufuegen. Ein 404 wuerde dort eine Fehlermeldung erzeugen.
    return NextResponse.json({
      set: { slug: set.slug, name: set.name, sprache },
      karten: [],
      faelligGesamt: 0,
    });
  }

  const faelligeKarten = alle
    // Karten ohne Fortschrittszeile sind neu. Eine neue Karte ist sofort
    // faellig – das ist der coalesce in der View und hier dieselbe Regel.
    // Ohne sie kaeme man nie an: alle Karten eines neuen Sets waeren unsichtbar
    // und die App wuerde bei jedem Start "nichts zu lernen" behaupten.
    .filter((karte) => karte.faelligAm <= heute)
    // Faellige zuerst, danach die mit der niedrigsten Stufe. Neue Karten
    // haben Stufe 0 und kommen dadurch vor, ohne eine zweite Abfrage.
    .sort((a, b) => a.stufe - b.stufe);

  return NextResponse.json({
    set: { slug: set.slug, name: set.name, sprache },
    karten: faelligeKarten.slice(0, MAX_KARTEN),
    // Gesamt, nicht die Zahl der gelieferten Karten: 20 sind die Obergrenze
    // fuer eine Runde, nicht der Bestand.
    faelligGesamt: faelligeKarten.length,
    /*
     * Nur gesetzt, wenn es wirklich zu viel ist. Die Oberflaeze kann das
     * anzeigen; wenn sie es nicht tut, ist die Antwort wenigstens ehrlich.
     */
    ...(setZuGross
      ? {
          setZuGross: true,
          hinweis:
            `Dieses Set hat mehr als ${MAX_SET_KARTEN} Karten. Es werden die ersten ` +
            `${MAX_SET_KARTEN} beruecksichtigt – teile es lieber in mehrere Sets.`,
        }
      : {}),
  });
}
