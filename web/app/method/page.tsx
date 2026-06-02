import Link from "next/link";

export const metadata = {
  title: "Method — slr.audit",
  description:
    "How the SLR citation-coverage audit is built — 6-stage Python pipeline, paper_key dedup, date control, and the 5-dimension ranker.",
};

export default function MethodPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-subtle)]">
        Method
      </div>
      <h1
        className="mt-3 text-balance text-4xl font-semibold leading-tight tracking-tight text-[var(--color-text)] sm:text-5xl"
      >
        How this audit is built
      </h1>
      <p
        className="mt-6 text-lg leading-relaxed text-[var(--color-text-muted)]"
        style={{
          fontFamily: "'Iowan Old Style', 'Iowan', 'Palatino', Georgia, serif",
        }}
      >
        A 6-stage Python pipeline pulls every paper that any published
        Systematic Literature Review in the technical-debt subfield cites,
        joins it against Semantic Scholar&apos;s top-50 most-cited papers in
        the same area, controls for publication year, and reports coverage.
      </p>

      <Section n="01" title="Identify SLRs">
        Three sources — Semantic Scholar bulk search, ACM Digital Library
        BibTeX exports, and IEEE Xplore — are queried for{" "}
        <Code>&quot;technical debt&quot;</Code> AND{" "}
        <Code>&quot;systematic literature review&quot; | &quot;systematic
        mapping study&quot; | &quot;tertiary study&quot;</Code>. Hits are
        deduplicated, manually classified in{" "}
        <Code>data/manual/slr_decisions.csv</Code>, and the survivors form
        the SLR corpus.
      </Section>

      <Section n="02" title="Extract references">
        For each SLR, Semantic Scholar&apos;s reference endpoint is pulled
        (bulk paging, 100/page, rate-limited to 80 calls per 60 seconds).
        References are persisted to{" "}
        <Code>data/processed/slr_references.json</Code> keyed by{" "}
        <Code>paper_key</Code>.
      </Section>

      <Section n="03" title="Top-cited corpus">
        Semantic Scholar is asked for the most-cited papers in the same
        subfield using the same keyword set as stage 01, capped at the
        top-50. Each carries its publication year so stage 04 can apply the
        date control.
      </Section>

      <Section n="04" title="Date-controlled overlap">
        For every (SLR, top-paper) pair the top-paper is considered{" "}
        <em>eligible</em> only if{" "}
        <Code>top.year ≤ slr.year</Code>. Counting misses for a paper that
        was published <em>after</em> the SLR would be unfair — the
        denominator drops to <Code>eligible_top_n</Code> rows in{" "}
        <Code>overlap_matrix.csv</Code>.
      </Section>

      <Section n="05" title="Explain the gaps">
        Each miss is annotated with venue, age, open-access status, and
        whether it&apos;s consistently missed across the corpus —{" "}
        <Code>missed_pairs.csv</Code>,{" "}
        <Code>gap_summary_by_venue.csv</Code>,{" "}
        <Code>gap_summary_by_age.csv</Code>.
      </Section>

      <Section n="06" title="Rank the SLRs">
        A 5-dimension composite score, equal-weighted by default
        (configurable via <Code>RANK_WEIGHTS</Code>): canonical coverage,
        semantic recall (Qwen3 embeddings, cosine vs SLR vector), authority
        (mean <Code>log(1 + citationCount)</Code> of refs), diversity
        (Shannon entropy of venues + first authors), and an LLM-judge pass
        (DeepSeek V3 via OpenRouter, deterministic temperature 0, cached
        per-SLR). The ranked output drives{" "}
        <Code>ranked_slrs.csv</Code> / <Code>.json</Code>.
      </Section>

      <h2 className="mt-20 text-2xl font-semibold tracking-tight text-[var(--color-text)]">
        Joining everything together
      </h2>
      <p
        className="mt-4 text-base leading-relaxed text-[var(--color-text-muted)]"
        style={{
          fontFamily: "'Iowan Old Style', 'Iowan', 'Palatino', Georgia, serif",
        }}
      >
        Every paper in the system gets a stable identifier the pipeline
        calls <Code>paper_key</Code>. Resolution order: normalized DOI →
        Semantic Scholar <Code>paperId</Code> → normalized title. That
        priority is the single source of truth for joining SLRs against
        references against the top-cited corpus — change it once and every
        stage downstream stays consistent.
      </p>
      <p
        className="mt-4 text-base leading-relaxed text-[var(--color-text-muted)]"
        style={{
          fontFamily: "'Iowan Old Style', 'Iowan', 'Palatino', Georgia, serif",
        }}
      >
        The site you&apos;re reading reads those flat files at build time —
        no database, no API call from your browser. Push to{" "}
        <Code>main</Code> and Vercel rebuilds the static pages with the
        latest pipeline outputs.
      </p>

      <h2 className="mt-20 text-2xl font-semibold tracking-tight text-[var(--color-text)]">
        Stack
      </h2>
      <ul className="mt-4 space-y-2 font-mono text-sm text-[var(--color-text-muted)]">
        {[
          ["Pipeline", "Python 3, pytest, semanticscholar SDK, dotenv"],
          ["Ranker", "sentence-transformers (Qwen3-Embedding-0.6B), pandas, networkx, pydantic"],
          ["LLM judge", "DeepSeek V3 via OpenRouter, temperature 0, file cache"],
          ["Web", "Next 16 App Router, TypeScript, Tailwind v4, Framer Motion v12"],
          ["3D", "React Three Fiber + drei, 3d-force-graph (vanilla Three.js)"],
          ["Type", "Geist Sans, Geist Mono, Iowan Old Style (serif body)"],
          ["Deploy", "Vercel — auto-builds on push to main"],
        ].map(([k, v]) => (
          <li key={k} className="flex items-baseline gap-6">
            <span className="w-24 shrink-0 text-[var(--color-text-subtle)]">
              {k}
            </span>
            <span className="text-[var(--color-text)]">{v}</span>
          </li>
        ))}
      </ul>

      <div className="mt-20 border-t border-[var(--color-border)] pt-10">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-subtle)]">
          Source
        </div>
        <p className="mt-3 text-sm text-[var(--color-text-muted)]">
          The full pipeline + this site live in one repo. Each stage owns
          its outputs under <Code>data/processed/</Code>; the web app reads
          them at build time. Coursework — private use, no PII.
        </p>
        <div className="mt-5 flex gap-6 font-mono text-sm">
          <Link
            href="/"
            className="text-[var(--color-accent)] hover:underline"
          >
            ← Back to overview
          </Link>
          <a
            href="https://github.com/connortessaro/slr-citation-audit"
            target="_blank"
            rel="noreferrer"
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            github →
          </a>
        </div>
      </div>
    </div>
  );
}

function Section({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-16 grid grid-cols-12 gap-6 border-t border-[var(--color-border)] pt-10">
      <div className="col-span-12 lg:col-span-3">
        <div className="font-mono text-3xl tabular-nums leading-none text-[var(--color-accent)]">
          {n}
        </div>
        <h3 className="mt-3 font-mono text-xs uppercase tracking-[0.12em] text-[var(--color-text-subtle)]">
          {title}
        </h3>
      </div>
      <div
        className="col-span-12 text-base leading-relaxed text-[var(--color-text-muted)] lg:col-span-9"
        style={{
          fontFamily: "'Iowan Old Style', 'Iowan', 'Palatino', Georgia, serif",
        }}
      >
        {children}
      </div>
    </section>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-[var(--color-surface)] px-1.5 py-0.5 font-mono text-[0.85em] text-[var(--color-text)]">
      {children}
    </code>
  );
}
