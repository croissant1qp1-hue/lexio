-- =============================================================================
-- 013: Tagesziel ehrlich machen (Phase 3.3)
--
-- Woher die 20 kamen: faellig in 003 und unveraendert durch 007/009/010
-- weitergeschleppt. Bei 5 XP je "gut"-Antwort und 20 Karten pro Runde ist
-- eine Runde 100 XP wert – wer seine Runde lernte, hatte das alte Ziel
-- laengst gerissen, der Balken war nach einer halben Runde voll. Das neue
-- Ziel ist einer Lernrunde eingeschrieben und steht damit an genau einer
-- Stelle (plus lib/profil.ts fuer den API-Fallback).
--
-- Funktionen aendern sich hier nur im Ziel-Wert, die Signatur bleibt die
-- aus 010. Ein komplettes "create or replace" ist noetig, weil die Funktion
-- aus einem Stueck besteht und kein Teil davon einzeln ersetzt werden kann.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Bestand angleichen: alle Tage, die mit dem alten flachen Ziel von 20
--    gefuehrt wurden, auf das neue Ziel heben – dann stimmt die Woche in der
--    Statistik wieder, ohne dass man die Historie wegwirft.
-- -----------------------------------------------------------------------------

update public.xp_events
   set ziel = 100
 where ziel = 20;

-- -----------------------------------------------------------------------------
-- 2. antwort_verbuchen mit dem neuen Ziel (gleiche Signatur wie in 010)
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

  -- XP des Tages. Das Ziel ist seit Phase 3.3 eine Lernrunde, nicht die
  -- flache 20 aus 003 – bei 5 XP je "gut" war eine Runde viermal so viel.
  insert into public.xp_events (user_id, set_id, datum, xp, ziel)
  values (v_user, p_set_id, current_date, greatest(p_xp, 0), 100)
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

-- Rechte wie in 010: anonym nichts, angemeldete alles.
revoke execute on function public.antwort_verbuchen(
  uuid, uuid, text, integer, boolean, date, integer, boolean
) from public;
grant execute on function public.antwort_verbuchen(
  uuid, uuid, text, integer, boolean, date, integer, boolean
) to authenticated;