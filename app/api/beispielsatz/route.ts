import { NextResponse } from "next/server";
import { mitUserOder401 } from "@/lib/supabase/user";

const MAX_LAENGE = 200;

/**
 * Automatischer Beispielsatz zu einem eingegebenen Wortpaar.
 *
 * Wofuer das da ist
 * -----------------
 * Der Vokabel-Wizard will dem Nutzer lästiges Selbertippen ersparen (Plan:
 * Beispielsaetze automatisch, Nutzerwunsch). Drei Quellen, in Reihenfolge:
 *
 *   1. TATOEBE-KORPUS  – Tabelle beispielsatz_korpus (Migration 012):
 *      je normalisiertem englischen Wort der kuerzeste brauchbare Satz
 *      samt deutscher Uebersetzung. Kostenlos, sofort, deterministisch.
 *      Diese Quelle gibt es NUR fuer Englisch (en).
 *
 *   2. CACHE            – schon einmal erzeugte Saetze (beispielsatz_cache),
 *      Schluessel ist das Begriffspaar. Spart die KI-Aufrufe und haelt das
 *      Gratis-Kontingent einer Spende an den Provider frei.
 *
 *   3. KOSTENLOSE KI    – Groq, llama-3.3-70b (Gratis-Tier, kein Konto mit
 *      Kartendaten noetig). Fuer alles, was der Korpus und der Cache nicht
 *      kennen – andere Sprachen, unueblich Woerter. Der Schluessel steht in
 *      `.env` als GROQ_API_KEY. Ist er nicht gesetzt, antwortet die Route
 *      weiterhin sauber, nur ohne KI-Stueck (quelle = "keine").
 *
 * Sprachsicherheit
 * ----------------
 * `sprache` ist der Code der ZIELSPRACHE des Sets (also des Begriffs, nicht
 * der Uebersetzung). Der Tatoeba-Korpus ist Englisch-Deutsch; er wird nur
 * angefragt, wenn die Zielsprache wirklich Englisch ist. Sonst kaeme z. B.
 * fuer ein italienisches "ciao" ein englischer Satz aus dem Korpus.
 *
 * Antwortschema
 * -------------
 *   { satz, uebersetzung, quelle }
 * mit quelle "tatoeba" | "ki" | "cache" | "keine". Bei "keine" sind satz
 * und uebersetzung null – das ist kein Fehler, nur ein leeres Ergebnis.
 */

type Antwort =
  | { satz: string; uebersetzung: string; quelle: "tatoeba" | "ki" | "cache" }
  | { satz: null; uebersetzung: null; quelle: "keine" };

/** Normalisiert ein Wort fuer den Korpus-Schluessel: klein, nur a-z (Umlaute). */
function normiere(wort: string): string {
  return wort
    .toLowerCase()
    .replace(/[^a-zäöüß]/g, "")
    .trim();
}

/**
 * Ein Wort, wie ein Mensch es eintippt, muss nicht der Korpus-Schluessel
 * sein: "apple", "Apple" oder "an apple" soll trotzdem "apple" treffen.
 * Von der normalisierten Eingabe werden versuchsweise geschickt: die ganze
 * Zeichenkette und – falls mehrteilig – das letzte (i. d. R. das Nomen).
 */
function korbuskandidaten(wort: string): string[] {
  const normiert = normiere(wort);
  if (!normiert) return [];
  const teile = normiert.split(" ");
  if (teile.length === 1) return [normiert];
  return [normiert, teile[teile.length - 1]];
}

function sprachName(code: string | null | undefined): string {
  switch ((code ?? "").toLowerCase()) {
    case "en":
      return "Englisch";
    case "es":
      return "Spanisch";
    case "it":
      return "Italienisch";
    case "fr":
      return "Französisch";
    case "de":
      return "Deutsch";
    case "pt":
      return "Portugiesisch";
    case "ru":
      return "Russisch";
    case "tr":
      return "Türkisch";
    case "nl":
      return "Niederländisch";
    case "pl":
      return "Polnisch";
    default:
      return "derselben Sprache wie das Wort";
  }
}

/**
 * Gespraech mit der kostenlosen KI (Groq, llama-3.3-70b). Liefert
 * { satz, uebersetzung } oder null, wenn nichts Brauchbares zurueckkommt.
 */
