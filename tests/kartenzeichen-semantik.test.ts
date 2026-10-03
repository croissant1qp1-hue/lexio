/**
 * Tests für die semantische Zuordnung.
 *
 * Der Schwerpunkt liegt nicht auf „funktioniert es bei Haus“, sondern auf den
 * drei Fehlern, die beim Bauen tatsächlich aufgetreten sind und die alle
 * dasselbe Ergebnis hatten: eine Karte bekam ein falsches Bild und niemand
 * bemerkte es, weil ein Emoji nun mal keine Fehlermeldung wirft. Sie stehen
 * deshalb einzeln und mit Begründung, damit sie nicht wieder auftritt.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
    kandidaten,
    normiere,
    semantischesZeichen,
    tabellenGroesse,
    alleWortEmoji,
} from "../lib/kartenzeichen-semantik.ts";

test("das Beispiel des Nutzers: haus ist ein Haus", () => {
    const treffer = semantischesZeichen("haus", "house");
    assert.ok(treffer, "haus muss ein Bild bekommen");
    assert.equal(treffer.emoji, "🏠");
    assert.equal(treffer.quelle, "begriff");
});

test("auch über die Übersetzung, wenn der Begriff nichts hergibt", () => {
    // „Fahrstuhl" steht nicht in der Tabelle, „elevator" schon.
    const treffer = semantischesZeichen("Fahrstuhl", "elevator");
    assert.ok(treffer, "die Übersetzung muss einspringen");
    assert.equal(treffer.emoji, "🛗");
    assert.equal(treffer.quelle, "uebersetzung");
});

test("Umlaute und ß führen auf denselben Schlüssel", () => {
    assert.equal(normiere("Straße"), "strasse");
    assert.equal(normiere("Größe"), "groesse");
    assert.equal(normiere("Häuser"), "haeuser");
    assert.equal(normiere("SCHÖN"), "schoen");
});

test("Komma-Alternativen werden einzeln geprüft", () => {
    assert.deepEqual(kandidaten("an, auf"), ["an auf", "an", "auf"]);
    // Die Teile bleiben, wie sie dastehen. Die Singularform entsteht erst
    // beim Nachschlagen, nicht schon beim Zerlegen – sonst wüsste der
    // Leser nicht, was „dieser, diese, jedes" eigentlich prüfen soll.
    assert.deepEqual(kandidaten("dieser, diese, jedes"), [
        "dieser diese jedes",
        "dieser",
        "diese",
        "jedes",
    ]);
    // Aus einem Import kommt dieselbe Unordnung mit Schrägstrich.
    assert.ok(kandidaten("du/Sie").includes("sie"));
});

test("REGRESSION: „bekommen“ darf nicht zu „kommen“ werden", () => {
    // Die ge- und Endungsregel prüfte mit slice(0, -2) am Ende, schnitt aber
    // mit slice(2) am Anfang. Ergebnis: „bekommen“ wurde zu „kommen“ und die
    // Karte bekam das Bild von „laufen“.
    const treffer = semantischesZeichen("bekommen", "");
    assert.equal(treffer, null);
});

test("REGRESSION: „many“ darf nicht zu „man“ werden", () => {
    // Die Endungsregel schnitt ohne Prüfung das letzte Zeichen ab, statt zu
    // prüfen, ob das Wort auf die Endung endet. „many“ wurde so zu „man“.
    const treffer = semantischesZeichen("", "many");
    assert.equal(treffer, null);
});

test("REGRESSION: „ein“ darf nicht zu „ei“ werden", () => {
    // Die Kürzungsregel stand auf zwei Buchstaben Mindestlänge, bevor sie das
    // war. Aus „ein“ wurde „ei“ und die Karte zeigte ein Ei.
    const treffer = semantischesZeichen("ein, eine", "a");
    assert.equal(treffer, null);
});

test("Homographen sind auf der Übersetzungsseite gesperrt", () => {
    // „see“ ist auf Deutsch der See und auf Englisch „sehen“.
    assert.equal(semantischesZeichen("See", "lake")?.emoji, "🏞️");
    assert.equal(semantischesZeichen("verstehen", "see"), null);
    // „gift“ ist auf Deutsch Gift und auf Englisch ein Geschenk.
    assert.equal(semantischesZeichen("Gift", "poison")?.emoji, "☠️");
    assert.equal(semantischesZeichen("Vergiftung", "gift"), null);
});

test("Funktionswörter bekommen grundsätzlich nichts", () => {
    const funktionswoerter = [
        "der", "die", "das", "ein", "eine", "und", "oder", "aber", "in", "an",
        "auf", "zu", "von", "mit", "für", "ist", "sind", "war", "hat", "haben",
        "sein", "werden", "können", "müssen", "ich", "du", "er", "sie", "es",
        "wir", "ihr", "nicht", "kein", "sehr", "auch", "noch", "nur", "schon",
        "mehr", "viele", "alle", "immer", "oft", "dann", "danach", "weil",
        "wenn", "dass", "ob", "als", "wie", "was", "wer", "wo", "wann",
        "welcher", "jetzt", "heute", "etwas", "nichts", "alles", "jemand",
    ];
    // Nicht dabei: „warum". Es steht in der Funktionswortliste, hat aber ein
    // völlig eindeutiges Bild, und eine Frage ist eine Frage.
    const faelsch = [];
    for (const wort of funktionswoerter) {
        const treffer = semantischesZeichen(wort, "");
        if (treffer) faelsch.push(`${wort} → ${treffer.emoji}`);
    }
    assert.deepEqual(faelsch, [], `Funktionswörter ohne Bild erwartet, aber gefunden: ${faelsch.join(", ")}`);
});

test("jeder Tabellenschlüssel ist auch erreichbar", () => {
    // Ein Schlüssel mit Unterstrich oder einer Sonderform, die die
    // Normalisierung nie erzeugt, ist toter Code: er zählt in der
    // Selbstauskunft mit und liefert nie ein Bild.
    const unerreichbar = [];
    for (const schluessel of Object.keys(alleWortEmoji())) {
        const treffer = semantischesZeichen(schluessel, "");
        if (!treffer) unerreichbar.push(schluessel);
    }
    assert.deepEqual(unerreichbar, [], `Nie erreichbare Schlüssel: ${unerreichbar.join(", ")}`);
});

test("in der Tabelle stehen keine Wörter, sondern Zeichen", () => {
    const verdächtig = [];
    for (const [wort, zeichen] of Object.entries(alleWortEmoji())) {
        if (/[A-Za-z]/.test(zeichen)) verdächtig.push(`${wort} = ${zeichen}`);
        if (!/[^\x00-\x7F]/.test(zeichen)) verdächtig.push(`${wort} = ${zeichen} (nicht darstellbar)`);
    }
    assert.deepEqual(verdächtig, []);
});

test("dieselbe Karte ergibt immer dasselbe Zeichen", () => {
    const einmal = semantischesZeichen("katze", "cat");
    const zweimal = semantischesZeichen("katze", "cat");
    assert.deepEqual(einmal, zweimal);
    assert.equal(einmal?.emoji, "🐱");
});

test("gängige Sachwörter haben ein Bild", () => {
    const erwartet: Record<string, string> = {
        haus: "🏠",
        hund: "🐶",
        katze: "🐱",
        auto: "🚗",
        baum: "🌳",
        brot: "🍞",
        milch: "🥛",
        schule: "🏫",
        buch: "📕",
        tisch: "🪑",
        wasser: "💧",
        sonne: "☀️",
        mond: "🌙",
        vogel: "🐦",
        schmetterling: "🦋",
        elefant: "🐘",
        apfel: "🍎",
    };
    for (const [wort, emoji] of Object.entries(erwartet)) {
        assert.equal(semantischesZeichen(wort, "")?.emoji, emoji, `${wort} sollte ${emoji} sein`);
    }
});

test("die Tabelle ist groß genug für eine Vokabel-App", () => {
    assert.ok(tabellenGroesse() > 300, `nur ${tabellenGroesse()} Wörter in der Tabelle`);
});