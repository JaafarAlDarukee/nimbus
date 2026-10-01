-- CV studio: what the ATS check learned from an uploaded PDF (pages, columns)
alter table public.cv_jobs add column cv_meta jsonb;
