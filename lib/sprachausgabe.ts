/**
 * Sprache vorlesen – `speechSynthesis` in einer brauchbaren Form.
 *
 * Vier Dinge, an denen die naheliegende Zeile scheitert:
 *
 * 1. `speechSynthesis` gibt es nur im Browser. Diese Datei wird von der
 *    Lernseite importiert, die auch serverseitig gerendert wird, also darf
 *    kein Zugriff auf `window` beim Laden des Moduls stattfinden.
 *
 * 2. `getVoices()` liefert in Safari beim ersten Aufruf eine LEERE Liste.
 *    Die Stimmen kommen asynchron nach, und der Browser sagt das mit
 *    `voiceschanged` mit. Ohne darauf zu warten, ist der erste Klick auf den
 *    Lautsprecher stumm – und zwar genau der, den jemand ausprobiert.
 *
 * 3. Ohne passende `lang` buchstabiert der Browser. Chrome und Edge lesen
 *    Text, dessen Sprache sie nicht bestimmen koennen, Zeichen fuer Zeichen
 *    vor: "hallo" wird zu "h a l l o". Der Sprachcode des Sets entscheidet
 *    das also nicht nur fuer die Stimmenauswahl, sondern fuer die Aussprache
 *    selbst.
 *
 * 4. Ohne `cancel()` laeuft der vorige Satz weiter, wenn jemand die naechste
 *    Karte sieht. Zwei Stimmen gleichzeitig sind kein Uebungsfall, sondern
 *    ein Unfall.
 *
 * Alles hier ist additiv: Fehlt `speechSynthesis` (Server, alter Browser,
 * Some-Modus auf dem Handy), liefert jede Funktion `false` bzw. `null`, und
 * die Lernseite blendet den Lautsprecher einfach aus.
 */

/** Wie lange auf die Stimmenliste gewartet wird, bevor es ohne weitergeht. */
const STIMMEN_TIMEOUT = 2000;

/** Sprachbasis eines Sprachcodes: "pt-BR" -> "pt". */
function basis(lang: string): string {
  return lang.toLowerCase().split(/[-_]/)[0];
}

/** Gibt es `speechSynthesis` in diesem Browser ueberhaupt? */
export function tonVerfuegbar(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.SpeechSynthesisUtterance === "function" &&
    "speechSynthesis" in window
  );
}

/**
 * Die verfuegbaren Stimmen, und das Warten darauf, das Safari verlangt.
 *
 * Kommt die Liste sofort, geht es sofort zurueck. Kommt sie nicht, wird auf
 * `voiceschanged` gehoert – mit einer Obergrenze, damit ein Browser, der das
 * Event nie schickt, die App nicht auf ewig festhält.
 */
export function stimmen(): Promise<SpeechSynthesisVoice[]> {
  if (!tonVerfuegbar()) return Promise.resolve([]);

  const direkt = window.speechSynthesis.getVoices();
  if (direkt.length > 0) return Promise.resolve(direkt);

  return new Promise<SpeechSynthesisVoice[]>((fertig) => {
    let erledigt = false;
    /*
     * Reihenfolge zaehlt: der Timer entsteht vor `abschliessen`, weil diese
     * Funktion ihn loescht – und `clearTimeout` auf eine noch nicht
     * belegte Bindung wuerde hier einen ReferenceError werfen, wenn die
     * Stimmen noch im selben Tick eintrudeln. `const` genuegt also, es gibt
     * nur eine Zuweisung.
     */
    const timer = setTimeout(() => abschliessen(), STIMMEN_TIMEOUT);

    function abschliessen() {
      if (erledigt) return;
      erledigt = true;
      window.speechSynthesis.removeEventListener("voiceschanged", abschliessen);
      clearTimeout(timer);
      fertig(window.speechSynthesis.getVoices());
    }

    window.speechSynthesis.addEventListener("voiceschanged", abschliessen);

    /*
     * Manche Browser fuellen die Liste, ohne je `voiceschanged` zu schicken –
     * dann wartet nur der Timer. Ein zweiter direkter Zugriff faengt die
     * Faelle, in denen die Liste zwischen dem ersten Aufruf und dem Anlegen
     * des Zuhörers gefüllt wurde.
     */
    const nachfrage = window.speechSynthesis.getVoices();
    if (nachfrage.length > 0) abschliessen();
  });
}

