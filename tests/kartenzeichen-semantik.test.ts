/**
 * Tests für die semantische Zuordnung.
 *
 * Der Schwerpunkt liegt nicht auf „funktioniert es bei Haus“, sondern auf den
 * drei Fehlern, die beim Bauen tatsächlich aufgetreten sind und die alle
 * dasselbe Ergebnis hatten: eine Karte bekam ein falsches Bild und niemand
 * bemerkte es, weil ein unbekannter Iconname keine Fehlermeldung wirft. Sie stehen
 * deshalb einzeln und mit Begründung, damit sie nicht wieder auftritt.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
    kandidaten,
    normiere,
    semantischesZeichen,
    tabellenGroesse,
    alleWortIcon,
} from "../lib/kartenzeichen-semantik.ts";
import { ICON_RUMPF } from "../lib/kartenzeichen-svg.generated.ts";

test("das Beispiel des Nutzers: haus ist ein Haus", () => {
    const treffer = semantischesZeichen("haus", "house");
    assert.ok(treffer, "haus muss ein Bild bekommen");
    assert.equal(treffer.icon, "house");
    assert.equal(treffer.quelle, "begriff");
});

test("auch über die Übersetzung, wenn der Begriff nichts hergibt", () => {
    // „Fahrstuhl" steht nicht in der Tabelle, „elevator" schon.
    const treffer = semantischesZeichen("Fahrstuhl", "elevator");
    assert.ok(treffer, "die Übersetzung muss einspringen");
    assert.equal(treffer.icon, "chevrons-up");
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
    assert.equal(semantischesZeichen("See", "lake")?.icon, "waves");
    assert.equal(semantischesZeichen("verstehen", "see"), null);
    // „gift“ ist auf Deutsch Gift und auf Englisch ein Geschenk.
    assert.equal(semantischesZeichen("Gift", "poison")?.icon, "skull");
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
        if (treffer) faelsch.push(`${wort} → ${treffer.icon}`);
    }
    assert.deepEqual(faelsch, [], `Funktionswörter ohne Bild erwartet, aber gefunden: ${faelsch.join(", ")}`);
});

test("jeder Tabellenschlüssel ist auch erreichbar", () => {
    // Ein Schlüssel mit Unterstrich oder einer Sonderform, die die
    // Normalisierung nie erzeugt, ist toter Code: er zählt in der
    // Selbstauskunft mit und liefert nie ein Bild.
    const unerreichbar = [];
    for (const schluessel of Object.keys(alleWortIcon())) {
        const treffer = semantischesZeichen(schluessel, "");
        if (!treffer) unerreichbar.push(schluessel);
    }
    assert.deepEqual(unerreichbar, [], `Nie erreichbare Schlüssel: ${unerreichbar.join(", ")}`);
});

test("jedes Icon in der Tabelle hat auch wirklich Markup", () => {
    // Der Fehler, den nur diese Tabelle haben kann: ein Eintrag, dessen Icon
    // `lib/kartenzeichen-svg.generated.ts` nicht kennt. Die Komponente fällt
    // dann still auf die erzeugte Form zurück, die Karte sieht plötzlich aus
    // wie zufällig – und kein Fehler wird geworfen. Deshalb wird hier jeder
    // Eintag einzeln geprüft.
    const ohneMarkup = [];
    for (const [wort, icon] of Object.entries(alleWortIcon())) {
        if (!ICON_RUMPF[icon]) ohneMarkup.push(`${wort} = ${icon}`);
    }
    assert.deepEqual(ohneMarkup, [], `Icons ohne Markup: ${ohneMarkup.join(", ")}`);
    // Und die Gegenrichtung: kein ungenutztes Markup, das nur die Datei aufbläht.
    const ungenutzt = Object.keys(ICON_RUMPF).filter(
        (icon) => !Object.values(alleWortIcon()).includes(icon),
    );
    assert.deepEqual(ungenutzt, [], `Markup ohne Tabelleneintrag: ${ungenutzt.join(", ")}`);
});

test("das Markup kann nichts anderes als eine Zeichnung", () => {
    // Das Markup wird mit `dangerouslySetInnerHTML` gesetzt. Das ist die
    // einzige Stelle im Projekt, an der das passiert, und deshalb lohnt die
    // Prüfung: der Rumpf darf nur Formelemente enthalten. Kein `<svg>` als
    // Ausbruch aus der 24er-Box, kein `<script>`, keine Ereignishandler.
    //
    // Der erste Versuch prüfte stattdessen die Zahlen im Pfad auf 24 und
    // meldete „apple: 648" – das ist ein Bogenparameter, keine Koordinate.
    // Die Prüfung bewertete ihren Befund als Fehler des Produkts, obwohl sie
    // die falsche Frage stellte.
    const verboten = /<\s*(script|svg|image|foreignObject|style|iframe)\b|\son[a-z]+\s*=|javascript:/i;
    const schuldig = [];
    for (const [icon, rumpf] of Object.entries(ICON_RUMPF)) {
        if (verboten.test(rumpf)) schuldig.push(icon);
    }
    assert.deepEqual(schuldig, [], `Markup mit mehr als Zeichnung: ${schuldig.join(", ")}`);
    // Und es besteht überhaupt aus etwas: ein leeres Icon wäre unsichtbar.
    const leer = Object.entries(ICON_RUMPF).filter(([, r]) => !r.trim());
    assert.deepEqual(leer.map(([i]) => i), []);
});

test("dieselbe Karte ergibt immer dasselbe Zeichen", () => {
    const einmal = semantischesZeichen("katze", "cat");
    const zweimal = semantischesZeichen("katze", "cat");
    assert.deepEqual(einmal, zweimal);
    assert.equal(einmal?.icon, "cat");
});

test("gängige Sachwörter haben ein Bild", () => {
    const erwartet: Record<string, string> = {
        haus: "house",
        hund: "dog",
        katze: "cat",
        auto: "car",
        baum: "tree-deciduous",
        brot: "croissant",
        milch: "milk",
        schule: "school",
        buch: "book",
        tisch: "armchair",
        wasser: "droplet",
        sonne: "sun",
        mond: "moon",
        vogel: "bird",
        apfel: "apple",
        fahrrad: "bike",
        stern: "star",
        regen: "cloud-rain",
        schnee: "snowflake",
        uhr: "clock",
    };
    for (const [wort, icon] of Object.entries(erwartet)) {
        assert.equal(semantischesZeichen(wort, "")?.icon, icon, `${wort} sollte ${icon} sein`);
    }
});

test("die Tabelle ist groß genug für eine Vokabel-App", () => {
    assert.ok(tabellenGroesse() > 300, `nur ${tabellenGroesse()} Wörter in der Tabelle`);
});