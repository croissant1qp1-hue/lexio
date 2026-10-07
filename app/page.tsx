import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { holeUser } from "@/lib/supabase/user";
import Kartenzeichen from "@/components/kartenzeichen";
import { INTERVALLE } from "@/lib/lernlogik";
import styles from "./landing.module.css";

/**
 * Die oeffentliche Startseite.
 *
 * Vorher lag an "/" die Uebersicht – hinter der Anmeldung, mit `noindex` aus
 * dem (app)-Layout. Das Ergebnis war: die Domain war fuer niemanden ausser
 * Lexio etwas wert. Wer die Adresse kannte, sah ein Anmeldeformular; fuer
 * Suchmaschinen gab es eine leere Sitemap, weil es keine einzige indexierbare
 * Seite gab.
 *
 * Diese Seite ist die Draussenfassade. Sie holt keine Daten aus der App, sie
 * zeigt, was Lexio tut, und verweist auf /anmelden.
 *
 * Zwei Entscheidungen, die wichtig sind:
 *
 *   1. **Der Umzug der Uebersicht.** Die App-Startseite liegt jetzt unter
 *      `/uebersicht`. Wer `/` aufruft und angemeldet ist, wird umgeleitet –
 *      alte Lesezeichen, geteilte Links und der Nach-dem-Login-Sprung
 *      (`weiter` ist auf "/" gesetzt) laufen also unveraendert weiter. Die
 *      Alternative waere gewesen, die Werbeseite auf einen Umwegpfad zu
 *      legen: erreichbar, aber ohne Adresse, die jemandem aufs Handy gesendet
 *      wird. Genau die fehlt.
 *
 *   2. **Nur "angemeldet" oder "nicht angemeldet".** `holeUser` unterscheidet
 *      drei Faelle, und der dritte ist wichtig: Ist Supabase gerade nicht
 *      erreichbar, ist die Sitzung *unklar*, nicht *weg*. Diese Seite leitet
 *      in dem Fall NICHT um. Ein Ausfall von fuenf Sekunden darf niemanden
 *      aus der App in ein Anmeldeformular werfen – dieselbe Sorge, aus der
 *      `lib/supabase/user.ts` die Datei ueberhaupt entstanden ist.
 */
export const metadata: Metadata = {
  title: "Lexio – Vokabeln lernen mit Beispielsaetzen",
  description:
    "Lexio ist ein Vokabeltrainer für Deutsch und Englisch: Karteikarten mit Beispielsaetzen, gestufte Wiederholung von 1 bis 60 Tagen, Statistiken und eigene Wortlisten.",
  // Ausdrücklich, auch wenn der Vorgabe schon indexierbar ist: die App trägt
  // `noindex` zentral, und diese Seite ist genau der Ort, an dem sich das
  // Gegenteil ausnahmsweise durchsetzen muss.
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
  openGraph: {
    title: "Lexio – Vokabeln lernen mit Beispielsaetzen",
    description:
      "Karteikarten mit Beispielsaetzen, gestufte Wiederholung und Statistiken. Starte ohne Abo mit einem Set aus 100 englischen Grundworten.",
    type: "website",
    // Eigenes openGraph ersetzt das des Layouts vollstaendig (Next mischt
    // diese Gruppe nicht tief zusammen) – ohne url und images waere der
    // Share-Link dieser Seite die Startseite und das Vorschaubild fehlte.
    url: "/",
    siteName: "Lexio",
    locale: "de_DE",
    images: ["/images/og-1200x630.png"],
  },
};

type Beispiel = {
  id: string;
  frage: string;
  antwort: string;
  satz: string;
};

/*
 * Drei echte Karten aus dem Starter-Set `englisch-grundlagen` – so, wie sie
 * am 2026-09-29 importiert wurden. Fest verdrahtet statt aus der Datenbank
 * geholt: eine Landing-Page darf an einem Supabase-Ausfall nicht
 * kaputtgehen, und drei Zahlen, die sich nicht aendern, sind keine
 * Datenabfrage wert. Wer hier etwas erfindet, wäre genau die Sorte von
 * Werbung, die die Seite nicht verdient.
 */
const BEISPIELE: Beispiel[] = [
  {
    id: "6f1d3c2e-0000-4000-8000-000000000001",
    frage: "welcher",
    antwort: "which",
    satz: "Which one do you take?",
  },
  {
    id: "6f1d3c2e-0000-4000-8000-000000000002",
    frage: "mögen",
    antwort: "like",
    satz: "I don't like you anymore.",
  },
  {
    id: "6f1d3c2e-0000-4000-8000-000000000003",
    frage: "von",
    antwort: "from",
    satz: "People from Madrid are weird.",
  },
];

const SCHRITTE = [
  {
    titel: "Anmelden",
    text: "E-Mail-Adresse und Passwort. Es gibt keine Testphase und keine Karte, die du hinterlegen musst.",
  },
  {
    titel: "Set wählen oder eigenes importieren",
    text: "Direkt loslegen mit 100 englischen Grundworten – oder eine eigene Wortliste als .txt, .csv oder .tsv hochladen.",
  },
  {
    titel: "Täglich wiederholen",
    text: "Vier Bewertungen statt richtig oder falsch. Eine Karte kommt erst wieder, wenn sie dran ist.",
  },
];

