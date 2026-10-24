-- More places Nimbus reads (owner, 24 Oct: "not only Adzuna"): Oracle Recruiting Cloud career sites.
-- ('page' and 'reed' were already allowed.)
alter table public.sources drop constraint if exists sources_kind_check;
alter table public.sources add constraint sources_kind_check check (kind in (
  'greenhouse', 'lever', 'smartrecruiters', 'workable', 'ashby', 'workday', 'successfactors', 'rss', 'sitemap', 'page',
  'adzuna', 'reed', 'jooble', 'inbox', 'news', 'devpost', 'recruitee', 'mlh', 'events', 'nhsjobs', 'oracle'));
