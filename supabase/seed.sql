-- =============================================================================
-- Lexio – Demodaten
-- =============================================================================
-- Legt zu jedem Set Karten an.
--
-- Die Anzahl gelernter Karten entspricht dem Fortschritt, der vorher in
-- lib/mock-karteikarten.ts stand (65/32/48 %), damit der Vergleich
-- Mock vs. Supabase nachvollziehbar bleibt.
--
-- Gleichzeitig werden die Karten auf unterschiedliche Lernstufen verteilt.
-- Sonst waeren alle Karten Stufe 0 und sofort faellig – die Lernsitzung waere
-- ein einziger ungebrochener Block ohne Wiederholungen.
--
--   Stufe 0  = neu, heute faellig
--   Stufe 1+ = bereits gesehen, faellig in 1..60 Tagen
--   jedes 3. gelernte Wort = faellig, weil es zur Wiederholung ansteht
-- =============================================================================

with sets as (
  select id, slug, anzahl_karten,
         case slug
           when 'englisch-grundlagen' then 0.65
           when 'italienisch-urlaub'  then 0.32
           when 'spanisch-alltag'     then 0.48
           else 0
         end as anteil
  from public.karteikarten_sets
),
paare as (
  select
    s.id as set_id,
    s.anzahl_karten,
    (s.anzahl_karten * s.anteil)::int as gelernt,
    s.slug
  from sets s
)
insert into public.karten
  (set_id, frage, antwort, gelernt, stufe, faellig_am, treffer, fehler)
select
  p.set_id,
  'Frage ' || n,
  'Antwort ' || n,
  n <= p.gelernt,
  -- neu, gelernt-veraltet oder in der Zukunft
  case
    when n >  p.gelernt then 0
    when n % 3 = 0      then 3
    else ((n * 3) % 5) + 1
  end,
  current_date + (
    case
      when n >  p.gelernt then 0
      when n % 3 = 0      then 0
      else (((n * 7) % 30) + 1)
    end
  ),
  -- je hoeher die Stufe, desto mehr Treffer
  case when n > p.gelernt then 0 else (n % 6) end,
  case when n > p.gelernt then 0 else (n % 2) end
from paare p
cross join lateral generate_series(1, p.anzahl_karten) as n
where not exists (select 1 from public.karten k where k.set_id = p.set_id);
