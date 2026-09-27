# Anmeldeanbieter einrichten

Lexio bietet sieben Anmeldeanbieter. Welche davon auf der Anmeldeseite
erscheinen, entscheidet **nur** das Supabase-Dashboard — nicht der Code. Die
App fragt die aktiven Anbieter ab und blendet alle anderen aus.

> Im Code steht die Liste in `lib/supabase/anbieter.ts`. Wer einen Anbieter
> ergänzen will, ändert diese eine Datei.

---

## Was für alle gleich gilt

### 1. Diese Callback-Adresse brauchst du überall

```
https://vvdouxtdvnhrptkptohp.supabase.co/auth/v1/callback
```

Supabase zeigt sie dir im Dashboard selbst an, sobald du den jeweiligen
Anbieter aufklappst. **Aufklappen → kopieren.** Nicht selbst tippen.

### 2. Redirect-URLs in Supabase (nur einmal)

Dashboard → **Authentication → URL Configuration** → *Redirect URLs*:

```
http://localhost:3000
http://localhost:3000/api/auth/callback
http://localhost:3000/passwort-aendern
```

Ohne `/api/auth/callback` kommt man nach der Anmeldung nicht in die App,
sondern wieder auf der Anmeldeseite.

### 3. Reihenfolge

Ein Anbieter ist erst nutzbar, wenn **beides** steht:
- die Callback-Adresse ist beim Anbieter eingetragen, **und**
- Client-ID plus Secret stehen in Supabase, und `Enabled` ist auf `ON`.

Trägst du nur die eine Hälfte ein, erscheint der Knopf nicht — die App zeigt
ihn nur an, wenn Supabase den Anbieter auch wirklich als aktiv meldet.

---

## Google

Am einfachsten, in etwa 5 Minuten erledigt.

