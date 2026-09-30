-- =============================================================================
-- 014: sets_gelernt reparieren (Phase 3.4)
--
-- Der Fehler aus C4: xp_events ist unique (user_id, datum) – eine Zeile pro
-- Tag. Der Upsert schreibt set_id = coalesce(bestand, neu), also bleibt der
-- EINER Set der Tag: wer am selben Tag zwei Sprachen lernt, traegt nur die
-- erste ein. mein_fortschritt.sets_gelernt zaehlt count(distinct set_id)
-- und rauscht deshalb dauerhaft eins drunter – und statistik_pro_sprache
-- rechnet sogar die XP des ganzen Tages einer einzigen Sprache zu.
--
-- Der Fix ist eine zweite, tag-scharfe Tabelle: xp_tag_sets je (user_id,
-- datum, set_id) mit der XP-Summe der Antworten, die die Karten dieses Sets
-- an diesem Tag gebracht haben. Beide Views lesen daraus, statt auf das
-- Ein-Set-Pro-Tag-Gedaechtnis von xp_events zu bauen. xp_events bleibt
-- unangetastet: es traegt weiter die Summe des Tages fuer Tagesziel und
-- Streak.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Die neue Tabelle mit RLS, genau nach dem Muster von xp_events
-- -----------------------------------------------------------------------------

create table if not exists public.xp_tag_sets (
  user_id      uuid not null references auth.users (id) on delete cascade,
  datum        date not null,
  set_id       uuid not null references public.karteikarten_sets (id) on delete cascade,
  xp_punktzahl integer not null default 0,
  primary key (user_id, datum, set_id)
);

alter table public.xp_tag_sets enable row level security;

drop policy if exists "eigene tag-sets lesen" on public.xp_tag_sets;
create policy "eigene tag-sets lesen"
  on public.xp_tag_sets for select
  using (auth.uid() = user_id);

drop policy if exists "eigene tag-sets schreiben" on public.xp_tag_sets;
create policy "eigene tag-sets schreiben"
  on public.xp_tag_sets for insert
  with check (auth.uid() = user_id);

drop policy if exists "eigene tag-sets fortschreiben" on public.xp_tag_sets;
create policy "eigene tag-sets fortschreiben"
  on public.xp_tag_sets for update
  using (auth.uid() = user_id);

drop policy if exists "eigene tag-sets loeschen" on public.xp_tag_sets;
create policy "eigene tag-sets loeschen"
  on public.xp_tag_sets for delete
  using (auth.uid() = user_id);

-- Die Funktionen laufen mit invoker-Rechten, also braucht die Rolle das
-- Schreibrecht auf die neue Tabelle direkt.
grant select, insert, update, delete on public.xp_tag_sets to authenticated;

-- Bestand uebernehmen: jede Tageszeile, die bisher einem einzigen Set
-- zugeordnet war, wandert als eine Zeile je (Tag, Set) rüber. Die XP des
-- Tages traegt damit das Set, das die alte Spalte gefuehrt hat – mehr als
-- das ist aus der Vergangenheit nicht rekonstruierbar. Ab jetzt zaehlt die
-- Tabelle ehrlich.
insert into public.xp_tag_sets (user_id, datum, set_id, xp_punktzahl)
select user_id, datum, set_id, xp
from public.xp_events
where set_id is not null;


