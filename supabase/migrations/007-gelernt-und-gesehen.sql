-- =============================================================================
-- 007 – gelernt ehrlich definieren, gesehen einführen
--
-- Erst NACH 006 ausführen. 006 stellt die Views auf sprache_code um; diese
-- Datei ändert die Bedeutung von gelernt und baut beide Views erneut.
--
-- Worum es hier geht
-- -----------------
-- Bisher war gelernt der merkwürdige Kompromiss aus "bewertung und nochmal":
--   gelernt = p_bewertung <> 'nochmal'  (app/api/lernen/antwort/route.ts:84)
-- Eine mit "schwer" beantwortete Karte galt damit als gelernt, stand aber auf
-- Stufe 0 und ist heute noch fällig. Der Fortschrittsbalken zeigte "gesehen"
-- und benannte es "kannt" (LEXIO-PLAN.md B4 und 1.5).
--
-- Was diese Datei ändert
-- ----------------------
--   1. Neue Spalte gesehen in public.karten_fortschritt. Sie bekommt der
--      Beantwortung folgend true – eine Karte zählt ab dem Moment, in dem
--      sie überhaupt beantwortet wurde. gelernt bleibt davon getrennt.
--   2. gelernt bekommt seine ehrliche Bedeutung: true ab Stufe 2.
--      StufeNachAntwort in lib/lernlogik.ts gibt Stufe 1 schon nach einem
--      "gut" – das ist noch nicht "gekonnt". Erst Stufe 2 (ein "gut" plus
--      ein weiteres "gut" oder "einfach") bedeutet, dass die Karte sitzt.
--   3. Bestand: bestehende Zeilen werden nachgerechnet. gesehen = true für
--      jede, die überhaupt existiert (sie entstand durch eine Antwort), und
--      gelernt = (stufe >= 2).
--   4. antwort_verbuchen bekommt einen neuen Parameter p_gesehen und schreibt
--      beide Spalten: gesehen immer, und gelernt nach der ehrlichen Regel.
--      Treffer und Fehler bleiben an p_gelernt gekoppelt – sie zählen, ob die
--      Antwort richtig war (Bewertung), nicht ob die Karte dadurch "gelernt"
--      wurde. Eine Karte, die auf Stufe 0 mit "nochmal" beantwortet wird,
--      bleibt unverändert ein Fehler.
--   5. Beide Views zählen künftig zusätzlich, was gesehen wurde:
--      karteikarten_sets_uebersicht.karten_gesehen und
--      statistik_pro_sprache.gesehen. Die alten Zähler bleiben erhalten.
--
-- Was hier bewusst NICHT passiert
-- -------------------------------
--   - gelernt wird nicht gelöscht: beide Views lesen es weiter für den
--     Fortschrittsbalken. Die App zeigt mit der neuen Definition denselben
--     Balken wie bisher – nur dass er jetzt die Wahrheit sagt.
--   - An einer Stelle bleibt die Definition doppelt: lib/lernlogik.ts rechnet
--     die Stufe, und diese Datei legt die Grenze "gelernt ab Stufe 2" fest.
--     Das ist Absicht und im Projekt schon einmal so dokumentiert: die Stufen-
--     logik gehört nach lib/lernlogik.ts, und die Schwelle zu "gelernt" gehört
--     in die Migration, weil sie ein Datenbankzustand ist.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Neue Spalte gesehen
-- -----------------------------------------------------------------------------

alter table public.karten_fortschritt
  add column if not exists gesehen boolean not null default false;

-- -----------------------------------------------------------------------------
-- 2. Bestand nachrechnen
-- -----------------------------------------------------------------------------
-- Jede existierende Zeile entstand durch mindestens eine Antwort – also ist
-- die Karte gesehen. gelernt wird nach der neuen Regel gesetzt: eine Karte
-- gilt als gelernt, wenn ihre Stufe mindestens 2 ist.

update public.karten_fortschritt
   set gesehen = true,
       gelernt = (stufe >= 2);

-- -----------------------------------------------------------------------------
-- 3. Funktion antwort_verbuchen ersetzen
-- -----------------------------------------------------------------------------
-- Neue Signatur: der Parameter p_gesehen kommt hinten dazu. create or replace
-- kann eine Signatur nicht ändern, deshalb wird die alte Funktion zuerst
-- verworfen – sonst bliebe der alte Aufrufer (ohne p_gesehen) gültig und
-- würde die Spalte nie füllen. Danach baut diese Datei die Funktion identisch
-- zu 003 wieder auf, nur mit gesehen.

