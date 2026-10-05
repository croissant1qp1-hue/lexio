import { NextResponse } from "next/server";
import { mitUserOder401 } from "@/lib/supabase/user";
import { migrationsMeldung } from "@/lib/db-fehler";
import { doppelteIndizes, duplikatMeldung } from "@/lib/karten-duplikat";

const MAX_LAENGE = 200;
const MAX_SATZ = 300;

/**
 * Hoechstes Laenge der Beisaetze. Gleiche Grenze wie in /api/karten, und aus
 * demselben Grund: ein Beispielsatz ist ein Satz, keine Beschreibung.
 *
 * Bewusst hier und nicht importiert. Die Datei app/api/karten/route.ts ist
 * eine Route, und Next.js erlaubt Route-Dateien nur HTTP-Methoden und
 * `config` als Export. Eine gemeinsame Datei mit beiden Grenzen waere
 * sauberer – und wuerde bedeuten, die Validierung selbst zu verschieben.
 * Sie liegt deshalb in lib/, sobald sie von einer dritten Stelle gebraucht
 * wird. Bis dahin steht sie zweimal, aber jeweils mit dem Kommentar, warum.
 */
type Supabase = Awaited<ReturnType<typeof mitUserOder401>>["supabase"];

/**
 * PATCH /api/karten/<id>  –  eine Karte aendern
 * DELETE /api/karten/<id> – eine Karte loeschen
 *
 * Beides geht ueber die Karten-ID, nicht ueber den Slug: der Slug gehoert zum
 * Set, und ein Set kann 500 Karten haben. Fuer das Bearbeiten einer einzelnen
 * Zeile waere ein Weg ueber Set-Slug-plus-Position eine Umrechnung, die
 * stimmen muss – und die beim Sortieren schon wieder falsch ist.
 *
 * Der Besitz wird wie bei den Sets zweimal geprueft: hier, damit die Meldung
 * verstaendlich ist, und in der Policy aus Migration 003, damit sie auch dann
 * greift, wenn jemand die PostgREST-Adresse direkt aufruft. Die UPDATE-Policy
 * fuer `karten` erlaubt genau das bereits: Karten in Sets, deren
 * `user_id = auth.uid()`. Es braucht keine Migration fuer diese Route.
 *
 * `karten` hat selbst keine `user_id`-Spalte. Der Weg von der Karte zum
 * Besitzer laeuft deshalb ueber `set_id` -> `karteikarten_sets.user_id`, und
 * das ist auch der Grund, warum hier kein `user_id = null`-Fall auftaucht wie
 * bei den Sets: eine Karte kann nicht ohne Set existieren, und ein Set ohne
 * Besitzer kann keine Karten haben (ON DELETE CASCADE).
 */
async function karteOderFehler(
  supabase: Supabase,
  userId: string,
  id: string,
): Promise<{ karte: { id: string; set_id: string; frage: string; antwort: string; beispielsatz: string | null; beispiel_uebersetzung: string | null } } | { antwort: NextResponse }> {
  if (!id) {
    return {
      antwort: NextResponse.json({ error: "Parameter 'id' fehlt" }, { status: 400 }),
    };
  }

  const { data: karte, error } = await supabase
    .from("karten")
    .select("id, set_id, frage, antwort, beispielsatz, beispiel_uebersetzung")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return { antwort: NextResponse.json({ error: error.message }, { status: 500 }) };
  }
  if (!karte) {
    return { antwort: NextResponse.json({ error: "Karte nicht gefunden" }, { status: 404 }) };
  }

  /*
   * Der Besitzer des Sets ist der Besitzer der Karte. Wird das Set nicht
   * gefunden, ist auch die Karte fuer diesen Nutzer nicht da – 404 wie bei
   * einem fremden Set, damit die Existenz fremder Karten nicht bestaetigt wird.
   */
  const { data: set, error: setFehler } = await supabase
    .from("karteikarten_sets")
    .select("id, user_id")
    .eq("id", karte.set_id)
    .maybeSingle();

  if (setFehler) {
    return { antwort: NextResponse.json({ error: setFehler.message }, { status: 500 }) };
  }
  if (!set || set.user_id !== userId) {
    return { antwort: NextResponse.json({ error: "Karte nicht gefunden" }, { status: 404 }) };
  }

  return { karte };
}