/**
 * Die Stimme für einen Sprachcode.
 *
 * Reihenfolge: exakte Übereinstimmung, dann irgendeine regionale Variante
 * derselben Sprache. Innerhalb einer Stufe gewinnt die lokale Stimme, weil
 * eine Netzstimme erst lädt und der Klick dann wirkt, als wäre nichts
 * passiert.
 */
export function stimmeFuer(
  code: string | null,
  liste: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | null {
  if (!code) return null;
  const gewuenscht = code.toLowerCase();
  const passt = (v: SpeechSynthesisVoice) =>
    v.lang.toLowerCase().replace(/_/g, "-") === gewuenscht.replace(/_/g, "-") ||
    basis(v.lang) === basis(code);

  const exakt = liste.filter((v) => v.lang.toLowerCase().replace(/_/g, "-") === gewuenscht.replace(/_/g, "-"));
  const ueberhaupt = liste.filter(passt);
  const aus = exakt.length > 0 ? exakt : ueberhaupt;
  if (aus.length === 0) return null;
  return aus.find((v) => v.localService) ?? aus[0];
}

/**
 * Einen Text sprechen, optional in mehreren Teilen mit Pause dazwischen.
 *
 * `code` ist der Sprachcode des Sets ("es"). Er geht als `lang` an die
 * Aussprache, damit der Browser nicht buchstabiert (siehe Kopf, Punkt 3).
 */
export function spreche(teile: (string | null | undefined)[], code: string | null): boolean {
  if (!tonVerfuegbar()) return false;
  /*
   * `?? ""` ist hier Pflicht und nicht Geschmack: der Beispielsatz kommt aus
   * der Datenbank und ist bei manuellen Karten null. Ohne das wirft die
   * Karte genau dann, wenn jemand ohne Beispielsatz lernen will – also
   * genau dann nicht, wenn es auffaellt, sondern wenn es stoert.
   */
  const saetze = teile
    .map((t) => (t ?? "").trim())
    .filter((t) => t.length > 0);
  if (saetze.length === 0) return false;

  const synth = window.speechSynthesis;
  synth.cancel();

  /*
   * `getVoices()` zuerst, obwohl `tonDa` bereits eine geladene Liste kennt:
   * die hier ist die aktuelle, und in Safari ist das nicht dieselbe Liste,
   * die der Aufrufer einmal gesehen hat.
   */
  const stimme = stimmeFuer(code, synth.getVoices());
  /*
   * `lang` ist wichtiger als die Stimme: der Browser spricht mit seiner
   * Standardstimme fuer dieses `lang`, wenn keine passt. Und mit falschem
   * `lang` buchstabiert er. Also immer setzen, auch ohne Stimme.
   */
  const lang = stimme?.lang ?? code ?? undefined;

  /*
   * `window.SpeechSynthesisUtterance` und nicht das nackte
   * `SpeechSynthesisUtterance`: in einem Fenster ist beides dasselbe, aber
   * nur die erste Fassung haengt garantiert am Fenster, in dem
   * `speechSynthesis` liegt. Der Rest dieser Datei greift auch nur ueber
   * `window` zu, und gemischt zu lesen war hier schon eine Fehlerquelle.
   */
  const Utterance = window.SpeechSynthesisUtterance;
  for (const satz of saetze) {
    const u = new Utterance(satz);
    if (lang) u.lang = lang;
    if (stimme) u.voice = stimme;
    u.rate = 0.92; /* Lernende brauchen den Ansatz, nicht das Tempus. */
    u.pitch = 1;
    synth.speak(u);
  }
  return true;
}

/** Laufendes Sprechen abbrechen – Karte gewechselt, Karte umgedreht. */
export function stoppe(): void {
  if (!tonVerfuegbar()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* Manche Browser werfen, wenn nichts laeuft. Das ist kein Fehler. */
  }
}
