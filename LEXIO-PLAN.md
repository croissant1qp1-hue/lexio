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

**2.5 Angenehmere Eingabe-Varianten.** Die Merknote aus 2.4 wird hier
abgearbeitet. Vier Varianten, in dieser Reihenfolge:

| # | Variante | Stand |
|---|---|---|
| 1 | Wortliste ohne Trennzeichen einfügen | erledigt |
| 2 | Beispielsätze automatisch ergänzen | erledigt |
| 3 | Datei hochladen (`.txt`, `.csv`) | erledigt |
| 4 | Set duplizieren, Karten bearbeiten/löschen | erledigt |

> **1 — Wortliste ohne Trennzeichen.** Eine deutsche Wortliste, wie sie aus
> einem Buch oder einer anderen App herauskopiert wird, hat kein Trennzeichen:
>
> ```
> Haus
> Baum
> Fluss
> ```
>
> Dafür gibt es `lib/einzelimport.ts`. Erkannt werden Nummerierung
> (`1.`, `1)`, `•`), Tabulator, Pipe, Semikolon, Doppelpunkt, `=`, `->`, `=>`
> und Trennworte (`means`, `ist`, `sind`, `heißt`, `heisst`). Eine Zeile mit
> nur einem Begriff wird als **offene, sichtbare Zeile** übernommen — leer,
> in der Liste sichtbar, dort zu ergänzen. Sie geht nicht verloren.
>
> Ausdrücklich **nicht** geraten wird: es gibt keine lokale Wörterbuchdatei
> und keinen Cloud-Schlüssel, und ein still falsches Wort in einer
> Vokabelkarte ist schlimmer als eine sichtbare Lücke. Der Bindestrich trennt
> nur, wenn die rechte Seite wie eine Übersetzung aussieht, sonst zerfällt
> jeder Nebensatz mit Gedankenstrich. 41 Tests grün.
>
> **2 — Beispielsätze automatisch.** `/api/beispielsatz` liefert zu einem
> Wortpaar einen echten Satz aus dem Tatoeba-Korpus (EN→DE, Migration 012)
> samt deutscher Übersetzung, mit Cache und optionaler KI dahinter.
>
> Verifiziert am 2026-10-01: Der Korpus war leer (Tabelle angelegt, nie
> befüllt) und `GROQ_API_KEY` fehlt in `.env` — die Route gab für **jedes**
> Wort `quelle: "keine"` zurück. Nach dem Einspielen von **35.125** Korpus-
> zeilen (Tatoeba `eng-deu`, `npm run beispielsatz:korpus`) liefert sie
> 16/16 getestete Wörter, live in der Oberfläche geprüft.
>
> Zwei Fehler, die erst die Messung zeigte:
>
>   - Die Route fragte `frage` im englischsprachigen Korpus ab. Bei „Haus =
>     house" steht der Begriff aber auf der deutschen Seite, der Treffer lag
>     unter `house` — 0 Treffer bei voller Tabelle. Jetzt werden beide Seiten
>     abgefragt, Übersetzung zuerst.
>   - Die Auto-Ergänzung nach dem Textblock-Import lief nie an: sie las
>     `paareRef`, der über einen `useEffect` einen Render hinterherhinkt.
>     Gemessen: **0** API-Aufrufe bei zwei importierten Wörtern. Jetzt wird
>     die frisch erzeugte Liste übergeben.
>
> Ehrlich statt still: Findet sich für eine Zeile nichts — bei einem
> spanischen Set ist das der Normalfall, weil es nur eine englische Quelle
> gibt —, sagt die Oberfläche das jetzt, statt den Knopf verschwinden zu
> lassen.

> **3 — Datei hochladen.** `lib/datei-import.ts` liest `.txt`, `.csv`
> und `.tsv` und macht daraus genau die Form, die `textblockEinlesen` bereits
> versteht: eine Zeile je Vokabel, Felder durch Tabulator. Die Datei
> durchläuft also **denselben** Importweg wie eingefügter Text — ein
> zweiter Vokabel-Parser wäre die Art von Doppelarbeit, die sich bei der
> nächsten Erweiterung rächt.
>
> Verifiziert am 2026-10-01, live in der Oberfläche mit Playwright, elf
> Dateien:
>
> | Fall | Ergebnis |
> |---|---|
> | Excel, deutsch (BOM, `;`, CRLF, Quotes, 4 Spalten) | 3 Vokabeln, Kopfzeile genannt |
> | Google Sheets (`,`, Kopfzeile) | 2 Vokabeln |
> | Tabellenexport (Tabulator) | 2 Vokabeln |
> | Wortliste ohne Trennzeichen | 3 offene Zeilen |
> | Kopfzeile ASCII / mit Umlaut / englisch | erkannt, Inhalt darunter importiert |
> | nur Kopfzeile, nichts darunter | Abbruch mit der Kopfzeile im Text |
> | PNG, 645 kB, leere Datei | Ablehnung mit Begründung |
>
> Drei Fehler, die erst die Messung zeigte:
>
>   - **Eine Kopfzeile aus einem deutschen Excel blieb als Vokabel stehen.**
>     Die Kopfwörter waren per `Ü→u` normalisiert, „Übersetzung" wurde also zu
>     `ubersetzung` — und stand nicht in der Liste, die `uebersetzung`
>     enthielt. Genau die wichtigste Kopfzeile der App fiel durch, wenn sie
>     mit Umlaut geschrieben war. Jetzt werden Umlaute nach `ae/oe/ue/ss`
>     übersetzt, wodurch beide Schreibweisen auf denselben Schlüssel fallen.
>     Ebenso fehlten die englischen Spaltennamen: „Word | Meaning | Example"
>     aus Google Sheets wurde als Vokabel importiert.
>   - **Ein PNG als Wortliste.** Das `accept`-Attribut ist kein Schutz, es ist
>     ein Filter im Dateidialog; per Drag-and-drop kommt alles durch. Gemessen:
>     drei Zeilen Müll. Neu ist `istTextdatei()` — Endung oder Text-MIME-Typ,
>     und im Zweifel der Inhalt (NUL-Byte, Anteil von Steuerzeichen).
>   - **Eine Datei, die nur aus der Kopfzeile besteht,** erzeugte eine
>     Phantomvokabel, weil `textblockEinlesen("")` eine offene Zeile
>     zurückgibt. Gespeichert wurde dann ein Set mit einem leeren Eintrag.
>     Jetzt: Abbruch, mit der Kopfzeile im Text, damit der Nutzer sie von
>     Hand nachragen kann.
>
> Der Import passiert **sofort**, ohne Zwischenstopp im Textfeld. Grund:
> die Zeilenliste ist die bessere Vorschau — jede Zeile einzeln editierbar,
> jede mit eigener Fehlermeldung. Bei 500 Zeilen wäre ein Textfeld voller
> Rohdaten nur ein zweiter Ort, an dem dieselben Daten liegen.
>
> 35 Tests im Datei-Parser, 76 insgesamt.
>
> **Der Knopf selbst**, nachgemessen an vier Breiten (390, 768, 1440, 1920):
>
> | Breite | Kasten | Knopf |
> |---|---|---|
> | 390px (Handy) | 324×136 | 293×44, volle Breite |
> | 768px (Tablet) | 626×82 | 140×44 |
> | 1440px | 606×82 | 140×44 |
> | 1920px | 606×82 | 140×44 |
>
> Kein Überlauf, kein Element ragt aus seinem Kasten, überall 44px Höhe.
>
> Zwei Entscheidungen, die nicht aus dem Katalog kommen:
>
>   - **`box-sizing: border-box` am Knopf.** Ohne das misst `min-height:
>     44px` den Inhalt, dazu kommen 16px Polsterung — gemessen **62px**. Der
>     Knopf war auf dem Handy fast halb so hoch wie nötig, und der ganze
>     Kasten 172px statt 136px.
>   - **Kein `translateY` beim Drücken.** Der Rahmen darum beult sich sichtbar
>     mit, und das liest sich wie ein Fehler. Der Knopf verändert nur die
>     Farbe.
>
> Die Tastatur sieht denselben Zustand wie die Maus: der Kasten reagiert auf
> `:focus-within`, nicht nur auf `:hover`. Die Tab-Reihenfolge im Schritt ist
> Dateifeld → Textfeld → „Wörter übernehmen" — das Dateifeld ist der erste
> Stopp, weil es im Markup vor dem Textfeld steht. Gemessen, nicht vermutet.
>
> Das versteckte `<input>` ist mit `clip: rect(0,0,0,0)` unsichtbar, aber
> **nicht** positioniert über der Fläche. Ein aufgelegtes, unsichtbares Feld
> fängt Klicks ab, die an den Text daneben gehen, und liefert bei Tests
> Treffer, die es im Bild nicht gibt. Der sichtbare Knopf ist ein `<label>`;
> der Klickpfad ist derselbe, und ohne JavaScript geht er auch.