async function frageKi(
  frage: string,
  antwort: string,
  sprache: string | null,
): Promise<{ satz: string; uebersetzung: string } | null> {
  const schluessel = process.env.GROQ_API_KEY;
  if (!schluessel) return null;

  const system:
    | "Du erfindest kurze, natuerliche Beispielsaetze fuer Vokabellernende."
    | string = "Du erfindest kurze, natuerliche Beispielsaetze fuer Vokabellernende.";

  const ziel = sprachName(sprache);

  const prompt =
    `Erfinde EINEN kurzen, natuerlichen Beispielsatz in ${ziel}, ` +
    `in dem das Wort „${frage}“ vorkommt. Der Satz ist das Wort in Aktion, ` +
    `nicht eine Definition. Dazu die deutsche Uebersetzung des ganzen Satzes.\n` +
    `Die Vokabel lautet: ${frage} → ${antwort}.\n\n` +
    `Antworte NUR mit JSON, ohne Codeblock, in dieser Form:\n` +
    `{"satz":"<Beispielsatz>","uebersetzung":"<deutsche Uebersetzung>"}`;

  const steuerung = new AbortController();
  const timeout = setTimeout(() => steuerung.abort(), 15_000);

  try {
    const antwortFetch = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${schluessel}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model:
          process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        temperature: 0.4,
        max_tokens: 400,
        response_format: { type: "json_object" },
      }),
      signal: steuerung.signal,
    });

    if (!antwortFetch.ok) {
      console.error(`Groq: HTTP ${antwortFetch.status} ${(await antwortFetch.text()).slice(0, 200)}`);
      return null;
    }

    const daten = (await antwortFetch.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const inhalt = daten.choices?.[0]?.message?.content ?? "";

    const gematcht = inhalt.match(/\{[\s\S]*\}/);
    if (!gematcht) return null;

    const objekt = JSON.parse(gematcht[0]) as {
      satz?: unknown;
      uebersetzung?: unknown;
    };
    const satz = typeof objekt.satz === "string" ? objekt.satz.trim() : "";
    const uebersetzung =
      typeof objekt.uebersetzung === "string" ? objekt.uebersetzung.trim() : "";

    if (!satz || !uebersetzung || satz.length > MAX_LAENGE + 100) return null;
    return { satz, uebersetzung };
  } catch (fehler) {
    // Abort (Timeout) genauso wie kaputtes JSON: nicht die Route zum Hopps
    // bringen, nur kein Resultat liefern.
    console.error(`Groq: ${fehler instanceof Error ? fehler.message : String(fehler)}`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: Request) {
  const { supabase, user, antwort: nichtAngemeldet } = await mitUserOder401();
  if (nichtAngemeldet) return nichtAngemeldet;
  void user;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const { frage: rohFrage, antwort: rohAntwort, sprache: rohSprache } = (body ?? {}) as {
    frage?: unknown;
    antwort?: unknown;
    sprache?: unknown;
  };

  const frage = typeof rohFrage === "string" ? rohFrage.trim() : "";
  const antwort = typeof rohAntwort === "string" ? rohAntwort.trim() : "";
  const sprache = typeof rohSprache === "string" && rohSprache.trim() ? rohSprache.trim() : null;

  const fehler: Record<string, string> = {};
  if (!frage) fehler.frage = "Begriff fehlt";
  else if (frage.length > MAX_LAENGE) fehler.frage = `Maximal ${MAX_LAENGE} Zeichen`;
  if (!antwort) fehler.antwort = "Übersetzung fehlt";
  else if (antwort.length > MAX_LAENGE) fehler.antwort = `Maximal ${MAX_LAENGE} Zeichen`;

  if (Object.keys(fehler).length > 0) {
    return NextResponse.json({ error: "Eingabe unvollständig", felder: fehler }, { status: 400 });
  }

  /*
   * 1. Tatoeba-Korpus – aber nur, wenn die Zielsprache wirklich Englisch
   *    ist. Der Korpus kennt nur EN→DE; ein spanischer Begriff gehoert nicht
   *    durch diese Tuer.
   */
  if ((sprache ?? null)?.toLowerCase() === "en") {
    for (const kandidat of korbuskandidaten(frage)) {
      const { data: treffer } = await supabase
        .from("beispielsatz_korpus")
        .select("satz, uebersetzung")
        .eq("wort", kandidat)
        .maybeSingle();

      if (treffer?.satz) {
        return NextResponse.json({
          satz: treffer.satz,
          uebersetzung: treffer.uebersetzung,
          quelle: "tatoeba",
        } satisfies Antwort);
      }
    }
  }

  /*
   * 2. Cache. Der Schluessel ist das eingetippte Paar, normalisiert in
   *    Kleinbuchstaben, damit "Apfel" und "apfel" nicht zwei Aufrufe an die
   *    KI ausloesen. In die Tabelle wird normalisiert geschrieben (Migration
   *    indiziert ebenfalls auf lower).
   */
  const schluessel = {
    frage: frage.toLowerCase().trim(),
    antwort: antwort.toLowerCase().trim(),
  };

  const { data: cacheZeile } = await supabase
    .from("beispielsatz_cache")
    .select("satz, uebersetzung, quelle")
    .eq("frage", schluessel.frage)
    .eq("antwort", schluessel.antwort)
    .maybeSingle();

  if (cacheZeile?.satz) {
    return NextResponse.json({
      satz: cacheZeile.satz,
      uebersetzung: cacheZeile.uebersetzung,
      quelle: cacheZeile.quelle === "ki" ? "cache" : "tatoeba",
    } satisfies Antwort);
  }

  /*
   * 3. Kostenlose KI. Ohne Groq-Schluessel in .env fällt sie aus, und die
   *    Antwort ist ehrlich "keine" – kein Fehler, nur nichts.
   */
  const vonKi = await frageKi(frage, antwort, sprache);
  if (!vonKi) {
    return NextResponse.json({ satz: null, uebersetzung: null, quelle: "keine" }, { status: 200 });
  }

  /*
   * Ins Cache legen, damit derselbe Ausdruck nicht noch einmal an die KI
   * geht. `insert` statt `upsert`: ein bestehender Eintrag aus einer anderen
   * Sitzung ist genauso gut, und den Datenbank-Konflikt koennen wir getrost
   * ignorieren (das Ergebnis ist dann eben das schon vorhandene).
   */
  const { error: cacheFehler } = await supabase
    .from("beispielsatz_cache")
    .insert({
      frage: schluessel.frage,
      antwort: schluessel.antwort,
      satz: vonKi.satz,
      uebersetzung: vonKi.uebersetzung,
      quelle: "ki",
    })
    .select("satz")
    .single();

  if (cacheFehler) {
    console.error(`Cache-Insert: ${cacheFehler.message}`);
  }

  return NextResponse.json(
    { satz: vonKi.satz, uebersetzung: vonKi.uebersetzung, quelle: "ki" },
    { status: 200 },
  );
}