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
| TTS | **Vorderseite** hört das Wort (Aussprache nicht umgehbar) |
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
   Spam-Einladung. Muss im Supabase-Dashboard abgeschaltet werden.
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
| A4 | Keine Erinnerung, keine Offline-Fähigkeit. Der Regler „Tägliche Erinnerung" steht in einem `<fieldset disabled>` mit dem Hinweis „Diese Regler sind im aktuellen Stand Attrappen." | `einstellungen/page.tsx:175-191` |

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

Die Wortlisten sind englisch zentriert. Beim Import gilt dieselbe Richtung:
Vorderseite Englisch, Rückseite Deutsch. Das ist auch die Richtung, die TTS
und die Quellen erwarten.

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

**1.3 TTS auf der Vorderseite.** `speechSynthesis` in `lernen-seite.tsx`.
Kein Server, keine Kosten. Braucht: Sprachcode aus 0.1, ein
Lautsprecher-Knopf auf der Kartenvorderseite, `voiceschanged` abfangen
(Safari lädt Stimmen asynchron — sonst ist der erste Klick stumm),
Großbuchstaben-Automatik aus, sonst buchstabiert es.

**1.4 Beispielsatz anzeigen.** Auf der Rückseite unter der Übersetzung. Bei
Import und Wortlisten-Generator gefüllt, bei manuellen Karten leer.

> **Erledigt in Phase 0** (0.2), live geprüft. Offen bleibt nur die
> automatische Füllung aus Wortlisten-Generator und Import — das sind
> 2.2 und 2.3.

**1.5 `gelernt` ehrlich definieren.** `lernen/antwort/route.ts:84` —
`gelernt = bewertung !== "nochmal"` ist der Grund für jeden geschönten
Balken. Vorschlag: `gelernt` ab Stufe ≥ 2, plus eigene Spalte für „gesehen".
Braucht Migration plus Anpassung aller drei Views.

**1.6 Trefferquote korrigieren.** `lernen-seite.tsx:163` — nur „gut" und
„einfach" als richtig zählen, damit die Zahl etwas Wahres sagt.

**1.7 Problemskarten entschärfen.** Aus den ungenutzten `treffer`/`fehler`:
Leech-Schwelle (etwa 8 Fehler → Ausschluss mit Knopf) und Rückgängig für
die letzte Antwort.

**Abnahme:** Runde fühlen sich ehrlich an. „Nochmal" zeigt die Karte
nochmal. Ton kommt auf der Vorderseite. Beispiel steht auf der Rückseite.
Fortschrittsbalken stimmen.

### Phase 2 — Inhalt und Import

**2.1 Die 300 Platzhalterkarten entfernen.** Sie stehen live in der
Produktivdatenbank. Ersetzen durch ein echtes Starter-Set (NGSL Top 100)
oder ganz entfernen, damit der Leerzustand endlich wieder arbeitet.

**2.2 Wortlisten-Generator.** Ein Skript in `scripts/`, das NGSL + Kelly +
Kaikki + Tatoeba zu Lexio-Karten zusammensetzt. Ausgabe als JSON/CSV, Import
über die bestehende `POST /api/karten`-Route. **Läuft einmalig, nicht zur
Laufzeit** — das ist Absicht, es hält die App schlank und kostenlos.

**2.3 Textblock-Import.** Neuer Schritt im Wizard: ein `<textarea>`,
Trennzeichen-Erkennung, dann **Vorschau mit Editierfeld je Zeile**, erst
dann speichern. Englischarteig nach links, deutsche Übersetzung nach rechts.

**2.4 „Wortschatz" einlösen.** `/wortschatz` ist heute ein Redirect. Eine
echte Wortliste aller Vokabeln mit Suche wäre das, was der Menüeintrag
verspricht — und der Import macht sie erst wertvoll.

### Phase 3 — Reichweite und Öffentlichkeit

**3.1 Web-Push.** Service Worker + VAPID-Schlüssel + Permission-Dialog. Der
tote Regler in `einstellungen/page.tsx:175-191` wird dadurch zum echten
Schalter. **iOS bleibt eine Lücke** — das gehört in die Ankündigung, nicht
unter den Tisch.

**3.2 Level-Kurve.** `lib/profil.ts:14` — Kurve statt 1500 flach, mit
Lücken-Balken bei 50 % / 80 % / 100 %.

**3.3 Tagesziel ehrlich.** 20 XP ist im RPC fest verdrahtet (`003:637`).
Entweder konfigurierbar oder aus der realen Rundenzahl abgeleitet.

**3.4 `sets_gelernt` reparieren.** `003:486` zusammen mit dem Upsert
`003:638-640`.

**3.5 PWA.** Kein Service Worker, kein Manifest, alle Fetchs mit
`cache: "no-store"`. Fürs Lernen im Zug.

**3.6 Rate-Limiting.** Es gibt **keines**, weder für Anmeldung noch für die
API. Die Anmeldeseite erkennt Supabases „rate limit"-Fehler und zeigt sie an
(`anmelden-seite.tsx:126`), erzeugt wird aber keine Begrenzung. Für eine
öffentliche Seite Pflicht.

**3.7 Security-Header.** `next.config.ts` ist ~30 Zeilen und enthält nur die
Bild-Quellen für die OAuth-Logos. Kein `poweredByHeader: false`, keine CSP,
kein HSTS. `app/layout.tsx:138` injiziert das Theme-Skript per
`dangerouslySetInnerHTML` — genau der Fall für eine CSPNonce.

**3.8 `/api/gesundheit` absichern.** Der Endpunkt ist öffentlich und verrät,
ob der Service-Role-Key gesetzt ist (`OFFENE-PUNKTE.md:229-236`).

**3.9 Deployment-Check.** E-Mail-Bestätigung **an** (aktuell aus, siehe
Betriebszustand), nur konfigurierte OAuth-Anbieter, Produktions-Build, und
**ein Handtest der Schreib-Policies im Dashboard** — ein Versuch, ein fremdes
Set oder eine fremde Karte zu ändern, muss scheitern.

**3.10 Session-Leistung.** `lernen/route.ts:23` zieht bis 1001 Karten mit
eingebautem Join, `cache: "no-store"` überall. Pro Sessionstart eine große
unbeholte Antwort. Paginierung oder Zufallsauswahl statt Komplettladung.

### Phase 4 — Aufräumen

Migrationen nach `supabase/migrations/` statt Hand-Import. Tests für
`lernlogik.ts` und `antwort_verbuchen` — die Level-Logik existiert in
TypeScript **und** SQL (`OFFENE-PUNKTE.md:299-303`). `003b`-UUID ersetzen.
Toter Code aus `OFFENE-PUNKTE.md:251-266`; bei Phase 0 fällt ein Teil davon
von selbst weg.

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
