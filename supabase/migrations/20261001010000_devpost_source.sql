-- Hackathons from Devpost are a new kind of source.
alter table public.sources drop constraint sources_kind_check;
alter table public.sources add constraint sources_kind_check check (kind in (
  'greenhouse', 'lever', 'smartrecruiters', 'workable', 'ashby', 'workday',
  'successfactors', 'rss', 'sitemap', 'page', 'adzuna', 'reed', 'jooble',
  'inbox', 'news', 'devpost', 'recruitee'
));
