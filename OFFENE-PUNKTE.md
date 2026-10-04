# Offene Punkte

Gefunden am 2026-09-27, nach dem Einbau der sieben Anmeldeanbieter.

**Die drei WICHTIG-Punkte sind inzwischen behoben** (siehe jeweiliger
Absatz). Die KLEIN-Punkte sind weiterhin offen — dafür war die
Reihenfolge „erst Auth, dann der Rest". Jeder Punkt nennt die Datei, den
Grund und, wenn er erledigt ist, wie.

## Kurzfassung

Es gibt **keine Blocker** — keine offene Tür, keine fremden Daten, keine Route
ohne Sessionprüfung. Der Fund war unangenehm, aber solide: drei echte Fehler,
der Rest ist Haltung und Aufräumarbeit.

```
WICHTIG   3   alle drei behoben
KLEIN     7   davon 4 behoben (4, 5, 8, 9), 3 offen
```

Dazu gekommen: eine **neue Profilseite** `/profil`. Die Profilkarte in der
Seitenleiste war bis dahin reiner Text — Name, Level und XP konnten
angesehen, aber nicht angeklickt werden, und auf dem Telefon war die Karte
per `display: none` komplett ausgeblendet. Die Daten waren überall da; nur
die Anzeige fehlte.

---

## WICHTIG — behoben

### 1. ~~Die Lernseite meldet „Alles gelernt", wenn das Netz weg ist~~ ✅

`app/(app)/lernen/[set]/lernen-seite.tsx:91-133`

```ts
try {
    const [daten, profil] = await Promise.all([...]);
    if (!daten) { setFehler("Karten konnten nicht geladen werden."); return; }
    // ...
} finally {
    if (!abgebrochen) setLaden(false);
}
```

`try`/`finally` **ohne `catch`**. `holeJson` wirft aber auch dann, wenn ein
Fallback übergeben wurde — bei 401 (`lib/api-client.ts:83`) und bei
Netzwerkfehler (`lib/api-client.ts:46`).

**Was passiert:** WLAN fällt aus → `holeJson` wirft → `finally` räumt den
Ladezustand ab → `fehler` bleibt `null` → `karten` bleibt `[]` → die Seite
rendert:

> ☕ Alles gelernt — Für *Englisch Grundlagen* sind heute keine Karten fällig.

**Warum das schlimmer ist als eine Fehlermeldung:** Der Nutzer wird
erfolgreich belogen. Und das ist ausgerechnet die Seite, auf der die App am
längsten läuft. Dazu kommt eine unbehandelte Promise-Rejection in der Konsole.

**Bemerkenswert:** Das ist der einzige Effekt im ganzen Projekt ohne `catch`.
Die anderen elf haben alle `abgebrochen`-Flag *und* `catch`.

**Fix:** `catch` ergänzen, der `setFehler("Karten konnten nicht geladen
werden.")` setzt. Das `finally` bleibt für `setLaden(false)`.

**Erledigt.** `catch` ergänzt, mit getrennter Meldung für 503
(`lib/api-client.ts` wirft 503 inzwischen immer, auch mit `abfall` — sonst
wäre `daten` weiter `null` gewesen).

---

### 2. ~~Ein Supabase-Ausfall meldet sich als Abmeldung~~ ✅

`lib/supabase/user.ts:13-18`, `proxy.ts:83`, `components/navbar/navbar.tsx:57`

```ts
const { data: { user } } = await supabase.auth.getUser();
return user;   // error wird nie ausgewertet
```

`getUser()` ist ein Netzwerkaufruf. Bei Timeout oder 5xx kommt
`{ user: null, error: {...} }` zurück — und `null` bedeutet in diesem Code
„nicht angemeldet". **Ausfall und Abmeldung sind nicht unterscheidbar.**

**Die Kette, die daraus entsteht:**

1. Supabase ist fünf Sekunden nicht erreichbar
2. `proxy.ts:113` leitet eine angemeldete Person auf `/anmelden` um
3. Umgeleitete API-Aufrufe antworten 401
4. `lib/api-client.ts:75` ruft `vergissAnmeldung()` auf — **die gemerkte
   E-Mail im localStorage wird gelöscht** (`lib/geraet.ts:130`)

