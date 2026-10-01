import { NextResponse } from "next/server";
import { mitUserOder401 } from "@/lib/supabase/user";
import { migrationsMeldung } from "@/lib/db-fehler";

const MAX_LAENGE = 200;

/**
 * Hoechstes Laenge der Beisaetze.
 *
 * Ein Beispielsatz ist ein Satz, keine Beschreibung. 300 Zeichen reichen fuer
 * "I always drink coffee in the morning." zweimal – und lassen Platz fuer die
 * Uebersetzung, ohne dass ein einzelner unpruefbar langer Text die
 * Lernansicht sprengt.
 */
const MAX_SATZ = 300;

/** Hoechstes Anzahl Paare pro Anfrage. */
const MAX_PAARE = 100;

/**
 * Hoechstes Anzahl Vokabeln in einer Liste (GET).
 *
 * Kein Seitenumbruch: die Liste ist fuer "was steht in diesem Set drin",
 * und da waere eine zweite Seite nur eine Stelle, an der Karten
 * verschwinden koennen. Ueber 500 Karten in einem Set ist hier nicht
 * vorgesehen – wenn es passiert, sagt die Antwort `gekuerzt: true`, statt
 * stillschweigend eine Zahl zu liefern, die nicht dem Bestand entspricht.
 */
const MAX_LISTE = 500;

/** Zeile aus `karten` mit eingebettetem Fortschritt. */
type KartenZeile = {
  id: string;
  frage: string;
  antwort: string;
  beispielsatz: string | null;
  beispiel_uebersetzung: string | null;
  fortschritt:
    | { stufe: number; gelernt: boolean; faellig_am: string | null; fehler: number }
    | { stufe: number; gelernt: boolean; faellig_am: string | null; fehler: number }[]
    | null;
};

type Paar = {
  frage: string;
  antwort: string;
  /** Beispielsatz in der Zielsprache. Leer heisst: keiner. */
  beispielsatz: string;
  /** Deutsche Uebersetzung des Beispielsatzes. Leer heisst: keine. */
  beispielUebersetzung: string;
};

/** Wie viele Zeichen an, was erlaubt ist. */
const MAX_BEISPIEL = { beispielsatz: MAX_SATZ, beispiel_uebersetzung: MAX_SATZ } as const;

/**
 * Prueft ein Paar und liefert die bereinigten Texte. Fehler landen in
 * `fehler` unter einem Schluessel, den die Oberflaeche dem Feld zuordnen kann.
 */
function pruefePaar(
  roh: { frage?: unknown; antwort?: unknown; beispielsatz?: unknown; beispiel_uebersetzung?: unknown },
  index: number,
  fehler: Record<string, string>,
): Paar | null {
  const frage = typeof roh.frage === "string" ? roh.frage.trim() : "";
  const antwort = typeof roh.antwort === "string" ? roh.antwort.trim() : "";

  // Leere Zeilen sind kein Fehler, sondern eine unbeantwortete Eingabereihe.
  // Nur beide leer heisst "Zeile nicht ausgefuellt".
  if (!frage && !antwort) return null;

  const feld = (name: string) => (index === 0 ? name : `${name}.${index}`);

  /*
   * Nur die Fehler DIESES Paares zaehlen. Vorher stand hier
   * `Object.keys(fehler)`, also der Zaehlerstand des ganzen Stapels: Sobald
   * Zeile 1 einen Fehler hatte, wurde jede weitere gueltige Zeile stillschweigend
   * verworfen. Bei 40 Zeilen und einem Tippfehler in Zeile 1 kamen 39
   * korrekte Vokabeln nicht an – und die Meldung sprach von einem einzigen
   * Feld.
   */
  const eigen: Record<string, string> = {};

  if (!frage) eigen[feld("frage")] = "Begriff fehlt";
  else if (frage.length > MAX_LAENGE) {
    eigen[feld("frage")] = `Maximal ${MAX_LAENGE} Zeichen`;
  }

  if (!antwort) eigen[feld("antwort")] = "Übersetzung fehlt";
  else if (antwort.length > MAX_LAENGE) {
    eigen[feld("antwort")] = `Maximal ${MAX_LAENGE} Zeichen`;
  }

  /*
   * Die Beisaetze sind optional, und ein Fehler bei ihnen ist genauso ein
   * Fehler wie bei den Pflichtfeldern – nur mit umgekehrter Richtung: Hier wird
   * die Zeile verworfen, statt sie halb zu speichern. "Halbe Sachen gehoeren
   * nicht auf main" gilt auch fuer eine Zeile in einer Datenbank.
   */
  const beispielsatz = typeof roh.beispielsatz === "string" ? roh.beispielsatz.trim() : "";
  const beispielUebersetzung =
    typeof roh.beispiel_uebersetzung === "string" ? roh.beispiel_uebersetzung.trim() : "";

  for (const [name, wert] of [
    ["beispielsatz", beispielsatz],
    ["beispiel_uebersetzung", beispielUebersetzung],
  ] as const) {
    if (wert.length > MAX_BEISPIEL[name]) {
      eigen[feld(name)] = `Maximal ${MAX_BEISPIEL[name]} Zeichen`;
    }
  }

  if (Object.keys(eigen).length > 0) {
    Object.assign(fehler, eigen);
    return null;
  }

  return { frage, antwort, beispielsatz, beispielUebersetzung };
}


