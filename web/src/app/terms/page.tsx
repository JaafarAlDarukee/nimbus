import type { Metadata } from "next";
import { Contact, LegalPage, contactEmail } from "@/components/legal-page";
import { notFound } from "next/navigation";
import { PRICE, PRIVATE, TRIAL_CVS, TRIAL_JOBS } from "@/lib/access";

export const metadata: Metadata = { title: "Terms · Nimbus" };

export default async function TermsPage() {
  if (PRIVATE) notFound();
  const email = await contactEmail();
  return (
    <LegalPage title="Terms" updated="17 October 2026">
      <p>
        These are the rules for using Nimbus, in plain English. By signing up you agree to them. Questions: <Contact email={email} />.
      </p>

      <h2>What Nimbus does</h2>
      <p>
        Nimbus reads employers&apos; own careers sites and job-site alert emails, shows you the roles that fit, and can message you on
        Telegram when new ones open. We work hard to be complete and accurate, but we can&apos;t promise every role is listed, correct or
        still open: always check the employer&apos;s own page before you apply. Nimbus never applies to or messages employers for you.
      </p>

      <h2>Free trial and price</h2>
      <ul>
        <li>New accounts get 2 days free, with up to {TRIAL_JOBS} roles, {TRIAL_CVS} CVs and {TRIAL_JOBS} Telegram alerts.</li>
        <li>
          After that, Nimbus costs <strong>{PRICE} once</strong>, paid through Stripe, for lifetime access: for as long as Nimbus runs. There
          is no subscription and nothing else to pay.
        </li>
      </ul>

      <h2>Refunds</h2>
      <p>
        If Nimbus isn&apos;t for you, email <Contact email={email} /> within 14 days of paying and we&apos;ll refund the full {PRICE}.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>One account per person. Keep your sign-in links and codes to yourself.</li>
        <li>Don&apos;t share your account, copy Nimbus&apos;s listings in bulk, resell them, or try to break or overload the site.</li>
        <li>You can ask us to delete your account at any time. We may close accounts that break these rules.</li>
      </ul>

      <h2>If something goes wrong</h2>
      <p>
        Nimbus is provided as it is. As far as the law allows, our responsibility to you is limited to what you paid us. Nothing here
        affects your legal rights as a consumer.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms. If a change matters, we&apos;ll tell you before it applies. These terms are governed by the law of
        England and Wales.
      </p>
    </LegalPage>
  );
}
