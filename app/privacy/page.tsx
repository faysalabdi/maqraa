import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Maqra handles your data.",
};

const UPDATED = "26 June 2026";
const CONTACT = "support@maqra.app";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/" className="text-sm font-semibold text-fg-muted hover:text-fg">
        ← Maqra
      </Link>
      <h1 className="mt-4 font-serif text-3xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="mt-1 text-sm text-fg-muted">Last updated {UPDATED}</p>

      <div className="prose-legal mt-8 space-y-6 text-sm leading-relaxed text-fg">
        <p className="rounded-xl bg-surface p-4 text-fg-muted ring-1 ring-border">
          This is a plain-language summary of how Maqra handles your data. It is a starting
          template — have it reviewed by a qualified professional before relying on it for a public
          launch.
        </p>

        <Section title="What we collect">
          <ul className="ml-5 list-disc space-y-1">
            <li>
              <strong>Account</strong>: your email address, used to sign you in (handled by our
              authentication provider, Supabase).
            </li>
            <li>
              <strong>Reading activity</strong>: which books and chapters you read, your saved
              words and flashcard review history, streaks, and progress.
            </li>
            <li>
              <strong>Content you add</strong>: text from books you upload, stored so you can read
              them in the app.
            </li>
          </ul>
        </Section>

        <Section title="How we use it">
          <p>
            To provide the service: showing your library, tracking progress, scheduling flashcard
            reviews, and generating translations, quizzes, and comprehension tests.
          </p>
        </Section>

        <Section title="AI processing">
          <p>
            When you tap a word, take a quiz or test, or have an uploaded book analysed, the
            relevant text is sent to our AI provider (Anthropic) to generate the response. We do not
            use your data to train models. See Anthropic&apos;s privacy terms for how they handle
            data they process on our behalf.
          </p>
        </Section>

        <Section title="Sharing">
          <p>
            We do not sell your data. We share it only with the service providers that run the app
            (hosting, database/authentication, and the AI provider above), and where required by
            law.
          </p>
        </Section>

        <Section title="Cookies">
          <p>
            We use a session cookie to keep you signed in. We do not use third-party advertising
            cookies.
          </p>
        </Section>

        <Section title="Your choices">
          <p>
            You can edit your profile in Settings, and you can request deletion of your account and
            associated data by contacting us at{" "}
            <a className="text-brand underline" href={`mailto:${CONTACT}`}>
              {CONTACT}
            </a>
            .
          </p>
        </Section>

        <Section title="Changes">
          <p>
            We may update this policy. Material changes will be reflected by the date above.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions? Email{" "}
            <a className="text-brand underline" href={`mailto:${CONTACT}`}>
              {CONTACT}
            </a>
            .
          </p>
        </Section>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-bold">{title}</h2>
      <div className="mt-2 space-y-2 text-fg-muted">{children}</div>
    </section>
  );
}
