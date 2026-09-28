/**
 * Tönende Geräte-Einstellung: ob das Vorlesen spricht und wie laut.
 *
 * Bewusst dieselbe Form wie lib/geraet.ts: die Wahl gehört zum Gerät, nicht
 * zum Konto. Wer auf einem Rechner mit Kopfhörern lernt und auf einem ohne,
 * will nicht jedes Mal umstellen müssen. Eine Einstellung, die an die
 * Anmeldung gebunden ist, würde das Gerätegedächtnis für ein
 * Geräte-Problem verwenden.
 *
 * Es gibt hier keinen Kontext und keine Provider: die Lernseite liest den
 * Stand beim Betreten, und die Einstellungen-Seite schreibt ihn. Beides
 * geht über dieselben zwei Funktionen, und es gibt keinen Zustand, in dem
 * die beiden Orte auseinanderlaufen könnten.
 */

/**
 * Die drei Stufen sind bewusst "Signalstärke" und nicht Prozent, weil sich
 * niemand für "82 %" interessiert. Der Wert, der wirklich ans
 * SpeechSynthesis geht, entsteht erst in spreche, beim Sprechen.
 */
export type Lautstaerke = "leise" | "normal" | "laut";

export const TON_SPEICHER = "lexio.ton.v1";

export type TonStand = {
  /** Schema-Version. Eine alte, unbekannte Version wird verworfen. */
  v: 1;
  /** Töne an: die Lernseite spricht, wenn jemand auf den Lautsprecher tippt. */
  an: boolean;
  /** Wie laut spreche spricht. */
  lautstaerke: Lautstaerke;
};

/** Der Standard, wenn nichts gespeichert ist: Töne an, normale Lautstärke. */
const VORGABE: TonStand = { v: 1, an: true, lautstaerke: "normal" };

/** Fachlich laut werden darf nur bis SpeechSynthesis (Maximalwert 1). */
export const LAUTSTÄRKE_VOLUMEN: Record<Lautstaerke, number> = {
  leise: 0.4,
  normal: 0.8,
  laut: 1,
};

function speicher(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Den gespeicherten Stand lesen, mit dem Standard, wenn nichts da ist. */
export function liesTon(): TonStand {
  const s = speicher();
  if (!s) return VORGABE;
  try {
    const roh = s.getItem(TON_SPEICHER);
    if (!roh) return VORGABE;
    const wert = JSON.parse(roh) as Partial<TonStand>;
    if (wert?.v !== 1) return VORGABE;
    const lautstaerke: Lautstaerke =
      wert.lautstaerke === "leise" ||
      wert.lautstaerke === "normal" ||
      wert.lautstaerke === "laut"
        ? wert.lautstaerke
        : "normal";
    return { v: 1, an: wert.an !== false, lautstaerke };
  } catch {
    // Kaputter Eintrag (Handeingetragen, andere App-Version): wegwerfen.
    return VORGABE;
  }
}

/** Den Stand speichern. Im privaten Modus gilt er nur für diese Sitzung. */
export function setzeTon(stand: TonStand): void {
  const s = speicher();
  if (!s) return;
  try {
    s.setItem(TON_SPEICHER, JSON.stringify(stand));
  } catch {
    /* Speicher voll oder verboten – die Einstellung gilt dann nur jetzt. */
  }
}