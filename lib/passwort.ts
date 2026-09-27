/**
 * Wie lang ein Passwort sein muss.
 *
 * Das stand vorher an vier Stellen in vier Dateien: Registrierung, Reset,
 * Änderung in den Einstellungen und die Oberfläche, die den Platzhalter
 * zeigt. An drei Stellen stand 6, an zwei 8 – und wer sich mit sechs Zeichen
 * angemeldet hatte, kam in den Einstellungen nicht mehr weiter, ohne sich
 * ein anderes Passwort auszudenken.
 *
 * Zwei Zahlen für dieselbe Regel sind keine Auslegungsfrage, sondern eine
 * Frage, die irgendwann jemand falsch beantwortet. Deshalb steht sie hier.
 *
 * 8 ist bewusst strenger als die 6, die Supabase selbst als kleinste Länge
 * zulässt. Ein Passwort, das man sich merken kann, ist eines, das nicht
 * buchstabiert werden muss – und die Kürzeste Ausnahme bleibt, dass hier
 * niemand eine Sicherheitsabwägung verwechselt: Wer 6 Zeichen braucht, um
 * es sich merken zu können, hat ein anderes Problem als ein kurzes Passwort.
 */
export const MIN_PASSWORT = 8;

/** Fertiger Satz für die Fehlermeldung, damit überall dasselbe steht. */
export const PASSWORT_FEHLER = `Das Passwort braucht mindestens ${MIN_PASSWORT} Zeichen.`;
