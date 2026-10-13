-- Eindeutigkeit je Set auf dem normalisierten Wortpaar.
--
-- Warum die Datenbank das tun muss und nicht nur die Route
-- -------------------------------------------------------
-- `POST`/`PATCH /api/karten` prüft vor dem Schreiben, ob das Paar schon im Set
-- steht (lib/karten-duplikat.ts). Das deckt den Normalfall ab, aber nicht zwei
-- Anfragen, die gleichzeitig dieselbe Prüfung bestehen: beide sehen denselben
-- Bestand, beide schreiben, und danach steht das Paar zweimal da. Genau diese
-- Lücke wurde am 2026-10-04 im Testset `englisch-testlauf` sichtbar; damals
-- schloss sie nur der Zufall, dass die Anfragen nacheinander kamen.
--
-- Die Bedingung bildet den Vergleich der Route nach: getrimmt (`btrim`), ohne
-- Gross-/Kleinschreibung (`lower`), auf beiden Seiten. „Hund"/„hund" und
-- „ Hund " sind dieselbe Karte.
--
-- Vor dem Anlegen gemessen (2026-10-11): 2286 Karten in 9 Sets, keine Dublette
-- je Set unter diesem Schlüssel, keine NULL-Werte, keine Randleerzeichen. Die
-- Bedingung greift also, ohne dass Bestandsdaten bereinigt werden müssen.
--
-- Der Import (scripts/wortlisten-importieren.mjs) bleibt verträglich: er fügt
-- nur ein, was englischseitig fehlt, und ein solches Paar ist damit ebenfalls
-- neu — er kann die Bedingung nicht auslösen.

create unique index if not exists karten_set_paar_idx
  on public.karten (set_id, lower(btrim(frage)), lower(btrim(antwort)));