Ergebnis: Jemand wird mitten im Lernen abgemeldet, muss sich neu anmelden und
muss seine E-Mail wieder tippen. Und das, weil der Server kurz nicht
 erreichbar war.

**Fix:** In `holeUser` den `error` prüfen und die Fälle trennen —
`error` vorhanden → 503, `error === null && !user` → 401. Im Proxy bei
`error` durchlassen statt umzuleiten. `holeUser` ist die zentrale Stelle:
jeder API-Aufrufer erbt das Verhalten.

**Erledigt, in vier Schritten** (ein Bug, vier betroffene Stellen):

| Datei | Änderung |
| --- | --- |
| `lib/supabase/user.ts` | `holeUser` liefert `SessionPruefung` (drei Fälle) statt `User \| null`. `mitUser` antwortet bei `fehler` mit **503**, sonst 401. |
| `proxy.ts` | Bei `error` durchlassen statt umzuleiten. |
| `lib/api-client.ts` | 503 wird **immer** geworfen, auch mit `abfall` — sonst zeigt die App bei Ausfall leere Listen statt eines Hinweises. |
| `components/navbar/navbar.tsx` | Auf die neue Form umgestellt. |

Die 10 API-Routen mussten **nicht** angefasst werden: sie geben `antwort`
unverändert weiter und werten nur `if (nichtAngemeldet)` aus.

> Der Name `mitUserOder401` ist jetzt historisch — bei Ausfall kommt 503.
> Absichtlich nicht umbenannt, sonst hätten 11 Dateien einen Diff ohne
> Verhaltensänderung bekommen.

#### Nachtrag: der erste Fix war falsch, und das fiel nur durch einen Test auf

Die erste Fassung stufte **jedes** `error` aus `getUser()` als Stoerung.
Live geprüft ergab das: `/api/profil` antwortete **503** für jemanden, der
gar nicht angemeldet war.

Der Grund steht in `node_modules/@supabase/auth-js/.../GoTrueClient.js:2712`:

```js
if (!data.session?.access_token && !this.hasCustomAuthorizationHeader) {
  return { data: { user: null }, error: new AuthSessionMissingError() };
}
```

`getUser()` liefert bei **fehlender Session** `user: null` *und* ein
`error`-Objekt. `error` allein bedeutet also nie „Kaputt" — es ist der
Normallfall für jeden, der nicht angemeldet ist. Zwei weitere Fehlerbilder
kommen dazu, ebenfalls mit `user: null` und `error`:

| Antwort von `/auth/v1/user` | Bedeutung | Soll |
| --- | --- | --- |
| `AuthSessionMissingError` (400) | niemand angemeldet | 401 |
| 401 `invalid claim` / 403 `bad_jwt` | Sitzung abgelaufen | 401 |
| Timeout, DNS, 5xx | **unbekannt** | 503 |

`istEchteStoerung()` in `lib/supabase/user.ts` trennt die drei, und wird von
`proxy.ts` importiert statt dort eine zweite Kopie zu pflegen. Sie prüft
zuerst `isAuthError(error)`: im Notbetrieb wirft `fetch` auch einen
`TypeError`, und ein `error.status` darauf wäre `undefined` — was still als
„nicht angemeldet" durchgegangen wäre.

Live geprüft nach dem Korrigieren:

| Aufruf | vorher | nachher |
| --- | --- | --- |
| `GET /api/profil` ohne Login | 503 | **401** |
| `GET /` ohne Login | 200 | **307** → `/anmelden?weiter=%2F` |
| `/profil` mit kaputtem Cookie | 503 | **307** → `/anmelden?weiter=%2Fprofil` |
| `/anmelden`, `/passwort-zuruecksetzen` | 200 | **200** (bleiben öffentlich) |

Ohne den Live-Test wäre der Fehler in Produktion aufgefallen — aber als
„Supabase ist kaputt", nicht als „wir haben das Abmelden zerschossen".

---

### 3. ~~`POST /api/karten` stürzt mit 500 ab statt 400 zu sagen~~ ✅

`app/api/karten/route.ts:20` und `:82-94`

```ts
const rohPaare = Array.isArray(paare) ? paare : [{ frage, antwort }];
rohPaare.forEach((roh, index) => { const geprueft = pruefePaar(roh, index, fehler); ...
```

und in `pruefePaar`:

```ts
const frage = typeof roh.frage === "string" ? roh.frage.trim() : "";
```

