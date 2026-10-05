import { NextResponse } from "next/server";
import { mitUserOder401 } from "@/lib/supabase/user";
import { holeSprachen, spracheNachCode } from "@/lib/sprachen-server";
import { UNBEKANNTE_SPRACHE, type SpracheInfo } from "@/lib/sprachen";
import { migrationsMeldung } from "@/lib/db-fehler";
import { LEECH_FEHLER } from "@/lib/lernlogik";
import { trainiereModell, schwierigkeit } from "@/lib/reihenfolge";
import { pruefeRohKarten } from "@/lib/fortschritts-form";

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

/**
 * Wie viele Karten "Nochmal lernen" ausliefert.
 *
 * Kleiner als MAX_KARTEN, und aus einem Grund: wer freiwillig uebt, will
 * Wiederholung, nicht den kompletten Bestand. Bei 300 Karten waere eine
 * Runde von 300 dann eine Sache von zwei Stunden, die niemand zu Ende
 * macht. 40 sind etwa eine gute Sitzung – lang genug, dass sich ein
 * Stapelwechsel lohnt, kurz genug, dass man ihn beendet.
 */
const MAX_WIEDERHOLUNG = 40;

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

  const suche = new URL(request.url).searchParams;
  const setSlug = suche.get("set");

  if (!setSlug) {
    return NextResponse.json({ error: "Parameter 'set' fehlt" }, { status: 400 });
  }

  /*
   * `modus=ueben` ignoriert die Faelligkeit.
   *
   * Wofuer: der Knopf "Nochmal lernen" auf der_sets-Uebersicht. Wer ein Set
   * anklickt, das heute schon dran war, sieht sonst "Alles geschafft" und
   * kommt nicht hinein – der einzige Weg zurueck in die Karten waere, auf
   * den naechsten Tag zu warten. Das ist die haeufigste Form von
   * "ich will lernen und die App laesst mich nicht".
   *
   * Warum ein Parameter und kein zweiter Endpunkt: die Regel, welche Karten
   * es gibt, bleibt an einer Stelle. Ein zweiter Endpunkt muesste die
   * Besitzpruefung und den Fälligkeitsfilter ein zweites Mal richtig
   * hinkriessen, und diese beiden Regeln sind genau die, die man nicht
   * doppelt pflegen will.
   *
   * `true` ist die einzige gueltige Form. Alles andere faellt auf den
   * normalen Modus zurueck, damit ein Tippfehler nicht ungefragt eine
   * Wiederholung mit 40 Karten startet.
   */
  const ueben = suche.get("modus") === "ueben";

  /**
   * Leech-Modus (Plan 1.7).
   *
   * `modus=leech` ist der Gegenweg zum Ausschluss: wer die eingefrorenen
   * Problemskarten trotzdem sehen will, holt sie sich hier bewusst herüber.
   * Wie bei `ueben` entscheidet die Adresse, nicht ein Client-Zustand – sonst
   * ginge der Zugriff nach einem Reload verloren.
   */
  const leechModus = suche.get("modus") === "leech";

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
    /*
     * Meldungstext war "Sprache nicht gefunden". Die Sprache wird an dieser
     * Stelle noch gar nicht nachgeschlagen – gefehlt hat das Set. Bei der
     * Suche nach den eigenen Sets eines anderen Kontos (RLS) ist genau das
     * der Normalfall, und die Meldung behauptet dann etwas Falsches: Es
     * gab nie eine Sprachfrage. "Set nicht gefunden" sagt, was fehlt, ohne
     * zu behaupten, man wisse mehr als die Abfrage.
     */
    return NextResponse.json({ error: "Set nicht gefunden" }, { status: 404 });
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
   * Plan 3.10 – Session-Leistung.
   *
   * Hier landete vorher der komplette Kartentext in der Abfrage
   * (frage, antwort, beide Beispielsaetze) fuer bis zu 1001 Karten – rund
   * 120 KB pro Sessionstart, nur damit daraus 20–40 Karten serviert werden.
   * Die Textfelder sind der dicke Teil der Antwort, aber fuer Sortierung,
   * Faelligkeit und Statistik wird nur die id plus die Fortschrittszeile
   * gebraucht. Die Texte kommen deshalb erst im zweiten Schritt fuer die
   * wenigen Karten, die die Runde wirklich ausliefert – siehe Kartentext.
   *
   * Die fruehere Warnung in diesem Kommentar ("bei 200 Karten ist die URL zu
   * lang") betraf die `.in("karte_id", [...])`-Form mit ALLEN Karten eines
   * grossen Sets in der Adresse. Im zweiten Schritt unten stehen nur die 20
   * bis 40 servierten ids in der URL (jede 36 Zeichen) – das bleibt klar
   * unter jeder Grenze.
   */
  const { data, error: kartenFehler } = await supabase
    .from("karten")
    .select(
      "id, " +
        "fortschritt:karten_fortschritt!karten_fortschritt_karte_id_fkey(stufe, gelernt, faellig_am, fehler, treffer, z_nochmal, z_schwer, z_gut, z_einfach)",
    )
    .eq("set_id", set.id)
    .eq("fortschritt.user_id", user.id)
    .order("created_at", { ascending: true })
    // Zweiter Sortierschluessel, weil ein Bulk-Import allen Karten denselben
    // Zeitstempel gibt. Ohne das kann sich die Reihenfolge des Stapels
    // zwischen zwei Abrufen aendern – und der Nutzer bekaeme am selben Tag
    // eine andere Reihenfolge. Siehe die ausfuehrliche Begruendung in
    // GET /api/karten.
    .order("id", { ascending: true })
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
              "supabase/migrations/003-auth-und-user-daten.sql im Supabase SQL Editor " +
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

  /*
   * Die eingebetteten Fortschrittszeilen prüfen, statt sie zu behaupten.
   *
   * Vorher stand hier `as unknown as RohKarte[]`. Der Cast war nicht falsch,
   * aber er sagte nichts über das, was tatsächlich ankommt: der Alias im
   * select-String ist ein String, und `data` ist `any`. Änderte sich der
   * Alias oder die Form des Embeds, wäre `zeile?.stufe ?? 0` stillschweigend
   * 0 gewesen – und jede Karte als neu erschienen, mit Stufe 0, ohne
   * Fälligkeit und ohne Fehlermeldung. Der Nutzer hätte sein gesamtes Set
   * noch einmal gelernt und keinen Grund gesehen.
   *
   * Deshalb `pruefeRohKarten`. Sie unterscheidet "keine Zeile" (Normalfall bei
   * einem neuen Set) von "etwas anderes als erwartet" (Fehler im Code) und gibt
   * im zweiten Fall einen Grund mit, statt eine Runde zu liefern, die falsch
   * ist. Siehe lib/fortschritts-form.ts für die ausführliche Begründung.
   */
  const form = pruefeRohKarten(data);
  if (!form.ok) {
    return NextResponse.json(
      {
        error:
          "Die Lernrunde kann nicht gelesen werden: Die Fortschrittsdaten " +
          "kommen unerwartet zurück. Bitte einmal neu laden; bleibt es dabei, " +
          "ist es ein Fehler und gehört gemeldet.",
        detail: form.grund,
      },
      { status: 500 },
    );
  }
  const roh = form.karten;

  /*
   * Plan 3.10 – Texte der servierten Karten nachladen.
   *
   * Die erste Abfrage (oben) liefert nur id und Fortschrittszeile, damit die
   * Antwort nicht fuer jedes set 120 KB Kartentext schleppt. Jetzt sind –
   * nach Sortierung und Filter – die Karten bekannt, die die Runde wirklich
   * ausliefert; deren Texte werden hier mit einer kleinen `.in`-Abfrage
   * geholt. Hoechstens MAX_WIEDERHOLUNG (40) ids, jede 36 Zeichen: das bleibt
   * komfortabel unter der URL-Grenze, an der die fruehere Variante mit allen
   * Karten eines grossen Sets scheiterte.
   *
   * Wenn die Textabfrage fehlschlaegt, waere die Runde ohne Inhalt sinnlos –
   * der Fehler wird deshalb gemeldet statt die Runde stillschweigend leer zu
   * lassen. Der Fall ist aber nur konstruierbar: dieselbe Tabelle, die gerade
   * die ids geliefert hat, versagt die Texte nur zusammen mit der ganzen DB.
   */

  /*
   * Plan 1.8 – Modell pro Account trainieren.
   *
   * Die Gewichte kommen aus ALLEN Karten des Accounts, nicht nur aus diesem
   * Set: das Modell soll den Nutzer verstehen, nicht ein einzelnes Set.
   * Die Rechnung mit den Zaehlern einzelner Antworten, also muss hier die
   * komplette Historie gelesen werden. Schlägt die Abfrage fehl (z. B.
   * Migration 010 noch nicht gelaufen), ist die Runde wichtiger als die
   * Sortierung: dann fallen die Gewichte auf null zurück und es ordnet
   * weiterhin nach stufe – kein 500, weil eine Verschönerung fehlt.
   */
  const { data: trainingsdaten, error: trainingsFehler } = await supabase
    .from("karten_fortschritt")
    .select("stufe, treffer, fehler, z_nochmal, z_schwer, z_gut, z_einfach")
    .eq("user_id", user.id);

  const gewichte = trainingsFehler
    ? null
    : trainiereModell(
        ((trainingsdaten ?? []) as {
          stufe: number;
          treffer: number;
          fehler: number;
          z_nochmal: number;
          z_schwer: number;
          z_gut: number;
          z_einfach: number;
        }[]).map((z) => ({
          stufe: z.stufe,
          treffer: z.treffer,
          fehler: z.fehler,
          zNochmal: z.z_nochmal,
          zSchwer: z.z_schwer,
          zGut: z.z_gut,
          zEinfach: z.z_einfach,
        })),
      );

  /*
   * Eine Karte mehr geholt als erlaubt, um zu erkennen, dass das Set die
   * Grenze ueberschreitet. Was dann zurueckkommt, wird nicht als
   * Lernrunde ausgegeben: lieber eine klare Meldung als ein Set, in dem
   * woertlich nichts mehr vorkommt, ohne dass man weiss warum.
   */
  const setZuGross = roh.length > MAX_SET_KARTEN;
  /*
   * Plan 3.10: Hier werden bewusst NUR id und Fortschritt aus dem ersten
   * Durchlauf uebernommen. Die Textfelder (frage, antwort, Beispielsaetze)
   * folgen weiter unten fuer die paar Karten, die die Runde wirklich ausgibt –
   * umgekehrt kosteten sie fuer alle Karten des Sets die 120 KB pro
   * Sessionstart.
   */
  const alle = (setZuGross ? roh.slice(0, MAX_SET_KARTEN) : roh).map((karte) => {
    const zeile = Array.isArray(karte.fortschritt) ? karte.fortschritt[0] : karte.fortschritt;
    const fehler = zeile?.fehler ?? 0;
    /*
     * Schwierigkeit laut Modell (1.8). Ist keine gelaufen (wenig Daten,
     * Abfragefehler), sagt der Client nichts – der Endschirm und die
     * Bewertungsknöpfe funktionieren auch ohne den Wert.
     */
    const schwierigkeitWert = gewichte
      ? schwierigkeit(gewichte, {
          stufe: zeile?.stufe ?? 0,
          treffer: zeile?.treffer ?? 0,
          fehler,
          zNochmal: zeile?.z_nochmal ?? 0,
          zSchwer: zeile?.z_schwer ?? 0,
          zGut: zeile?.z_gut ?? 0,
          zEinfach: zeile?.z_einfach ?? 0,
        })
      : null;
    return {
      id: karte.id,
      stufe: zeile?.stufe ?? 0,
      gelernt: zeile?.gelernt ?? false,
      // Ohne Zeile: heute. Mit Zeile: ihr Datum.
      faelligAm: zeile?.faellig_am ?? heute,
      /*
       * Leech (Plan 1.7): eine Karte mit der Fehlerschwelle ist für die
       * normale Runde zu oft "nochmal" gewesen. Sie wird unten aus der
       * Rotation genommen und nur noch über den Modus "leech" geübt.
       */
      leech: fehler >= LEECH_FEHLER,
      ...(schwierigkeitWert !== null ? { schwierigkeit: schwierigkeitWert } : {}),
    };
  });

  /*
   * Karten ohne Fortschrittszeile sind neu. Eine neue Karte ist sofort
   * faellig – das ist der coalesce in der View und hier dieselbe Regel.
   * Ohne den Vergleich `faelligAm <= heute` kaeme man nie an: alle Karten
   * eines neuen Sets waeren unsichtbar, und die App wuerde bei jedem Start
   * "nichts zu lernen" behaupten. Der Vergleich steht deshalb unten beim
   * Filtern und nicht hier beim Bauen der Liste.
   */
  if (alle.length === 0) {
    // Nicht als Fehler: ein leeres Set ist ein gueltiger Zustand, und die
    // Oberflaeche zeigt dafuer "Noch keine Vokabeln" mit einem Knopf zum
    // Hinzufuegen. Ein 404 wuerde dort eine Fehlermeldung erzeugen.
    return NextResponse.json({
      set: { slug: set.slug, name: set.name, sprache },
      karten: [],
      faelligGesamt: 0,
      // Ein leeres Set hat null Karten – die Lernseite unterscheidet damit
      // "nichts faellig" von "noch nichts angelegt" und zeigt im ersten Fall
      // einen "Nochmal lernen"-Knopf, im zweiten nicht.
      kartenGesamt: alle.length,
    });
  }

  /*
   * Sortierung in beiden Modi gleich – und das ist Absicht. "Nochmal lernen"
   * sortiert die niedrigsten Stufen nach vorn, also genau die Karten, die am
   * weitesten weg sind. Ein Stapel, der mit dem Schwierigsten beginnt, faengt
   * an zu lernen; einer, der mit dem Leichtesten beginnt, endet bei den
   * mittleren, weil die letzten vier den ganzen Rest der Sitzung kosten.
   *
   * Plan 1.8: Statt stur nach `stufe` ordnet das Modell den Stapel nach der
   * gelernten Schwierigkeit dieses Accounts (schwierigste zuerst). Ohne
   * Modell – zu wenig beantwortete Karten, Abfragefehler – gilt weiterhin
   * die stufe-Reihenfolge, die vor 1.8 der Aufhänger war.
   */
  const sortiert = gewichte
    ? alle.sort((a, b) => (b.schwierigkeit ?? 0) - (a.schwierigkeit ?? 0))
    : alle.sort((a, b) => a.stufe - b.stufe);

  const istLeech = (karte: (typeof sortiert)[number]) => karte.leech;

  /*
   * Leech (Plan 1.7): In der normalen Rotation sind Problemskarten
   * ausgeschlossen – sie haben genug Fehler und sollen die Runde nicht mehr
   * blockieren. Im Uebungsmodus zaehlen sie mit (die Runde ist ohnehin eine
   * bewusste Wiederholung), und der Leech-Modus liefert nur sie aus.
   */
  const genutzt = leechModus
    ? sortiert.filter(istLeech).slice(0, MAX_WIEDERHOLUNG)
    : ueben
      ? sortiert.slice(0, MAX_WIEDERHOLUNG)
      : sortiert.filter((karte) => karte.faelligAm <= heute && !istLeech(karte)).slice(0, MAX_KARTEN);

  /*
   * Plan 3.10 – die Texte der servierten Karten.
   *
   * Erst jetzt, wo feststeht, welche Karten die Runde ausgibt, wird ihr Text
   * geladen: hoechstens MAX_WIEDERHOLUNG (40) Karten statt des ganzen Sets.
   * Die `.in`-Liste hat damit nie mehr als 40 Eintraege (je 36 Zeichen) und
   * bleibt weit unter der URL-Grenze, an der die alte Ein-Schritt-Variante
   * bei grossen Sets scheiterte.
   *
   * Fehlgeschlagen ist die Abfrage praktisch nur, wenn die Datenbank selbst
   * weg ist – dann waere eine Runde ohne Kartentext sinnlos, also wird der
   * Fehler gemeldet, statt eine Meldung ohne Worte auszuliefern.
   */
  /**
   * Typ der Karten, die die Runde ausgibt: Fortschritt plus Text, der erst
   * nach der Auswahl geladen wird (Plan 3.10). `schwierigkeit` ist optional,
   * weil sie ohne Modell (wenig Daten, Abfragefehler) nicht gesetzt wird.
   */
  type ServierteKarte = {
    id: string;
    frage: string;
    antwort: string;
    beispielsatz: string | null;
    beispielUebersetzung: string | null;
    stufe: number;
    gelernt: boolean;
    faelligAm: string;
    leech: boolean;
    schwierigkeit?: number;
  };

  const serviert: ServierteKarte[] = [];
  if (genutzt.length > 0) {
    const ids = genutzt.map((k) => k.id);
    const { data: texte, error: textFehler } = await supabase
      .from("karten")
      .select("id, frage, antwort, beispielsatz, beispiel_uebersetzung")
      .in("id", ids);

    if (textFehler) {
      return NextResponse.json({ error: textFehler.message }, { status: 500 });
    }

    const texteMap = new Map(
      (texte ?? []).map((t) => [
        t.id,
        {
          frage: t.frage,
          antwort: t.antwort,
          beispielsatz: t.beispielsatz ?? null,
          beispielUebersetzung: t.beispiel_uebersetzung ?? null,
        },
      ]),
    );

    for (const karte of genutzt) {
      const text = texteMap.get(karte.id);
      serviert.push({
        ...karte,
        frage: text?.frage ?? "",
        antwort: text?.antwort ?? "",
        beispielsatz: text?.beispielsatz ?? null,
        beispielUebersetzung: text?.beispielUebersetzung ?? null,
      });
    }
  }

  return NextResponse.json({
    set: { slug: set.slug, name: set.name, sprache },
    karten: serviert,
    /*
     * Gesamt, nicht die Zahl der gelieferten Karten: 20 sind die Obergrenze
     * fuer eine Runde, nicht der Bestand. Im Uebungsmodus ist es die
     * Obergrenze von 40, damit "12 von 40 geschafft" dasselbe meint wie
     * vorher, nur eben in einem anderen Umfang.
     */
    faelligGesamt: leechModus
      ? Math.min(sortiert.filter(istLeech).length, MAX_WIEDERHOLUNG)
      : ueben
        ? Math.min(sortiert.length, MAX_WIEDERHOLUNG)
        : sortiert.filter((karte) => karte.faelligAm <= heute && !istLeech(karte)).length,
    /*
     * Bestand statt Fälligkeit: die Lernseite braucht "hat das Set überhaupt
     * Karten", um "nichts fällig" von "noch nichts angelegt" zu
     * unterscheiden und im ersten Fall "Nochmal lernen" anzubieten.
     */
    kartenGesamt: alle.length,
    /*
     * Anzahl der ausgeschlossenen Problemskarten. Die Lernseite nutzt die
     * Zahl für den Hinweis "N Problemskarten sind ausgeblendet" im normalen
     * Modus – dem Gegenstück zum Knopf, der sie trotzdem hereinhält.
     */
    leechAnzahl: sortiert.filter(istLeech).length,
    /*
     * Der Client braucht das, um den Endschirm ehrlich zu halten: ohne diesen
     * Hinweis wuerde er bei "7 von 40" nach einer Runde von 7 behaupten, es
     * sei nichts mehr da, obwohl 33 im Set liegen.
     */
    ...(ueben ? { uebungsmodus: true } : {}),
    /*
     * Modus-Flag für den Client: in `modus=leech` ist die Runde eine
     * bewusste Reparaturrunde, und der Endschirm benennt das auch so.
     */
    ...(leechModus ? { leechModus: true } : {}),
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