-- -----------------------------------------------------------------------------
-- 2. antwort_verbuchen: beim XP des Tages auch das Set des Tages eintragen
--    (gleiche Signatur wie in 013, zusaetzlich das xp_tag_sets-Insert)
-- -----------------------------------------------------------------------------

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

  insert into public.karten_fortschritt
    (karte_id, user_id, stufe, gelernt, gesehen, faellig_am,
     treffer, fehler, z_nochmal, z_schwer, z_gut, z_einfach,
     letzte_wiederholung, letzte_antwort)
  values
    (p_karte_id, v_user, p_neue_stufe, p_gelernt, p_gesehen, p_faellig_am,
     case when p_bewertung = 'nochmal' then 0 else 1 end,
     case when p_bewertung = 'nochmal' then 1 else 0 end,
     case when p_bewertung = 'nochmal' then 1 else 0 end,
     case when p_bewertung = 'schwer'  then 1 else 0 end,
     case when p_bewertung = 'gut'     then 1 else 0 end,
     case when p_bewertung = 'einfach' then 1 else 0 end,
     now(),
     jsonb_build_object(
       'vorhanden_vorher', false,
       'xp', greatest(p_xp, 0),
       'tag', current_date
     ))
  on conflict (karte_id, user_id) do update
    set stufe               = excluded.stufe,
        gelernt             = excluded.gelernt,
        gesehen             = public.karten_fortschritt.gesehen or excluded.gesehen,
        faellig_am          = excluded.faellig_am,
        letzte_wiederholung = now(),
        treffer             = public.karten_fortschritt.treffer
                               + case when p_bewertung = 'nochmal' then 0 else 1 end,
        fehler              = public.karten_fortschritt.fehler
                               + case when p_bewertung = 'nochmal' then 1 else 0 end,
        z_nochmal           = public.karten_fortschritt.z_nochmal
                               + case when p_bewertung = 'nochmal' then 1 else 0 end,
        z_schwer            = public.karten_fortschritt.z_schwer
                               + case when p_bewertung = 'schwer'  then 1 else 0 end,
        z_gut               = public.karten_fortschritt.z_gut
                               + case when p_bewertung = 'gut'     then 1 else 0 end,
        z_einfach           = public.karten_fortschritt.z_einfach
                               + case when p_bewertung = 'einfach' then 1 else 0 end,
        letzte_antwort      = jsonb_build_object(
                               'vorhanden_vorher', true,
                               'stufe_vorher',            public.karten_fortschritt.stufe,
                               'gelernt_vorher',          public.karten_fortschritt.gelernt,
                               'gesehen_vorher',          public.karten_fortschritt.gesehen,
                               'faellig_am_vorher',       public.karten_fortschritt.faellig_am,
                               'treffer_vorher',          public.karten_fortschritt.treffer,
                               'fehler_vorher',           public.karten_fortschritt.fehler,
                               'z_nochmal_vorher',        public.karten_fortschritt.z_nochmal,
                               'z_schwer_vorher',         public.karten_fortschritt.z_schwer,
                               'z_gut_vorher',            public.karten_fortschritt.z_gut,
                               'z_einfach_vorher',        public.karten_fortschritt.z_einfach,
                               'letzte_wiederholung_vorher', public.karten_fortschritt.letzte_wiederholung,
                               'xp', greatest(p_xp, 0),
                               'tag', current_date
                             );

  -- XP des Tages (Tagesziel, Streak) – unveraendert aus 013.
  insert into public.xp_events (user_id, set_id, datum, xp, ziel)
  values (v_user, p_set_id, current_date, greatest(p_xp, 0), 100)
  on conflict (user_id, datum) do update
    set xp    = public.xp_events.xp + greatest(p_xp, 0),
        set_id = coalesce(public.xp_events.set_id, excluded.set_id);

  -- Set des Tages (Phase 3.4): eine Zeile je (Tag, Set), damit mehrere Sets
  -- am selben Tag nicht mehr gegeneinander antreten.
  insert into public.xp_tag_sets (user_id, datum, set_id, xp_punktzahl)
  values (v_user, current_date, p_set_id, greatest(p_xp, 0))
  on conflict (user_id, datum, set_id) do update
    set xp_punktzahl = public.xp_tag_sets.xp_punktzahl + greatest(p_xp, 0);

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


-- -----------------------------------------------------------------------------
-- 3. antwort_rueckgaengig: die Set-Zeile des Tages mit zurueckziehen
--    (gleiche Signatur wie in 010)
-- -----------------------------------------------------------------------------