1. [Google Cloud Console](https://console.cloud.google.com) → neues Projekt anlegen
2. **APIs & Dienste** → **OAuth Client-ID** erstellen
   - Applikationstyp: **Webanwendung**
3. Bei *Autorisierte Weiterleitungs-URIs* eintragen:
   ```
   https://vvdouxtdvnhrptkptohp.supabase.co/auth/v1/callback
   ```
4. Client-ID und Client-Secret notieren
5. Supabase → Authentication → Sign In / Providers → **Google** aufklappen
   → Enabled `ON` → beide Werte einfügen → **Save**

**Liefert eine E-Mail.** Profilbild von `lh3.googleusercontent.com`.

---

## GitHub

1. [github.com/settings/developers](https://github.com/settings/developers) → **OAuth Apps** → **New OAuth App**
2. **Authorization callback URL**:
   ```
   https://vvdouxtdvnhrptkptohp.supabase.co/auth/v1/callback
   ```
3. **Client ID** kopieren, **Generate a new client secret**
4. Supabase → **GitHub** aufklappen → `ON` → beide Werte → **Save**

**Liefert die E-Mail nur, wenn sie öffentlich ist.** Sonst nicht — das Konto
funktioniert, aber Lexio kann keine Adresse anzeigen.

---

## Facebook

Der aufwendigste, mit drei Stellen, an denen es hängen kann.

1. [developers.facebook.com](https://developers.facebook.com) → **My Apps** → **Create App**
2. Auf der Seite *Add Products to Your App*: bei **Facebook Login** auf **Setup**,
   den Quickstart überspringen
3. Linke Leiste → **Facebook Login** → **Settings** → bei *Valid OAuth
   Redirect URIs* die Callback-Adresse eintragen → **Save Changes**
4. **Wichtig, sonst kommt keine E-Mail an:**
   *Use Cases* → **Authentication and Account Creation** → **Edit** → beide
   Berechtigungen müssen **Ready for testing** zeigen:
   - `public_profile`
   - `email`
5. *Settings* → **Basic** → **App ID** kopieren, bei *App Secret* auf **Show**
6. Supabase → **Facebook** aufklappen → `ON` → beide Werte → **Save**

**Zwei Fallen:**

- **Nur Rollen-Benutzer können sich anmelden.** Eine neue Facebook-App startet
  im *Development*-Modus. Wer keine Rolle auf der App hat, sieht
  „App Not Setup". Zum Testen: *App Roles* → die Person als **Tester**
  hinzufügen. Für die Öffentlichkeit braucht es den App Review.
- **Keine E-Mail im Profil.** Dann bleibt in Lexio das E-Mail-Feld leer. Das
  Konto funktioniert trotzdem — der Fortschritt hängt an der User-ID, nicht an
  der Adresse.

---

## Discord

1. [discord.com/developers](https://discord.com/developers) → **New Application**
   → Name eingeben → **Create**
2. Linke Leiste → **OAuth2** → **Add Redirect** →
   ```
   https://vvdouxtdvnhrptkptohp.supabase.co/auth/v1/callback
   ```
   → **Save Changes**
3. Unter **Client information**: **Client ID** und **Client Secret** kopieren
4. Supabase → **Discord** aufklappen → `ON` → beide Werte → **Save**

**Liefert die E-Mail nur, wenn sie im Discord-Account hinterlegt ist.**

---

## X (früher Twitter)

> **Wichtig:** In Supabase gibt es zwei X-Einträge. Nimm
> **„X / Twitter (OAuth 2.0)"** — der andere ist das alte OAuth 1.0a und wird
> eingestellt. Lexio benutzt OAuth 2.0.

1. [developer.x.com](https://developer.x.com) → anmelden → **Create Project**
   → durch die vier Schritte durchklicken
2. Bei *Keys and tokens*: **API Key** und **API Secret Key** notieren
   (die sind für OAuth 1.0a und werden hier nicht gebraucht)
3. **App settings** → unten *User authentication settings* → **Set up**
4. **App permissions** → *Request email from users* → **einschalten**
   (ohne das gibt es keine E-Mail)
5. **Type of App**: **Web App**
6. Bei *App info*:
   - **Callback URL** = die Supabase-Adresse
   - **Website URL** = `http://localhost:3000`
   - **Terms of service URL** und **Privacy policy URL** eintragen
7. **Save** → zurück zu *Keys and tokens* → ganz unten **Client ID**, und bei
   **Client Secret** auf **Regenerate** → **Yes, regenerate** → kopieren
8. Supabase → **X / Twitter (OAuth 2.0)** aufklappen → `ON` → beide Werte → **Save**

**X ist der eine Sonderfall im Code.** Die Einstellungen-API von Supabase
meldet diesen Anbieter noch unter dem alten Namen, der Client erwartet den
neuen. `lib/supabase/anbieter.ts` fragt deshalb beide ab — daran musst du
nichts machen, es funktioniert, aber gut zu wissen falls du mal debugst.

---

## Twitch

1. [dev.twitch.tv/console](https://dev.twitch.tv/console) → **Log in with Twitch**
2. **Zwei-Faktor-Authentifizierung aktivieren** — sonst kommst du nicht weiter.
   Die findet man unter [twitch.tv/settings/security](https://www.twitch.tv/settings/security)
3. **Register Your Application**
   - **OAuth Redirect URL** = die Supabase-Adresse
   - Kategorie wählen, CAPTCHA bestätigen → **Create**
4. **Manage** → **Client ID** kopieren → **New Secret** → **Client Secret** kopieren
5. Supabase → **Twitch** aufklappen → `ON` → beide Werte → **Save**

**Liefert normalerweise keine E-Mail.** Wie bei Discord bleibt das E-Mail-Feld
in Lexio dann leer; das Konto ist trotzdem vollständig nutzbar.

---

## Spotify

1. [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
   → **Create an App** → Name, Beschreibung, Developer's TOS bestätigen
2. Bei *Redirect URIs* die Supabase-Adresse eintragen → **Add** → **Save**
3. **Client ID** und **Client Secret** kopieren
4. Supabase → **Spotify** aufklappen → `ON` → beide Werte → **Save**

**Eine Besonderheit:** Spotify liefert zwar eine E-Mail, aber Supabase
verlangt deren Bestätigung, bevor die Sitzung gilt. Das ist unabhängig von der
Einstellung *„Confirm email"* für normale Konten. Wer sich über Spotify anmeldet,
muss also den Link aus der Mail anklicken — dafür braucht die App einen
Mailserver (siehe `SUPABASE-SETUP.md`, Abschnitt 2).

---

## Prüfen, ob es geklappt hat

```bash
node scripts/db-status.mjs
```

Oder in der App: auf der Anmeldeseite. Der aktuelle Stand steht auch hier:

```bash
curl -s localhost:3000/api/gesundheit | python3 -m json.tool
```

Unter `anmeldung.provider` stehen alle sieben Schalter. `true` heißt: der
Knopf ist sichtbar. Bleibt einer auf `false`, obwohl du ihn eingeschaltet
hast, ist meist die Callback-Adresse beim Anbieter falsch.

Die App fragt nur alle **45 Sekunden** neu ab. Nach dem Umschalten im
Dashboard also: Seite neu laden oder auf der Anmeldeseite *„Erneut prüfen"*
klicken.

---

## Wenn sich jemand anmeldet, aber nichts passiert

In dieser Reihenfolge nachsehen:

1. **Weiterleitung auf `/anmelden`?** Dann passt `/api/auth/callback` nicht in
   die Redirect-URLs.
2. **„requested path is invalid" von Supabase?** Die Callback-Adresse beim
   Anbieter stimmt nicht exakt. Kein Slash am Ende, keine Grossbuchstaben.
3. **Knopf fehlt ganz?** Supabase meldet den Anbieter nicht als aktiv. Fast
   immer fehlen `Enabled = ON` oder das Secret.
4. **Anmeldung klappt, aber Lexio zeigt Fehler?** Dann fehlt die Migration 003
   in der Datenbank — siehe `SUPABASE-SETUP.md`. Das ist ein anderes Problem
   als der Anbieter.