drop function if exists public.antwort_verbuchen(
  uuid, uuid, text, integer, boolean, date, integer
);

create or replace function public.antwort_verbuchen (
  p_karte_id    uuid,
  p_set_id      uuid,
  p_bewertung   text,
  p_neue_stufe  integer,
  p_gelernt     boolean,
  p_faellig_am  date,
  p_xp          integer,
  p_gesehen     boolean
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_ganz bigint;
begin
  if v_user is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  if p_bewertung not in ('nochmal', 'schwer', 'gut', 'einfach') then
    raise exception 'Unbekannte Bewertung: %', p_bewertung using errcode = '22023';
  end if;

  /*
   * Die Karte muss zu einem Set gehoeren, das diese Person sehen darf.
   * Die EXISTS-Abfrage laeuft mit den Rechten der aufrufenden Rolle, greift
   * also die Policy auf karteikarten_sets: ein fremdes privates Set liefert
   * false, ein Demoset true, ein nicht existierendes false.
   */
  if not exists (
    select 1
    from public.karten k
    join public.karteikarten_sets s on s.id = k.set_id
    where k.id = p_karte_id
      and k.set_id = p_set_id
      and (s.user_id is null or s.user_id = v_user)
  ) then
    raise exception 'Karte nicht gefunden.' using errcode = 'P0002';
  end if;

  /*
   * Fortschritt. on conflict do update statt vorherigem Lesen und dann
   * Schreiben: das Lesen und das Schreiben einer Zeile, die zwischen zwei
   * Karten im selben Set angefasst werden koennte, sind ohne Sperre nicht
   * konsistent. Treffer und Fehler werden im UPDATE aus dem bestehenden Wert
   * berechnet, nicht aus einem vorher gelesenen – sonst wuerde der zweite
   * Klick die Zaehlung des ersten ueberschreiben.
   *
   * gesehen und gelernt sind zwei verschiedene Dinge: gesehen zaehlt, sobald
   * die Karte ueberhaupt beantwortet wurde (auch "nochmal"), gelernt erst ab
   * Stufe 2. Treffer und Fehler haengen an der Bewertung, nicht am Lernstand:
   * "schwer" ist eine richtige Antwort und bleibt ein Treffer, auch wenn die
   * Karte auf Stufe 0 stehen bleibt. Sonst wuerde die Leech-Statistik aus 1.7
   * Karten als Fehler zaehlen, die nur nicht aufgestiegen sind.
   */
  insert into public.karten_fortschritt
    (karte_id, user_id, stufe, gelernt, gesehen, faellig_am, treffer, fehler, letzte_wiederholung)
  values
    (p_karte_id, v_user, p_neue_stufe, p_gelernt, p_gesehen, p_faellig_am,
     case when p_bewertung = 'nochmal' then 0 else 1 end,
     case when p_bewertung = 'nochmal' then 1 else 0 end,
     now())
  on conflict (karte_id, user_id) do update
    set stufe               = excluded.stufe,
        gelernt             = excluded.gelernt,
        -- gesehen ist kumulativ: eine beantwortete Karte bleibt gesehen,
        -- auch wenn eine spatere Antwort p_gesehen = false mitbringt.
        gesehen             = public.karten_fortschritt.gesehen or excluded.gesehen,
        faellig_am          = excluded.faellig_am,
        letzte_wiederholung = now(),
        treffer             = public.karten_fortschritt.treffer
                               + case when p_bewertung = 'nochmal' then 0 else 1 end,
        fehler              = public.karten_fortschritt.fehler
                               + case when p_bewertung = 'nochmal' then 1 else 0 end;

  /*
   * XP des Tages. xp_events hat unique (user_id, datum), also pro Tag genau
   * eine Zeile. der Kommentar zu on conflict do update steht in 003:630-640.
   */
  insert into public.xp_events (user_id, set_id, datum, xp, ziel)
  values (v_user, p_set_id, current_date, greatest(p_xp, 0), 20)
  on conflict (user_id, datum) do update
    set xp    = public.xp_events.xp + greatest(p_xp, 0),
        set_id = coalesce(public.xp_events.set_id, excluded.set_id);

  select coalesce(sum(xp), 0) into v_ganz
  from public.xp_events
  where user_id = v_user;

  return jsonb_build_object(
    'xp',        p_xp,
    'neueStufe', p_neue_stufe,
    'xpGesamt',  v_ganz::int
  );
end;
$$;

-- Rechte wie in 003: die Funktion laeuft mit den Rechten der aufrufenden
-- Rolle, und nur angemeldete Personen rufen sie auf. Die neue Signatur hat
-- zusaetzliches p_gesehen; deshalb werden die Rechte fuer die neue Signatur
-- gesetzt und die fuer die alte (per drop weggefallene) nicht mehr benoetigt.
revoke execute on function public.antwort_verbuchen(
  uuid, uuid, text, integer, boolean, date, integer, boolean
) from public;
grant execute on function public.antwort_verbuchen(
  uuid, uuid, text, integer, boolean, date, integer, boolean
) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Views neu aufbauen
-- -----------------------------------------------------------------------------
-- create or replace view kann die Spaltenliste nicht aendern. Beide Views
-- bekommen einen Zaehler fuer "gesehen", deshalb drop + create – genau wie in
-- 003:357-360 und 006:45-54. Reihenfolge wie dort: statistik_pro_sprache
-- liest karteikarten_sets_uebersicht und muss zuerst weg.

drop view if exists public.statistik_pro_sprache;
drop view if exists public.karteikarten_sets_uebersicht;

create or replace view public.karteikarten_sets_uebersicht
with (security_invoker = true) as
select
  s.id,
  s.slug,
  s.name,
  s.sprache_code,
  coalesce(sp.name, s.sprache)     as sprache,
  coalesce(sp.flaeche, '#17232B')  as sprache_flaeche,
  coalesce(sp.akzent,  '#E7B14A')  as sprache_akzent,
  s.anzahl_karten,
  s.user_id,
  s.eigenes_set,
  count(k.id)                                                          as karten_gesamt,
  count(k.id) filter (where f.gesehen)                                  as karten_gesehen,
  count(k.id) filter (where f.gelernt)                                  as karten_gelernt,
  count(k.id)
    filter (where coalesce(f.faellig_am, current_date) <= current_date) as karten_faellig,
  -- null, wenn das Set noch nie gelernt wurde. Die Oberflaeche zeigt dafuer
  -- "–" statt eines erfundenen Datums.
  max(f.letzte_wiederholung)                                           as zuletzt_gelernt,
  case
    when count(k.id) = 0 then 0
    else round(count(k.id) filter (where f.gelernt) * 100.0 / count(k.id))::int
  end                                                                  as fortschritt_prozent
from public.karteikarten_sets s
left join public.sprachen sp
       on sp.code = s.sprache_code
left join public.karten k on k.set_id = s.id
left join public.karten_fortschritt f
       on f.karte_id = k.id
      and f.user_id = auth.uid()
group by
  s.id, s.slug, s.name, s.sprache_code, s.sprache, s.anzahl_karten, s.user_id, s.eigenes_set,
  sp.name, sp.flaeche, sp.akzent;

create or replace view public.statistik_pro_sprache
with (security_invoker = true) as
with xp_je_set as (
  select set_id, sum(xp)::int as xp
  from public.xp_events
  where set_id is not null
  group by set_id
)
select
  v.sprache_code,
  min(v.sprache)                 as sprache,
  min(v.sprache_flaeche)         as sprache_flaeche,
  min(v.sprache_akzent)          as sprache_akzent,
  sum(v.karten_gesehen)::int     as gesehen,
  sum(v.karten_gelernt)::int     as gelernt,
  sum(v.karten_gesamt)::int      as total,
  coalesce(sum(x.xp), 0)::int    as xp
from public.karteikarten_sets_uebersicht v
left join xp_je_set x on x.set_id = v.id
group by v.sprache_code
order by min(v.sprache);

-- Rechte wiederherstellen, die der drop mitgenommen hat (006:160-175).
grant select on public.karteikarten_sets_uebersicht to anon, authenticated;
grant select on public.statistik_pro_sprache        to anon, authenticated;