create or replace function public.antwort_rueckgaengig (
  p_karte_id uuid
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_snap jsonb;
  v_ganz bigint;
  v_set  uuid;
begin
  if v_user is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.karten k
    join public.karteikarten_sets s on s.id = k.set_id
    where k.id = p_karte_id
      and (s.user_id is null or s.user_id = v_user)
  ) then
    raise exception 'Karte nicht gefunden.' using errcode = 'P0002';
  end if;

  select letzte_antwort into v_snap
  from public.karten_fortschritt
  where karte_id = p_karte_id and user_id = v_user;

  if v_snap is null or v_snap = 'null'::jsonb then
    return jsonb_build_object('erledigt', false);
  end if;

  select set_id into v_set
  from public.karten
  where id = p_karte_id;

  if (v_snap->>'vorhanden_vorher')::boolean then
    update public.karten_fortschritt
       set stufe               = (v_snap->>'stufe_vorher')::int,
           gelernt             = coalesce((v_snap->>'gelernt_vorher')::boolean, false),
           gesehen             = coalesce((v_snap->>'gesehen_vorher')::boolean, false),
           faellig_am          = (v_snap->>'faellig_am_vorher')::date,
           treffer             = coalesce((v_snap->>'treffer_vorher')::int, 0),
           fehler              = coalesce((v_snap->>'fehler_vorher')::int, 0),
           z_nochmal           = coalesce((v_snap->>'z_nochmal_vorher')::int, 0),
           z_schwer            = coalesce((v_snap->>'z_schwer_vorher')::int, 0),
           z_gut               = coalesce((v_snap->>'z_gut_vorher')::int, 0),
           z_einfach           = coalesce((v_snap->>'z_einfach_vorher')::int, 0),
           letzte_wiederholung = (v_snap->>'letzte_wiederholung_vorher')::timestamptz,
           letzte_antwort      = null
     where karte_id = p_karte_id and user_id = v_user;
  else
    delete from public.karten_fortschritt
     where karte_id = p_karte_id and user_id = v_user;
  end if;

  update public.xp_events
     set xp = greatest(0, xp - coalesce((v_snap->>'xp')::int, 0))
   where user_id = v_user
     and datum = (v_snap->>'tag')::date;

  -- Set des Tages mit zurueck (Phase 3.4): fiel die einzige Antwort dieses
  -- Sets an diesem Tag unter die Zeile, wird sie entfernt, damit sets_gelernt
  -- das Set nicht mehr zaehlt.
  if v_set is not null then
    update public.xp_tag_sets
       set xp_punktzahl = greatest(0, xp_punktzahl - coalesce((v_snap->>'xp')::int, 0))
     where user_id = v_user
       and datum = (v_snap->>'tag')::date
       and set_id = v_set;

    delete from public.xp_tag_sets
     where user_id = v_user
       and datum = (v_snap->>'tag')::date
       and set_id = v_set
       and xp_punktzahl <= 0;
  end if;

  select coalesce(sum(xp), 0) into v_ganz
  from public.xp_events
  where user_id = v_user;

  return jsonb_build_object('erledigt', true, 'xpGesamt', v_ganz::int);
end;
$$;


-- -----------------------------------------------------------------------------
-- 4. mein_fortschritt: sets_gelernt zaehlt jetzt ehrlich ueber die Tag-Set-Zeilen
-- -----------------------------------------------------------------------------

create or replace view public.mein_fortschritt
with (security_invoker = true) as
with tage as (
  select generate_series(current_date - 399, current_date, interval '1 day')::date as datum
),
taetig as (
  select datum, sum(xp)::int as xp
  from public.xp_events
  where datum >= current_date - 399
  group by datum
),
reihe as (
  select
    t.datum,
    row_number() over (order by t.datum desc) as abstand,  -- 1 = heute
    coalesce(a.xp, 0) as xp
  from tage t
  left join taetig a on a.datum = t.datum
),
reihe_start as (
  select case
    when max(xp) filter (where abstand = 1) > 0 then 1
    when max(xp) filter (where abstand = 2) > 0 then 2
    else 0
  end as erster
  from reihe
),
streak as (
  select count(*)::int as tage
  from reihe, reihe_start
  -- erster = 0 heisst "gar nicht heute und gar nicht gestern gelernt" und
  -- darf nicht die 400 Tage der Historie zaehlen.
  where reihe_start.erster > 0
    and reihe.abstand >= reihe_start.erster
    and reihe.xp > 0
)
select
  (select coalesce(sum(xp), 0)::int from public.xp_events) as xp_gesamt,
  (select count(*)::int from taetig)                      as lerntage,
  -- Phase 3.4: distinct Sets ueber die Tag-Set-Zeilen statt ueber die
  -- Ein-Set-pro-Tag-Spalte von xp_events.
  (select count(distinct set_id)::int
     from public.xp_tag_sets)                              as sets_gelernt,
  streak.tage                                            as streak
from streak;


-- -----------------------------------------------------------------------------
-- 5. statistik_pro_sprache: XP je Set ueber die Tag-Set-Zeilen rechnen –
--    dann gehoert jedes Sets XP auch wirklich zu diesem Set, statt dass der
--    erste Lerntag des Tages alle XP bekommt.
-- -----------------------------------------------------------------------------

create or replace view public.statistik_pro_sprache
with (security_invoker = true) as
with xp_je_set as (
  select set_id, sum(xp_punktzahl)::int as xp
  from public.xp_tag_sets
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


-- -----------------------------------------------------------------------------
-- 6. Rechte
-- -----------------------------------------------------------------------------

grant select on public.mein_fortschritt      to authenticated;
grant select on public.statistik_pro_sprache to anon, authenticated;