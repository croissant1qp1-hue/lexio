"use client";

import styles from "./setup-hinweis.module.css";
import { useGesundheit } from "./use-gesundheit";

/**
 * Zeigt an, was im Supabase-Dashboard noch fehlt.
 *
 * Der Grund fuer diese Komponente ist ein konkreter Erfahrungswert: Wer die
 * App zum ersten Mal aufsetzt, sitzt vor einer Anmeldeseite, deren Knöpfe
 * nichts tun, und vor einer Datenbank, deren Meldung lautet
 * `42703: column user_id does not exist`. Beides zusammen sagt nichts. Der
 * Fehler liegt in der App, nicht bei der Person, und die App kann es sagen –
 * deshalb fragt sie nach und zeigt die Liste.
 *
 * Zwei Darstellungen:
 *   "gross"  auf der Anmeldeseite, mit allem was fehlt
 *   "leiste" in der App, nur wenn die Datenbank noch nicht bereit ist
 *
 * Die Liste ändert sich, ohne dass sich Code ändert – deshalb fragt sie die
 * Route ab, statt die Schalter fest einzubauen.
 */

type Props = {
  variante: "gross" | "leiste";
};

export function SetupHinweis({ variante }: Props) {
  const { bericht, neuLaden, laeuft } = useGesundheit();

  // In der App nur melden, wenn die Datenbank fehlt. Die OAuth-Schalter sind
  // dort ein Herzensthema, aber kein Grund, jede Seite zu überlagern.
  const relevant = bericht?.aufgaben.filter((a) =>
    variante === "gross" ? true : a.id === "migration",
  );
  if (!relevant || relevant.length === 0) return null;

  const box = variante === "gross" ? styles.hinweis : `${styles.hinweis} ${styles.leiste}`;

  return (
    <section className={box} aria-label="Einrichtung">
      <div className={styles.kopf}>
        <i className="fa-solid fa-screwdriver-wrench" aria-hidden="true" />
        <p className={styles.titel}>
          {variante === "gross"
            ? "Die App ist noch nicht einsatzbereit – es fehlt Folgendes:"
            : "Die Datenbank ist noch nicht bereit."}
        </p>
      </div>

      <ol className={styles.liste}>
        {relevant.map((a) => (
          <li key={a.id} className={styles.eintrag}>
            <span className={styles.kuerzel} aria-hidden="true">
              {a.kuerzel}
            </span>
            <div>
              <p className={styles.eintragTitel}>{a.titel}</p>
              <p className={styles.warum}>{a.warum}</p>
              <p className={styles.wo}>{a.ort}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className={styles.knoepfe}>
        <button
          type="button"
          className={styles.knopf}
          onClick={neuLaden}
          disabled={laeuft}
        >
          {laeuft ? "Prüfe…" : "Erneut prüfen"}
        </button>
      </div>
    </section>
  );
}
