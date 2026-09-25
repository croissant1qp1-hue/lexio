-- =============================================================================
-- Lexio – Demodaten
-- =============================================================================
-- Legt zu jedem Set Karten an. Die Anzahl gelernter Karten entspricht dem
-- Fortschritt, der vorher in lib/mock-karteikarten.ts stand (65/32/48 %),
-- damit der Vergleich Mock vs. Supabase nachvollziehbar bleibt.
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
insert into public.karten (set_id, frage, antwort, gelernt)
select
  p.set_id,
  'Frage ' || n,
  'Antwort ' || n,
  n <= p.gelernt
from paare p
cross join lateral generate_series(1, p.anzahl_karten) as n
where not exists (select 1 from public.karten k where k.set_id = p.set_id);