> **4 — Set duplizieren, Karten bearbeiten und löschen.** Drei Routen:
> `POST /api/sets/<slug>/duplizieren`, `PATCH /api/karten/<id>` und
> `DELETE /api/karten/<id>`; dazu `lib/kopie-name.ts` für die Namensregel.
> 15 Tests für den Namen, 91 insgesamt.
>
> Verifiziert am 2026-10-02, live mit Playwright gegen die echte Datenbank,
> **59 Prüfungen, 0 Fehlschläge, 0 Browserfehler**. Auszug:
>
> | Fall | Ergebnis |
> |---|---|
> | Demo-Set kopieren | 100 Karten, Inhalt und Reihenfolge identisch |
> | Lernstand in der Kopie | 0 Zeilen, Stufe 0, nichts fällig |
> | Karte bearbeiten | Begriff, Übersetzung, Satz und Satzübersetzung gespeichert |
> | Leeres Beispielfeld | entfernt den Satz, lässt die Übersetzung stehen |
> | Karte löschen | 100 → 99, Zähler im Kopf stimmt mit |
> | Leeres Set kopieren | 201, Kopie ist leer |
> | Karte im Demo-Set | kein Bearbeiten, kein Löschen — nicht ausgegraut, gar nicht da |
> | ohne Anmeldung | 401 auf allen drei Routen |
>
> Drei Entscheidungen, die nicht aus dem Katalog kommen:
>
>   - **Demo-Sets lassen sich duplizieren, bearbeiten und löschen lassen sie
>     nicht.** Das ist der ganze Nutzen dieser Phase: wer „Englisch Grundlagen"
>     sieht und zwölf Wörter streichen will, hatte vorher nur den Weg, alle 100
>     Karten von Hand zu tippen. Der Dialog startet bei einem Demo-Set direkt
>     im Duplizieren-Schritt — nicht weil das kürzer ist, sondern weil
>     Bearbeiten und Löschen dort 403 geben und der Nutzer sonst an zwei Knöpfen
>     vorbeikommt, die nichts können. Der Knopf in der Übersicht erscheint
>     deshalb jetzt bei **allen** Sets, und `eigen` entscheidet, was er anbietet.
>   - **Kein Namensfeld beim Duplizieren.** Der Server vergibt den Namen nach
>     einer festen Regel, und die Zahl steigt bei jeder Kopie: „Italienisch",
>     „Italienisch (Kopie)", „Italienisch (Kopie 2)". Ein Namensfeld würde die
>     Regel aushebeln — wer „Mein Set" einträgt, bekäme „Mein Set (Kopie)" und
>     müsste selbst wie die Regel denken. Der Dialog zeigt die Vorschau, der
>     Server entscheidet. Die Regel steht in `lib/kopie-name.ts`, nicht in der
>     Route, weil der Wizard sie später ebenfalls braucht.
>   - **Löschen fragt in der Zeile nach, nicht in einem Dialog.** Bei einem
>     ganzen Set ist ein Dialog berechtigt, bei einem einzelnen Vokabelbegriff
>     ist er Kram: es gibt keine zweite Aktion, die man verwechseln könnte.
>     Der Begriff steht in der Frage, damit niemand auf „Ja" klickt, weil er
>     die Zeile daneben für die richtige hielt.
>
> Zwei Fehler, die erst die Messung zeigte — beide in der Reihenfolge der
> Karten, und beide wären dem Nutzer stillschweigend begegnet:
>
>   - **Die Reihenfolge einer Kopie war nicht die des Originals.** Beim ersten
>     Durchlauf stand in der Liste „der", in der Datenbank war es „sein" —
>     dieselbe Route, dieselbe Abfrage, zwei Antworten. Ursache: alle Karten
>     einer Bulk-Anweisung bekommen in Postgres denselben `now()`. Gemessen am
>     Demovorsatz: **100 Karten, ein einziger Zeitstempel**
>     (`2026-09-29T16:55:36.997968`). Bei gleichem Wert entscheidet Postgres
>     nach der physischen Zeilenlage, und die ist nicht garantiert. Behoben an
>     zwei Stellen: die Lese-Routen sortieren jetzt nach `created_at` **und**
>     `id`, und die Kopie verteilt die Zeitstempel selbst (Basis + 1 ms je
>     Karte, Index über alle Blöcke hinweg). Verifiziert: sechs Abrufe
>     hintereinander liefern dieselbe Reihenfolge, und sie ist exakt die des
>     Originals.
>   - **Nach dem Bearbeiten sah der Nutzer eine andere Karte als die, die er
>     bearbeitet hatte** — dieselbe Ursache, andere Seite. Das war kein Fehler
>     der Oberfläche, sondern die Bestätigung des ersten: Die Liste zeigte, was
>     gespeichert war, aber die Reihenfolge war nicht die, mit der man
>     gearbeitet hatte.
>
> Was **nicht** gebaut wurde: Undo. Postgres kennt über HTTP keine
> Transaktionen, ein gelöschter Begriff ist weg. Für das Löschen eines kompletten
> Sets gilt dasselbe seit dem Set-Löschen.