`roh` ist zur Laufzeit ungeprüft. Ein Aufruf mit `{"paare":[null]}` gibt
`TypeError: Cannot read properties of null` und damit einen unbehandelten 500.

**Warum das auffällt:** Der Rest der Route ist penibel typgeprüft — `typeof
name === "string"`, `istBewertung`, `Array.isArray`. Genau diese eine Lücke
passt nicht ins Muster. Ein 500 mit Stacktrace im Log ist zudem das
unhöflichste, was ein Formular bekommen kann.

**Fix:** Vor `pruefePaar` auf `roh && typeof roh === "object"` prüfen und das
Element als `fehler.paare[index]` melden.

**Erledigt.** `rohPaare` ist jetzt `unknown[]`, die Schleife prüft den Typ
und meldet Nicht-Objekte als `Wortpaar fehlt` → 400 statt 500.

---

## KLEIN

### 4. ~~Erfolgsmeldung nach dem Löschen kann falsch zählen~~ ✅

`app/api/sets/[slug]/route.ts` (DELETE) — `error` wurde bei der Zählung nicht
geprüft. Bei Timeout meldete die Route Erfolg mit `karten: 0`. Die Löschung
selbst ist korrekt abgesichert; nur die Zahl in der Antwort war unzuverlässig.

**Erledigt.** `null` statt `0`, wenn das Zählen scheitert. Bewusst **kein**
Fehler der ganzen Route: Die Löschung passiert danach, und sie zu verweigern,
weil eine Nebenabfrage ins Timeout gelaufen ist, hieße: Das Set bleibt, und
der Nutzer glaubt, es sei weg. Das ist die schlimmere Lüge. Eine erfundene
Null ist ohnehin keine Information, "0 Wörter gelöscht" liest sich wie eine
Tatsache.

Live am Produktionsbuild geprüft, der Normalfall: Set mit 3 Karten anlegen und
löschen → `{"geloescht":{"slug":"punkt-4-probe","name":"Punkt 4 Probe","karten":3}}`.
Der Fehlerfall lässt sich live nicht erzwingen; der ist im Code geprüft.

### 5. ~~Toter Fehlerzweig in `/api/sets`~~ ✅

`app/api/sets/route.ts` — der Kommentar beschrieb `42501`
(insufficient_privilege) als Folge einer fehlenden Migration. Tatsächlich
kommt ohne 003 ein `42703 column "user_id" does not exist`.

**Schlimmer als beschrieben: der Zweig war unerreichbar.** `migrationsMeldung`
steht zwei Zeilen darüber und beantwortet 42501 bereits — mit derselben
Migration 003, nur als 503 statt 403. Der eigene Zweig konnte nie laufen.

**Erledigt.** Zweig entfernt. Die Zuordnung bleibt an einer Stelle
(`lib/db-fehler.ts`), damit sie nicht an zwei Orten auseinanderläuft. Damit
der Befund nicht wiederkehrt, nagelt `tests/db-fehler.test.ts` die Zuordnung
fest: 42703/PGRST204 mit `user_id` → 003, mit `sprache_code` → 005+006,
PGRST205 → 005 bzw. 003, 42501 → 003, und alles ohne Migrationsbezug → `null`,
weil die Route dafür eine bessere Meldung hat. 8 Tests, Gesamtsuite 149.

### 6. Zwei bewusste, aber stille Typ-Casts

`app/api/lernen/route.ts:171`, `app/api/lernen/antwort/route.ts:126`

```ts
const roh = (data ?? []) as unknown as RohKarte[];
```

Beide sind begründet und kommentiert. Das Restrisiko ist aber konkret: Bricht
der Alias `fortschritt:` oder ändert sich der RPC-Return, liefert die
Normalisierung stillschweigend `stufe: 0, gelernt: false` — die Karte gilt
als **neu** und wird erneut angeboten, statt als Fehler aufzufallen.

### 7. „Angemeldet bleiben" einschalten löscht die gemerkte E-Mail

`lib/geraet.ts:113-120` — `setzeMerken(true)` schreibt den Eintrag neu, ohne
`alt.email` zu übernehmen. Wer den Schalter in den Einstellungen von nein auf
ja stellt, verliert die vorgemerkte Adresse.

### 8. ~~Der öffentliche Endpunkt verrät den Fehlkonfigurationszustand~~ ✅