/**
 * Aendert eine Karte in einem eigenen Set.
 *
 * Body: `{ frage?, antwort?, beispielsatz?, beispielUebersetzung? }`
 *
 * Nur was geschickt wird, wird geschrieben. Das ist wichtig fuer die
 * Beisaetze: ein leeres Textfeld heisst in der Oberflaeche "der Nutzer hat
 * den Beispielsatz geloescht", und das muss auch so ankommen. Ohne
 * Unterscheidung zwischen "nicht geschickt" und "leer geschickt" waere ein
 * leeres Feld unmoeglich, und der Nutzer koennte einen vorhandenen Satz nie
 * wieder loswerden.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { supabase, user, antwort: nichtAngemeldet } = await mitUserOder401();
  if (nichtAngemeldet) return nichtAngemeldet;

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const { frage, antwort, beispielsatz, beispielUebersetzung } = (body ?? {}) as {
    frage?: unknown;
    antwort?: unknown;
    beispielsatz?: unknown;
    beispielUebersetzung?: unknown;
  };

  const willFrage = frage !== undefined;
  const willAntwort = antwort !== undefined;
  const willBeispiel = beispielsatz !== undefined;
  const willBeispielUebersetzung = beispielUebersetzung !== undefined;

  if (!willFrage && !willAntwort && !willBeispiel && !willBeispielUebersetzung) {
    return NextResponse.json(
      { error: "Nichts zu ändern – Begriff, Übersetzung oder Beispielsatz schicken." },
      { status: 400 },
    );
  }

  const aenderung: Record<string, string | null> = {};
  const felder: Record<string, string> = {};

  /*
   * Die Pflichtfelder. `frage` und `antwort` sind in der Datenbank NOT NULL,
   * und ein leerer Begriff ergibt eine Karte, die beim Lernen nichts anzeigt.
   * Deshalb: leer schicken ist ein Fehler, nicht ein "leer machen".
   */
  if (willFrage) {
    const wert = typeof frage === "string" ? frage.trim() : "";
    if (!wert) felder.frage = "Begriff fehlt";
    else if (wert.length > MAX_LAENGE) felder.frage = `Maximal ${MAX_LAENGE} Zeichen`;
    else aenderung.frage = wert;
  }

  if (willAntwort) {
    const wert = typeof antwort === "string" ? antwort.trim() : "";
    if (!wert) felder.antwort = "Übersetzung fehlt";
    else if (wert.length > MAX_LAENGE) felder.antwort = `Maximal ${MAX_LAENGE} Zeichen`;
    else aenderung.antwort = wert;
  }

  /*
   * Die Beisaetze sind optional, also ist hier ein leerer String erlaubt und
   * heisst "loeschen". Gespeichert wird `null`, weil "" in der Spalte
   * "vorhanden und leer" bedeutet und null "noch keiner" – dieselbe
   * Unterscheidung wie beim Anlegen (POST /api/karten).
   */
  if (willBeispiel) {
    const wert = typeof beispielsatz === "string" ? beispielsatz.trim() : "";
    if (wert.length > MAX_SATZ) felder.beispielsatz = `Maximal ${MAX_SATZ} Zeichen`;
    else aenderung.beispielsatz = wert || null;
  }

  if (willBeispielUebersetzung) {
    const wert = typeof beispielUebersetzung === "string" ? beispielUebersetzung.trim() : "";
    if (wert.length > MAX_SATZ) {
      felder.beispielUebersetzung = `Maximal ${MAX_SATZ} Zeichen`;
    } else aenderung.beispiel_uebersetzung = wert || null;
  }

  if (Object.keys(felder).length > 0) {
    return NextResponse.json({ error: "Eingabe unvollständig", felder }, { status: 400 });
  }

  const geprueft = await karteOderFehler(supabase, user.id, id);
  if ("antwort" in geprueft) return geprueft.antwort;
  const karte = geprueft.karte;

  /*
   * Dieselbe Dublettenfrage wie beim Anlegen — sonst waere die Sperre dort nur
   * Dekoration: `bearbeiten` macht dasselbe Paar genauso leicht wie `hinzufuegen`.
   *
   * Geprueft wird nur, wenn sich tatsaechlich Begriff oder Uebersetzung
   * aendern. Wird nur ein Beispielsatz gepflegt, ist das Paar unveraendert, und
   * eine Meldung wie "steht schon in diesem Set" waere dann einfach falsch.
   * (`aenderung` enthaelt nur die Felder, die wirklich neu geschrieben werden,
   * `null` bedeutet hier "loeschen", nicht "unveraendert".)
   */
  if (aenderung.frage !== undefined || aenderung.antwort !== undefined) {
    /*
     * Ohne `limit`, aus demselben Grund wie beim Anlegen: eine stillschweigende
     * Grenze waere eine Pruefung, die ab einer gewissen Menge nicht mehr prueft.
     * Die eigene Karte ist per `neq` ausgenommen — sonst waere jede Karte für
     * sich selbst ein Duplikat.
     */
    const { data: bestand, error: bestandFehler } = await supabase
      .from("karten")
      .select("frage, antwort")
      .eq("set_id", karte.set_id)
      .neq("id", karte.id);

    if (bestandFehler) {
      return NextResponse.json({ error: bestandFehler.message }, { status: 500 });
    }

    const endFrage = aenderung.frage ?? karte.frage;
    const endAntwort = aenderung.antwort ?? karte.antwort;

    if (
      doppelteIndizes(
        [{ frage: endFrage, antwort: endAntwort }],
        (bestand ?? []) as { frage: string; antwort: string }[],
      ).length > 0
    ) {
      const paar = { frage: endFrage, antwort: endAntwort };
      return NextResponse.json(
        { error: "Doppeltes Wortpaar", felder: { frage: duplikatMeldung(paar) } },
        { status: 400 },
      );
    }
  }

  /*
   * `.eq("set_id", karte.set_id)` ist hier Pflicht und nicht Redundanz. Die
   * UPDATE-Policy aus Migration 003 hat ein `using` (welche Zeilen darf ich
   * anfassen) aber KEIN `with check` (in welches Set darf ich sie hinein
   * schieben). Ohne diesen Filter koennte ein Aufrufer `set_id` mitschicken
   * und die Karte in ein fremdes Set verschieben – von dort waere sie fuer
   * den Besitzer unsichtbar und fuer niemanden mehr erreichbar.
   */
  const { data, error } = await supabase
    .from("karten")
    .update(aenderung)
    .eq("id", karte.id)
    .eq("set_id", karte.set_id)
    .select("id, frage, antwort, beispielsatz, beispiel_uebersetzung")
    .single();

  if (error) {
    const migration = migrationsMeldung(error);
    if (migration) {
      return NextResponse.json({ error: migration }, { status: 503 });
    }
    if (error.code === "42501") {
      return NextResponse.json(
        {
          error:
            "Die Karte konnte nicht geändert werden. Bitte die Migration " +
            "supabase/migrations/003-auth-und-user-daten.sql ausführen.",
        },
        { status: 403 },
      );
    }
    /*
     * 42703 = Spalte existiert nicht. Die beiden Beisatzspalten kommen aus
     * Migration 005; schickt der Aufrufer "beispielsatz" gegen eine Datenbank
     * ohne diese Spalte, kommt genau hier der Fehler. Die Meldung nennt 005,
     * nicht 003 – siehe dasselbe Muster in POST /api/karten.
     */
    if (error.code === "42703") {
      return NextResponse.json(
        {
          error:
            "Die Karte konnte nicht geändert werden – der Datenbank fehlen " +
            "die Beispielsatz-Spalten. Bitte supabase/migrations/005-sprachen-und-beisatz.sql " +
            "im Supabase SQL Editor ausführen.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ karte: data });
}

/**
 * Loescht eine Karte aus einem eigenen Set.
 *
 * Was mitgeht: die Zeile in `karten_fortschritt` verschwindet ueber
 * ON DELETE CASCADE (Migration 003). Das ist richtig – der Lernstand gehoert
 * zu genau dieser Karte, und eine verwaiste Zeile waere ein Platzhalter, den
 * kein Code mehr liest.
 *
 * Bewusst kein undo, aus demselben Grund wie beim Loeschen eines Sets:
 * Postgres kennt ueber HTTP keine Transaktionen. Die Oberflaeche fragt vorher
 * nach und nennt die Vokabel, damit klar ist, was verschwindet.
 */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { supabase, user, antwort: nichtAngemeldet } = await mitUserOder401();
  if (nichtAngemeldet) return nichtAngemeldet;

  const { id } = await context.params;

  const geprueft = await karteOderFehler(supabase, user.id, id);
  if ("antwort" in geprueft) return geprueft.antwort;
  const karte = geprueft.karte;

  /**
   * `.select("id")` ist nicht Kosmetik: ohne das gibt supabase-js nur `error`
   * zurueck, und ein von RLS stillschweigend auf 0 Zeilen reduziertes DELETE
   * gilt darin als Erfolg. Die Route meldete dann "geloescht", obwohl die
   * Karte munter weiter existiert. Siehe das gleiche Argument in
   * DELETE /api/sets/[slug].
   */
  const { data: geloescht, error } = await supabase
    .from("karten")
    .delete()
    .eq("id", karte.id)
    .eq("set_id", karte.set_id)
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!geloescht || geloescht.length === 0) {
    return NextResponse.json(
      {
        error:
          "Karte konnte nicht gelöscht werden. Die Löschrechte fehlen – bitte die " +
          "Migration supabase/migrations/003-auth-und-user-daten.sql ausführen.",
      },
      { status: 403 },
    );
  }

  return NextResponse.json({ geloescht: { id: karte.id, frage: karte.frage } });
}