**Abnahme (Phase 2):** Wortschatz-Sicht abgenommen — Liste, Suche, Set-Links
und der Wechsel zwischen Wortsicht und Set-Übersicht in beide Richtungen
(Commit `ea94203`). Der Leerzustand arbeitet wieder (2.1), das Starter-Set
steht live (2.2), der Textblock-Import ist geprüft (2.3). Alle vier Varianten
aus 2.5 sind umgesetzt und live geprüft. **Phase 2 abgeschlossen am
2026-09-30.**

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

> **Erledigt.** Commit `7b0c1e4`. Jeder Aufstieg kostet 10 % mehr als der
> letzte, Basis 1000, auf volle Zehn gerundet: Stufe 2 braucht 1100, Stufe 3
> 1210, Stufe 12 2850. Flach 1500 hätte 187 perfekte Antworten je Stufe
> verlangt, egal ob seit einer Woche oder seit einem Jahr. Die Kerben sitzen
> bei 50 % und 80 %; 100 % ist der Balken selbst. Der Deckel liegt bei 120.
>
> Nachgetragen am 2026-10-02: 19 Tests in `tests/profil.test.ts`, weil diese
> Formel als einzige Logik im Projekt ohne Regressionstest dastand — und
> `levelAusXp` sowie `levelInfo` je eine eigene Schleife über dieselbe
> Tabelle haben. Ein Test fand sofort einen echten Fehler:
> `Math.max(1, Math.floor(NaN))` ist `NaN`, nicht 1. Die Wache vor 0 und
> negativen Stufennummern ließ NaN durch, und ein NaN wanderte in den
> Fortschrittsbalken.

**3.3 Tagesziel ehrlich.** 20 XP ist im RPC fest verdrahtet (`003:637`).
Entweder konfigurierbar oder aus der realen Rundenzahl abgeleitet.

> **Erledigt.** Commit `a2522bf`, Migration 013. 100 XP, also eine Lernrunde
> pro Tag (5 XP je Karte × 20 Karten). Die 20 waren absurd wenig: eine
> halbe Runde mit „gut" gefüllt den ganzen Balken. Das Ziel steht als
> `TAGESZIEL_XP` in `lib/profil.ts` und wird von Route, Statistik und
> RPC-Bindung geteilt — vorher stand dieselbe Zahl an drei Stellen, was der
> eigentliche Fehler war.

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
> **Teil 3 (Tests) erledigt.** `npm test` (23 Tests, alle grün).
>
> - `tests/lernlogik.test.ts` – 18 Tests für die Stufen-, Intervall-, XP- und
>   Bewertungslogik. Die erwarteten Stufenübergänge stehen als Tabelle **fest im
>   Test**, nicht aus dem Code abgeleitet – ein Test, der die Erwartung aus der
>   Quelle zieht, die er prüft, prüft nichts.
> - `tests/sql-paritaet.test.ts` – 5 Tests gegen den **Quelltext** der
>   Migrationen, nicht gegen die laufende DB: Bewertungsliste TS ↔ SQL,
>   Zähler-Zuordnung je Bewertung, `nochmal` als einziger Fehlerzähler,
>   Leech-Schwelle `LEECH_FEHLER` ↔ `fehler < 8` in der View, und dass die Route
>   mit `stufeNachAntwort`/`xpFuerBewertung` rechnet statt mit eigenen Zahlen.
>   Gelesen wird immer die **letzte** Definition (höchste Migrationsnummer) —
>   sonst würde eine veraltete Fassung geprüft.
> - Gegengeprüft, dass die Tests beißen: `LEECH_FEHLER` 8→9 und eine neue
>   Bewertung nur in `BEWERTUNGEN` lassen beide Tests rot werden.
> - `tsx` als devDependency, weil diese Node-Version ohne TypeScript-Support
>   gebaut ist (`ERR_NO_TYPESCRIPT`); `tsconfig.json` braucht dafür
>   `allowImportingTsExtensions`.
> - **Nebenbefund:** `antwort_verbuchen` ist für `anon` ausführbar (014 ohne
>   `revoke`/`grant`). Kein Datenleck – `security_definer = false` und der
>   Aufruf bricht mit 42501 ab – aber eine Abweichung von der beabsichtigten
>   Härtung. Steht als Punkt 10 in `OFFENE-PUNKTE.md`.
>
> **Teil 4 (`003b`-UUID) erledigt, mit Befund.**
>
> `eigene` steht auf dem einzigen echten Konto (`a47d7318-…`, theo.diesch@gmail.com);
> die übrigen `auth.users`-Zeilen sind Wegwerf-Konten aus Tests. Die Datei bricht
> damit nicht mehr mit „Kein Konto mit dieser UUID" ab.
>
> **Befund: es gibt nichts zu übernehmen.** `public.karten` hat die Legacy-Spalten
> (`stufe`, `gelernt`, `treffer`, `fehler`, `faellig_am`) weiterhin als Spalte, aber
> alle 100 Demokarten stehen auf Stufe 0 ohne Treffer und ohne Fehler. Der alte
> Stand wurde nie gepflegt oder ist beim Import verlorengegangen. 003b würde 100
> Zeilen mit Stufe 0 schreiben — genau das, was vorher schon da war.
>
> Geprüft, nicht behauptet: mit eingetragener UUID läuft die Datei in `BEGIN/ROLLBACK`
> durch, mit dem alten Platzhalter bricht sie mit der erwarteten Meldung ab.
> Zeilenzahl in der Datenbank danach unverändert (6 gesamt, 5 davon deine).
>
> **Teil 4 ist damit inhaltlich erledigt.** `003b` steht weiterhin nicht in der
> `STAND`-Liste von `scripts/db-migrieren.mjs` und läuft nie von selbst — richtig so
> für eine Einmal-Aktion.
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
> **Teil 2 (Landing-Page) ist erledigt (2026-10-03).** `/` ist jetzt die
> öffentliche Seite: Titel, Beschreibung, OG-Tags, `robots: index, follow`, und
> `sitemap.ts` führt genau diese eine Route. Die App-Übersicht ist von `/` nach
> **`/uebersicht`** umgezogen; wer angemeldet auf `/` landet, wird umgeleitet,
> damit alte Lesezeichen, geteilte Links und der Nach-dem-Login-Sprung
> (`weiter` bleibt `/`) unverändert funktionieren.
>
> **Warum die Übersicht überhaupt wandern musste.** Die Seite konnte nicht
> einfach zusätzlich liegen bleiben: der gesamte `(app)`-Bereich trägt zentral
> `robots: { index: false }`. Eine Landing-Page *innerhalb* dieser Gruppe wäre
> eine Seite, die Google nicht aufnimmt — der Auftritt hätte sich erledigt und
> es hätte ausgesehen, als wäre nichts passiert.
>
> **Der Umgang mit dem Ausfall-Fall.** `holeUser` unterscheidet drei Fälle, und
> der dritte entscheidet: ist Supabase gerade nicht erreichbar, ist die Sitzung
> *unklar*, nicht *weg*. Die Startseite leitet in diesem Fall **nicht** um. Ein
> Ausfall von fünf Sekunden darf niemanden aus der App in ein Anmeldeformular
> werfen — dieselbe Sorge, aus der `lib/supabase/user.ts` entstanden ist.
>
> **Was auf der Seite steht und was nicht.** Drei echte Karten aus dem
> Starter-Set, die Wiederholungsabstände als Zahl aus `lib/lernlogik.ts` statt
> als abgetippte Werbung, die Import-Formate, die es wirklich gibt (`.txt`,
> `.csv`, `.tsv` — **kein** PDF), und eine Datumsangabe ohne Anmeldung. Keine
> Nutzerzahl, keine Bewertung, kein Testimonials: nichts davon existiert.
>
> **Geprüft.** Anonym `/` → Startseite mit drei Beispielkarten, kein
> waagerechter Bildlauf bei 360 px, keine Konsolenfehler. Angemeldet `/` →
> `/uebersicht`. Anonym `/uebersicht` → `/anmelden`. Responsive-Audit: **72
> Durchläufe**, die Startseite in allen sechs Viewports ohne Befund.

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

