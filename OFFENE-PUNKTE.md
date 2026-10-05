# Offene Punkte

Gefunden am 2026-09-27, nach dem Einbau der sieben Anmeldeanbieter.

**Alle elf Punkte sind behoben** (siehe jeweiliger Absatz). Keiner davon stand
im Weg — keiner fiel in einer Testabnahme auf, keiner in einem
Migrationslauf. Jeder Punkt nennt die Datei, den Grund und, wie er erledigt
wurde.

## Kurzfassung

Es gibt **keine Blocker** — keine offene Tür, keine fremden Daten, keine Route
ohne Sessionprüfung. Der Fund war unangenehm, aber solide: drei echte Fehler,
der Rest ist Haltung und Aufräumarbeit.

```
WICHTIG   3   alle drei behoben
KLEIN     8   alle 8 behoben (4, 5, 6, 7, 8, 9, 10, 11)
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

### 6. ~~Zwei bewusste, aber stille Typ-Casts~~ ✅

`app/api/lernen/route.ts:171`, `app/api/lernen/antwort/route.ts:126`

```ts
const roh = (data ?? []) as unknown as RohKarte[];
```

Beide sind begründet und kommentiert. Das Restrisiko ist aber konkret: Bricht
der Alias `fortschritt:` oder ändert sich der RPC-Return, liefert die
Normalisierung stillschweigend `stufe: 0, gelernt: false` — die Karte gilt
als **neu** und wird erneut angeboten, statt als Fehler aufzufallen.

> **Nachtrag bei der Abarbeitung:** Von den beiden genannten Stellen war nur
> noch eine übrig. `antwort/route.ts` wurde seither umgeschrieben und hat
> dort keinen Cast mehr — die Fundstellenliste war veraltet.

**Erledigt** mit `lib/fortschritts-form.ts` (`pruefeRohKarten`), benutzt in
`app/api/lernen/route.ts:258`:

* Der Cast ist weg. Was ankommt, wird geprüft, und im Zweifel wird gemeldet.
* Geprüft wird genau das, woran der Lernstand hängt: `id` ist ein String, und
  eine vorhandene Fortschrittszeile hat eine **numerische `stufe`**. Fehlt das
  Feld oder ist es ein String, ist das ein Fehler im Code und keine neue Karte.
* Der Normalfall bleibt unangetastet: `fortschritt: null`, `undefined` oder ein
  leeres Array bedeutet „nie gesehen" und ist keine Fehlermeldung. Sonst würde
  jedes neue Set als Fehler begrüßt.
* Bewusst *nicht* geprüft werden Nebensachen wie `z_gut`. Ein falscher Wert in
  der Lernreihenfolge ist eine schlechtere Sortierung, kein falscher
  Lernstand. Zu strenge Prüfungen erzeugen nur Lärm, den niemand liest.
* Bei Abweichung: **HTTP 500** mit Grund und Kartenposition, statt einer Runde,
  die falsch aussieht. Das war der ganze Unterschied — vorher bekam der Nutzer
  sein gesamtes Set noch einmal präsentiert und keine Fehlermeldung.

Live am Produktionsbuild, eigenes Set mit einer Karte:

```
vor der Antwort   stufe 0  gelernt false  faellig 2026-10-04
nach „gut"        stufe 1  gelernt false  faellig 2026-10-05
nach Rückgängig   stufe 0  gelernt false  faellig 2026-10-04
```

`tests/fortschritts-form.test.ts` (14 Tests) hält die erlaubten Formen fest.
Gegenprobe: ohne die `stufe`-Prüfung fallen 4 der 14 Tests um, darunter der
wichtigste — eine Zeile ohne `stufe` darf nicht als Stufe 0 durchgehen.

### 7. ~~„Angemeldet bleiben" einschalten löscht die gemerkte E-Mail~~ ✅

`lib/geraet.ts:113-120` — `setzeMerken(true)` schreibt den Eintrag neu, ohne
`alt.email` zu übernehmen. Wer den Schalter in den Einstellungen von nein auf
ja stellt, verliert die vorgemerkte Adresse.

**Erledigt** in zwei Teilen, weil das Auseinanderfallen von Absicht und
Wirkung hier die eigentliche Ursache war:

* `lib/geraet.ts:127` — `setzeMerken(merken: boolean, email?: string)`. Beim
  Ausschalten fällt die Adresse weg (das war schon so und ist gewollt). Beim
  Einschalten wird sie normalisiert übernommen, wenn sie mitkommt.
* `app/(app)/einstellungen/page.tsx:147-166` — `merkenUmschalten` schaltet den
  Eintrag sofort, und **nur beim Einschalten** holt es die Adresse asynchron
  über `auth.getUser()`. Das ist Absicht: die Einstellungsseite wird auch
  geladen, wenn niemand angemeldet ist, und das Nachpflegen gehört nicht in
  einen Klick, der sofort.localStorage schreiben soll.

Live geprüft mit zwei vollständigen Zyklen (Anmelden → ein → aus → ein →
Abmelden): die Adresse kommt nach jedem Einschalten zurück und ist nach dem
Abmelden weg. `tests/geraet.test.ts` deckt beide Richtungen ab (10 Tests); mit
dem alten Rumpf schlägt der Test fehl, mit dem neuen nicht.

> **Nachtrag: einer dieser Tests war Flakes und hat einen echten Fehler
> verdeckt.** „Einschalten haelt den alten Zeitstempel" fiel in 2 von 30
> Läufen durch. Ursache: `setzeMerken(false)` schrieb `{ v: 1, merken: false }`
> und **warf dabei `zuletztAngemeldet` weg**; beim wieder Einschalten ersetzte
> `Date.now()` es. Der Test verglich beide Werte und bestand nur, wenn die
> drei Aufrufe in derselben Millisekunde passierten — also meistens, und nie
> zuverlässig.
>
> Das Verhalten ist älter als Punkt 7 (`bdddb5a` hat es nur umgebogen, nicht
> eingebaut). Der **Test** hatte recht und der **Code** unrecht: Der Schalter
> beendet die Anmeldung nicht — er ist kein Login. Ein erfundener Zeitstempel
> heißt „angemeldet vor eben", und alles, was daraus einmal eine Sitzungsdauer
> ableitet, rechnet mit einem Alter, das es nicht gibt. `setzeMerken(false)`
> löscht deshalb weiter die Adresse, behält aber den Zeitstempel.
> `vergissAnmeldung()` bleibt der Ort, der alles löscht — wer sich abmeldet,
> hat die Anmeldung wirklich beendet.
>
> Und der Test prüft jetzt überhaupt etwas: `Date.now` ist darin ersetzt, damit
> die Uhr garantiert weiterläuft. Gegenprobe: ohne den Fix **10 von 10** rot,
> mit dem Fix **20 von 20** grün, Suite dreimal hintereinander 173/173.
>
> *Randnotiz:* `zuletztAngemeldet` wird derzeit nirgends **gelesen**, nur
> geschrieben. Die Semantik ist damit nicht falsch, nur ungenutzt — die
> Entscheidung, was damit geschehen soll, gehört an die Stelle, an der etwas
> es liest.

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

### 10. ~~`antwort_verbuchen` ist für `anon` ausführbar~~ ✅

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

**Warum das trotzdem kein Loch war** (live gegengeprüft, nicht nur gelesen):
Die Funktion ist `security_definer = false` und beginnt mit
`if v_user is null then raise exception 'Nicht angemeldet.' using errcode =
'42501'`. Ein Aufruf ohne Sitzung kommt nicht zu den Schreibvorgängen, die RLS
greift zusätzlich. Ein anonymer Aufruf lieferte genau:

```json
{"code":"42501","message":"Nicht angemeldet."}
```

Es war damit eine Abweichung von der beabsichtigten Härtung und kein
Datenleck.

#### Beim Reparieren kam der eigentliche Fehler heraus

Migration **015** (`supabase/migrations/015-antwort-verbuchen-rechte.sql`)
`revoke`t beiden Funktionen — `antwort_verbuchen` **und**
`antwort_rueckgaengig`, denn beide hatten dieselbe direkte `anon`-Vergabe —
und `grant`t sie `authenticated`. Live danach:

```
antwort_verbuchen    anon=false  authenticated=true
antwort_rueckgaengig anon=false  authenticated=true
anonym aufgerufen → 42501 permission denied for function antwort_verbuchen
```

Beim anschließenden Testen des Rückgängig-Pfades antwortete
`/api/lernen/antwort/rueckgaengig` dauerhaft mit `erledigt: false`. Das ist
**kein** Rechtefehler — die Funktion lief, sie fand nur keinen Snapshot, weil
sie nie einen bekam. Ursache: In der Produktionsdatenbank war nie eine
Migration nach 010 vollständig angekommen. Belegt über die Merkmale jeder
Migration:

| Migration | Merkmal | live |
| --- | --- | --- |
| 008–012 | `push_abonnements`, `antwort_rueckgaengig`, `z_nochmal`, Beispielsatz-Cache | da |
| 013 | `update xp_events set ziel = 100` | Datenupdate **da**, Funktionsersetzung **nein** (Funktion schrieb `ziel = 20`) |
| 014 | Tabelle `xp_tag_sets` + Bestandsrückübertragung | **da**, Funktionsersetzung und View **nein** |

Die Anweisungen waren also jeweils bis zur Funktionsdefinition gelaufen und
dort abgebrochen — die Datei als Ganzes war nie durch. Zwei Konsequenzen, die
der Plan als „erledigt" führt, waren live nie in Kraft:

* **Rückgängig hat nie funktioniert.** `antwort_verbuchen` schrieb keinen
  Snapshot in `letzte_antwort`, also hatte `antwort_rueckgaengig` nichts zum
  Zurücksetzen und meldete jedes Mal „nichts rückgängig".
* **Tagesziel und `sets_gelernt` waren falsch.** Die Funktion schrieb 20 statt
  100, und `mein_fortschritt.sets_gelernt` zählte die Sets des Tages über das
  Ein-Set-pro-Tag-Gedächtnis `xp_events` — wer an einem Tag zwei Sprachen
  lernte, sah eines weniger.

013 und 014 nachgelaufen. Live gegengeprüft, mit Testkonto:

```
Antwort „gut"        → xpGesamt 15, xpGespeichert true
Rückgängig           → erledigt true, xpGesamt 10
zweites Set heute    → setsGelernt 2   (vorher wäre 1 gewesen)
karten_fortschritt   → 1 Zeile mit Snapshot (die zurückgenommene Zeile
                       wurde gelöscht, wie vorhanden_vorher=false vorsieht)