/*
 * Die Abstände stehen als Text in `lib/lernlogik.ts`, weil die App damit
 * arbeitet. Sie hier abzuschreiben waere eine zweite Wahrheit, die irgendwann
 * falsch wird, ohne dass jemand es merkt – beide Zahlen sehen plausibel aus.
 */
const ABSTAENDE = INTERVALLE.slice(1);

const KANNEN = [
  "Beispielsatz zu jedem Wort – damit das Wort in einem Satz hängen bleibt, nicht allein auf einer Karte.",
  `Gestufte Wiederholung: ${ABSTAENDE.join(", ")} Tage. Wer eine Karte ${ABSTAENDE[ABSTAENDE.length - 1]} Tage nicht gebraucht hat, kennt sie.`,
  "Statistik über Wörter, nicht über Tage: XP, Serie, Fortschritt je Vokabel.",
  "Eigene Wortlisten importieren, jederzeit.",
  "Sprachausgabe für jedes englische Wort.",
  "Tägliche Erinnerung, damit die Serie nicht abreißt.",
  "Hell oder dunkel, und jedes Wort bekommt ein eigenes Zeichen.",
];

export default async function Startseite() {
  const supabase = await createClient();
  const { user } = await holeUser(supabase);
  if (user) redirect("/uebersicht");

  return (
    <div className={styles.seite}>
      {/* Erster Fokusschritt, wie in (app)/layout.tsx – siehe .skipLink. */}
      <a href="#inhalt" className="skipLink">
        Zum Inhalt springen
      </a>
      <header className={styles.kopf}>
        <div className={styles.marke}>
          <span className={styles.wort}>Lexio</span>
        </div>
        <nav className={styles.nav}>
          <Link href="/anmelden">Anmelden</Link>
        </nav>
      </header>

      <main id="inhalt" className={styles.main} tabIndex={-1}>
        <section className={styles.held}>
          <h1>Vokabeln lernen, das hängen bleibt.</h1>
          <p className={styles.vorspann}>
            Lexio ist ein Vokabeltrainer für Deutsch und Englisch. Die Karte zeigt
            den deutschen Begriff, auf der Rückseite das englische Wort mit einem
            Beispielsatz. Wiederholt wird, bis eine Karte sitzt – und dann seltener.
          </p>
          <div className={styles.aktionen}>
            <Link href="/anmelden" className={styles.knopf}>
              Erste Runde starten
            </Link>
            <Link href="/anmelden" className={styles.knopfLeise}>
              Ich habe schon ein Konto
            </Link>
          </div>
          <p className={styles.klein}>
            100 englische Grundwörter sind schon drin. Nur eine E-Mail-Adresse nötig.
          </p>
        </section>

        <section className={styles.beispiele} aria-label="Beispielkarten">
          {BEISPIELE.map((b) => (
            <article key={b.id} className={styles.karte}>
              <div className={styles.karteZeile}>
                <Kartenzeichen karteId={b.id} begriff={b.frage} uebersetzung={b.antwort} />
                <div>
                  <p className={styles.karteBegriff}>{b.frage}</p>
                  {/* lang=en, sonst liest eine deutsche Stimme die
                      englische Aussprache nach – und wer eine englische
                      Hilfe liest, bekommt sie englisch vorgelesen. */}
                  <p className={styles.karteAntwort} lang="en">
                    {b.antwort}
                  </p>
                </div>
              </div>
              <p className={styles.karteSatz} lang="en">
                {b.satz}
              </p>
            </article>
          ))}
        </section>

        <section className={styles.ablauf}>
          <h2>So läuft es ab</h2>
          <ol className={styles.schritte}>
            {SCHRITTE.map((s) => (
              <li key={s.titel} className={styles.schritt}>
                <h3>{s.titel}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.kann}>
          <h2>Was Lexio kann</h2>
          <ul className={styles.liste}>
            {KANNEN.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ul>
          <p className={styles.klein}>
            Abstände: {ABSTAENDE.join(", ")} Tage. Diese Liste steht in
            `lib/lernlogik.ts`, und die Seite liest sie von dort – die Zahl oben
            ist also keine Werbung, sondern die, mit der die App arbeitet.
          </p>
        </section>

        <section className={styles.schluss}>
          <h2>Bereit für die erste Runde?</h2>
          <p>
            Das Set &bdquo;Englisch Grundlagen&ldquo; wartet. Du kannst sofort anfangen und
            später deine eigenen Wortlisten dazunehmen.
          </p>
          <Link href="/anmelden" className={styles.knopf}>
            Konto anlegen
          </Link>
        </section>
      </main>

      <footer className={styles.fuss}>
        {/*
         * Die Quellen stehen im Fuss, nicht in einem eigenen Menuepunkt.
         *
         * Die Wortlisten sind Bearbeitungen fremder Quellen unter CC BY-SA.
         * Share-Alike verlangt die Quellenangabe dort, wo die Inhalte
         * abrufbar sind – ein Link im Fuss reicht dafuer, und er steht auf
         * jeder Seite, die jemand ohne Konto sieht. Wer nach der Herkunft
         * der englischen Sets fragt, muss nicht erst in den Einstellungen
         * suchen.
         */}
        <Link href="/quellen">Quellen der Wortlisten</Link>
        <Link href="/anmelden">Anmelden</Link>
        <span className={styles.klein}>
          Alle Daten liegen bei dir im Konto. Diese Seite nennt nur, was Lexio tut.
        </span>
      </footer>
    </div>
  );
}