#### Zwischenstand (gerenderter Audit, noch nicht abgenommen)

`scripts/responsive-audit.mjs` misst die gerenderte Seite mit Playwright über
echtes Chromium: 12 Seiten × 6 Viewports (360/414/768 px, jeweils hoch und
quer) = 72 Durchläufe, mit dem Wegwerfkonto aus `scripts/audit-konto.mjs`.

Der erste Durchlauf hat einen Fehler mit Breitenwirkung gefunden, der im
Quelltext nicht auffällt:

`body` trug `font-size: clamp(1rem, 0.9rem + 0.4vw, 1.25rem)`. Der untere Rand
der Klammer ist aber nie 16 px: bei 360 px Breite ist `0.9rem + 0.4vw` kleiner
als `1rem`, und `1rem` löst die Klammer gegen die eigene Schriftgröße auf. Die
Grundgröße lag damit bei rund **14,4 px** — und weil im Projekt nahezu jede
Angabe in `rem` steht, schrumpfte alles mit. Die untere Navigationsleiste kam
so bei **9,3 px** heraus. Dazu kam `@media (max-width: 370px)`, das die
Beschriftung auf `0.58rem` heruntersetzte — genau im Bereich, den diese
Abnahme prüft.

Erledigt: Grundgröße auf feste 16 px, Tab-Leiste auf 0,875rem, und 30 Stellen
im gemessenen Befund auf 0,875rem gehoben. Ergebnis: 72 → 46 Durchläufe mit
Befund, Textbefunde 72 → 22, zu kleine Bedienflächen 36 → 34. Waagerechter
Bildlauf, verdeckter Inhalt und Bewegung trotz `prefers-reduced-motion` waren
in keinem Durchlauf ein Befund.

**Noch offen, bewusst nicht behauptet:**

- 22 Durchläufe mit Text zwischen 11,3 und 13,6 px (siehe Liste unten)
- 34 Durchläufe mit Bedienflächen unter 44 × 44 px — davon sind viele
  *verdeckte Checkboxen* (`input` mit 1 × 1 px), deren sichtbare Fläche das
  Label ist. Das ist ein Messbefund, kein bestätigter Mangel, und braucht den
  Blick aufs Handy.
- Hoch-/Querformat ist bisher nur über die Höhe geprobt, nicht gedreht
  (360 × 420 ist kein Querformat).
- Screenshots und der Blick auf die gerenderte Oberfläche fehlen noch.

#### Nachtrag vom 2026-10-02 — gegen den Produktions-Build, Ergebnis null

Der erste Durchlauf stand gegen `npm run dev`. Das Skript sagt ausdrücklich,
für den Produktionsstand `npm run start` zu verwenden — die Vorgabe war nicht
befolgt, und der Unterschied ist nicht kosmetisch: **im Entwicklungsbetrieb
zeigt `/anmelden` einen Setup-Hinweis, den es in Produktion nicht gibt.** Die
gemeldeten Textbefunde mit 13,6 px waren dessen Eintragstitel, nicht die
Checkbox-Beschriftung der App. Ein Audit gegen die falsche Oberfläche
misst die falsche Seite.

Gegen `npm run build && npm run start`: **66 Durchläufe, 0 Befunde.**
Kein waagerechter Bildlauf, kein verdeckter Inhalt, keine Bewegung trotz
`prefers-reduced-motion`, kein Text unter 14 px, kein Bedienelement unter
44 × 44 px. (66 statt 72, weil ein Wizard-Schritt aus der Liste fliegt, siehe
unten.)

**Was die 13 eindeutigen Fundstellen waren — und was sie waren:**

