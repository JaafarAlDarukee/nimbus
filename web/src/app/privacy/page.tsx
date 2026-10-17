import type { Metadata } from "next";
import { Contact, LegalPage, contactEmail } from "@/components/legal-page";

export const metadata: Metadata = { title: "Privacy · Nimbus" };

export default async function PrivacyPage() {
  const email = await contactEmail();
  return (
    <LegalPage title="Privacy" updated="17 October 2026">
      <p>
        Nimbus finds placements, internships, graduate jobs, apprenticeships and events for students, and tells you when they open. It is
        a small service run by a student in the UK. This page says what we keep about you, why, and what you can do about it. Questions:{" "}
        <Contact email={email} />.
      </p>

      <h2>What we keep, and why</h2>
      <ul>
        <li><strong>Your email address</strong>, to sign you in (we email you a link and a code).</li>
        <li>
          <strong>What you tell us when you sign up</strong>: your name, field, degree, year, industries and places, how many applications
          you plan and how you heard about Nimbus. We use it to choose your roles and to make Nimbus better.
        </li>
        <li>
          <strong>Your CV</strong>, if you add one, and the CVs and job adverts you work on in CV studio. They are stored privately: only
          you can open them.
        </li>
        <li><strong>Your tracker</strong>: roles you save or apply to, your notes, reminders, and roles you hide.</li>
        <li><strong>Your Telegram chat</strong>, if you connect Telegram, so the bot can message you, and a record of which roles it sent so nothing comes twice.</li>
        <li>
          <strong>Your payment</strong>: the amount, the date and Stripe&apos;s reference. Your card details go to Stripe; we never see
          them.
        </li>
      </ul>

      <h2>Who helps us run it</h2>
      <ul>
        <li><strong>Supabase</strong> stores the data above and handles sign-in (servers in London).</li>
        <li><strong>Vercel</strong> runs the website.</li>
        <li><strong>Telegram</strong> delivers your alerts, if you connect it.</li>
        <li><strong>Stripe</strong> takes payments.</li>
        <li><strong>Google</strong> sends our sign-in emails (Gmail). Employer logos come from Google&apos;s icon service, so your browser asks Google for them.</li>
        <li><strong>GitHub</strong> runs the radar that checks employers&apos; sites and sends alerts.</li>
      </ul>
      <p>They only use your data to provide their part of Nimbus.</p>

      <h2>What we don&apos;t do</h2>
      <ul>
        <li>No adverts, and we never sell or share your data.</li>
        <li>No tracking or advertising cookies. Cookies only keep you signed in and remember the role you were opening.</li>
        <li>We never send your details to employers, and Nimbus never applies to or messages employers for you.</li>
      </ul>

      <h2>How long we keep it</h2>
      <p>
        Until you ask us to delete your account. Payment records are kept for as long as UK tax rules require. Roles and employers&apos;
        public adverts are kept for the job radar.
      </p>

      <h2>Your rights</h2>
      <p>
        You can ask to see, correct, download or delete your data at any time: email <Contact email={email} /> and we&apos;ll reply
        within a month. If you&apos;re unhappy with how we handle your data, you can complain to the Information Commissioner&apos;s
        Office at <a href="https://ico.org.uk" className="text-t-sky">ico.org.uk</a>.
      </p>
    </LegalPage>
  );
}
