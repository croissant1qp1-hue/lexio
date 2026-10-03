import type { Metadata } from "next";
import Link from "next/link";
import styles from "./quellen.module.css";

/**
 * Quellen und Lizenzen der vorinstallierten Wortlisten.
 *
 * Der Grund fuer diese Seite ist nicht Formalismus. Die englischen Sets
 * enthalten Wortlisten, Uebersetzungen und Beispielsaetze aus fremden
 * Quellen – NGSL, Kaikki/Wiktionary, Tatoeba. NGSL und Kaikki stehen unter
 * CC-BY-SA 4.0, Tatoeba unter einer Sammlung freier Lizenzen. Wer die Listen
 * erzeugt hat, muss sie nur weitergeben, wenn er sie weitergibt. Das ist mit
 * einem Satz im Code nicht erledigt: die Quellenangabe muss dort stehen, wo
 * jemand sie lesen kann, also oeffentlich und ohne Anmeldung.
 *
 * Ehrlichkeit in beide Richtungen: der Umfang. Die Listen enthalten Wörter,
 * die ueber die CCFR-Stufen hinausgehen. Das ist Absicht – NGSL ist nach
 * Worthaeufigkeit sortiert, nicht nach Lernniveau, und Lexio ist bisher
 * keine Plattform mit definierten Niveaustufen. Wer die englische
 * Wortliste anfaengt, braucht ein Woerterbuch daneben. Das steht hier, weil
 * es im Produkt sonst nirgends nachlesbar waere.
 */

export const metadata: Metadata = {
    /*
     * Ohne den Markennamen im Titel: app/layout.tsx haengt per
     * `title.template` " · Lexio" an jeden Seitentitel. Ein Titel, der den
     * Namen schon selbst traegt, ergibt sonst "Quellen der Wortlisten – Lexio
     * · Lexio". Genau das stand dort zuerst.
     */
    title: "Quellen der Wortlisten",
    description:
        "Woher die englischen Wortlisten in Lexio kommen: NGSL, Kaikki/Wiktionary und Tatoeba – mit Lizenzen und Quellenangabe.",
    alternates: { canonical: "/quellen" },
};

const QUELLEN = [
    {
        name: "NGSL – New General Service List",
        bereich: "Auswahl der englischen Wörter und ihre Reihenfolge",
        lizenz: "CC BY-SA 4.0",
        url: "https://github.com/FabriceBoyer/word_lists",
        hinweis:
            "Die Auswahl folgt der Worthaeufigkeit, keinem Lernniveau. Aus diesem Grund heissen die Sets „Alltag“ und „Ausbau“ und nicht etwa „A1“ oder „B1“.",
    },
    {
        name: "Kaikki – Wiktionary-Dump (Englisch, Deutsch)",
        bereich: "Deutsche Uebersetzungen und Wortarten",
        lizenz: "CC BY-SA 4.0",
        url: "https://kaikki.org/dictionary/English/",
        hinweis:
            "Zu einem Wort nennt Wiktionary oft mehrere Bedeutungen. Lexio waehlt die zur deutschen Uebersetzung passende Bedeutung und legt Karten mit unpassender Bedeutung nicht an.",
    },
    {
        name: "Tatoeba – Beispielsatzpaare (Englisch/Deutsch)",
        bereich: "Beispielsatz und deutsche Uebersetzung",
        lizenz: "je Satz verschieden, überwiegend CC BY 2.0 FR",
        url: "https://tatoeba.org/de",
        hinweis:
            "Die Beispielsätze wurden nach den Kriterien der Quellen ausgewaehlt: kurze, vollstaendige Saetze, die zur Karte passen.",
    },
];

export default function QuellenSeite() {
    return (
        <main className={styles.seite}>
            <div className={styles.kopf}>
                <Link href="/" className={styles.zurueck}>
                    &larr; Lexio
                </Link>
            </div>

            <article className={styles.text}>
                <h1>Quellen der Wortlisten</h1>

                <p className={styles.einleitung}>
                    Die englischen Wortlisten sind der Teil von Lexio, der nicht von mir erfunden wurde.
                    Die englischen Sets in allen Sprachversionen gehen auf die Wortlisten und Wörterbücher
                    zurück, aus denen sie erzeugt wurden. Diese Listen sind Creative-Commons-lizenziert –
                    deshalb steht hier, woher sie kommen, und unter welcher Lizenz sie stehen.
                </p>

                <h2>Drei Quellen</h2>
                <dl className={styles.liste}>
                    {QUELLEN.map((q) => (
                        <div key={q.name} className={styles.eintrag}>
                            <dt>
                                {q.name}
                                <span className={styles.lizenz}>{q.lizenz}</span>
                            </dt>
                            <dd>
                                <p>{q.bereich}</p>
                                <p className={styles.hinweis}>{q.hinweis}</p>
                                <a
                                    href={q.url}
                                    className={styles.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {q.url.replace(/^https?:\/\//, "")}
                                </a>
                            </dd>
                        </div>
                    ))}
                </dl>

                <h2>Was daraus wurde</h2>
                <p>
                    Diese Karten sind Bearbeitungen der genannten Quellen: ausgewaehlte Wörter, gepruefte
                    Uebersetzungen, dazu ein passender Beispielsatz. Nach der Share-Alike-Klausel von
                    CC BY-SA muessen solche Bearbeitungen unter derselben Lizenz weitergegeben werden.
                    Die englische Originalwortliste von NGSL steht deshalb unter CC BY-SA 4.0, und
                    Lexio gibt sie unter dieser Lizenz weiter.
                </p>

                <h2>Was das für den Gebrauch heißt</h2>
                <ul className={styles.punkte}>
                    <li>
                        Die Sets folgen der Worthäufigkeit, <strong>keinem Lernniveau</strong>. Es gibt
                        keine CEFR-Einstufung, und die Namen der Sets sagen nichts darüber aus, ob ein
                        Wort für einen Anfänger geeignet ist.
                    </li>
                    <li>
                        Für die Grundlagen aus dem Alltag genügt ein Wörterbuch daneben. Wer ohne
                        Hilfsmittel lernen will, fängt bei „Alltag“ an und lässt die späteren Sets liegen.
                    </li>
                    <li>
                        Beispielsätze stammen von Muttersprachlern und klingen nicht immer wie Lehrbuch-
                        Deutsch. Sie sind echte Sätze, kein Stilideal.
                    </li>
                    <li>
                        Eigene Karten und eigene Wortlisten sind davon nicht betroffen – das bleibt bei
                        dir im Konto.
                    </li>
                </ul>

                <h2>Eigene Karten</h2>
                <p>
                    Selbst angelegte Karten, Wortlisten und Texte gehören dir. Sie werden nicht an Dritte
                    weitergegeben und nicht in die vorinstallierten Listen aufgenommen. Wenn du eine
                    Wortliste selbst veröffentlichen willst, ist das eine andere Frage – dann gelten die
                    Rechte, die du selbst hast.
                </p>

                <p className={styles.klein}>
                    Quellenangabe nach der Namensnennungspflicht von CC BY-SA 4.0. Die
                    Bearbeitungen stehen unter derselben Lizenz wie die Quellen.
                </p>
            </article>
        </main>
    );
}