| Seite | Fundstelle | vorher | Ursache |
|---|---|---|---|
| Einstellungen | Speichern, Abmelden | 13,3 px | Chrome-UA für `button` |
| Statistiken | Sprachzeile | 13,3 px | dieselbe Ursache |
| Anmelden | Reiter Anmelden / Konto erstellen | 149 × 37 | keine `min-height` |
| Anmelden | Passwort vergessen? | 157 × 27 | dito |
| Anmelden | Checkbox-Beschriftung | 13,6 px | `0.85rem` |
| Anmelden | `<small>` darunter | 11,3 px | `<small>` erbt 0.8em |
| Karteikarten | Set-Name (Link) | 336 × 19 | keine Höhe, reiner Textlink |
| Karteikarten | „Vokabeln ansehen" | 336 × 17 | dito, dazu 13 px Schrift |
| Karteikarten | Suchfeld | 663 × 21 | siehe Kasten unten |
| Wortschatz | Suchfeld | 277 × 21 | dito |
| Wortschatz | Set-Name (Link) | 265 × 17 | keine Höhe |
| Profil | Einstellungen, Passwort ändern | 147 × 38 | `padding` statt `min-height` |
| Karteikarten-404 | „404 Error" | 12,8 px | `0.8rem` |

Der interessanteste Fund war nicht in der Liste, sondern ihre Ursache.

**Die Knöpfe standen in Arial.** Bei `button`, `select` und `textarea` stand
nirgends eine `font-family`, also griff der Browser-Standard: Chrome setzt
**Arial 13,3333px**. Zwei der sieben Textbefunde waren genau das, und dieselbe
Ursache hätte die dritte Seite mitgezogen, die der Audit nicht listet. Im
Bild faellt Arial nicht auf — es ist eine gewoehnliche Schrift —, aber zwei
nebeneinander stehende Knöpfe aus verschiedenen Schriften sind sofort
erkennbar. Jetzt erben die drei Elemente die Familie global (`global.css`),
die Größe bleibt lokal: `font: inherit` hätte auch jedes Element ohne eigene
`font-size` auf 16 px gehoben, und die Abnahme verlangt nur „nicht kleiner als
14 px".

**Zwei Suchfelder, die 46 px aussahen und 21 px waren.** Beide Felder
(`/karteikarten`, `/wortschatz`) liegen in einem Kasten mit
`min-height: 46px` — aber die `min-height` sass am Kasten, nicht am
`<input>`. Getroffen werden muss genau das Eingabefeld: ein Tipp auf den
freien Kasten daneben tat nichts, das Feld selbst war 21 px hoch. Das ist
der eine Befund, bei dem die Oberfläche aktiv in die Irre führt.

**Zwei Korrekturen am Messgerät, nicht an der App.** Sie sind getrennt
erwähnt, weil ein Befund, der immer dasselbe sagt, ignoriert wird und dann
den ganzen Audit entwerten würde:

- **Checkboxen.** `input[type=checkbox]` misst 1 × 1 px (versteckt, mit
  `clip`) oder 20 × 20 px (sichtbar), und damit immer zu klein. Die reale
  Zielfläche ist das umschließende `<label>` — bei `/anmelden` 44 px hoch,
  bei `/einstellungen` der Umschalter daneben. Das Skript misst jetzt das
  Label und meldet nur, wenn *das* zu klein ist. Eine Checkbox ohne großes
  Label zählt weiterhin, das wäre einer.
- **Ein Wizard-Schritt fliegt aus der Liste.**
  `/karteikarten-hinzufuegen/sprache-auswählen` liefert 404, weil dort nur
  eine CSS-Datei liegt. Ein `grep` über alle Komponenten bestätigt: **kein
  Element verweist auf diesen Pfad**, er ist also für niemanden erreichbar.
  Solange die `page.tsx` nicht existiert, misst ein Durchlauf dort nur die
  404-Seite unter falschem Namen.

**Was damit gemessen ist — und was nicht.** Gemessen sind die fünf Regeln,
die das Skript prüft: Textgröße, Zielfläche, untere Leiste, waagerechter
Bildlauf, reduzierte Bewegung. **Nicht** gemessen und weiterhin offen ist die
optische Beurteilung: ob die vier Bewertungsknöpfe auf 360 px lesbar *und*
die 3D-Karte beim Drehen keinen Text überdeckt, sieht man nur mit eigenen
Augen. Die „quer"-Viewports sind 360 × 420 px — kurzes Hochformat, **kein**
echtes Querformat (ein Telefon im Querformat ist etwa 740 × 360). Screenshots
aller acht Seiten bei 360 px liegen in `/tmp/phase5/`; sie sind nicht
committet. Diese Phase ist damit **gemessen abgeschlossen, optisch nicht
abgenommen** — und ein Plan, der beides gleichsetzt, ist der Fehler, den er
sich selbst vorwirft.

#### Nachtrag vom 2026-10-03 — die Abnahme oben ist nicht reproduzierbar

Der Nachtrag von gestern meldet für den Produktionsstand **66 Durchläufe,
0 Befunde**. Heute am selben Commit `7604782` gemessen: **66 Durchläufe,
18 mit Befund.** Bevor die Zahl als Fehler im Audit abgetan wird, wurde der
alte Stand gebaut und gemessen — in einem zweiten Arbeitsverzeichnis, nicht
durch Raten:

| Stand | Durchläufe | mit Befund | Fehler |
|---|---:|---:|---:|
| `7604782`, vor den Kartenzeichen-Commits | 66 | 18 | 0 |
| `7c3358c` plus Hydration-Fix | 66 | 18 | 0 |

Die Fundstellen sind in beiden Läufen **identisch**:

