# Was jetzt zu tun ist

Kurzfassung: **die Datenbank steht. Die App läuft.** Am 27.09.2026 wurde
Migration 003 im Supabase SQL Editor ausgeführt und danach Ende-zu-Ende geprüft:
Registrierung, Profil, Wortschatz, Lernsitzung, XP, Streak und Statistiken
funktionieren. Was noch offen ist, steht unten — nichts davon blockiert den Betrieb.

> **Zur Reihenfolge:** 002 wurde nie ausgeführt, 003 schon. 003 legt die Spalte
> `eigenes_set` inzwischen selbst an, 002 musste also **nicht** nachgeholt werden.

---

## Was noch offen ist

### 1. `.env`: zwei falsche oder fehlende Werte

Beides steht auf der Anmeldeseite unter „Die App ist noch nicht einsatzbereit“:

* `SUPABASE_DB_PASSWORD` enthält einen **Service-Role-Schlüssel** statt des
  Passworts. Wird nur für `psql` gebraucht, die App läuft auch so.
* `SUPABASE_SERVICE_ROLE_KEY` fehlt. Braucht die App nicht, nur automatisierte Migrationen.

Dashboard → **Settings → Database** bzw. **Settings → API** → Wert eintragen, `.env`
neu laden. Details stehen in `SUPABASE-SETUP.md`.

### 2. Optional: Migration 004 (nur Geschwindigkeit)

Legt Indizes an, damit die Lernsitzung schneller lädt. Ohne sie wird nichts kaputt.

```bash
cd /home/theo/Coding/projekte/lexio
xclip -selection clipboard -i supabase/migrations/004-leistung.sql
```

Dann Dashboard → **SQL Editor** → `Strg+V` → **Run**.

### 3. Migration 003b — nicht ausführen, sie tut nichts mehr

Der alte Rumpf sollte Lernfortschritt aus der Demo auf ein echtes Konto
übernehmen. Dafür gibt es keine Daten mehr. Gemessen am 2026-10-04: `003b` würde
**2.275 Karten aus fünf Wortlisten** treffen, davon **0** mit Fortschritt, und
2.269 erfundene „gesehen"-Zeilen in ein echtes Konto schreiben. Es rettet nichts
und erfindet etwas — deshalb ist der Rumpf seit 2026-10-04 eine Meldung, die
genau das sagt. **Nicht ausführen.**

### 4. Optional: Anmeldeanbieter einschalten

Alle sieben (Google, GitHub, Discord, Spotify, Facebook, X, Twitch) sind im
Dashboard aus. Die Anmeldeseite zeigt einen Knopf **von selbst** an, sobald einer
aktiv ist. Anleitung: `OAUTH-ANLEITUNG.md`.

---

## Prüfen, ob alles klappt

```bash
cd /home/theo/Coding/projekte/lexio
node scripts/db-status.mjs
```

Meldet der Lauf „Datenbank ist bereit“, stimmt die Datenbank. Für den vollen Durchstich
mit Anmeldung: `node scripts/lexio-browser.mjs start`, dann `lesen`, dann
`url http://localhost:3211/anmelden`.


```bash
cd /home/theo/Coding/projekte/lexio
node scripts/db-status.mjs
```

Wenn dort **„Datenbank ist bereit"** steht, war es erfolgreich.

---

## Durchklicken mit deinem eigenen Konto

Der automatische Test lief mit `kiro-funktionstest@lexio.invalid`. Der Weg
durch die App ist damit klar — prüf ihn noch einmal mit deinem Konto:

`npm run dev` → die Adresse zeigt das Terminal an (derzeit **http://localhost:3211**;
der Port hängt davon ab, wie oft der Dev-Server schon lief).

- [ ] Übersicht lädt ohne Fehlermeldung
- [ ] Dein Name und Level stehen in der Seitenleiste
- [ ] Klick aufs Profil → `/profil` mit Level, XP, Streak
- [ ] Auf dem Handy: Profil-Tab unten in der Tableiste
- [ ] „Hinzufügen“ → ein Wortpaar anlegen
- [ ] Lernen → Karte beantworten, XP-Zahl hochzählen sehen
- [ ] Abmelden und wieder anmelden

Taucht eine Fehlermeldung auf: **nicht weiterklicken**, sondern den genauen Text
mir geben. Nicht zusammengefasst.

---

## Was danach noch offen ist

Allesamt dokumentiert in `OFFENE-PUNKTE.md`, nichts davon blockiert dich:

| | |
|---|---|
| 7 kleine Issues | Aufräumarbeit, davon 3 in der Lernansicht |
| Tests für `lernlogik.ts` | Die XP-Formel existiert in TypeScript **und** in SQL — genau diese Doppelung hat schon einmal Fehler gemacht |
| Versions-Tracking für Migrationen | Migrationen laufen per Hand im SQL Editor; mit 7 Dateien irgendwann Chaos |

## Das Testkonto wieder loswerden

Dashboard → **Authentication → Users** → `kiro-funktionstest@lexio.invalid`
→ löschen. Die zugehörige Zeile in `profil` und `mein_fortschritt` nimmt der
Löschvorgang mit, weil beides am Konto hängt.

---

## Tägliche Erinnerung (Web-Push, Plan 3.1)

Der Schalter in den Einstellungen ist echt: er fragt die
Browser-Berechtigung ab, registriert den Service Worker (`public/sw.js`)
und meldet das Abo an die Datenbank.

Manuell verschicken, um die komplette Kette zu prüfen:

```bash
cd /home/theo/Coding/projekte/lexio
npm run push:senden
```

Die Nachricht kommt auch an, wenn Lexio zu ist — das ist der Zweck. Im
Trockenlauf (ohne zu senden): `npm run push:senden -- --trocken`.

**Täglich automatisch:** eine crontab-Zeile ruft das Skript um 18:30 auf
(das gehört zu diesem Rechner, nicht in dieses Repository):

```
30 18 * * * node /home/theo/Coding/projekte/lexio/scripts/erinnerung-senden.mjs >> /tmp/lexio-push.log 2>&1
```

Das funktioniert genau solange, wie dieser Rechner zu der Zeit läuft und
angemeldet ist — eine ehrliche Grenze für eine App, die noch nicht
öffentlich deployt ist. Beim ersten Lauf enthält `/tmp/lexio-push.log` die
Auskunft, ob Abos gefunden und Zustellungen erfolgreich waren.

Abgelaufene Abos (Browser hat die Berechtigung verloren) räumt das Skript
beim Senden selbst auf.

**iOS bleibt eine Lücke.** Web-Push ist dort unzuverlässig. Wer auf dem
iPhone eine Erinnerung will, braucht so lange einen anderen Weg.