`app/api/gesundheit/route.ts:16` → `lib/gesundheit.ts:194-273`

Positiv: Es verlässt kein Schlüsselmaterial den Server, die Rolle des
anon-Keys ist ohnehin aus dem öffentlichen Key decodierbar. Was bleibt: Die
Antwort verrät, ob `SUPABASE_SERVICE_ROLE_KEY` gesetzt ist. Bei korrekter
Konfiguration ist die Antwort leer — unkritisch, aber bewusst entscheidbar.

**Erledigt in Phase 3.8** (hier nur noch als offen geführt). Die drei
Server-Diagnosen hängen an `optionen.inklusiveServerKonfiguration`, und die
Route schaltet sie nur außerhalb der Produktion zu. Live am laufenden
Produktionsbuild geprüft, nicht nur im Code gelesen:

```
GET /api/gesundheit → aufgaben: ["oauth"]   (nur der Dashboard-Schalter)
                     "service-key" kommt nicht vor
```

### 9. ~~Der Assistent meldet Erfolg, obwohl das Nachladen fehlschlug~~ ✅

`app/(app)/karteikarten-hinzufuegen/vokabeln-hinzufuegen/vokabeln-hinzufuegen-seite.tsx:772`

```ts
setSets(await holeJson<SetZeile[]>("/api/karteikarten"));   // ohne Fallback
```

Schlägt **nach** erfolgreichem Speichern nur dieses Nachladen fehl, landet der
Fehler im `catch`: Formularmeldung „Keine Verbindung zum Server.", obwohl die
Wörter in der Datenbank sind. Der Nutzer wiederholt und erzeugt ein zweites
Set. Randfall, aber die Reihenfolge ist die Ursache.

**Fix:** eigenes `try`/`catch` nur um das Nachladen. Der Erfolg wird gemeldet,
weil einer ist; die Liste zeigt beim nächsten Aufruf den neuen Stand.

Kein `abfall`-Wert: der greift nur bei HTTP-Fehlern, nicht wenn die Verbindung
abbricht — und ein stilles `[]` wäre die schlechtere Täuschung, weil danach
keine eigene Kachel mehr da ist.

**Erledigt und beides gemessen.** Mit Playwright den Abruch des Nachladens
erzwungen (zweiter Aufruf von `/api/karteikarten` wird abgeworfen), vorher
und nachher am laufenden System:

| | alt | neu |
|---|---|---|
| `POST /api/sets` | 201 | 201 |
| `POST /api/karten` | 201 | 201 |
| Anzeige | „Keine Verbindung zum Server." | „Gespeichert" |
| Set in der DB | 1 Karte | 1 Karte |

Alte Fassung: Wort gespeichert, Meldung „Fehler" — die Falle stand wirklich.
Neu: zweimal hintereinander reproduziert, zusätzlich der Normalfall ohne
Abbruch (Set mit 1 Karte, Liste neu geladen). 141 Tests, Lint und Build sauber,
Responsive-Audit 72 Durchläufe ohne Befund.

### 10. `antwort_verbuchen` ist für `anon` ausführbar

`supabase/migrations/014-sets-gelernt-reparieren.sql:73` (gefunden bei Phase 4,
Teil 3 — beim Prüfen der SQL-Pendants zu `lib/lernlogik.ts`)

Die Migration 014 kopiert den Funktionsrumpf von 013, hat aber als einzige
`create or replace function public.antwort_verbuchen` **weder `revoke` noch
`grant`**. In Postgres ist `create or replace` bei geänderter Signatur eine
neue Funktion — und deren Vorgabe ist `EXECUTE TO PUBLIC`. Gegenprobe:

```
select has_function_privilege('anon', p.oid, 'execute') from pg_proc p ...
→ true
proacl → {postgres=X/postgres, anon=X/postgres, authenticated=X/postgres, …}
```

003, 007, 009, 010 und 013 haben jeweils `revoke … from public` /
`grant … to authenticated` mitgeschrieben; 014 fehlt es.

**Warum das trotzdem kein Loch ist** (live gegengeprüft, nicht nur gelesen):
Die Funktion ist `security_definer = false` und beginnt mit
`if v_user is null then raise exception 'Nicht angemeldet.' using errcode =
'42501'`. Ein Aufruf ohne Sitzung kommt nicht zu den Schreibvorgängen, die RLS
greift zusätzlich. Ein anonymer Aufruf liefert genau:

