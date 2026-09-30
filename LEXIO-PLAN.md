# Lexio — Umbauplan

Erstellt am 2026-09-27 nach einem vollständigen Scan des Projekts und einer
Abfrage aller Produktentscheidungen. Stand der Fakten: siehe
[Verifizierter Zustand](#verifizierter-zustand-2026-09-27).

**Wenn jemand sagt „fixx lexio", gilt diese Datei als Auftrag.** Phasen in der
Reihenfolge abarbeiten, nach jeder Phase mit dem Nutzer durchgehen, nicht
weiterbauen ohne Rückmeldung.

---

## Arbeitsregeln

Diese drei Regeln stehen bewusst vor allen Aufgaben. Sie sind keine
Vorgaben, sondern die Bedingungen, unter denen die Aufgaben sinnvoll sind.

### 1. Zeitnehmen

Kein Punkt gilt als fertig, bevor er am laufenden System geprüft ist. „Sieht
richtig aus" ist in diesem Projekt kein Nachweis.

Belege dafür liegen im Projekt selbst:

- `OFFENE-PUNKTE.md:117-158` — die erste Fassung eines Fixes war falsch und
  fiel ausschließlich durch einen Live-Test auf. Jedes `error` aus
  `getUser()` als Stoerung zu stufen, ließ `/api/profil` ohne Login **503**
  statt **401** antworten.
- `lernen/route.ts:122-139` — zwei verschiedene Ursachen mit derselben
  PostgREST-Fehlermeldung erfordern eine Zusatzabfrage, um sie zu
  unterscheiden. Das fällt nur auf, wenn man live prüft.

Nach jeder Änderung: `npm run build`, `npm run lint`, und der Punkt am
laufenden System. Ein Punkt ohne Abnahme ist nicht fertig, er ist offen.

### 2. Responsive von Anfang an

Nicht am Ende nachziehen. Jede neue oder geänderte Komponente wird direkt
für Handy **und** Desktop gebaut.

Bekannter Ausgangsschaden: Die Profilkarte ist auf dem Telefon komplett
ausgeblendet — `.logo-title` und `.side-bar-menu + *` bekommen bei
`max-width: 860px` beide `display: none` (`components/navbar/side-bar.css:143-146`).
Auf dem Handy sind Level, XP, Serie und Lerntage damit unsichtbar.

Am 2026-09-27 gemessen, damit erledigt: Lernansicht, alle vier
Wizard-Schritte und das offene Sprachmenü wurden bei 360 px, 414 px und
768 px gegen das laufende System geprüft. Ergebnis der Phase 0: kein
waagerechter Bildlauf, keine Bedienfläche unter 44 px, nichts ragt aus dem
Viewport. Der Beispielsatz steht bei 15.2 px, der Sprachknopf bei 16 px und
exakt 44 px Höhe.

Dabei aufgefallen, aber **nicht** Phase 0 und deshalb offen: die
untere Navigationsleiste setzt ihre Beschriftung auf 9.3 px, die
Set-Namen im Wortschatz sind 19 px hohe Links, und die Wortschatz-Tabelle
wird bei 360 px von `main-body { overflow-x: hidden }` abgeschnitten,
nicht scrollbar. Gehört nach Phase 5.

Abnahmekriterien stehen in [Phase 5](#phase-5--responsive-audit).

### 3. Öffentlich denken

Jede Änderung so schreiben, dass mehrere Nutzer sie gleichzeitig benutzen
können:

- Kein geteilter Zustand zwischen Nutzern
- Keine Annahme über eine einzelne Sitzung
- Keine Entscheidung, die nur bei einem einzigen Konto funktioniert
- Jede Datenabfrage prüft Besitz über die Datenbank, nicht im Anwendungscode

### 4. Nach jedem Schritt committen und pushen

Vom Nutzer am 2026-09-27 festgelegt. Gilt, sobald er **„setze das jetzt
alles um"** sagt:

**Nach jedem funktionierenden Schritt committen und auf `origin/main` pushen.**

„Funktionierend" heißt geprüft: `npm run build` und `npm run lint` sauber,
und die Änderung tut am laufenden System, was sie soll. Was nicht fertig
läuft, kommt nicht auf `main` — auch nicht als Zwischenstand.

Zum Commit:

- Ein Schritt, ein Commit. Kurze deutsche Betreffzeile, die sagt, was der
  Schritt getan hat.
- **Nur die Pfade dieses Schritts vormerken**, nie `git add -A`, nie
  `git add .`. Im Arbeitsbaum liegen fremde, noch unfertige Änderungen; die
  dürfen nicht mitrutschen. Vorher `git status` und `git diff` ansehen.
- Dieser Plan wird mitcommitted, wenn er sich ändert. Die abgehakte Phase
  ist der Fortschrittsnachweis für die nächste Sitzung.
- Kein Force-Push, keine Geheimnisse, `.env` bleibt draußen.

Die vollständige Fassung steht in `AGENTS.md`.

---

## Produktentscheidungen

Vom Nutzer am 2026-09-27 getroffen. Diese Werte sind gesetzt und sollen nicht
gegenfrags erweitert werden.

| Bereich | Entscheidung |
|---|---|
| Zweck | Lernen von **Fremdsprachen-Vokabeln** |
| Erste Sprache | **Englisch** (beste Quellenlage, beste Browser-Stimmen) |
| Inhalt | Echte Wortlisten von Lexio, nicht Nutzerbeiträge |
| Wortquelle | Mix aus vorhandener Liste und KI — Quellen siehe unten |
| Karte | Begriff + deutsche Übersetzung + **Beispielsatz** + TTS |
| TTS | **Rückseite** hört das Wort (Aussprache der Fremdsprache) |
| Aussehen | **Papier-Notizbuch-Charme**: Lernkarte als Blockblatt mit Punktraster und abgeknickter Ecke, Handschrift-Marke, Punktraster im Hintergrund. Dezente Dosis, gesetzt am 2026-09-28 |
| Sprachfeld | **Feste Liste mit Code** (`en`, `es`, …), kein Freitext |
| Import | Textblock einfügen, mit **Vorschau und Korrektur vor dem Speichern** |
| Lernrunde | 20er-Grenze bleibt; „20 von 47 geschafft"; **„Nochmal" reiht in derselben Runde wieder ein** |
| Erinnerung | **Web-Push** |
| Reihenfolge | Erst Lerneffekt, dann Reichweite |

---

## Verifizierter Zustand (2026-09-27)

`npm run db:status` ausgeführt, Ergebnis **grün**:

```
Projekt: vvdouxtdvnhrptkptohp.supabase.co
Datenbank erreichbar.
anon-Key hat die Rolle anon.
da  karteikarten_sets.user_id
da  karteikarten_sets_uebersicht.eigenes_set
da  profil.id
da  karten_fortschritt.karte_id
da  mein_fortschritt.streak
da  karteikarten_sets_uebersicht.karten_faellig
Registrierung offen.
Keine E-Mail-Bestaetigung noetig – Konto sofort nutzbar.
Google und GitHub sind beide aus.
Datenbank ist bereit.
```

**Migration 003 ist gelaufen.** Damit gilt der persönliche Lernstand und
`WAS-NUN.md:13-17` ist veraltet — dieser Schritt ist erledigt.

**Nachtrag 2026-09-27:** 003–006 sind inzwischen alle live gefahren, und
zwar über `npm run db:migrieren` statt von Hand im SQL Editor. 003 war beim
ersten Lauf nur halb durch — `antwort_verbuchen` fehlte — und ist jetzt
wiederholbar, weil die beiden umbenannten Policies vorher mit
`drop policy if exists` entfernt werden. `006` hängt die Views auf
`sprache_code`.

### RLS live geprüft

Gegen die echte Datenbank mit dem anonymen Key getestet, ausschließlich
Lesezugriffe:

| Tabelle / View | Anonym sichtbar | Bewertung |
|---|---|---|
| `karteikarten_sets` | 3, alle `user_id = null` | korrekt, Besitzrechte greifen |
| `karten` | 300 | erwartbar (globale Demo-Sets) |
| `karten_fortschritt` | 0 Zeilen | dicht |
| `xp_events` | 0 Zeilen | dicht |
| `profil` | 0 Zeilen | dicht |
| `xp_pro_tag` | 0 Tage, XP-Summe 0 | dicht |
| `statistik_pro_sprache` | 3 Sprachen, alle `xp = 0` | dicht |
| `mein_fortschritt` | 1 Zeile, alle Werte 0 | **korrekt**, nicht Leck |

`mein_fortschritt` hat `security_invoker = true` (`003:436`) und liefert
anonym deshalb eine Nullzeile statt nichts. Das ist gewollt und in
`003:523-524` auch so begründet.

**Ergebnis: kein Fremdzugriff.** Die Schreib-Policies wurden nicht getestet —
dafür wäre ein echter Schreibversuch nötig, und der gehört von Hand ins
Dashboard (siehe [Phase 3](#phase-3--reichweite-und-öffentlichkeit)).

### Drei offene Punkte aus dem Betriebszustand

1. **300 Platzhalterkarten stehen produktiv.** Live geprüft, alle 300 gelesenen
   Karten haben den Inhalt `Frage n` → `Antwort n`. Siehe [Phase 2](#phase-2--inhalt-und-import).
2. **Registrierung ohne E-Mail-Bestätigung.** Jeder, der die URL kennt, kann
   ein Konto anlegen und sofort loslegen. Für eine öffentliche Seite
   Spam-Einladung. **Nutzerentscheidung am 2026-09-30:** bleibt vorläufig aus,
   weil kein SMTP-Mailserver konfiguriert ist (siehe Phase 3.9). Wieder
   aufnehmen, sobald SMTP steht.
3. **Kein OAuth-Anbieter aktiv.** Google und GitHub sind aus. Funktioniert,
   ist aber nur E-Mail/Passwort. Vor einer Veröffentlichung entscheiden, ob
   Google und GitHub eingerichtet werden.

---

## Die Befunde, nach denen gebaut wird

Aus dem Scan. Nicht alles wird umgesetzt — die Liste ist die Begründung für
die Phasen.

### Warum Leute die App nicht nutzen

| Nr. | Befund | Fundstelle |
|---|---|---|
| A1 | 300 Karten mit Inhalt `Frage 1` / `Antwort 1`. **Live bestätigt.** Jeder neue Nutzer sieht zuerst drei Kacheln mit 65 % / 32 % / 48 % Fortschritt und kann 20 Karten beantworten, 100 XP sammeln und Level steigen — auf Nonsense. Der Leerzustand „Noch keine Vokabel-Sets" ist toter Code. | `supabase/seed.sql:19-62` |
| A2 | Kein Importweg. Nur manuelles Tippen, ein Wort pro Zeile. Kein Datei-, CSV-, Anki-Import, kein `<textarea>`, keine KI-Erzeugung. | `app/(app)/karteikarten-hinzufuegen/` |
| A3 | Der Menüeintrag „Wortschatz" führt zu den Sets, nicht zu einem Wortschatz. Keine Wortliste, keine Wortsuche. | `app/(app)/wortschatz/page.tsx` |
| A4 | Keine Erinnerung, keine Offline-Fähigkeit. Der Regler „Tägliche Erinnerung" war ein `<fieldset disabled>` mit dem Hinweis „Diese Regler sind im aktuellen Stand Attrappen." | `einstellungen/page.tsx` (behoben mit 3.1) |

### Warum Leute wenig lernen, obwohl sie kommen

| Nr. | Befund | Fundstelle |
|---|---|---|
| B1 | **„Nochmal" tut nichts.** `INTERVALLE[0] = 0` zeigt „heute", aber `karten` wird nur beim Laden gesetzt und `setIndex(i => i + 1)` schiebt die Karte raus. Sie erscheint erst bei „Noch eine Runde" wieder. Der meistgeklickte Knopf wirkt kaputt. | `lernen-seite.tsx:221-223` |
| B2 | **Die 20er-Grenze ist unsichtbar.** `faelligGesamt` wird berechnet und zurückgegeben, aber **nirgends angezeigt** (verifiziert: nur die Typdeklaration). Die Übersicht sagt „Lerne heute 47 Wörter", die Runde endet mit 🎉 „Sitzung geschafft" bei 20 von 47. | `lernen/route.ts:219` |
| B3 | **Karten sind nackte Paare.** Kein Beispielsatz, kein Ton, keine Aussprache. Für eine Fremdsprachen-App ist das Grunddefizit. | `schema.sql:21-22` |
| B4 | **Fortschrittsbalken messen „gesehen", nicht „kannt".** `gelernt = bewertung !== "nochmal"` — eine mit „Schwer" bewertete Karte zählt als gelernt, steht aber auf Stufe 0 und ist heute noch fällig. | `lernen/antwort/route.ts:84` |
| B5 | **Trefferquote belohnt Raten.** `richtig = beantwortet - nochmal`; „Schwer" zählt als richtig. Wer immer „Schwer" klickt, hat 100 %. | `lernen-seite.tsx:163` |
| B6 | **Kein Umgang mit Problemskarten.** `treffer`/`fehler` werden seit 003 geschrieben und **nie gelesen**. Kein Aussetzen, keine Leech-Erkennung, keine Tags, keine Favoriten, kein Rückgängig. | `karten_fortschritt` |
| B7 | **Stufe 0 ist eine Sackgasse.** `stufeNachAntwort` ist unten bei 0 begrenzt. „Schwer" auf Stufe 0 bleibt 0, Intervall 0, heute fällig. Zusammen mit B1 ist der Nachlern-Loop kaputt. | `lernlogik.ts:36-37` |

### Zahlen, die nicht halten

| Nr. | Befund | Fundstelle |
|---|---|---|
| C1 | Level flach: `XP_PRO_LEVEL = 1500` ohne Kurve, bei max. 8 XP/Karte 187 perfekte Antworten pro Level. | `lib/profil.ts:14` |
| C2 | Tagesziel fest verdrahtet auf 20 XP und nicht einstellbar. Eine 20er-Runde „gut" ergibt 100 XP — der Balken ist sofort voll. | `003:637`, `tages-xp/route.ts:6` |
| C3 | Streak bricht bei einem einzigen verpassten Tag auf 0, ohne Freeze. Zählt aber schon 2 XP als geretteten Tag. | `003:466-481` |
| C4 | `sets_gelernt` zählt distinct `set_id` in `xp_events`, aber der Upsert schreibt `set_id = coalesce(bestand, neu)` — nur das **erste** Set des Tages. Wer am ersten Tag zwei Sprachen lernt, hat dauerhaft eine zu wenig. | `003:486`, `003:638-640` |
| C5 | Kein Umgang mit Intervall-Lücken. Kein „trotzdem lernen", wenn nichts fällig ist — nur „☕ Alles gelernt". | `lernen-seite.tsx:324-342` |
| C6 | Künstliche Deckelung: `MAX_SET_KARTEN = 1000`, der Nutzer bekommt „teile es lieber in mehrere Sets". | `lernen/route.ts:23` |

### Technisch, fällt später an

7 Migrationen laufen per Hand im SQL Editor. Es gibt kein
`supabase/migrations/` und keine `config.toml`. Die Level- und XP-Logik
existiert in TypeScript **und** in SQL — genau diese Doppelung hat schon
einmal Fehler gemacht (`OFFENE-PUNKTE.md:299-303`). `003b` enthält den
Platzhalter `00000000-…`. Toter Code steht in `OFFENE-PUNKTE.md:251-266`.

---

## Wortlisten-Quellen

Für **Englisch** ist die Quellenlage besser als für jede andere Sprache.
Reihenfolge der Nutzung:

1. **NGSL 1.2** — 2.809 Wörter, deckt 92 % des normalen Englischs ab,
   eigens für Lernende erstellt, Creative Commons, kostenlos.
   `newgeneralservicelist.com` → Das ist die maßgebliche Liste für „welche
   Wörter zuerst".
2. **Kelly Project (English)** — 7.549 Wörter mit **CEFR-Stufe A1–C2**,
   sauberes JSON. Damit werden die Sets geschnitten: A1 → „Grundlagen",
   A2 → „Alltag", B1 → „Fortgeschritten".
3. **Kaikki / Wiktionary englisch** — die deutsche Übersetzung zu jedem Wort
   (`translations[].code == "de"`). Englisch-Wiktionary hat die beste
   Übersetzungsabdeckung aller Sprachen. `kaikki.org`
4. **Tatoeba** (Englisch↔Deutsch) — echte Beispielsätze mit Übersetzung.
   `tatoeba.org`
5. **Browser-TTS** — da TTS gewählt ist, werden **keine Audiodateien**
   gebraucht. Das spart den kompletten Audio-Download.

**Referenz, dass so eine Pipeline trägt:**
`github.com/Mohith-akash/german-frequency-deck` macht genau dasselbe
(Frequenzliste + TTS + Bilder + Konjugation + Goethe-Level) und ist offen.
Deutsch statt Englisch, aber die Architektur ist dieselbe.

### Lizenz

NGSL und Kaikki/wordhoard stehen unter **CC-BY-SA**. Für die eigene App
unkritisch. Wird Lexio je öffentlich mit den Listen verteilt, braucht es
Quellenangabe und Share-Alike. Das ist der einzige Punkt mit echtem Aufwand
und muss vor einer Veröffentlichung entschieden werden.

### Erwartungszahl

Nicht jedes NGSL-Wort hat eine brauchbare deutsche Übersetzung **und** einen
Tatoeba-Beispielsatz. Realistisch sind das **1.500–2.000 vollständige
Karten**, nicht 2.809. Diese Zahl vor der Planung kennen, nicht danach.

### Satzspiegel

Die Wortlisten sind englisch zentriert. Ein Wortpaar ist ein Begriff in
der Zielsprache und seine deutsche Übersetzung. Beim Import gilt dieselbe
Richtung: Vorderseite Deutsch (Übersetzung), Rückseite Englisch (Begriff).
Das ist die Richtung, die TTS erwartet: gesprochen wird der Begriff, der
auf der Rückseite steht. Wer umgekehrt lernen will, bekommt die Karte
gedreht, sobald es die Richtungswahl gibt.

---

## Die Phasen

Jede Phase endet mit einer Abnahme durch den Nutzer. Nicht durchgehen.

### Phase 0 — Fundament

Voraussetzung für TTS **und** für Phase 2.

**Abgeschlossen am 2026-09-27, Migration 003–006 live gefahren.**

**0.1 Sprache von Freitext auf Code.** `sprache text not null`
(`schema.sql:12`) wird zu einer Tabelle mit `code`, `name`, `farbe`,
`akzent`. 12 echte Code-Dateien, 134 Treffer (viele davon CSS und toter
Code). Nebeneffekt: Zwei fragile String-Hacks fallen weg —
`schluessel()` in `lib/sprachen-farbe.ts:34-36` und die Dublette in
`karteikarten-seite.tsx:114,130`. Beide nehmen „nur das erste Wort" und
kollidieren bei „Chinesisch (Mandarin)".

> Erledigt als `public.sprachen` mit `flaeche` und `akzent` (die Spalten
> heißen so, weil `farbe` in Postgres kein Kollisionsproblem hat, aber der
> Feldname konsistent zum Konzept bleiben sollte). `lib/sprachen-farbe.ts`
> ist gelöscht, beide String-Hacks sind weg, 12 Sprachen stehen live in
> der Tabelle. Die alte Spalte `sprache` bleibt wie geplant stehen.

**0.2 Karten erweitern.** Neue Spalten `beispielsatz` (englisch) und
`beispiel_uebersetzung` (deutsch). Karte hat dann fünf Felder statt zwei.

> Erledigt. `005:103-104` legt beide Spalten an, `/api/karten` nimmt sie
> optional entgegen (max. 300 Zeichen), der Wizard hat zwei Felder mit
> „optional"-Hinweis, und die Rückseite der Lernkarte zeigt den Satz.
> Damit ist auch **1.4 vorab erledigt**. Live geprüft: Karte
> `Mañana`/`Morgen` gespeichert, Satz und Übersetzung in der Datenbank
> bestätigt, auf der Lernseite sichtbar.

**0.3 Das 1000-Karten-Limit.** `MAX_SET_KARTEN = 1000`
(`lernen/route.ts:23`). **Empfehlung:** Sets auf ≤1.000 Wörter schneiden und
das Limit stehen lassen. Es wird nie sichtbar, und das Antwortproblem von
120 KB pro Session bleibt ohnehin bestehen — das gehört in Phase 3.

> Entscheidung umgesetzt: `MAX_SET_KARTEN` bleibt bei 1000, unangetastet.

### Phase 1 — Lerneffekt

**1.1 „Nochmal" reiht wieder ein.** `lernen-seite.tsx:221-223` macht
`setIndex(i => i + 1)`. Stattdessen bei `nochmal` die Karte ans Ende der
Queue hängen und den Fortschritt nicht hochzählen. Der Server bleibt wie er
ist (`faelligAm(0) = heute`), das Problem ist rein die Client-Queue.

**1.2 Runde ehrlich machen.** `faelligGesamt` anzeigen: Kopfzeile „7 / 20",
Ende-Screen „20 von 47 geschafft — 27 bleiben". Der `hinweis` von
`setZuGross` bleibt unangetastet.

**1.3 TTS auf der Rückseite.** `speechSynthesis` in `lernen-seite.tsx`.
Kein Server, keine Kosten. Braucht: Sprachcode aus 0.1, ein
Lautsprecher-Knopf auf der Kartenrückseite (spricht den Begriff der
Fremdsprache), `voiceschanged` abfangen
(Safari lädt Stimmen asynchron — sonst ist der erste Klick stumm),
Großbuchstaben-Automatik aus, sonst buchstabiert es.

> **Erledigt am 2026-09-28, Commit `ee984f3`.** Die Logik liegt in
> `lib/sprachausgabe.ts`, nicht in der Seite: Stimmen asynchron, `lang`
> gesetzt (Chrome buchstabiert ohne), `cancel()` vor jedem neuen Satz.
>
> **Richtung gedreht am 2026-09-28 (Commit folgt).** Nutzerwunsch: erst die
> Muttersprache sehen, dann die Fremdsprache und die aussprechen. Die
> Vorderseite zeigt jetzt die deutsche Übersetzung, die Rückseite den
> Begriff, und der Lautsprecher sitzt bei ihm. Das Ende der Aussprache
> kommt aus `onend` statt aus einem Timer; der Timer bleibt nur als
> Obergrenze.
> 45 Fälle gegen eine nachgebaute `speechSynthesis` geprüft. Nicht live am
> Lautsprecher geprüft — dafür fehlt dem Browser-Werkzeug das TTY.

**1.4 Beispielsatz anzeigen.** Auf der Rückseite unter der Übersetzung. Bei
Import und Wortlisten-Generator gefüllt, bei manuellen Karten leer.

> **Erledigt in Phase 0** (0.2), live geprüft. Offen bleibt nur die
> automatische Füllung aus Wortlisten-Generator und Import — das sind
> 2.2 und 2.3.

**1.5 `gelernt` ehrlich definieren.** `lernen/antwort/route.ts:84` —
`gelernt = bewertung !== "nochmal"` ist der Grund für jeden geschönten
Balken. Vorschlag: `gelernt` ab Stufe ≥ 2, plus eigene Spalte für „gesehen".
Braucht Migration plus Anpassung aller drei Views.

> **Erledigt, live geprüft.** Migration 007: neue Spalte `gesehen` (Backfill
> für Bestand), `gelernt` ab Stufe ≥ 2, `antwort_verbuchen` mit `p_gesehen`.
> Beide Views zählen `karten_gesehen`/`gesehen` zusätzlich, während der
> Fortschrittsbalken weiter die ehrliche `gelernt`-Zahl nutzt. Treffer/Fehler
> hängen nun an der Bewertung, nicht am Lernstand — die Leech-Statistik (1.7)
> bleibt damit aussagekräftig.

**1.6 Trefferquote korrigieren.** `lernen-seite.tsx:163` — nur „gut" und
„einfach" als richtig zählen, damit die Zahl etwas Wahres sagt.

**1.7 Problemskarten entschärfen.** Aus den ungenutzten `treffer`/`fehler`:
Leech-Schwelle (etwa 8 Fehler → Ausschluss mit Knopf) und Rückgängig für
die letzte Antwort.

> **Erledigt.** Migration 009: Spalte `letzte_antwort` (Snapshot vor der
> Antwort), `antwort_verbuchen` schreibt den Snapshot, neue Funktion
> `antwort_rueckgaengig` stellt die Zeile wieder her (XP-Tageswert abziehen,
> nie unter 0), View `karteikarten_sets_uebersicht` zählt Leech-Karten
> nicht mehr als fällig. Die Schwelle `LEECH_FEHLER = 8` steht in
> `lib/lernlogik.ts`; die Route filtert Leech-Karten aus der normalen
> Rotation, `modus=leech` holt sie gezielt zurück (leechModus-Flag). Die
> Lernseite zeigt das Badge „Problemskarte", den Hinweis „N
> Problemskarten sind ausgeblendet" mit „Trotzdem üben" und einen Endschirm
> für die Reparaturrunde; „Rückgängig" nimmt die letzte Antwort per
> Snapshot zurück (Route `app/api/lernen/antwort/rueckgaengig`).

**Abnahme (Phase 1 bisher):** Runde fühlen sich ehrlich an. „Nochmal" zeigt
die Karte nochmal. Ton kommt auf der Rückseite (der Begriff klingt, die
Vorderseite bleibt still). Beispiel steht auf der Rückseite.
Fortschrittsbalken stimmen.

**1.8 Schlaue Reihenfolge.** Die Runde soll die Karten nicht mehr stur nach
`stufe`, sondern nach den Antworten des Accounts zwischen „schwer" und
„einfach" ordnen. Dazu ein kleines Modell pro Account (logistische
Regression), trainiert aus den Zaehler je Bewertung, das vorhersagt, wie
schwer eine Karte dem Nutzer faellt. Zusaetzlich kommt die Karte nach der
Runde wieder rein, je nach Bewertung.

> Der Nutzer wuenscht sich dabei: „nochmal" kommt in der Runde wieder und,
> wenn er dann erneut falsch liegt, wird es staerker gewichtet (haelt also
> mit, aber man merkt die Eskalation). „schwer" kommt mit etwa 50 % Chance
> wieder — bei zweimal „schwer" steigt die Chance. „gut" und „einfach"
> kommen nicht wieder (aber fließen trotzdem unterschiedlich in die
> Gewichtung). Genau diese Ereignisse eingelegt in die Statistik, damit das
> Modell aus dem Verlauf lernt.

**Abnahme (1.8):** Zwei gleich erstellte Karten mit unterschiedlicher
Antwort-Historie (einmal haeufig „schwer", einmal haeufig „einfach") sortiert
der Server unterschiedlich. „Nochmal" landet spuerbar wieder in der Runde,
„schwer" mit spuerbarer Wahrscheinlichkeit, „gut"/„einfach" nicht.
Statistikwerte zaehlen pro Bewertung korrekt hoch. Build und Lint sauber.

> **Erledigt.** Migration 010: Spalten `z_nochmal`, `z_schwer`, `z_gut`,
> `z_einfach` in `karten_fortschritt`, `antwort_verbuchen` zaehlt je
> Bewertung mit, `antwort_rueckgaengig` nimmt die Zaehler zurueck. Das
> Modell steht in `lib/reihenfolge.ts` (logistische Regression, pro Anfrage
> aus allen Karten des Accounts trainiert, Fallback auf stufe unterhalb der
> Stichprobengrenze). Die Route sortiert nach gelernten Schwierigkeit und
> liefert `schwierigkeit` je Karte; der Client wuerfelt bei „schwer" mit
> 50 % Basis, modellgefärbt, mit Eskalation beim zweiten „schwer" in der
> Runde (`lib/reihenfolge.ts:schwerChance`). „nochmal" bleibt in der Runde
> wie bisher.

**Stand Phase 1:** 1.1, 1.2, 1.3, 1.5, 1.6, 1.7 und 1.8 erledigt. Phase 1
ist damit abgeschlossen. 1.4 ist inhaltlich in 0.2 erledigt, die
automatische Fuellung folgt mit 2.2 und 2.3.

### Phase 2 — Inhalt und Import

**2.1 Die 300 Platzhalterkarten entfernen.** Sie stehen live in der
Produktivdatenbank. Ersetzen durch ein echtes Starter-Set (NGSL Top 100)
oder ganz entfernen, damit der Leerzustand endlich wieder arbeitet.

> **Erledigt.** Migration 011 löscht die drei globalen Demo-Sets
> (englisch-grundlagen, italienisch-urlaub, spanisch-alltag); Karten und
> der Lernstand darauf gehen per ON DELETE CASCADE mit. Die fünf
> Testreste (`__conntest__`, `probe-a`, `probe-b`, `ciao`, `bella`) lagen
> in diesen Sets und sind damit ebenfalls entfernt. Live geprüft: keine
> Sets, keine Karten, kein Fortschritt, keine XP-Events mehr; die Übersicht
> zeigt wieder den echten Leerzustand. Das Starter-Set folgt in 2.2.

**2.2 Wortlisten-Generator.** Ein Skript in `scripts/`, das NGSL + Kelly +
Kaikki + Tatoeba zu Lexio-Karten zusammensetzt. Ausgabe als JSON/CSV, Import
über die bestehende `POST /api/karten`-Route. **Läuft einmalig, nicht zur
Laufzeit** — das ist Absicht, es hält die App schlank und kostenlos.

> **Erledigt.** `scripts/wortlisten-erzeugen.mjs` setzt NGSL (Frequenzrang) +
> Kelly (CEFR) + Kaikki (deutsche Übersetzung) + Tatoeba (Beispielsatz mit
> Übersetzung) zu Karten zusammen (Vorderseite Deutsch, Rückseite Englisch,
> Beispielsatz EN + DE-Fassung). Ein Filter verwirft Kaikki-Fragmente
> (Sätze, Dialektvarianten, Buchstabensense); eine kuratierte Sonderfall-Liste
> deckt die ~26 häufigsten Funktionswörter ab, deren erste Kaikki-Bedeutung
> irreführend ist. Ergebnis: **100/100** der NGSL-Top-100 als vollständige
> Karten. Ausgabe als JSON + CSV unter `scripts/wortlisten/`.
>
> Der Import läuft NICHT über `POST /api/karten`: die Route blockt das
> Schreiben in fremde (öffentliche) Sets absichtlich, und das Starter-Set
> soll für alle sichtbar sein (Nutzer-Entscheidung). Stattdessen legt
> `scripts/wortlisten-importieren.mjs` das Set als globales Set an
> (`user_id = NULL`, `eigenes_set = false`) über die Management-API
> (Access Token) in einer SQL-Anweisung. Live eingespielt: Set
> `englisch-grundlagen` „Englisch Grundlagen", 100 Karten, für alle sichtbar.
> Roh-Quellen liegen bewusst außerhalb des Repos (`/scripts/quellen/` ist
> gitignored); der Generator erwartet sie dort oder unter `--quellen`.

**2.3 Textblock-Import.** Neuer Schritt im Wizard: ein `<textarea>`,
Trennzeichen-Erkennung, dann **Vorschau mit Editierfeld je Zeile**, erst
dann speichern. Englischarteig nach links, deutsche Übersetzung nach rechts.

> **Erledigt.** Schritt 2 des Vokabel-Wizards hat jetzt einen Umschalter
> „Zeile für Zeile" / „Textblock einfügen". Der Textblock wird mit
> `lib/textblock-import.ts` geparst (Trennzeichen: Tabulator, `;`, `|`,
> `->`, `=`, `:`, Strich; bevorzugt das häufigste je Block, optional
> Beispielsatz als dritte und Übersetzung als vierte Spalte). Die Zeilen
> landen als normale, editierbare Wortpaare in derselben Liste — erst
> Schritt 3 speichert. Parsen ohne Trennzeichen oder leere Einträge werden
> gemeldet, nicht still geschluckt. Die Parser-Logik ist als reine Funktion
> testbar (21 Tests grün); Build und Lint sauber.

**2.4 „Wortschatz" einlösen.** `/wortschatz` ist heute ein Redirect. Eine
echte Wortliste aller Vokabeln mit Suche wäre das, was der Menüeintrag
verspricht — und der Import macht sie erst wertvoll.

> **Merknote für „fixx lexio":** Beim Vokabeln-Adden müssen später auf jeden
> Fall noch ein paar **angenehmere Eingabe-Varianten** dazu kommen (es bleibt
> nicht beim einfachen Textblock/Feld). Welche genau, wird beim „fixx lexio"
> noch erarbeitet — hier steht nur der Auftrag, dass es mehr als eine
> unbequeme Weg-Variante gibt.

**Abnahme (Phase 2):** Wortschatz-Sicht abgenommen — Liste, Suche, Set-Links
und der Wechsel zwischen Wortsicht und Set-Übersicht in beide Richtungen
(Commit `ea94203`). Der Leerzustand arbeitet wieder (2.1), das Starter-Set
steht live (2.2), der Textblock-Import ist geprüft (2.3). **Phase 2
abgeschlossen am 2026-09-30.** Die Merknote zu angenehmeren Eingabe-Varianten
bleibt als späterer Auftrag offen.

### Phase 3 — Reichweite und Öffentlichkeit

**3.1 Web-Push.** Service Worker + VAPID-Schlüssel + Permission-Dialog. Der
tote Regler in `einstellungen/page.tsx:175-191` wird dadurch zum echten
Schalter. **iOS bleibt eine Lücke** — das gehört in die Ankündigung, nicht
unter den Tisch. Der Versand läuft über ein lokales Skript
(`npm run push:senden`, täglich per crontab) — ehrlich für eine App, die
bisher nur auf dem eigenen Rechner läuft. Abos liegen in
`public.push_abonnements` (Migration 008).

> Erledigt. Der Schalter fragt die Permission an, registriert den Service
> Worker (`public/sw.js`), meldet das Abo an `app/api/push/abonnement` und
> erzeugt beim Versand eine System-Benachrichtigung. VAPID-Schlüssel in
> `.env` (`npm run push:schluessel`). Der lokale Cron ist eingerichtet
> (18:30, Log in `/tmp/lexio-push.log`). iOS: Web-Push bleibt unzuverlässig —
> der Browser meldet das selbst, der Schalter zeigt einen Hinweis.

**3.2 Level-Kurve.** `lib/profil.ts:14` — Kurve statt 1500 flach, mit
Lücken-Balken bei 50 % / 80 % / 100 %.

**3.3 Tagesziel ehrlich.** 20 XP ist im RPC fest verdrahtet (`003:637`).
Entweder konfigurierbar oder aus der realen Rundenzahl abgeleitet.

**3.4 `sets_gelernt` reparieren.** `003:486` zusammen mit dem Upsert
`003:638-640`.

> **Erledigt.** Migration 014: neue Tabelle `xp_tag_sets` (PK
> `(user_id, datum, set_id)`), damit ein Tag mehrere Sets zaehlt statt nur
> das erste. `antwort_verbuchen`/`antwort_rueckgaengig` schreiben hier,
> beide Views lesen hier, RLS und Grants passend. Live geprueft:
> `xp_tag_sets=1`, `xp_events=4`, ner-Zaehler bleiben konsistent — laufende
> Praxis war, dass nur das erste Set des Tages gezählt wurde. Commit
> `db26965`.

**3.5 PWA.** Kein Service Worker, kein Manifest, alle Fetchs mit
`cache: "no-store"`. Fürs Lernen im Zug.

> **Erledigt.** Manifest (`app/manifest.ts`), Icons 192/512/maskable aus dem
> Logo, Service Worker in `public/sw.js` mit Offline-App-Shell
> (Network-first fuer Navigationen, Cache-first fuer `/_next/static` und
> Bilder, `/api/*` bleibt bewusst ungecacht). Registrierung beim App-Start
> (`components/pwa/pwa-registrierung.tsx`). Commit `97e197f`.

**3.6 Rate-Limiting.** Es gibt **keines**, weder für Anmeldung noch für die
API. Die Anmeldeseite erkennt Supabases „rate limit"-Fehler und zeigt sie an
(`anmelden-seite.tsx:126`), erzeugt wird aber keine Begrenzung. Für eine
öffentliche Seite Pflicht.

> **Erledigt.** `proxy.ts` (Next 16 nennt Middleware `proxy`): In-Memory-
> Sliding-Window je IP und Gruppe — `auth` 10/min, `gesundheit` 60/min,
> Schreiben 30/min, Lesen 120/min; 429 mit `Retry-After`. Live gemessen:
> 120-mal 200er-Reihe, dann 429er. Anmelde-Cooldown clientseitig ergaenzend
> (5 Fehlversuche, 30 s Sperre). Commit `e652235`.

**3.7 Security-Header.** `next.config.ts` ist ~30 Zeilen und enthält nur die
Bild-Quellen für die OAuth-Logos. Kein `poweredByHeader: false`, keine CSP,
kein HSTS. `app/layout.tsx:138` injiziert das Theme-Skript per
`dangerouslySetInnerHTML` — genau der Fall für eine CSPNonce.

> **Erledigt.** `next.config.ts`: `poweredByHeader: false` plus statische
> Header (nosniff, Referrer-Policy, X-Frame-Options, Permissions-Policy,
> HSTS). `proxy.ts` setzt pro Anfrage eine CSP mit frischem Nonce
> (`script-src 'self' 'nonce-…' 'strict-dynamic'`), `connect-src` erlaubt
> den Supabase-Ursprung, `style-src` bleibt bewusst `'unsafe-inline'` (die
> App setzt dutzende Inline-Style-Attribute). `app/layout.tsx` reicht den
> Nonce an das Theme-Skript. Live geprueft: Nonce steht in jedem
> Script-Tag, `/api/*`, `/_next/static`, `sw.js`, Manifest und Bilder
> bekommen keine CSP (SW-Antwort: bewusst nicht). Commit folgt.

**3.8 `/api/gesundheit` absichern.** Der Endpunkt ist öffentlich und verrät,
ob der Service-Role-Key gesetzt ist (`OFFENE-PUNKTE.md:229-236`).

> **Erledigt.** Die Env-Diagnosen (Service-Role-Key, DB-Passwort, anon-Rolle)
> verrät der Endpunkt nur noch im Entwicklungsbetrieb
> (`inklusiveServerKonfiguration` in `pruefeGesundheit`, aktiv wenn
> `NODE_ENV !== "production"`). Vor einer öffentlichen Instanz bleibt stehen,
> was ein Besucher auch durch Raten erfährt (Datenbank erreichbar, Migration,
> Dashboard-Schalter). Live geprüft: dev zeigt `service-key`, der
> Produktions-Build zeigt nur noch `oauth`. Commit folgt.

**3.9 Deployment-Check.** E-Mail-Bestätigung **an** (aktuell aus, siehe
Betriebszustand), nur konfigurierte OAuth-Anbieter, Produktions-Build, und
**ein Handtest der Schreib-Policies im Dashboard** — ein Versuch, ein fremdes
Set oder eine fremde Karte zu ändern, muss scheitern.

> **Erledigt, mit einer bewussten Ausnahme.** Nutzerentscheidung vom
> 2026-09-30: Die E-Mail-Bestätigung bleibt **vorläufig aus**, weil im
> Projekt **kein SMTP-Mailserver hinterlegt** ist — anschalten würde jeden
> Neuzugang lautlos blockieren, bis eine Bestätigungsmail ankommt. Der
> Punkt bleibt offen, bis SMTP eingerichtet ist (Docs Social →
> Authentication; siehe Spielregel "Drei offene Punkte aus dem
> Betriebszustand", Punkt 2). Alle anderen Teile dieses Checks sind grün:
>
> - **OAuth-Anbieter:** keine aktiv — die Anmeldeseite zeigt nur
>   E-Mail/Passwort, keine toten Knöpfe. Konsistent, nichts zu tun.
> - **Produktions-Build:** `npm run build` sauber, der gebaute Server lief
>   auf Port 3999 und beantwortete `/api/gesundheit`.
> - **Schreib-Policies live geprüft (Handtest):** UPDATE auf ein öffentliches
>   Set → 0 Zeilen (`[]` mit `Prefer: return=representation`), DELETE →
>   0 Zeilen, INSERT mit fremder `user_id` → API-Fehler `42501 row-level
>   security policy violation`. `pg_policies` zeigt die Ursachen: UPDATE/
>   DELETE gestatten nur `user_id = auth.uid()` (Sets) bzw. ein Set, das
>   `auth.uid()` gehört (Karten); öffentliche Sets sind nur lesbar.
>   Commit folgt.

**3.10 Session-Leistung.** `lernen/route.ts:23` zieht bis 1001 Karten mit
eingebautem Join, `cache: "no-store"` überall. Pro Sessionstart eine große
unbeholte Antwort. Paginierung oder Zufallsauswahl statt Komplettladung.

> **Erledigt.** Die Komplettladung ist geteilt (`app/api/lernen/route.ts`):
> Die erste Abfrage holt nur noch `id` plus Fortschrittszeile
> (`fortschritt:karten_fortschritt!…`), also die Metadaten, die Sortierung,
> Faelligkeit und Statistik brauchen — die einstigen ~120 KB Karten-Text
> bleiben draußen. Texte (`frage`, `antwort`, beide Beispielsaetze) folgen
> erst für die Karten, die die Runde wirklich ausgibt: eine zweite `.in`-Abfrage
> auf höchstens `MAX_WIEDERHOLUNG` (40) Karten; ihre ids stehen einzeln in der
> URL (je 36 Zeichen), weit unter der Grenze, an der die fruehere Variante
> mit allen Karten großer Sets scheiterte. Bewusst **keine** Zufallsauswahl:
> die „schlaue Reihenfolge" (Plan 1.8) braucht alle faelligen Karten des Sets,
> um die haertesten zuordnen zu koennen — Metadaten sind dazu klein genug.
> Live geprüft mit einem temporären Konto gegen das laufende System:
> `modus=ueben` serviert 40 Karten mit Volltext (~10 KB statt ~120 KB),
> die normale Runde 20; `faelligGesamt`/`kartenGesamt`/`setZuGross` unveraendert.

### Phase 4 — Aufräumen

Migrationen nach `supabase/migrations/` statt Hand-Import. Tests für
`lernlogik.ts` und `antwort_verbuchen` — die Level-Logik existiert in
TypeScript **und** SQL (`OFFENE-PUNKTE.md:299-303`). `003b`-UUID ersetzen.
Toter Code aus `OFFENE-PUNKTE.md:251-266`; bei Phase 0 fällt ein Teil davon
von selbst weg.

> **Teil 1 (Toter Code) erledigt.** Gelöscht, über den Importgraph geprüft:
> `lib/mock-*.ts` (4), `components/stats/` (5 Dateien), `components/loading-state-div/`,
> `components/sprache-auswählen/` – nur noch tote `top-of-page`-Teile enthalten –
> und `components/navbar/button-element-navbar.tsx`. Build und Lint sauber.
>
> **Teil 2 (Migrationen) erledigt.** Alle 14 Dateien liegen jetzt in
> `supabase/migrations/`; `schema.sql`/`seed.sql` bleiben oben. `scripts/db-migrieren.mjs`
> liest und meldet von `supabase/migrations/` (Trockenlauf geprüft). `db-status.mjs`
> bleibt unangetastet – fremd modifiziert (paralleler Agent); sein Hinweistext mit
> `supabase/<datei>` zeigt nur auf den Pfad und ist nicht funktional.
>
> **SEO gehört zu Phase 4 (Nutzerauftrag). Teil 1 (Basistechnik) erledigt:**
>
> - `lib/meta.ts` exportiert `SITE_URL` aus `NEXT_PUBLIC_SITE_URL`, Fallback
>   `http://localhost:3000`. **Beim Deploy muss `NEXT_PUBLIC_SITE_URL` gesetzt
>   werden**, sonst zeigen OG-Tags ins Leere (localhost).
> - `app/robots.ts` disallowed die drei Auth-Seiten; `app/sitemap.ts` ist bewusst
>   **leer** – aktuell gibt es keine öffentlich indexierbare Seite.
> - Root-Layout: `metadataBase`, OpenGraph, Twitter-Card.
> - `app/(app)/layout.tsx` setzt zentral `robots: noindex` für den gesamten
>   Login-Bereich – so rutscht keine neue App-Seite versehentlich in den Index.
> - `proxy.ts` schließt `robots.txt`/`sitemap.xml` vom Matcher aus; eine CSP auf
>   Text-/XML-Antworten ist sinnlos.
> - Geprüft: Build, Lint, Live-Checks (`curl` auf robots/Sitemap/head).
>
> **Teil 2 (Landing-Page) offen:** ohne öffentliche Seite bleibt die Sitemap leer
> und Google hat nichts Nützliches zu indexieren. Landing-Page konzipieren und
> dann `sitemap.ts` füllen.

### Phase 5 — Responsive-Audit

**Abnahmekriterien.** Für jede Seite bei **360 px, 414 px und 768 px**:
Übersicht, Wortschatz, Lernansicht, Statistiken, Profil, Einstellungen,
Anmelden, alle vier Schritte des Hinzufügen-Wizards.

- Kein waagerechter Bildlauf
- Kein Text kleiner als 14 px
- Kein Bedienelement kleiner als 44 × 44 px
- Kein Inhalt wird vom unteren Tabellenleisten-Bereich verdeckt
- Die vier Bewertungsknöpfe sind auf 360 px alle erreichbar und lesbar
- Die 3D-Karte dreht sich korrekt und überdeckt keinen Text
- Sticky-Elemente überlappen keinen Inhalt
- Hoch- und Querformat geprüft
- `prefers-reduced-motion` respektiert (die Karten-Animation dreht sich)

**Wichtig:** Das ist eine Prüfphase, keine Behauptung. CSS lesen zeigt keine
gerenderte Seite. Der Befund zur Profilkarte (Arbeitsregel 2) kam aus dem
Quelltext; der Blick aufs Handy ist das, was fehlt.

---

## Reihenfolge und Abhängigkeiten

```
Phase 0  (Sprach-Code, Kartenspalten)
   ├──> Phase 1  (TTS braucht 0.1, Beispielsatz braucht 0.2)
   └──> Phase 2  (Wortlisten müssen sauber einsortiert werden)
Phase 1  ──> Phase 2   (Lerneffekt zuerst, wie entschieden)
Phase 2  ──> Phase 3   (Content, bevor Reichweite)
Phase 2  ──> Phase 6   (Icons brauchen echten Inhalt, nicht Platzhalter)
Phase 3  ──> Phase 4
Phase 4  ──> Phase 5
Phase 5  ──> Phase 6   (Icons auf dem Handy prüfen)
Phase 6  ──> Phase 7   (Icon-System wandert in die App)
```

Phase 0 ist trotz „klingt nach nichts" die teuerste Code-Änderung: 12
Dateien, 134 Treffer, plus Migration. Sie ist trotzdem Voraussetzung für
alles Weitere.

Phase 6 und Phase 7 sind ausdrücklich nachrangig. Sie stehen hier, damit
sie nicht verloren gehen — nicht damit sie jetzt gemacht werden. Siehe
[Nachtrag](#nachtrag-vom-2026-09-27--react-native-app-und-karten-icons).

---

## Risiken

**Die Wortlisten sind der teuerste Teil.** Erwartung von **1.500–2.000**
vollständigen Karten, nicht 2.809. Für eine echte App reicht das, aber die
Zahl muss vor der Planung stehen.

**Phase 0 berührt viel.** 12 Dateien an 134 Stellen. Fehler dort sind schwer
zu sehen, weil die Farb- und Sprachlogik überall hängt.

**Erledigt am 2026-09-27, mit Konto und Messung:** die Lernansicht wurde bei
360 px, 414 px und 768 px geprüft, inklusive Beispielsatz. Kein
waagerechter Bildlauf, keine Bedienfläche unter 44 px, nichts ragt heraus.
Offen bleibt davon nur die **optische** Beurteilung — die vier
Bewertungsknöpfe sind messbar erreichbar, aber ob die 3D-Karte Text
überdeckt, sieht man nur mit eigenen Augen. Das bleibt Phase 5.

**iOS-Web-Push bleibt eine Lücke.** Web-Push ist unzuverlässig auf iOS. Wer
eine App will, die auf jedem Gerät erinnert, braucht zusätzlich einen Weg.

**Die Lizenzfrage ist nicht technisch.** Vor einer öffentlichen
Veröffentlichung entscheiden, ob CC-BY-SA Share-Alike akzeptabel ist.

**`supabase/schema.sql` ist eine Falle.** Am 2026-09-27 gegen die Live-Datenbank
geprüft: `schema.sql` ist der alte Bootstrap-Stand **ohne** `user_id`,
`profil`, `karten_fortschritt` und `mein_fortschritt`. Wer eine frische
Umgebung daraus aufbaut, bekommt eine App ohne persönlichen Lernstand — also
eine, die im Kern kaputt ist. Die beiden Dateien widersprechen sich sogar
inhaltlich: `003:404` rechnet `statistik_pro_sprache` über `karten_gesamt`,
`schema.sql:176` über `anzahl_karten`. **Maßgeblich sind 003 und 004, nicht
`schema.sql`.** Vor einer öffentlichen Veröffentlichung muss geklärt werden,
ob `schema.sql` entweder auf den 004-Stand gebracht oder klar als
„historischer Bootstrap" gekennzeichnet wird. Gehört nach Phase 4.

**`anzahl_karten` zählt nicht, es behauptet.** Live gegen `count(k.id)`
geprüft: 120/80/95 gegen 122/82/96 — die Differenz sind 5 Testkarten, die nach
dem Seed dazukamen. Für die Statistik ist es folgenlos, weil 003 inzwischen
über `karten_gesamt` rechnet, aber die Spalte wird in
`karteikarten_sets_uebersicht` weiter mitgeliefert und kann in der Oberfläche
landen. Entweder per Trigger pflegen oder nicht mehr ausliefern. Phase 4.

**Platzhalterbestand: 295, nicht 300.** Am 2026-09-27 live gezählt. Die
restlichen 5 Karten sind Testreste und keine Inhalte: `__conntest__`
(Spanisch), `probe-a`/`probe-b` (Italienisch) sowie `ciao` → `hallo` und
`bella` → `mädchen` im **englischen** Set. Letztere sind doppelt falsch
einsortiert. Entfernen ist unkritisch, aber sie gehören in Phase 2 namentlich
genannt, damit niemand sie für echten Inhalt hält.

**Transliterationen matchen nicht.** `005` leitet `sprache_code` aus dem
Freitext ab und normalisiert dabei Umlaute. `Türkisch` wird zu `turkisch` und
findet die Sprache. Die ASCII-Schreibweise `tuerkisch` findet sie *nicht* und
bleibt leer; die Migration meldet das per `NOTICE`. Absicht — aber es heißt,
dass Altbestand mit ASCII-Umschreibungen von Hand zugeordnet werden muss.

---

## Nachtrag vom 2026-09-27 — React Native App und Karten-Icons

Zwei Vorhaben, die nach der Nutzerentscheidung vom 2026-09-27 dazukommen.
Beide stehen **nach** Phase 5. Sie sind hier festgehalten, damit sie nicht
vergessen werden — sie sind kein Grund, eine Phase vorzuziehen.

### Phase 6 — Karten-Icons als Wiedererkennungsmerkmal

**Der Wunsch.** Jede Karte soll ein kleines, eigenes, gut merkbares Zeichen
bekommen, das man beim Wort sofort wiedererkennt. Also ein Lernanker:
Wort → Bild → Wort, ohne den Text zu lesen.

**Warum das nicht 2.000 gezeichnete Logos sind.** Der teure Weg wäre ein Logo
pro Karte. Bei 1.500–2.000 Karten heißt das: 2.000 Bilder, jeder seine eigene
Gestaltung, eigene Datei, eigener Speicherplatz. Das ist nicht bezahlbar und
nicht wartbar. Noch teurer: 2.000 per KI erzeugte Bilder — langsam, teuer, und
im Stil jedes Mal ein anderes. Eine uneinheitliche Icon-Fläche auf 2.000
Karten sieht schlechter aus als gar keine.

**Der Weg, der funktioniert.** Ein *eigenes Zeichen pro Karte* ist nicht nötig,
wenn das Zeichen aus einer **konsistenten, kleinen Menge stammt** und die
Zuordnung *offensichtlich* ist. Also:

- Ein Icon-Satz mit einem einheitlichen Stil, etwa 150–400 Zeichen. Nicht
  selbst gezeichnet, sondern lizenzfrei (z. B. Lucide oder Phosphor, beide MIT
  und in Next.js gut tree-shakable).
- Eine **Zuordnungstabelle Wort → Icon**. Für "apple" das Apfel-Icon, für
  "dog" das Hund-Icon, für "doctor" das Arzt-Icon. Nicht "apple" → Obst-Symbol,
  denn das ist zu grob: dann teilen sich 200 Obstwörter dasselbe Zeichen.
- Für jedes Wort zusätzlich die **Sprach-Akzentfarbe** aus `sprachen`
  (`005-sprachen-und-beisatz.sql`) und womöglich eine von wenigen
  Formvarianten. Zusammen ergibt das genug optische Vielfalt, ohne 2.000
  Bilder zu pflegen.
- Die **Zuordnung ist das teure Stück**, nicht die Technik: rund 2.000
  bewusste Entscheidungen, wie man sie beim Erzeugen der Wortlisten in
  Stapeln macht und prüft. Einmalig, danach Teil der Wortlisten-Generierung.

**Was den Nutzen ausmacht.** Der Lerneffekt kommt nicht davon, dass ein Bild
einmalig ist, sondern dass Bild und Wort **sichtbar gekoppelt** sind. Ein
konsistenter Satz, richtig zugeordnet, wirkt stärker als 2.000 bunte
Eigenkreationen. Umgekehrt gilt: ein *falsches* oder *abstraktes* Icon ist
schlechter als keines, weil es als Lärm im Bild sitzt.

**Warum es warten kann, ohne Schaden.** Icons sind reine Zusatzinformation auf
der Kartenfläche. TTS (1.3), Beispielsatz (1.4), Nochmal-Requeue (1.1) und
die ehrlichen Fortschrittsbalken (1.5) funktionieren ohne Icons und stehen
zuerst. Icons sind das letzte, was jemandem auffällt, wenn es fehlt.

**Was ausdrücklich nicht passiert.** Kein halbes Icon-Set. Wenn nur 40 von 2.000
Karten ein Zeichen haben, ist die *Abwesenheit* das Signal, und die Fläche
sieht kaputt aus. Lieber Phase 6 komplett verschieben, bis die echten Wortlisten
aus Phase 2 stehen — Platzhalter symolisieren wäre weggeworfene Arbeit.

**Abnahme:** 20 zufällige Karten, bei denen das Icon ohne Kontext und auf
360 px dennoch das richtige Wort erraten lässt. Wenn das bei 20 nicht
trägt, ist die Kategorie zu grob und wird nachgeschärft.

### Phase 7 — React Native App

**Der Wunsch.** Lexio soll als App fürs Telefon gebaut werden, nicht nur als
Website.

**Was das ist.** Ein zweiter Client für dieselbe Datenbank. Die API-Routen,
das Lernlogik-Modul (`lib/lernlogik.ts`) und das Datenmodell bleiben
gemeinsam; die gesamte Oberfläche wird neu geschrieben. Das ist kein Feature,
das ist ein zweites Produkt.

**Was es wirklich löst.** Der iOS-Push. Web-Push ist auf iOS unzuverlässig
(siehe [Risiken](#risiken)); eine native App kann über APNs zuverlässig
erinnern. Das ist das stärkste Argument dafür — aber es greift erst, wenn
genug Leute die Web-Version benutzen.

**Warum es ans Ende gehört.** Vor Phase 5 fertig zu sein heißt, jeden
Oberflächenfehler zweimal zu beheben. Die Lernansicht wird sich in Phase 1
und 5 ohnehin noch mehrfach ändern.

**Was jetzt schon getan werden kann, damit es später billiger wird.** Fast
nichts, aber das Wenige lohnt sich:

- `lib/lernlogik.ts` (Intervalle, Bewertungen, Stufen) bleibt reines TypeScript
  ohne React- und ohne Next-Bezug. Ist es derzeit schon, und das ist Zufall,
  nicht Absicht — bitte so lassen.
- Typen aus `lib/types.ts` und die Farb-/Sprachwerte aus `public.sprachen`
  als gemeinsame Quelle, nicht als Duplikat im Client.
- Keine Logik in Client-Komponenten, die nur im Web existieren kann
  (z. B. `speechSynthesis` aus 1.3 ist Web-only; React Native braucht dafür
  eine eigene Audio-Bibliothek — als Austauschpunkt vormerken).

**Abnahme:** derselbe Nutzer meldet sich in der App an, sieht denselben
Fortschritt wie im Web, und lernt eine Runde auf einem echten iPhone. Danach
iOS-Erinnerungen, die auch wirklich ankommen.
