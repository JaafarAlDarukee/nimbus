import { redirect } from "next/navigation";
import { CvStudio } from "@/components/cv-studio";
import { blankCv, type BuiltCv, type CvJob } from "@/lib/cv";
import { withDefaults } from "@/lib/preferences";
import { createClient } from "@/lib/supabase/server";

type Row = {
  id: string;
  title: string;
  company: string;
  link: string;
  jd: string;
  jd_name: string | null;
  mode: "upload" | "build" | null;
  cv_name: string | null;
  cv_text: string | null;
  cv: BuiltCv | null;
  step: number;
};

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) || undefined;

export default async function CvStudioPage(props: PageProps<"/cv-studio">) {
  const params = await props.searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // From Opportunities ("Yes, check my CV"): one CV job per role, filled in from the advert
  const opportunityId = first(params.job);
  if (opportunityId) {
    const { data: existing } = await supabase.from("cv_jobs").select("id").eq("opportunity_id", opportunityId).maybeSingle();
    let id = existing?.id as string | undefined;
    if (!id) {
      const { data: o } = await supabase.from("opportunities").select("title,company_name,apply_url,description").eq("id", opportunityId).maybeSingle();
      if (o) {
        const { data: created } = await supabase
          .from("cv_jobs")
          .insert({ opportunity_id: opportunityId, title: o.title, company: o.company_name, link: o.apply_url, jd: (o.description ?? "").slice(0, 20000), step: 2 })
          .select("id")
          .single();
        id = created?.id as string | undefined;
      }
    }
    redirect(id ? `/cv-studio?id=${id}` : "/cv-studio");
  }

  const [{ data: rows }, { data: profile }] = await Promise.all([
    supabase.from("cv_jobs").select("id,title,company,link,jd,jd_name,mode,cv_name,cv_text,cv,step").order("created_at", { ascending: true }),
    supabase.from("profiles").select("first_name,last_name,cv_details,preferences").eq("id", user!.id).maybeSingle(),
  ]);

  const jobs: CvJob[] = ((rows ?? []) as Row[]).map((r) => ({
    id: r.id,
    title: r.title,
    company: r.company,
    link: r.link,
    jd: r.jd,
    jdName: r.jd_name,
    mode: r.mode,
    cvName: r.cv_name,
    cvText: r.cv_text,
    cv: r.cv,
    step: r.step,
  }));
  const prefs = withDefaults(profile?.preferences);
  const saved = (profile?.cv_details as BuiltCv | null) ?? null;

  return (
    <CvStudio
      jobs={jobs}
      selectedId={first(params.id) ?? jobs[jobs.length - 1]?.id ?? null}
      // Nothing saved yet: start from what onboarding knows
      saved={saved ?? { ...blankCv(), name: [profile?.first_name, profile?.last_name].filter(Boolean).join(" "), email: user!.email ?? "", degree: prefs.degrees[0] ?? "" }}
      hasSaved={!!saved}
      signupCv={prefs.cvPath ? (prefs.cvName ?? "your CV") : null}
    />
  );
}
