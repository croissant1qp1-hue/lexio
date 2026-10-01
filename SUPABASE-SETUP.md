# Supabase einrichten

Kurzfassung: ohne diese drei Schritte ist die App nicht benutzbar. Danach
läuft sie.

Stand dieses Projekts (geprüft mit `node scripts/db-status.mjs`):

| Schritt | Zustand |
| --- | --- |
| Registrierung erlaubt | ✅ |
| E-Mail-Bestätigung abgeschaltet | ✅ Konto ist sofort nutzbar |
| Datenbank erreichbar | ✅ |
| **Migration 003 ausgeführt** | ✅ 27.09.2026, Ende-zu-Ende geprüft |
| **Datenbankpasswort in `.env`** | ❌ dort steht ein Schlüssel, kein Passwort |
| Migration 004 (nur Geschwindigkeit) | ⬜ optional |
| Anmeldeanbieter (optional) | ❌ keiner aktiviert — läuft über E-Mail/Passwort |

---

## 1. Migration 003 (erledigt)

Ausgeführt am 27.09.2026 im SQL Editor. `node scripts/db-status.mjs` meldet
alle sechs geprüften Objekte als vorhanden, und der komplette Weg über die App
funktioniert: Registrierung, `profil`-Trigger, Wortschatz, Lernantwort, XP,
Streak, Statistiken.

002 wurde nie ausgeführt und muss auch nicht nachgeholt werden: 003 legt
`eigenes_set` selbst an und setzt die Policies, die es braucht, mit eigenen.

Wer 003 erneut ausführen will: mehrfach ausführbar, `if not exists` überall.
Danach optional `supabase/004-leistung.sql` (nur Indizes) und
`supabase/003b-demofortschritt-uebernehmen.sql` (Fortschritt übernehmen).

Prüfen:

```bash
node scripts/db-status.mjs
```

Läuft ohne das richtige Passwort und zeigt genau, was noch fehlt.

### Oder per psql

Braucht `SUPABASE_DB_PASSWORD` in `.env` – also das Passwort des
Datenbanknutzers `postgres`, **nicht** den service_role-Schlüssel. Findet
sich unter Dashboard → Project Settings → Database und lässt sich dort auch
neu erzeugen.

```bash
PGPASSWORD="…" psql "host=db.<ref>.supabase.co user=postgres dbname=postgres sslmode=require" \
  -f supabase/003-auth-und-user-daten.sql \
  -f supabase/004-leistung.sql
```

003 ist mehrfach ausführbar (`if not exists` überall), 003b und 004 ebenso.

---

## 2. Registrierung ohne Mailserver

Aktuell ist „Confirm email" **an**. Supabase schickt dann eine Mail, bevor
das Konto nutzbar ist – und der mitgelieferte Test-Mailserver stellt nur
etwa zwei Mails pro Stunde an Teammitglieder zu. Für eine private Adresse
kommt nichts an. Das Konto existiert, ist aber nicht einlogbar.

**Zwei Wege, einer davon reicht:**

**a) Schnellstart ohne Mail (empfohlen zum Ausprobieren)**
Dashboard → Authentication → Sign In / Providers → „Confirm email"
**abschalten**. Danach ist das Konto sofort nutzbar. Für den ernsthaften
Betrieb lieber Weg b.

**b) Richtig: eigener Mailserver**
Dashboard → Authentication → Emails → SMTP. Kostenlos reicht Resend
(kostenlose Stufe, ~300 Mails/Monat). Danach in den Templates den Absender
auf eine eigene Domain setzen – auf der Supabase-Adresse landen
Bestätigungsmails bei Gmail zuverlässig im Spam.

**Redirect-URLs** (gleiche Seite, direkt darunter) müssen enthalten sein:

```
http://localhost:3000/api/auth/callback
http://localhost:3000/passwort-aendern
```

Weitere Umgebungen analog (`https://…`). Fehlt eine, lehnt Supabase den
Aufruf mit „requested path is invalid" ab – der Grund ist dann nicht die
Adresse, sondern diese Liste.

---

## 3. Anmeldeanbieter (optional)

Dashboard → Authentication → Sign In / Providers.

Ohne einen aktivierten Anbieter funktioniert die App vollständig über
E-Mail und Passwort. Sind welche aktiv, erscheinen ihre Knöpfe auf der
Anmeldeseite von selbst — ohne Codeänderung.

Lexio unterstützt **Google, GitHub, Discord, Spotify, Facebook, X und Twitch**.
Die vollständige Anleitung je Anbieter steht in **`OAUTH-ANLEITUNG.md`**.

Falls nur Google und GitHub eingerichtet werden sollen, hier die Kurzfassung:

**Google** (schnellster Weg)
1. Google Cloud Console → neues Projekt
2. APIs & Dienste → Credentials → OAuth-Client-ID → **Webanwendung**
3. Autorisierte Weiterleitungs-URIs:
   `https://<ref>.supabase.co/auth/v1/callback`
4. Client-ID und Client-Secret zurück in Supabase eintragen, Provider
   aktivieren

**GitHub**
1. github.com/settings/developers → OAuth Apps → New OAuth App
2. Callback-URL: `https://<ref>.supabase.co/auth/v1/callback`
3. Client-ID und Client Secret in Supabase eintragen

Die Anmeldeseite zeigt einen Knopf erst an, wenn der Provider wirklich
aktiv ist. Ein Knopf für etwas, das nicht eingeschaltet ist, wäre ein Knopf,
der immer mit einer Fehlermeldung endet.

---

## `.env`

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>   # nur für Migrationen
SUPABASE_DB_PASSWORD=<passwort des postgres-Nutzers>
```

Zwei Fallen, die schon passiert sind:

- **`SUPABASE_DB_PASSWORD` ist kein Schlüssel.** Ein dort eingetragener
  service_role-Schlüssel macht `psql` die Anmeldung kaputt, weil er als
  Passwort nie funktioniert. Der Platzhaltertext `DEIN_SERVICE_ROLE_KEY` in
  `SUPABASE_SERVICE_ROLE_KEY` ist kein gültiger Schlüssel und fällt beim
  ersten Admin-Aufruf auf. `node scripts/db-status.mjs` sagt einem, ob beides
  stimmt.
- **Der anon-Key gehört in den Browser.** Steht dort ein Schlüssel mit der
  Rolle `service_role`, umgeht die gesamte App ihre eigenen Datenbankregeln.
  Für den Browser zwingend der Schlüssel mit der Rolle `anon`.

---

## Prüfen, ohne zu raten

```bash
node scripts/db-status.mjs        # Datenbank und Anmeldung
curl -s localhost:3000/api/gesundheit | jq .    # dasselbe als JSON
```

Dieselbe Prüfung läuft in der App: auf der Anmeldeseite erscheint eine Liste
der offenen Punkte, in der App eine schmale Leiste – aber nur solange etwas
fehlt. Nach dem Beheben verschwindet sie von selbst.