| Fundstelle | gemessener Wert | Läufe | wann |
|---|---|---:|---|
| `…kachelLoeschen` („Löschen") | 11,52 px Schrift, 88 × 34 px | 24 | nur mit eigenem Set |
| `statistiken…spracheKopf` (Sprachzeile) | 18 px hoch, 305–691 px breit | 6 | immer |
| `statistiken…tagXp` (XP-Anzeige) | 9,6 px | 6 | nur mit XP |

**Und hier ist der wahrscheinlichere Grund für die alte 0.** Zwei der drei
Fundstellen sind **datenabhängig**: `kachelLoeschen` erscheint nur, wenn das
Konto ein eigenes Set hat, `tagXp` nur, wenn XP da ist. Gemessen wurde
beide Male mit einem frischen Audit-Konto — aber eines ohne eigenes Set, weil
das Zeichen-Audit nicht vorher gelaufen war. Ein neuer Nutzer sieht diese
Stellen also nicht. **Genau die Nutzer, die bleiben, sehen sie**: wer ein
eigenes Set angelegt hat, arbeitet auf genau diesen Bildschirmen.

Damit ist die alte Abnahme nicht falsch, aber sie hat den **falschen Zustand
gemessen**: den ersten Aufruf, nicht den wiederkehrenden. Ein Audit über einen
frischen Account prüft den Bestandsnutzer nicht.

Zwei Schlüsse, und sie sind verschieden:

1. **Die Kartenzeichen-Commits haben nichts verursacht.** Sie fassen
   `lernen-seite.tsx`, `einstellungen/page.tsx` und die Zeichenmodule an.
   `kachelLoeschen` und `spracheKopf` liegen auf Übersicht und Statistiken —
   Seiten, die in keinem dieser Commits vorkommen. Das ist gemessen.
2. **Phase 5 ist nicht sauber abgenommen.** Drei Fundstellen stehen gegen das
   eigene Abnahmekriterium „kein Text unter 14 px, kein Bedienelement unter
   44 × 44 px". Warum sie am 2026-10-02 nicht auftauchten, ist offen; beide
   Messungen liefen mit frischen Audit-Konten. Bis dahin gilt die Phase als
   **gemessen, nicht bestanden**.

#### Nachtrag vom 2026-10-03 — Hydration-Fehler auf `/einstellungen` behoben

`scripts/zeichen-audit.mjs` meldete bei jedem Lauf einen React-Fehler #418 auf
`/einstellungen` und schob ihn mit dem Zusatz „vorbestehend" beiseite. Das war
kein unvermeidbarer Rest, sondern derselbe Fehler, den dieselbe Datei sich
beim Kartenzeichen schon selbst erklärt hatte.

**Ursache.** `pushUnterstuetzt` stand in einem `useState`-Initializer mit
`typeof window`-Prüfung. Auf dem Server ist das immer `false`, der Server
schrieb also „Dieser Browser unterstützt keine Push-Benachrichtigungen",
während der Client „Erhalte eine tägliche Lernerinnerung" schrieb. Genau die
Reihe, die React in der Hydration-Meldung nennt.

**Fix.** Der Wert ist jetzt `boolean | null`; `null` heißt „noch unbekannt".
Server und erster Client-Render zeigen denselben Text, und die Fähigkeit wird
im selben Effekt festgestellt wie das Push-Abo. Bewusst **nicht** synchron im
Effekt: `eslint` meldet ein `setState` direkt im Effekt als zusätzliche
Renderstufe, und das Ergebnis tritt ohnehin asynchron ein.

**Verifiziert.** Audit gegen `npm run build && npm run start`: **0 Fehler,
0 Hinweise** — der Hinweis ist weg. `/einstellungen` fünfmal hintereinander
geladen: **5/5 ohne Konsolenfehler**, Schalter und Text korrekt.

#### Zwei Punkte aus der Abnahme, vom Nutzer gemeldet

Beide Punkte sind erledigt. Sie standen hier zuerst nur als Meldung, weil sie
beim Messen der responsiven Seiten auffielen und funktional sind.

1. **„Alles gelernt" ohne Weg zurück** — *erledigt*.
   Klickt man ein leeres Set an, kam der Endbildschirm „Alles gelernt" mit
   Kaffeetasse und ohne jede Handlungsmöglichkeit: der „Nochmal lernen"-Knopf
   hängt an `kartenGesamt > 0`, und ein leeres Set hat null Karten. Am echten
   Konto reproduziert an `karteikarten_sets.slug = 'englisch-satze-ki-testen'`,
   0 Karten.

   Die Ursache war nicht der fehlende Knopf, sondern eine Lüge in der
   Zwischenebene: `app/api/lernen/route.ts:363` kommentierte, der Client
   unterscheide „nichts fällig" von „noch nichts angelegt" — im Client gab es
   diese Unterscheidung nicht. Beide Fälle liefern `karten: []` und sahen
   deshalb gleich aus.

   `lernen-seite.tsx` trennt sie jetzt. Leeres Set: „Noch keine Vokabeln",
   Text, was fehlt, und ein Weg zu „Vokabeln hinzufügen". Der Verweis geht
   bewusst nach `/karteikarten` und **nicht** mitten in den Hinzufügen-Wizard:
   Schritt 2 dort fragt die Sprache ab, obwohl das Set sie schon hat, und die
   Seite ist derzeit ohnehin Gegenstand eines parallelen Arbeitsstands.

   Nebenbei gefunden und richtiggestellt: die 404-Meldung der Lernroute lautete
   „Sprache nicht gefunden", obwohl an dieser Stelle das **Set** gesucht wird.
   Bei fremden Konten (RLS) ist genau das der Normalfall, und die Meldung
   behauptete dann etwas Falsches.

2. **Keine Übersicht aller Vokabeln eines Sets** — *erledigt*.
   Neu: `/wortschatz/[set]`. Zeigt Begriff, Übersetzung, Beispielsatz samt
   Übersetzung, den Lernstand je Vokabel und Filter „Alle / Offen / Gelernt".
   Erreichbar von der Set-Übersicht („Vokabeln ansehen") und vom Endbildschirm
   des Lernens.

   Dazu `GET /api/karten?setSlug=`. Bewusst getrennt von der Lernroute: die
   Lernroute liefert den Stapel **von heute** (20 oder 40), nicht den Bestand —
   bei 100 Karten sieht man 20 davon und hält das für den ganze Set.

   Geprüft am Demoset: 100 Vokabeln, Zähler „100 Vokabeln · 1 gelernt", Filter
   „Offen 99 / Gelernt 1", Haken an der gelernten Vokabel, kein waagerechter
   Bildlauf bei 360 px und bei gedreht 780 px.

   Eine Vermutung aus der Recherche hat sich dabei als **falsch** erwiesen und
   ist nicht in den Code gewandert: der Filter `.eq("fortschritt.user_id", …)`
   auf der eingebetteten Ressource löscht keine Karten ohne Fortschrittszeile.
   Das Auditkonto hatte dort null Zeilen und bekam trotzdem alle 100 Karten
   zurück. Grund ist der To-One-Hinweis im Embed — die Bedingung wandert ins
   ON eines Left Joins. Ohne den Hinweis wäre es ein Inner Join, und dann wäre
   die gemeldete „Alles gelernt"-Sackgasse bei *jedem* frischen Konto sofort
   aufgetreten. Der Kommentar an der Abfrage steht jetzt an der Stelle, an der
   er jemanden vom Nachbauen dieser Fehlannahme abhält.

---

## Reihenfolge und Abhängigkeiten

```
Phase 0  (Sprach-Code, Kartenspalten)
   ├──> Phase 1  (TTS braucht 0.1, Beispielsatz braucht 0.2)
   └──> Phase 2  (Wortlisten müssen sauber einsortiert werden)
Phase 1  ──> Phase 2   (Lerneffekt zuerst, wie entschieden)
Phase 2  ──> Phase 3   (Content, bevor Reichweite)
Phase 3  ──> Phase 4
Phase 4  ──> Phase 5
Phase 5  ──> Phase 6   (Kartenzeichen auf dem Handy prüfen)
Phase 6  ──> Phase 7   (Zeichenberechnung wandert in die App)
```

**Phase 6 ist erledigt (2026-10-02)** und zwar entgegen der ursprünglichen
Abhängigkeit: Die Zeichen entstehen aus der Karten-ID statt aus einer
Zuordnungstabelle, also brauchen sie keine Wortlisten und keinen echten
Inhalt. Damit ist genau die Bedingung entfallen, an der die Phase in der
ursprünglichen Planung hing.

Phase 0 ist trotz „klingt nach nichts" die teuerste Code-Änderung: 12
Dateien, 134 Treffer, plus Migration. Sie ist trotzdem Voraussetzung für
alles Weitere.

Phase 7 ist ausdrücklich nachrangig. Sie steht hier, damit sie nicht verloren
geht — nicht damit sie jetzt gemacht wird. Siehe
[Nachtrag](#nachtrag-vom-2026-09-27--react-native-app-und-karten-icons).
Phase 6 ist dagegen umgesetzt; siehe die Phase selbst für den Nutzerentscheid,
der die semantische Zuordnungstabelle ersetzt hat.

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

### Phase 6 — Kartenzeichen (umgesetzt)

**Der Wunsch, unverändert.** Jede Karte bekommt ein kleines, eigenes Zeichen,
das man beim Wort wiedererkennt.

**Der Nutzerentscheid, der die Umsetzung geändert hat.** Nach dem ersten
Stand — unten links, 26 px, Deckkraft 0,3 bis 0,58 — kam zurück: *rechts
unten, auf beiden Seiten der Karte, etwas auffälliger und etwas größer*.
Umsetzung: unten rechts, 32 px, Deckkraft 0,6 bis 1,0, und es steht jetzt
**außerhalb** der Vorder-/Rückseiten-Verzweigung, damit beide Seiten es
bekommen.

Damit fällt die ursprüngliche Planung dieser Phase ersetzt: eine
*semantische* Zuordnung Wort → Icon aus einem lizenzfreien Satz (Lucide,
Phosphor) mit 2.000 bewussten Entscheidungen. Der Nutzer wollte keine
Bedeutung im Zeichen, sondern ein unterscheidbares. Und die Datenlage sagt
dasselbe: von den NGSL-Wörtern des Demovets hat **1 von 100** ein direkt
passendes Icon. Eine Tabelle, die für 99 von 100 Wörtern etwas Falsches oder
Abstraktes einträgt, ist schlechter als keine — sie sitzt als Lärm im Bild.

**Korrektur vom 2026-10-03.** Diese Entscheidung galt dem ersten Stand und
hält nicht. Zurück kam der Wunsch nach einem Zeichen, das man beim Wort
*wiedererkennt*: „haus ist ein Haus". Die Begründung oben bleibt trotzdem
richtig, sie gilt nur nicht mehr für jedes Wort. Genau darin liegt der
Zwischenstand unten: semantisch, aber nur wo es eindeutig ist.

**Der Weg, der gebaut wurde.** Kein Icon-Satz, keine Zuordnungstabelle, keine
Migration. Die Zeichen entstehen **aus der Karten-ID**:

- `lib/kartenzeichen.ts` — FNV-1a über die UUID, daraus mit `mulberry32`
  Form, Eckenzahl, Drehung, Radius, Ringzahl, Innenmotiv, Spiegelung,
  Strichstärke und Deckkraft. Rund 2.903.040 Kombinationen. Reine Funktion,
  kein Zustand, kein Bild, keine Datei.
- `components/kartenzeichen.tsx` — setzt die Pfade als Inline-SVG in ein
  festes 24er-`viewBox`, `aria-hidden`, `pointer-events: none`.
- `lib/kartenzeichen-ein.ts` — die Sichtbarkeit als Geräteeinstellung im
  `localStorage`, gelesen über `useSyncExternalStore`.

**Der Nachtrag: semantisch, aber nur wo es eindeutig ist.**

Der erste Versuch stand unter dem Vorbehalt „Emoji". Der Nutzer hat das
abgelehnt: **SVG, keine Emoji.** Die Zuordnungstabelle ist deshalb auf einen
echten Icon-Satz umgestellt.

- `lib/kartenzeichen-semantik.ts` — kuratierte Wort → Icon-Tabelle für
  Deutsch und Englisch, mit Normalisierung (`ä` → `ae`, `ß` → `ss`) und
  einer Sperre für die Homographen `see` und `gift`. 559 Zuordnungen auf 202
  verschiedene Icons.
- `lucide-static` 1.51.0 als npm-Paket — 2.130 Icons, Lizenz ISC. Die Wahl
  fiel gegen FontAwesome Free (lokal vorhanden, aber CC BY 4.0 mit
  Namensnennung und geringerer Abdeckung) und gegen eine KI-API (Konto,
  Kosten, Übermittlung aller Lernwörter an einen Dritten).
- `scripts/icons-einlesen.mjs` — liest die benötigten SVGs aus
  `node_modules/lucide-static` und schreibt sie als Markup nach
  `lib/kartenzeichen-svg.generated.ts`. Diese Datei ist eingecheckt: ein
  Build darf sie nicht erst erzeugen müssen. Neu erzeugen mit
  `node --import tsx scripts/icons-einlesen.mjs --schreiben`.
- `components/kartenzeichen.tsx` — bei einem Treffer das Lucide-SVG in
  `currentColor`, 2px-Strich im selben 24er-`viewBox`. Die Deckkraft kommt
  weiter aus derselben UUID wie die Geometrie, damit nicht jede Karte
  denselben Abdruck hat. Steht ein Wort in der Tabelle, fehlt aber sein
  Icon, gewinnt die erzeugte Form — die Karte darf nicht verloren gehen.
- `data-zeichen` und `data-icon` stehen im DOM, damit `scripts/zeichen-audit.mjs`
  Icon und Form unterscheiden kann. Beide sind ein `svg`; am Tag sind sie
  nicht zu unterscheiden.
- Die Grundregel von oben gilt unverändert: nur eindeutige Zuordnungen.
  Farben und schwache Näherungen sind draußen, auch wenn die Tabelle dadurch
  kleiner wird.

**Ehrlich zur Reichweite.** Gemessen mit `scripts/zeichen-reichweite.mjs`:

| Wortliste | Karten | mit Bild |
|---|---:|---:|
| NGSL top 100, das Demovet, viele Funktionswörter | 100 | **17 (17 %)** |
| Sachwörter, stellvertretende Auswahl | 187 | **177 (95 %)** |

Die zehn fehlenden Wörter dieser Liste haben kein ehrliches Piktogramm. Sie
bekommen die erzeugte Form, und zwar ohne Beanstandung: `schuh` und `tuer`
lassen sich als Strichbild nicht von ihrem Wort unterscheiden, und ein Icon
dafür wäre eine Lüge in Linienform.

Die 17 Prozent sind weder ein Misserfolg noch eine Täuschung. Die übrigen
83 Prozent sind Funktionswörter und Abstrakta wie *der*, *werden*,
*verstehen*, *nicht*. Dafür gibt es kein ehrliches Bild, und dafür steht
weiter das erzeugte Zeichen. Ein Wort, das kein Bild verdient, sieht hier
aus wie das, was es ist: ein Lernwort.

**Warum die UUID und nicht ein Datenbankfeld.** Eine neue Spalte plus Backfill
für jede Karte wäre der übliche Weg — und er wäre hier falsch. Der Nutzer
sollte nie ein Zeichen sehen, das fehlt, weil die Zeile nicht zurückgespielt
wurde. Aus der UUID ist das Zeichen mit dem Moment vorhanden, in dem die Karte
existiert: für Bestandskarten, für neue Karten, für Karten aus einem
Textblock-Import und für eigene Karten. Es gibt keinen Importpfad, der etwas
nachziehen müsste, und keine Zeile, die verloren gehen kann.

**Ehrlich zur Eindeutigkeit.** Die Parameter sind quantisiert, es gibt also
endlich viele mögliche Zeichen, und bei endlich vielen Kombinationen sind
Zusammenfälle nicht ausgeschlossen. Gemessen, nicht geschätzt:

| Karten | verschiedene Zeichen | Zusammenfälle |
|---:|---:|---:|
| 100 | 100 | 0 |
| 2.000 | 2.000 | **0** |
| 5.000 | 4.992 | 8 (0,16 %) |

Diese Zahlen stehen als feste Erwartung in `tests/kartenzeichen.test.ts`,
damit ein Umbau, der die Verteilung verschlechtert, im Test auffällt.

**Farbe.** Bewusst keine eigene Farbauswahl. Die Kartenfläche ist in beiden
Designs dieselbe mittelhelle Sprachfarbe; jede Farbvariation müsste gegen
zwoelf Hintergründe einzeln beweisen, dass sie lesbar bleibt. Das Zeichen
erbt `currentColor` und setzt nur Deckkraft und Strichstärke. Die Unterschiede
trägt die Geometrie — 3 bis 9 Ecken, 60 Drehungen, 12 Innenmotive.

**Zwei Fehler, die erst das Messen gefunden hat.** Beide standen in einem
`useState(() => liesZeichen())`, demselben Muster wie `lib/ton.ts`:

1. `localStorage` im Zustands-Initializer zu lesen ergibt einen
   Hydration-Fehler (#418). Der Server hat kein `window`, rendert den
   Vorgabe-Stand, der erste Client-Render den gespeicherten. Behoben über
   `useSyncExternalStore` mit ausdrücklichem Server-Snapshot.
2. Der erste Test meldete 1.120 „Kollisionen" unter 5.000 Karten. Ursache war
   der **Test-Generator**: er lieferte nur 3.887 verschiedene UUIDs für 5.000
   Nummern. Ein Test, der einen echten Fehler versteckt, ist schlimmer als
   kein Test — deshalb prüft `tests/kartenzeichen.test.ts` jetzt zuerst, ob
   seine eigenen Eingaben überhaupt verschieden sind.

**Bekannt und nicht Teil dieser Phase.** Auf `/einstellungen` wirft React
einen Hydration-Fehler #418, und zwar an der **unveränderten** Seite
(gegengemessen mit `git checkout` auf den Basisstand: dort kommt er genauso).
Ursache ist `pushUnterstuetzt` in Zeile 84, das im Zustands-Initializer
`typeof window` prüft — dieselbe Fehlerklasse, andere Stelle. Gehört in die
Foundation, nicht hierher.

**Abnahme, gemessen mit `scripts/zeichen-audit.mjs`** (Produktions-Build, Wegwerf-Konto):

- 0 Fehler, 34 Messungen.
- Zeichen 32 × 32 px und quadratisch auf 320, 360, 414 px hoch, 740 px quer
  und 1280 px — **auf beiden Seiten** der Karte, je 10 Prüfungen.
- Einzug rechts 13,6 px und unten 13,6 px: unten rechts, wie bestellt.
- Kein Überdecken von `.karteTipp` und keines von `.karteZeichen`.
- Klick auf das Zeichen deckt die Karte auf (`look` → `scheinen`): es fängt
  keinen Klick ab.
- 6 Karten durchlaufen, 6 verschiedene Zeichenformen.
- Schalter schreibt `{"v":1,"an":false}`, das Zeichen verschwindet aus dem
  DOM, übersteht das Neuladen und kommt beim Wiedereinschalten zurück.
- Eigenes Set über `POST /api/sets`, fünf eigene Karten über `POST /api/karten`.
- Der Stapel vollständig durchlaufen: `haus`/`house` → 🏠, `katze`/`cat` → 🐱,
  `apfel`/`apple` → 🍎, und die beiden erfundenen Probewoörter fallen auf die
  erzeugte Form zurück.
- Jedes Bild sitzt in derselben 32 × 32 px-Box wie die Form, Schrift 28 bis
  32 px.

**Vier Messfehler, die erst das Audit gefunden hat.** Sie standen alle im
Messskript, nicht im Produkt, und jeder davon hätte einen Fehlbefund
gemeldet, der genau das Gegenteil der Wahrheit war:

1. Der Selektor `.karteMarke` findet nichts. Next.js schreibt die
   CSS-Modulklasse im Produktionsbau als `lernen-module__LnHAJq__karteMarke`.
2. Die Prüfung suchte nur das `svg` und meldete für jede Karte mit einem Bild
   „kein Zeichen".
3. Umgekehrt wurde über einen Selektor für beide Arten die `svg` mit erfasst,
   weil sie dieselbe Klasse trägt. Ergebnis: „6 Karten, aber nur 1
   verschiedene Zeichenform".
4. `getBoundingClientRect` rechnet die 3D-Kartendrehung mit ein. Gemessen
   wurde 12 × 33 px statt 32 × 32 px. Richtig ist `offsetWidth`.

Dazu kam ein Denkfehler: der „Gut"-Knopf steht erst nach dem Aufdecken im
DOM, und der Stapel ist ein Kreis — nach der letzten Karte kommt die erste
wieder. Beides gehört zu den Dingen, die ein Audit misst und nicht weiß.

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
