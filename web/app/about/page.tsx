import Link from "next/link";
import { getOverviewStats, getRanked } from "@/lib/data";

export const metadata = {
  title: "About · slr.audit",
  description:
    "Why this site exists: auditing whether systematic literature reviews on technical debt actually cite the field they review.",
};

export default function AboutPage() {
  const stats = getOverviewStats();
  const candidates = getRanked().length;

  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-subtle)]">
        About
      </div>
      <h1 className="mt-3 text-balance text-4xl font-semibold leading-tight tracking-tight text-[var(--color-text)] sm:text-5xl">
        Why this audit exists
      </h1>

      <p
        className="mt-8 text-lg leading-relaxed text-[var(--color-text-muted)]"
        style={{
          fontFamily: "'Iowan Old Style', 'Iowan', 'Palatino', Georgia, serif",
        }}
      >
        When researchers want to learn about a field they don&apos;t
        already work in, they reach for a <em>systematic literature
        review</em> — an SLR. The pitch is simple: somebody else read all
        the important papers, weighed the evidence, and wrote it up.
        Readers save weeks of reading. The SLR becomes the shortcut.
      </p>
      <p
        className="mt-5 text-lg leading-relaxed text-[var(--color-text-muted)]"
        style={{
          fontFamily: "'Iowan Old Style', 'Iowan', 'Palatino', Georgia, serif",
        }}
      >
        This site asks a sharper question:{" "}
        <strong className="text-[var(--color-text)]">
          when an SLR claims to summarize a field, does it actually cite
          the field it claims to summarize?
        </strong>
      </p>

      <Section title="What the audit does">
        <p>
          The audit picks one field — <em>technical debt</em> in software
          engineering — and builds a required-reading list of the{" "}
          {stats.topCount} most-cited papers on the topic according to
          Semantic Scholar. Then it pulls the bibliographies of{" "}
          {stats.slrCount} published SLRs in the same field and grades
          each one on how many of those {stats.topCount} required readings
          it actually cited.
        </p>
        <p className="mt-4">
          The result is on the{" "}
          <Link
            href="/"
            className="text-[var(--color-accent)] underline-offset-2 hover:underline"
          >
            overview
          </Link>
          : average grade {stats.meanCoveragePct.toFixed(1)}%, median{" "}
          {stats.medianCoveragePct.toFixed(1)}%, with{" "}
          {stats.zeroCoverage} SLRs citing none of the list at all.
        </p>
      </Section>

      <Section title="Why this matters">
        <p>
          SLRs aren&apos;t just academic exercises. They shape what gets
          taught, what gets funded, and what new researchers read first. If
          the SLRs in a field systematically miss the most-cited work in
          that same field, then the &ldquo;shortcut&rdquo; isn&apos;t a
          shortcut — it&apos;s a detour around the canon.
        </p>
        <p className="mt-4">
          One paper on the list (
          <Link
            href="/papers"
            className="text-[var(--color-accent)] underline-offset-2 hover:underline"
          >
            see Top Cited
          </Link>
          ) has over a thousand citations and is referenced by exactly one
          of the {stats.slrCount}&nbsp;SLRs. That&apos;s the kind of gap
          this audit makes visible.
        </p>
      </Section>

      <Section title="What this isn't claiming">
        <p>
          A low grade isn&apos;t automatically a bad SLR. Some SLRs are
          deliberately narrow — &ldquo;technical debt in microservices&rdquo;
          shouldn&apos;t cite ML-debt papers. Some came out before key
          papers existed (which the year-control handles). And the
          most-cited list is one definition of a canon — citation count is
          a flawed proxy for importance.
        </p>
        <p className="mt-4">
          So treat the grade as a <em>signal</em>, not a verdict. The site
          shows the raw numbers and the per-SLR drilldown so you can
          interpret each one in context. The{" "}
          <Link
            href="/slrs"
            className="text-[var(--color-accent)] underline-offset-2 hover:underline"
          >
            SLR list
          </Link>{" "}
          also includes an AI judge for each SLR that reads its abstract
          and adds qualitative context.
        </p>
      </Section>

      <Section title="How to read this site">
        <ul className="space-y-3">
          <li>
            <strong className="text-[var(--color-text)]">
              <Link
                href="/"
                className="text-[var(--color-accent)] underline-offset-2 hover:underline"
              >
                Overview
              </Link>
            </strong>{" "}
            — headline numbers, the most-cited paper callout, the
            distribution histogram, and the full SLR table sorted by rank.
          </li>
          <li>
            <strong className="text-[var(--color-text)]">
              <Link
                href="/slrs"
                className="text-[var(--color-accent)] underline-offset-2 hover:underline"
              >
                SLRs
              </Link>
            </strong>{" "}
            — every SLR with its grade, miss list, hit list, and rank
            breakdown.
          </li>
          <li>
            <strong className="text-[var(--color-text)]">
              <Link
                href="/papers"
                className="text-[var(--color-accent)] underline-offset-2 hover:underline"
              >
                Top cited
              </Link>
            </strong>{" "}
            — the {stats.topCount}-paper required-reading list, each with
            how many SLRs actually cited it.
          </li>
          <li>
            <strong className="text-[var(--color-text)]">
              <Link
                href="/consensus"
                className="text-[var(--color-accent)] underline-offset-2 hover:underline"
              >
                Consensus
              </Link>
            </strong>{" "}
            — which papers the SLRs agree on (regardless of whether
            they&apos;re on the required list).
          </li>
          <li>
            <strong className="text-[var(--color-text)]">
              <Link
                href="/compare"
                className="text-[var(--color-accent)] underline-offset-2 hover:underline"
              >
                Compare
              </Link>
            </strong>{" "}
            — pick any two SLRs and see how much their bibliographies
            overlap.
          </li>
          <li>
            <strong className="text-[var(--color-text)]">
              <Link
                href="/graph"
                className="text-[var(--color-accent)] underline-offset-2 hover:underline"
              >
                Graph
              </Link>
            </strong>{" "}
            — the whole citation network in 3D. Orphan clusters = SLRs
            that miss everything.
          </li>
          <li>
            <strong className="text-[var(--color-text)]">
              <Link
                href="/method"
                className="text-[var(--color-accent)] underline-offset-2 hover:underline"
              >
                Method
              </Link>
            </strong>{" "}
            — the full 6-step pipeline, stack, and join logic.
          </li>
        </ul>
      </Section>

      <div className="mt-20 border-t border-[var(--color-border)] pt-10">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-subtle)]">
          Scope
        </div>
        <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-muted)]">
          One field ({stats.slrCount} published SLRs, {candidates}{" "}
          candidates from the pipeline), one canonical reading list ({stats.topCount}{" "}
          papers), year-controlled. Coursework — private use, no PII. The
          methodology generalizes to any field with enough SLRs to make
          the comparison meaningful.
        </p>
        <div className="mt-5 flex gap-6 font-mono text-sm">
          <Link
            href="/"
            className="text-[var(--color-accent)] hover:underline"
          >
            ← Back to overview
          </Link>
          <Link
            href="/method"
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            Method →
          </Link>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-14 grid grid-cols-12 gap-6 border-t border-[var(--color-border)] pt-10">
      <h2 className="col-span-12 font-mono text-xs uppercase tracking-[0.12em] text-[var(--color-text-subtle)] lg:col-span-3">
        {title}
      </h2>
      <div
        className="col-span-12 space-y-0 text-base leading-relaxed text-[var(--color-text-muted)] lg:col-span-9"
        style={{
          fontFamily: "'Iowan Old Style', 'Iowan', 'Palatino', Georgia, serif",
        }}
      >
        {children}
      </div>
    </section>
  );
}
