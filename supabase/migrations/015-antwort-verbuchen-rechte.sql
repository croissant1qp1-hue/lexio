-- =============================================================================
-- 015: Die Antwort-Funktionen wieder dicht machen (OFFENE-PUNKTE.md Punkt 10)
--
-- Ausgangspunkt war die Notiz "014 hat beim Erzeugen von
-- public.antwort_verbuchen die Rechte vergessen". Gemessen und korrigiert:
--
--   1. Es sind zwei Funktionen, nicht eine. antwort_rueckgaengig hat denselben
--      Aufbau (auth.uid(), Abbruch bei fehlender Sitzung) und dieselbe Lücke.
--
--   2. "revoke ... from public" haette nicht geholfen – auch nicht in 003,
--      007, 009, 010 und 013, die es alle mitgeschrieben haben. Supabase
--      traegt in pg_default_acl ein, dass JEDE neue Funktion im Schema public
--      direkt an anon und authenticated bekommt:
--
--        rolle  | typ | acl
--        -------+-----+---------------------------------------------
--        postgres | f | {postgres=X,anon=X,authenticated=X,service_role=X}
--
--      Das Recht haengt also an der Rolle anon selbst, nicht an PUBLIC. Ein
--      revoke auf public laesst es unberuehrt. Gemessen vor dem Lauf:
--
--        has_function_privilege('anon', oid, 'execute') → true
--
--      Deshalb steht unten 'anon' ausdruecklich beim revoke. Das ist der
--      Unterschied zu den vorherigen Migrationen, und der Grund, warum deren
--      Zeilen bisher nichts bewirkt haben.
--
-- Warum es kein Datenleck war: Beide Funktionen sind security_invoker und
-- beginnen mit
--
--   if v_user is null then
--     raise exception 'Nicht angemeldet.' using errcode = '42501';
--
-- Ein Aufruf ohne Sitzung kam also nicht an die Schreibvorgaenge, die RLS
-- greift zusaetzlich. Gemessen als anon, vor diesem Lauf:
--
--   POST /rest/v1/rpc/antwort_verbuchen → {"code":"42501","message":"Nicht angemeldet."}
--
-- Behoben wird damit die Abweichung von der beabsichtigten Haertung: die
-- Funktionen liessen sich ohne Sitzung aufrufen, statt sofort abzubrechen.
--
-- Kein Funktionsrumpf wird angefasst, nur die Rechte. Reihenfolge: 015 laeuft
-- NACH 013 und 014. Ein revoke auf eine nicht vorhandene Funktion bricht mit
-- 42883 ab (gemessen), es laeuft also nicht ins Leere — auf einer Datenbank,
-- auf der 013/014 nie durchgekommen sind, meldet diese Datei einen Fehler
-- und nicht etwa "nichts zu tun".
-- =============================================================================

revoke execute on function public.antwort_verbuchen(
  uuid, uuid, text, integer, boolean, date, integer, boolean
) from public, anon;

revoke execute on function public.antwort_rueckgaengig(
  uuid
) from public, anon;

grant execute on function public.antwort_verbuchen(
  uuid, uuid, text, integer, boolean, date, integer, boolean
) to authenticated;

grant execute on function public.antwort_rueckgaengig(
  uuid
) to authenticated;

-- Sichtpruefung, dieselbe Abfrage wie im Kopf. Nach dem Lauf muss fuer beide
-- gelten: anon_darf = false, angemeldet_darf = true.
--
--   proname             | anon_darf | angemeldet_darf
--   --------------------+-----------+-----------------
--   antwort_verbuchen   | false     | true
--   antwort_rueckgaengig| false     | true