/**
 * Alle Vokabeln eines Sets auflisten.
 *
 * Aufruf: GET /api/karten?setSlug=<slug>
 *
 * Warum das hier und nicht in der Lernroute: die Lernroute liefert
 * bewusst nur den Stapel von heute (20 oder 40 Karten), nicht den Bestand.
 * Wer sehen will, was in einem Set steht, braucht alle – und das ist eine
 * andere Frage mit einer anderen Ausgabe, keine Variante der Lernrunde.
 *
 * Die Reihenfolge ist `created_at`, wie beim Anlegen. Eine alphabetische
 * Sortierung waere fuer eine Vokabelliste verlockender, aber dann verschiebt
 * sich beim Nachschlagen alles, was man vor drei Wochen angelegt hat, und
 * die Position im Set ist das, woran man sich gewöhnt hat.
 */
export async function GET(request: Request) {
  /*
   * Hier wird `user` doch gebraucht, auch wenn nicht geschrieben wird: die
   * Antwort sagt, ob das Set diesem Konto gehoert. Vorher stand hier nur
   * `supabase`, weil beim Lesen keine Besitzpruefung noetig war – das stimmt
   * fuer die Sichtbarkeit, nicht fuer die Oberflaeche.
   *
   * Ohne dieses Feld muesste die Vokabelansicht Bearbeiten und Loeschen auch
   * bei einem Demo-Set anzeigen und den 403 der Route aushalten. Dann
   * entscheidet sich beim Klick, ob der Knopf taugt. Das ist genau der
   * Fehler, der beim Set-Dialog schon einmal drin war.
   */
  const { supabase, user, antwort: nichtAngemeldet } = await mitUserOder401();
  if (nichtAngemeldet) return nichtAngemeldet;

  const setSlug = new URL(request.url).searchParams.get("setSlug")?.trim() ?? "";
  if (!setSlug) {
    return NextResponse.json({ error: "Set fehlt" }, { status: 400 });
  }

  const { data: set, error: setFehler } = await supabase
    .from("karteikarten_sets")
    .select("id, slug, name, user_id")
    .eq("slug", setSlug)
    .maybeSingle();

  if (setFehler) {
    return NextResponse.json({ error: setFehler.message }, { status: 500 });
  }
  if (!set) {
    return NextResponse.json({ error: "Set nicht gefunden" }, { status: 404 });
  }

  /*
   * Lesen ist fuer alle Sets erlaubt, Schreiben nicht (siehe POST). Deshalb
   * wird hier keine Besitzpruefung gemacht: Demokarten sind zum Lesen da,
   * und RLS regelt die Sichtbarkeit von Sets anderer Konten bereits.
   *
   * Der Join auf karten_fortschritt bringt den eigenen Lernstand je Karte.
   * Der Filter `.eq("fortschritt.user_id", user.id)` steht in beiden
   * Lese-Routen, und die naheliegende Sorge ist, dass er Karten OHNE
   * Fortschrittszeile wegfiltert – dann waere ein frisches Konto ueberall
   * bei null Karten und die App wuerde "nichts zu lernen" behaupten.
   *
   * Gemessen am 2026-09-30 gegen die echte Datenbank: es passiert nicht.
   * Das Auditkonto hatte null Zeilen in karten_fortschritt und bekam
   * trotzdem alle 100 Karten des Demosets zurueck, jede mit den
   * Nullwerten aus `zeile?.stufe ?? 0`. Der Grund ist der Hinweis im
   * Embed (`!karten_fortschritt_karte_id_fkey`): er legt eine
   * To-One-Beziehung fest, und die Bedingung wandert ins ON eines Left
   * Joins – Elternzeilen ohne Treffer bleiben erhalten. Ohne den Hinweis
   * waere es ein Inner Join und genau die Katastrophe.
   *
   * Deshalb steht hier kein `gekuerzt` als Notnagel, sondern `anzahl` als
   * die Zahl der gelieferten Zeilen – und weil dieselbe Semantik auch in
   * app/api/lernen/route.ts gilt, ist `kartenGesamt` dort der echte
   * Bestand und kein Teil davon.
   */
  const { data, error } = await supabase
    .from("karten")
    .select(
      "id, frage, antwort, beispielsatz, beispiel_uebersetzung, " +
        "fortschritt:karten_fortschritt!karten_fortschritt_karte_id_fkey(stufe, gelernt, faellig_am, fehler)",
    )
    .eq("set_id", set.id)
    /*
     * ZWEI Sortierschluessel, nicht einer. `created_at` allein ist hier eine
     * Lotterie, und das war nicht immer so:
     *
     * Bei einem Set, das ueber /api/karten mit 40 Paaren auf einmal entsteht,
     * bekommen alle Karten in derselben INSERT-Anweisung denselben
     * `now()`. Gemessen am Demovorsatz: 100 Karten, EIN Zeitstempel
     * (2026-09-29T16:55:36.997968). Bei gleichem Wert entscheidet Postgres die
     * Reihenfolge nach der physischen Lage der Zeilen – was meistens der
     * Einfuegereihenfolge entspricht und nicht garantiert ist.
     *
     * Sichtbar wurde das beim Duplizieren: nach einem Bearbeiten lieferte
     * derselbe Aufruf einmal "der" an erster Stelle und einmal "sein". Fuer den
     * Nutzer heisst das, dass er eine Zeile anzeigt und eine andere bearbeitet.
     *
     * `id` als zweiter Schluessel macht die Sache eindeutig, ohne dass sich
     * etwas aendert, wenn die Zeitstempel verschieden sind. Deshalb wird es
     * hier und in /api/lernen genauso gemacht – eine Liste, die sich beim
     * Neuladen umsortiert, ist schlimmer als eine, die gleich bleibt.
     */
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(MAX_LISTE);

  if (error) {
    const migration = migrationsMeldung(error);
    if (migration) {
      return NextResponse.json({ error: migration }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const zeilen = (data ?? []) as unknown as KartenZeile[];

  const karten = zeilen.map((karte) => {
    const zeile = Array.isArray(karte.fortschritt) ? karte.fortschritt[0] : karte.fortschritt;
    return {
      id: karte.id,
      frage: karte.frage,
      antwort: karte.antwort,
      // Leere Strings statt null: die Liste zeigt sie nur an, wenn etwas
      // drinsteht, und muss dafuer nicht erst prüfen, was die Datenbank
      // meint. Ein fehlender Beispielsatz ist ein Normalfall, kein Fehler.
      beispielsatz: karte.beispielsatz ?? "",
      beispielUebersetzung: karte.beispiel_uebersetzung ?? "",
      gelernt: zeile?.gelernt ?? false,
      stufe: zeile?.stufe ?? 0,
      fehler: zeile?.fehler ?? 0,
      faellig: (zeile?.faellig_am ?? null) !== null,
    };
  });

  return NextResponse.json({
    set: {
      slug: set.slug,
      name: set.name,
      /*
       * `user_id !== null` allein reicht nicht: ein fremdes privates Set ist
       * ueber RLS gar nicht erst geladen worden, aber `user_id !== null` waere
       * trotzdem wahr. Der Vergleich mit der Session ist deshalb noetig, und
       * liefert bei einem Demo-Set zuverlaessig `false`.
       */
      eigen: set.user_id !== null && set.user_id === user.id,
    },
    karten,
    anzahl: karten.length,
    // true, wenn die Liste abgeschnitten wurde und oben etwas fehlt.
    gekuerzt: zeilen.length >= MAX_LISTE,
  });
}

export async function POST(request: Request) {
  const { supabase, user, antwort: nichtAngemeldet } = await mitUserOder401();
  if (nichtAngemeldet) return nichtAngemeldet;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const { setSlug, frage, antwort, paare } = (body ?? {}) as {
    setSlug?: unknown;
    frage?: unknown;
    antwort?: unknown;
    paare?: unknown;
  };

  const slug = typeof setSlug === "string" ? setSlug.trim() : "";

  const fehler: Record<string, string> = {};
  if (!slug) fehler.setSlug = "Sprache fehlt";

  // Zwei Formen werden akzeptiert: ein einzelnes Paar (behaelt den alten
  // Vertrag) und ein Stapel. Sonst muesste jeder Aufrufer mitgezogen werden.
  //
  // `unknown[]` und nicht `{frage, antwort}[]`: ein Array kann auch
  // andersartige Eintraege enthalten. `paare: [null]` war ein 500 mit
  // Stacktrace, weil `pruefePaar` auf `roh.frage` eines `null` z griff.
  const rohPaare: unknown[] = Array.isArray(paare) ? paare : [{ frage, antwort }];

  if (Array.isArray(paare) && paare.length > MAX_PAARE) {
    fehler.paare = `Maximal ${MAX_PAARE} Wortpaare pro Anfrage`;
  }

  const sauber: Paar[] = [];
  rohPaare.forEach((roh, index) => {
    const feld = (name: string) => (index === 0 ? name : `${name}.${index}`);

    if (typeof roh !== "object" || roh === null) {
      fehler[feld("paare")] = "Wortpaar fehlt";
      return;
    }

    const geprueft = pruefePaar(roh as { frage?: unknown; antwort?: unknown }, index, fehler);
    if (geprueft) sauber.push(geprueft);
  });

  if (sauber.length === 0 && Object.keys(fehler).length === 0) {
    fehler.frage = "Begriff fehlt";
    fehler.antwort = "Übersetzung fehlt";
  }

  if (Object.keys(fehler).length > 0) {
    return NextResponse.json({ error: "Eingabe unvollständig", felder: fehler }, { status: 400 });
  }

  // Bei einem Fehler in Zeile 5 werden die 4 guten Zeilen nicht gespeichert.
  // Bewusst: halb gespeicherte Stapel sind schlimmer als gar keine, weil der
  // Nutzer nicht weiss, welche Woerter jetzt da sind.
  const { data: set, error: setFehler } = await supabase
    .from("karteikarten_sets")
    .select("id, name, user_id")
    .eq("slug", slug)
    .maybeSingle();

  if (setFehler) {
    return NextResponse.json({ error: setFehler.message }, { status: 500 });
  }
  if (!set) {
    return NextResponse.json({ error: "Sprache nicht gefunden" }, { status: 404 });
  }

  /*
   * In fremde Sets schreiben. Die Policy in 003 verhindert es auch, aber sie
   * liefert nur "row-level security violation" – ohne diese Prüfung bekäme man
   * eine 403 ohne Aussage darüber, was los ist. Und: die Demokarten sind
   * ausdrücklich nicht beschreibbar, sonst ändert jeder die Beispieldaten.
   */
  if (set.user_id !== user.id) {
    return NextResponse.json(
      {
        error:
          set.user_id === null
            ? `„${set.name}“ ist ein vorgefertigtes Set. Lege eine eigene Kopie an, um Wörter hinzuzufügen.`
            : "Set nicht gefunden",
      },
      { status: 403 },
    );
  }

  /*
   * Ein Insert fuer alle Paare. Das ist eine Anweisung, kein Loop: es gibt
   * keinen Halbzustand, in dem drei Woerter drin sind und das vierte fehlt.
   *
   * `faellig_am` wird hier nicht mehr gesetzt. Es ist eine Fortschrittsangabe
   * und steht seit 003 in public.karten_fortschritt – je Nutzer, je Karte.
   * Eine neue Karte ist fuer jeden neu, und karten_fortschritt bekommt seine
   * Zeile beim ersten Aufruf der Lernsitzung.
   */
  const { data, error } = await supabase
    .from("karten")
    .insert(
      sauber.map((p) => ({
        set_id: set.id,
        frage: p.frage,
        antwort: p.antwort,
        // null statt "": null heisst in 005 "noch keiner vorhanden", ein leerer
        // String hiesse "vorhanden und leer". Die Lernansicht (1.4) behandelt
        // beides gleich, aber die Wortlisten aus Phase 2 fragen spaeter nach
        // "fehlt noch einer" – und das kann nur null beantworten.
        beispielsatz: p.beispielsatz || null,
        beispiel_uebersetzung: p.beispielUebersetzung || null,
      })),
    )
    .select("id, frage, antwort, beispielsatz, beispiel_uebersetzung");

  if (error) {
    if (error.code === "42501") {
      return NextResponse.json(
        {
          error:
            "Karten konnten nicht gespeichert werden. Bitte die Migration " +
            "supabase/003-auth-und-user-daten.sql ausführen.",
        },
        { status: 403 },
      );
    }
    /*
     * 42703 = "Spalte existiert nicht". Die beiden Beisatzspalten kommen aus
     * 005; fehlen sie, schlaegt der Insert genau hier fehl. Ohne diese
     * Unterscheidung kaeme eine 500 mit einem Postgres-Satz zurueck, und die
     * Meldung spricht von einer Spalte, die der Nutzer nie gesehen hat.
     */
    if (error.code === "42703") {
      return NextResponse.json(
        {
          error:
            "Die Karten konnten nicht gespeichert werden – der Datenbank fehlen " +
            "die Beispielsatz-Spalten. Bitte supabase/005-sprachen-und-beisatz.sql " +
            "im Supabase SQL Editor ausführen.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ karten: data ?? [], anzahl: sauber.length }, { status: 201 });
}
