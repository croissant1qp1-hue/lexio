/**
 * Plan 1.8 – was mit einer Karte IN der laufenden Runde passiert.
 *
 * Die Runde ist eine feste Liste (`karten`), `index` ist der Cursor darauf.
 * „Nochmal" – und „schwer", wenn der Würfel die Karte behält – heißt: die
 * Karte kommt später noch einmal. Sie wandert ans Ende der Liste, der Cursor
 * bleibt stehen: die nächste Karte rückt an seine Stelle.
 *
 * Wichtig ist, was hier NICHT wegfällt: der bereits gesehene Anfang der Liste
 * (`liste.slice(0, index)`) bleibt erhalten. Genau der fehlte früher, als die
 * Stelle noch `[...liste.slice(index + 1), karte]` hieß. Damit schrumpfte die
 * Runde bei jeder „nochmal"-Antwort um den halben Cursor, und `karten[index]`
 * zeigte an der eigentlichen nächsten Karte vorbei – Karten wurden still
 * übersprungen. `karten.length` ist die Rundengröße und muss gleich bleiben.
 */
export function nachHinten<T>(liste: T[], index: number): T[] {
    if (index < 0 || index >= liste.length) return liste;
    return [...liste.slice(0, index), ...liste.slice(index + 1), liste[index]];
}
