# Was jetzt zu tun ist

Kurzfassung: **ein Klick-Punkt, dann bist du durch.** Die App ist fertig
programmiert. Es fehlt nur noch die Datenbank.

> **Hinweis zur Reihenfolge:** 002 wurde nie ausgeführt, 003 schon. 003 legt
> die Spalte `eigenes_set` inzwischen selbst an, du musst 002 also **nicht**
> vorher nachholen. 002 ist nur für die Insert-/Delete-Policies zuständig, und
> die überschreibt 003 ohnehin mit eigenen.

---

## 1. Migration 003 ausführen — das ist der einzige Blocker

Ohne das funktioniert **nichts**: kein Login, keine Sets, keine Karten. Alle
Fehlermeldungen, die du siehst (`Could not find the 'eigenes_set' column`),
kommen von hier.

Die Datei liegt **jetzt in deiner Zwischenablage** (26.964 Bytes, gerade
geprüft). Falls nicht: in VSCodium öffnen, `Strg+A`, `Strg+C`.

**Supabase Dashboard → SQL Editor → neues Query → `Strg+V` → Run**

Dauert ein paar Sekunden. Am Ende erscheint *Success. No rows returned* —
das ist richtig, die Datei legt nur Tabellen an.

**Falls der Lauf mit `column ... does not exist` abbricht:** die
Zwischenablage enthielt eine ältere Fassung. Datei neu kopieren:

```bash
cd /home/theo/Coding/projekte/lexio
xclip -selection clipboard -i supabase/003-auth-und-user-daten.sql
```

**Danach dasselbe mit der zweiten Datei:**

```bash
cd /home/theo/Coding/projekte/lexio
xclip -selection clipboard -i supabase/004-leistung.sql
```

Wieder `Strg+V` → Run. Das sind nur Indizes für die Geschwindigkeit,
nichts Kaputt-geht, wenn du sie überspringst.

**Prüfen, ob es geklappt hat:**

```bash
cd /home/theo/Coding/projekte/lexio
node scripts/db-status.mjs
```

Wenn dort **„Datenbank ist bereit"** steht, war es erfolgreich.

---

## 2. Einloggen und einmal durchklicken

`npm run dev` → http://localhost:3000

Dann einmal:

- [ ] Übersicht lädt ohne Fehlermeldung
- [ ] Dein Name und Level stehen links in der Seitenleiste
- [ ] Klick aufs Profil → neue Seite `/profil` mit Level, XP, Streak
- [ ] Auf dem Handy: Profil-Tab unten in der Tableiste
- [ ] „Hinzufügen" → ein Wortpaar anlegen
- [ ] Lernen → Karte beantworten, XP-Zahl hochzählen sehen
- [ ] Abmelden und wieder anmelden

Wenn dabei irgendwo eine Fehlermeldung auftaucht: **nicht weiterklicken**,
sondern die Meldung mir geben. Genauer Text, nicht zusammengefasst.

---

## 3. Optional: ein Anmeldeanbieter

Die App läuft vollständig mit E-Mail und Passwort. Für Google oder GitHub
musst du nichts an Code anfassen, nur einmalig im Dashboard:

**Supabase Dashboard → Authentication → Sign In / Providers → Google → Enable**

Client-ID und Client Secret bekommst du von Google (Anleitung:
`OAUTH-ANLEITUNG.md`). Alle sieben Anbieter sind vorbereitet, sie erscheinen
automatisch, sobald du sie einträgst.

**Wichtig:** Diese drei Reihenfolgen nicht verwechseln — Migration zuerst,
Anbieter sind nur Kosmetik danach.

---

## Was danach noch offen ist

Allesamt dokumentiert in `OFFENE-PUNKTE.md`, nichts davon blockiert dich:

| | |
|---|---|
| 7 kleine Issues | Aufräumarbeit, davon 3 in der Lernansicht |
| Tests für `lernlogik.ts` | Die XP-Formel existiert in TypeScript **und** in SQL — genau diese Doppelung hat schon einmal Fehler gemacht |
| Versions-Tracking für Migrationen | Migrationen laufen per Hand im SQL Editor; mit 7 Dateien irgendwann Chaos |

Sag mir nach Schritt 1 kurz Bescheid, dann mache ich mit dem nächsten
Punkt weiter.