```json
{"code":"42501","message":"Nicht angemeldet."}
```

Es ist damit eine Abweichung von der beabsichtigten Härtung — die Funktion
lässt sich ohne Sitzung aufrufen, statt sofort abzubrechen — und kein
Datenleck. **Fix:** dieselben zwei Zeilen wie in 013 an das Ende von 014 (bzw.
eine neue Migration 015, wenn 014 schon gelaufen ist).

### 11. Toter Code

Vollständig unbenutzt, über den gesamten Importgraph geprüft:

| Datei | |
| --- | --- |
| `lib/mock-*.ts` (4 Dateien) | die alten Mockup-Zahlen: 65/32/48 %, 6777 XP |
| `components/stats/` (Baum, 6 Dateien) | `statistiken-seite.tsx` hat alles selbst gebaut |
| `components/loading-state-div/` | nur vom toten Stats-Baum importiert |
| `components/sprache-auswählen/top-of-page/` (4) | die `page.tsx` darunter sind reine `redirect(...)` |
| `components/navbar/button-element-navbar.tsx` | kein Import |
| 2 CSS-Module | keine Referenz, die `page.tsx` daneben sind Redirects |

Kein Laufzeitrisiko. Aber: Wer `components/stats` reaktiviert, erbt
`xp-pro-tag-pie-chart.tsx:29-30` mit einem Loader, der bei `null` nie endet.

---

## Geprüft und in Ordnung

Damit man nicht nochmal suchen muss:

- **Sessionprüfung** — alle 10 geschützten Routen rufen `mitUserOder401()`
  **vor** dem ersten `.from()`/`.rpc()`. Öffentlich sind nur `/api/gesundheit`
  und `/api/auth/callback`.
- **RLS und Besitzrechte** — konsistent. Fremde Sets ergeben `null`, keine
  Leaks. Views laufen `security_invoker`.
- **Open Redirect** — `lib/weiter-ziel.ts` ist robust: Regex auf Roh- **und**
  dekodiertem Wert, `\\`-Sonderfall, `origin`-Prüfung, `/anmelden`-Ausschluss.
- **API-Format gegen Aufrufer** — alle 12 Routen abgeglichen, keine
  Abweichung.
- **Wochen-/Tages-XP** — UTC durchgängig, Montagsberechnung korrekt.
  `ziel: 20` statt `0` verhindert die 0/0-Balkenfalle.
- **Race Conditions** — 11 von 12 Effekten mit `abgebrochen`-Flag und
  `catch`. Punkt 1 ist der einzige Ausreißer.
- **Typen** — kein `any`, kein `@ts-ignore`, kein `@ts-expect-error`.
- **Platzhalter** — keine hartkodierten UUIDs, E-Mails, Passwörter oder
  Nutzer-IDs im App-Code. `.env` ist korrekt ignoriert.
- **TODO/FIXME/HACK** — keine. „später" und „noch nicht" kommen nur in
  erklärenden Kommentaren oder als UI-Text vor.

---

## Was als Nächstes sinnvoll wäre

Die drei WICHTIG-Punkte sind erledigt, aus den KLEIN-Punkten 4, 5, 8 und 9.
Offen sind die drei KLEIN-Punkte 6, 7 und 10 (dazu 11 toter Code) und diese
drei:

1. **Tests für `lernlogik.ts` und `antwort_verbuchen`.** Die Stufenlogik
   existiert in TypeScript *und* ihre Wirkung in SQL. Das ist genau die Art
   von Doppelung, die beim Ändern einer Seite vergessen wird — und der Grund,
   warum 003 sich so ausführlich zu diesem Punkt äußert. Ohne Tests ist das
   nur eine höfliche Bitte an den nächsten Entwickler.
2. **Versions-Tracking für die Migrationen.** *Erledigt (Phase 4):* die
   Dateien liegen jetzt in `supabase/migrations/`, `scripts/db-migrieren.mjs`
   liest von dort und führt sie über die Management-API aus.
3. **`003b` enthält den Platzhalter `00000000-…`.** Die Datei wirft in diesem
   Zustand absichtlich, aber wer sie später erneut ausführt, ohne die UUID
   einzutragen, hat eine Überraschung.