xp_tag_sets          → 2 Zeilen, eine je (Tag, Set)
```

Damit stimmt die Datenbank mit dem überein, was `LEXIO-PLAN.md` seit Phase 3
behauptet.

#### Nebenbei gefunden: der Migrationsrunner ist nicht idempotent

`supabase/migrations/014-…sql` hat die Bestandsrückübertragung ohne
`on conflict` — ein zweiter Lauf scheitert am Primärschlüssel. Da das Projekt
keine Tabelle mit angewandten Migrationen hat und jede Datei von Hand läuft,
wurde `on conflict (user_id, datum, set_id) do nothing` ergänzt. `do nothing`
statt `do update`, weil Zeilen aus echten Antworten nicht vom alten
Tageswert überschrieben werden dürfen.

Und: `scripts/db-migrieren.mjs` hat eine fest verdrahtete Standardliste
(`STAND`, 003–007) und liest nicht das Verzeichnis, auch wenn die
Dokumentation das nahelegt. Deshalb wurde 013/014 ausdrücklich übergeben.

#### Und ein Test, der auf die falsche Datei schaute

`tests/sql-paritaet.test.ts` nimmt die **letzte Datei, die den Funktionsnamen
enthält** — seit 015 war das die Rechte-Migration, und die Tests prüften
`revoke`-Zeilen gegen eine Bewertungsliste. Der Helper sucht jetzt echte
`create [or replace] function`-Blöcke und liefert den Rumpf. Gegenprobe: mit
absichtlich kaputter Bewertungsliste (`'einfach'` → `'leicht'`) schlägt der
Test wieder fehl, mit der richtigen Liste nicht.

### 11. ~~Toter Code~~ ✅

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

> **Nachtrag bei der Abarbeitung:** Außer der Tabelle gab es nur noch eine
> Stelle, und die stand in keiner Liste: Fast alles hiervon ist bereits
> entfernt — Commit `4a6d61c` („Phase 4: toten Code entfernen") hat die
> Mock-Dateien, den Stats-Baum und die ungenutzten Bausteine gelöscht. Die
> Tabelle oben beschrieb einen Stand, den es nicht mehr gab.

**Gefunden und gelöscht:** `app/(app)/karteikarten-hinzufuegen/page.module.css`
(110 Zeilen). Der Ordner hat nur noch ein `page.tsx`, das auf
`/karteikarten-hinzufuegen/vokabeln-hinzufuegen` umleitet und außer
`next/navigation` nichts importiert. Keine einzige Klasse der Datei kommt
sonstwo im Projekt vor — der Ein-Schritt-Bildschirm hat seinen eigenen
Aufbau. Eine Datei, die niemand laden kann, wieder zu löschen ist die
billigste Aufräumarbeit, die es gibt.

**Gegenprobe:** `npm run toter-code` — `scripts/toten-code.mjs`, das alle
versionierten Dateien prüft und beim ersten Fund mit exit 1 endet. Es sucht
nach dem Basisnamen ohne Endung, weil ein CSS-Modul über `./name.module.css`
importiert wird und nie über seinen Ordner.

> **Der erste Lauf dieses Skripts hat zwei weitere Leichen gefunden — und damit
> den ersten Scan widerlegt.** Dort stand „Ergebnis: nichts", und das war
> falsch. Übersehen worden waren
> `app/(app)/karteikarten-hinzufuegen/sprache-auswählen/sprachen-auswählen-seite.module.css`
> und ihr Zwillings unter `app/karteikarten-hinzufuegen/` (ohne Route-Gruppe,
> ohne jede `page.tsx`, also selbst keine Route). Beide enthielten dieselben
> zwei Debug-Klassen — `background-color: blue`, `red`, `height: 100vh`,
> `gap: 100px` — und **keine wurde irgendwo importiert**.
>
> **Warum der erste Scan sie übersehen hat:** Er lief über `git ls-files`, und
> git maskiert Pfade mit Nicht-ASCII-Zeichen als `\303\244`. Gesucht wurde
> nach dem unmaskierten Namen, verglichen wurde die maskierte Form. Ein Scan,
> der seine eigenen Eingabedateien nicht sieht, findet nichts und meldet
> Erfolg. Beide Dateien sind gelöscht, und der Ordner
> `app/karteikarten-hinzufuegen/` war danach leer und ist mit verschwunden.
>
> Gegenprobe gegen genau diesen Fehler: eine leere Datei
> `app/(app)/prüfordner/prüfdatei-mit-ü.css` angelegt → **gefunden**, exit 1.
> Danach entfernt. `.vscode/` und die Datenkörper in `scripts/wortlisten/`
> sind getrennt geführt: die CSV-Exporte werden nie von einer Datei
> referenziert und sind trotzdem kein toter Code.

**Nebenbefund, jetzt behoben:** `/karteikarten-hinzufuegen/sprache-auswählen`
lieferte **404**, obwohl dort eine `page.tsx` mit `redirect()` lag und Next die
Route im Manifest führte. Ursache ist Next 16.3.4 selbst: **der App Router
findet keine Route, deren Pfadsegment Nicht-ASCII-Zeichen enthält** — und
`redirects()` in `next.config.ts` ebenso wenig.

Nachgewiesen mit zwei Seiten, die bis auf den Ordnernamen identisch waren:
`/probe/ascii-redirect` → 307, `/prüfung/ascii-redirect` → 404. Also nicht am
`redirect()` gelegen, und `next dev` verhält sich wie `next start`. Zur Grenze
der Messung: Next *kann* Nicht-ASCII-URLen ausliefern (Bilddatei aus `public/`
mit Umlauten: 200), und der `proxy` läuft vor der Routenzuordnung und kann sie
umleiten (308). „Geht im Framework nicht" gilt also nur für die Zuordnung.

Der Ordner ist gelöscht — die Adresse liefert vorher wie nachher 404, sie hat
nie funktioniert, und für eine URL, die es nie gab, baut man keine
Proxy-Maschinerie. Die Regel steht jetzt als Test da:
`tests/routen-ascii.test.ts` verbietet Umlaute in Ordnern unter `app/` **und**
in `redirects()`-Quellen. Gegenproben: `app/(app)/probe-ü/` angelegt → rot,
`source: "/mit-ü"` eingebaut → rot. Beide zurückgebaut.

> **Warum das ein Test sein muss und kein Kommentar.** Der Build zeigt den
> Fehler nicht: Next führt einen Umlaut-Ordner fröhlich im Routenmanifest, erst
> die Anfrage liefert 404. Wer nicht misst, hält die Seite für erreichbar und
> legt einen toten Link darauf.

---

## Nachtrag 2026-10-04 — was die Behebung von Punkt 10 aufgedeckt hat

Beim Prüfen der Migrationen (also beim Versuch, „läuft sie?" überhaupt zu
beantworten) kam ein zweiter Fund heraus, der nichts mit den Punkten 4 bis 11 zu
tun hat und trotzdem Produktionsdaten betrifft.

**Migration 011 ist eine Falle.** Sie löscht drei Demo-Sets per Slug, darunter
`englisch-grundlagen`. Dieser Slug trägt heute die kuratierte Wortliste
`ngsl-top100` mit **100 echten Karten** — importiert am 2026-10-04 mit
`scripts/wortlisten-importieren.mjs`. Die Bedingung der Datei ist
`user_id is null`, und genau das haben die Wortlisten auch. Ein erneuter Lauf
würde 100 Karten samt Lernstand löschen.

Belegt und nicht vermutet: `italienisch-urlaub` und `spanisch-alltag` sind
weg, `englisch-grundlagen` steht mit seinen 100 Karten. Der heutige Zustand
ist richtig — die Datei ist nur historisch und darf nicht wieder laufen.

> **Ein Kommentar ersetzt keine Sperre.** Also: 011 hat jetzt eine
> **Löschsperre im Code** (Stand 2026-10-04). Ein Set wird nur noch gelöscht,
> wenn *jede* seiner Karten dem Platzhalter-Muster `Frage n`/`Antwort n`
> entspricht — also der Invariante, die diese Migration ohnehin meint. Nicht
> als Slug-Sperre (`not in` mit den fünf Wortlisten): die müsste bei jedem Import
> nachgezogen werden und schützt keine sechste, die morgen kommt. Und die
> Fehlrichtung ist die harmlose: zu streng gefasst wird nichts gelöscht und man
> merkt es an der Kontrolle am Dateiende; zu weit gefasst verschwinden
> Wortlisten.
>
> Zwei Gegenproben, beide live und ohne etwas zu löschen:
>
> - echter Datensatz: `englisch-grundlagen` mit 100 Karten → **würde nicht**
>   gelöscht
> - Logiktest an synthetischen Daten: echter Platzhalter → gelöscht;
>   fast-Platzhalter mit *einer* echten Karte → bleibt; Wortliste → bleibt;
>   leeres Set → gelöscht
>
> `scripts/db-pruefen.mjs` prüft für 011 trotzdem **nur** die beiden echten
> Platzhalter: hätte es `englisch-grundlagen` mitgeprüft, hätte es „fehlt"
> gemeldet — und die naheliegende Reaktion auf „fehlt" wäre
> `npm run db:migrieren -- 011`. Eine Prüfung, die zum Löschen von
> Produktionsdaten auffordert, ist schlimmer als keine.

Daraus folgt der Kern des Skripts: **es prüft Merkmale, keine Dateinamen**, und
es verweigert den Dienst, wenn eine Datei ohne Eintrag dazukommt. Was beim
Bau dieser Liste auffiel: die Marker mussten einzeln gegen die echte Datenbank
geprüft werden. Zwei meiner ersten Versuche waren falsch — die Karten-Tabelle
heißt `karten` und nicht `karteikarten`, und für 011 hätte ich fast das
falsche Merkmal genommen. Eine Merkmalsliste, die man nicht gegen die Datenbank
verifiziert, ist nur eine andere Behauptung.

## Nachtrag 2026-10-05 — beim Prüfen des Dublettenschutzes gefunden

Beim Testen von „doppelte Paare werden abgelehnt" (siehe Punkt 5) hing das
Formular nach dem ersten Speichern fest. Knopf auf **„Speichert…"**, dauerhaft
`disabled`, und **kein einziger Request** ging raus — der Server bekam nichts zu
sehen. Betroffen war jede weitere Karte, nicht nur doppelte: auch ein gültiges
„Fisch/fish" blieb hängen.

Ursache: `status` wird nach dem Erfolg nicht zurückgesetzt. Der Erfolgsbildschirm
zeigt den Speichern-Knopf nicht, der Zustand lebt aber weiter. „Noch mehr Wörter"
führt zurück in die Eingabe, wo derselbe Zustand den Knopf sperrt — und
`speichern()` steigt über ihre erste Zeile sofort aus:

```ts
if (status === "speichert" || gefuelltePaare.length === 0) return;
```

Behoben im Erfolgszweig von `speichern()` (`setStatus("idle")` nach `setFertig`),
mit `tests/hinzufuegen-status.test.ts` als Regressionstest.

Bemerkenswert an der Suche: Es sah aus wie ein Fehler des neuen Dublettenschutzes
und war es nicht. Zwei Dinge haben in die Irre geführt, beide überzeugend
plausibel:

- Ein `pkill -f "next-server"` hat die eigene Shell mitgetroffen, weil das Muster
  in ihrer Kommandozeile stand. Der Befehl lief ins Zeitlimit und lieferte
  keinerlei Ausgabe — nach einem Timeout ist das erst einmal kein Beweis für
  irgendeine Ursache.
- `ss -tn | grep 3000` zeigte keine Verbindung, was nach „der Request ist
  abgeschickt und hängt" aussah. Die Gegenprobe im Proxy auf Port 3002 zeigte
  die Wahrheit: es war **nie** ein Request rausgegangen.

Die eigentliche Diagnose war dann billig: **ein gültiges Paar statt eines
doppelten** testen. Damit fiel sofort auf, dass es nicht am Dublettenschutz
liegen konnte — der Hänger war älter als die Änderung, die ihn ausgelöst zu
haben schien.

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

Alle elf Punkte sind erledigt. Was bleibt, ist Arbeit, die keine Korrektur
an bestehendem Code ist, sondern Absicherung:

1. **Prüfen, welche Migrationen wirklich in der Datenbank stehen.** Erledigt
   ist die *eine* Stichprobe aus Punkt 10 — und die hat gezeigt, dass 013 und
   014 in Produktion nie fertig angekommen sind, obwohl der Plan sie als
   abgehakt führt. Es gibt keine Tabelle mit angewandten Migrationen, also
   ist „läuft" nur am Merkmal erkennbar. Ein `npm run db:status`, das alle
   Migrationen nacheinander prüft, wäre die Abhilfe.
2. **Tests für `lernlogik.ts` und `antwort_verbuchen`.** *Erledigt (Phase 4):*
   `tests/sql-paritaet.test.ts` vergleicht Bewertungsliste und Zähler der
   jeweils letzten Funktionsdefinition mit den TypeScript-Konstanten. Genau
   der Test hat beim Reparieren von Punkt 10 zuerst gegen die falsche Datei
   geschaut — die Sache existiert also, sie muss nur auf die richtige Quelle
   zeigen.
3. **Versions-Tracking für die Migrationen.** *Teilweise erledigt (Phase 4):*
   die Dateien liegen in `supabase/migrations/` und werden über die
   Management-API ausgeführt. **Erledigt am 2026-10-04, und es war schlimmer
   als notiert:** `scripts/db-migrieren.mjs` führte nicht nur „nur die genannten
   Dateien" aus, sondern **fünf von fünfzehn** — eine fest verdrahtete Konstante
   `STAND` mit 003 bis 007. `npm run db:migrieren` ohne Argumente meldete danach
   „Alle Dateien gelaufen", darunter wäre 015 nie gelaufen, die Rechte-Reparatur
   aus Punkt 10. Nachgewiesen mit `--trocken`.
   Das Skript liest jetzt das Verzeichnis und fragt die Datenbank, statt zu
   raten: `scripts/migrationen.mjs` hält Verzeichnis und Merkmalsproben
   gemeinsam, `db:migrieren.mjs` führt nur aus, was nachweislich fehlt, verweigert
   Dateien ohne Probe und meldet eine abgebrochene Messung als unbekannt
   statt als erledigt. Sieben Tests in `tests/migrationen.test.ts`.
   **Offen bleibt:** es gibt weiterhin keine Tabelle angewandter Migrationen —
   014 war nur nach einem `on conflict` wiederholbar, und das ist von Hand
   entstanden. Gemessen statt gespeichert ist besser als geraten, aber kein
   Verlauf.
4. **`003b` — erledigt, und zwar durch Unschädlichmachen.**
5. **Der Wortlisten-Import legt doppelte Karten an — und der Kommentar im
   Skript behauptet, er verhindere genau das.** Gefunden am 2026-10-04 durch
   eine Gegenprobe, nicht durch Lesen: eine Probedatei mit sechs Einträgen,
   davon einer doppelt, und das Skript meldete „6 Karten".

   Der `NOT EXISTS`-Block im SQL vergleicht `lower(k.antwort)` mit dem, was
   schon in der Datenbank steht — und sieht die Zeilen **nicht**, die sein
   eigenes Statement gerade einfügt. Postgres wertet gegen den Zustand *vor*
   dem Statement aus. Die Sperre wirkt also über Läufe hinweg, nicht innerhalb
   einer Datei. Dasselbe Statement im Kommentar darüber:

   > Der Schluessel ist die englische Seite, nicht das Paar aus beiden Seiten.
   > … das Set wuchs von 100 auf 127 Karten – jede doppelt

   Genau dieser Fall ist die Lücke, und `public.karten` fängt nichts auf:
   geprüft in `pg_constraint` und `pg_indexes`, es gibt außer
   `karten_pkey (id)` **keine** Eindeutigkeitsbedingung.

   > **Erledigt.** `dateiBefund()` in `scripts/wortlisten-importieren.mjs` prüft
   > die Datei **vor** dem Schreiben auf doppelte Paare (Groß-/Kleinschreibung
   > und Randleerzeichen mit) und bricht mit exit 1 ab. Das ist die einzige
   > Stelle, an der noch nichts in der Datenbank passiert ist. Live belegt:
   > Gegenprobe exit 1 und `karteikarten_sets`/`karten` unverändert bei 5/2275;
   > grüner Weg mit `ngsl-top100.json` exit 0 und 100/100. Acht Tests in
   > `tests/wortlisten-mengen.test.ts`. Nebenbei die versprochene, aber nie
   > vorhandene Mengenprüfung eingebaut (`Die Mengengleichheit pruefen wir
   > abschliessend` — Tat: Zahl aus der Datenbank gedruckt).

   **Offen, weil es eine Produktentscheidung ist, nicht ein Fehler:**
   Der Import fasst auf der **englischen Seite** zusammen. „Köter" und „Hund"
   bedeuten beide „dog" — zwei woertlich verschiedene Karten, von denen der
   Import stillschweigend eine wegwirft. Ob das gewollt ist, entscheidet der
   Nutzer.

   Die zweite Hälfte ist erledigt. `POST /api/karten` und `PATCH
   /api/karten/{id}` lehnen ein Wortpaar jetzt ab, das im Set schon steht —
   getrimmt und ohne Beachtung der Groß-/Kleinschreibung, gegen den Bestand
   und gegen den eigenen Stapel. Die Ablehnung nennt das betroffene Feld
   (`frage` bzw. `frage.N`), sodass der Formularzeile eine sichtbare Meldung
   folgt: *„Pferd / horse" steht schon in diesem Set*. Beides am laufenden
   System über ein Wegwerf-Konto geprüft, sowohl im Formular als auch gegen
   die Datenbank. Der Bestand des Testsets blieb dabei unverändert.

   `englisch-testlauf` hatte zwei überzählige Karten (*dog/Hund* und
   *cat/Katze*). Sie sind entfernt, das Set hat 5 statt 7 Karten, an keiner
   davon hing Fortschritt. Der Nutzer hat die Bereinigung ausdrücklich
   freigegeben.

   **Nicht gelöst, weil es eine Entscheidung ist:** die Prüfung läuft in der
   Route, nicht in der Datenbank. Zwei gleichzeitig eingehende Anfragen können
   sich zwischen Prüfung und Schreiben noch ins Gehege kommen. Eine
   Eindeutigkeit je Set wäre die saubere Gegenmassnahme und braucht eine
   Migration plus die Entscheidung, was mit den bestehenden Sets passiert.
   Eine SET-Variante auf Basis normalisierter Paare wäre über einen Ausdruck
   möglich und würde ohne Datenbereinigung auskommen, weil global keine
   Dublette innerhalb eines Sets existiert — sie müsste nur wieder entfernt
   werden, sobald die App Zugriff bekommt.

   Nebenbefund derselben Messung, unkritisch: vier Sets haben
   `anzahl_karten = 0`, obwohl sie Karten enthalten. Kein Fehler — die Anzeige
   nutzt `karten_gesamt`, und `zielKarten` hat gar keinen Leser. Die
   Migrationen 005 und 006 halten die Unzuverlässigkeit der Spalte bereits
   fest. *Stand 2026-10-04:*
   Die Datei enthielt nicht mehr den Platzhalter, sondern die echte Konto-ID
   eines echten Kontos. Ausgeführt hätte sie **5 Wortlisten mit 2.275 Karten**
   getroffen, davon **0 mit Fortschritt** — und für jede Karte `gesehen = true`
   gesetzt, also 2.269 neue Zeilen in einem Konto, das sie nicht kennt. Nichts
   gerettet, etwas erfunden. Der Rumpf ist jetzt eine `raise notice`, die genau
   das erklärt; ausgeführt und gegengeprüft (läuft fehlerfrei, `karten_fortschritt`
   bleibt bei 12 Zeilen, davon 6 aus Wortlisten). Die Konto-ID steht nicht mehr im
   Text.
