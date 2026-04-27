/**
 * AtlasFrameworkPrintPage.tsx
 *
 * Customer-facing printable summary that explains the Atlas recommendation
 * framework — the "Core-to-UI Mapping Layer" architectural blueprint.
 *
 * Rendered when the engineer clicks "Print customer summary" from the Visit Hub
 * or "Print summary" from the in-room presentation.
 *
 * Architecture rules
 * ──────────────────
 *   - Static content only — no engine dependency, no Math.random().
 *   - Print CSS separate (AtlasFrameworkPrintPage.css).
 *   - All user-facing terminology follows docs/atlas-terminology.md.
 */

import './AtlasFrameworkPrintPage.css';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface AtlasFrameworkPrintPageProps {
  /** Called when the user clicks the Back button (screen-only). */
  onBack?: () => void;
}

// ─── Pillars data ─────────────────────────────────────────────────────────────

const PILLARS = [
  {
    number: '1',
    title: 'The Identity',
    subtitle: 'Context',
    body: 'Maps your home details and surveyor assumptions so we can show you exactly what we know about your property.',
  },
  {
    number: '2',
    title: 'The Verdict',
    subtitle: 'Eligibility',
    body: 'Translates system status — viable, caution, or not suitable — into clear, physics-grounded choices.',
  },
  {
    number: '3',
    title: 'The Experience',
    subtitle: 'Timeline',
    body: 'Uses your occupancy profile to simulate life with the new system across a typical 24-hour day.',
  },
  {
    number: '4',
    title: 'The Roadmap',
    subtitle: 'Options & Plans',
    body: 'Highlights future energy opportunities and any installation requirements for long-term planning.',
  },
];

const PORTAL_SECTIONS = [
  {
    number: '1',
    heading: 'The "What Matters to You" Header',
    source: 'Your stated priorities',
    logic:
      'Dynamic cards based on what you told us — for example, "hot water runs out" or "system is noisy".',
    outcome: "\u201cWe\u2019re recommending stored hot water to match your household\u2019s demand.\u201d",
  },
  {
    number: '2',
    heading: 'The Interactive 24-Hour Timeline',
    source: 'Day simulation visuals',
    logic:
      'A scrubbable graph showing how room temperature and hot water supply fluctuate across a typical day based on your occupancy profile.',
    outcome: null,
  },
  {
    number: '3',
    heading: 'Physics-Based Ratings',
    source: 'Heating and hot-water option analysis',
    logic:
      'Performance bands — Excellent, Good, Needs Right Setup — rather than arbitrary scores.',
    outcome:
      'Each rating has a "Why?" drill-down that reveals the physics evidence behind it.',
  },
  {
    number: '4',
    heading: 'Real-World Scenario Explorer',
    source: 'Real-world behaviour data',
    logic:
      'Scenarios like "Morning shower + kitchen tap" with a performance bar from Poor to Excellent.',
    outcome: null,
  },
];

const PDF_PAGES = [
  {
    page: '1',
    heading: 'The Executive Summary',
    items: [
      'Primary Recommendation — bold hero title of the top-ranked system.',
      '"At a Glance" stats — heat loss (kW), bathroom count, and occupancy.',
    ],
  },
  {
    page: '2',
    heading: 'The Comparison',
    items: [
      '"Atlas Pick" vs. "Alternatives" — side-by-side view of your quoted options.',
      'Avoided Risks — what the recommended system protects you against.',
    ],
  },
  {
    page: '3',
    heading: 'The Technical Blueprint',
    items: [
      'Requirements Checklist — must-have items such as G3-qualified installers or 28 mm primary pipes.',
      'Installation complexity summary — for example, "Low disruption" or "No cylinder space needed".',
    ],
  },
];

const LLM_CONTEXT_FIELDS = [
  { label: 'User Goal', example: 'Reduce carbon footprint while ensuring 4 showers in the morning' },
  { label: 'Primary Constraint', example: 'No cylinder space confirmed' },
  { label: 'Efficiency Trap', example: 'Shift-worker efficiency collapse for draws under 15 s' },
  { label: 'Physics Verdict', example: 'System is thermal-capacity-limited, not pressure-limited' },
  { label: 'Improvement Pathway', example: 'Descale coil or upgrade to Mixergy' },
];

const SUMMARY_ROWS = [
  { element: 'Data Depth', portal: 'High (all 15-minute data points)', pdf: 'Medium (key averages)' },
  { element: 'Visual Style', portal: 'Interactive / animated', pdf: 'High-contrast / static' },
  { element: 'Navigation', portal: 'Non-linear / exploration', pdf: 'Linear / narrative' },
  { element: 'Key Action', portal: '"Explore Physics"', pdf: '"Approve Quote"' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function AtlasFrameworkPrintPage({ onBack }: AtlasFrameworkPrintPageProps) {
  return (
    <div className="afp-wrap">

      {/* ── Screen toolbar (hidden on print) ── */}
      <div className="afp-toolbar" data-testid="afp-toolbar">
        {onBack && (
          <button className="afp-toolbar__back" onClick={onBack} aria-label="Back">
            ← Back
          </button>
        )}
        <span className="afp-toolbar__label">Customer recommendation summary</span>
        <button
          className="afp-toolbar__print"
          onClick={() => window.print()}
          aria-label="Print summary"
          data-testid="afp-print-button"
        >
          Print summary
        </button>
      </div>

      {/* ── A4 page card ── */}
      <div className="afp-page" data-testid="afp-page">

        {/* ── Page header ── */}
        <header className="afp-header">
          <div className="afp-header__logo" aria-hidden="true">◆</div>
          <div className="afp-header__body">
            <h1 className="afp-header__title">Your Atlas Recommendation</h1>
            <p className="afp-header__subtitle">
              A framework built on physics — translating your home's data into the right system choice.
            </p>
          </div>
        </header>

        {/* ── Section 1: Core-to-UI Mapping ── */}
        <section className="afp-section" data-testid="afp-section-mapping">
          <h2 className="afp-section__heading">
            <span className="afp-section__icon" aria-hidden="true">🏗</span>
            The Four Atlas Pillars
          </h2>
          <p className="afp-section__intro">
            Before any recommendation is shown, your home's data is mapped across four pillars.
            Every number and label you see traces directly back to one of these foundations.
          </p>
          <div className="afp-pillars">
            {PILLARS.map((p) => (
              <div className="afp-pillar" key={p.number}>
                <span className="afp-pillar__number">{p.number}</span>
                <div className="afp-pillar__body">
                  <p className="afp-pillar__title">
                    {p.title}
                    <span className="afp-pillar__subtitle"> — {p.subtitle}</span>
                  </p>
                  <p className="afp-pillar__text">{p.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Section 2: Interactive Portal ── */}
        <section className="afp-section" data-testid="afp-section-portal">
          <h2 className="afp-section__heading">
            <span className="afp-section__icon" aria-hidden="true">📱</span>
            Your Interactive Portal
          </h2>
          <p className="afp-section__intro">
            Best for high engagement, transparency, and building trust through data exploration.
          </p>
          <div className="afp-portal-sections">
            {PORTAL_SECTIONS.map((s) => (
              <div className="afp-portal-section" key={s.number}>
                <div className="afp-portal-section__num" aria-hidden="true">{s.number}</div>
                <div className="afp-portal-section__body">
                  <p className="afp-portal-section__heading">{s.heading}</p>
                  <p className="afp-portal-section__source">
                    <span className="afp-label">Source:</span> {s.source}
                  </p>
                  <p className="afp-portal-section__logic">{s.logic}</p>
                  {s.outcome && (
                    <p className="afp-portal-section__outcome">
                      <span className="afp-label">Outcome:</span> <em>{s.outcome}</em>
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Section 3: Printable PDF ── */}
        <section className="afp-section" data-testid="afp-section-pdf">
          <h2 className="afp-section__heading">
            <span className="afp-section__icon" aria-hidden="true">📄</span>
            Your Printable Recommendation
          </h2>
          <p className="afp-section__intro">
            Best for shared decision-making, installer reference, and an archival record.
          </p>
          <div className="afp-pdf-pages">
            {PDF_PAGES.map((pg) => (
              <div className="afp-pdf-page" key={pg.page}>
                <div className="afp-pdf-page__label">Page {pg.page}</div>
                <div className="afp-pdf-page__body">
                  <p className="afp-pdf-page__heading">{pg.heading}</p>
                  <ul className="afp-pdf-page__list">
                    {pg.items.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Section 4: LLM Side-Load Block ── */}
        <section className="afp-section" data-testid="afp-section-ai">
          <h2 className="afp-section__heading">
            <span className="afp-section__icon" aria-hidden="true">🤖</span>
            AI-Ready Context Block
          </h2>
          <p className="afp-section__intro">
            Every view includes a structured context block so the Atlas AI can answer your questions in real time.
          </p>
          <div className="afp-llm-block">
            {LLM_CONTEXT_FIELDS.map((f) => (
              <div className="afp-llm-row" key={f.label}>
                <span className="afp-llm-row__label">{f.label}:</span>
                <span className="afp-llm-row__example">{f.example}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Section 5: Summary table ── */}
        <section className="afp-section" data-testid="afp-section-summary">
          <h2 className="afp-section__heading">
            <span className="afp-section__icon" aria-hidden="true">🛠</span>
            Framework at a Glance
          </h2>
          <table className="afp-table" role="table">
            <thead>
              <tr>
                <th className="afp-table__th">Element</th>
                <th className="afp-table__th">Portal (online)</th>
                <th className="afp-table__th">Printable (PDF)</th>
              </tr>
            </thead>
            <tbody>
              {SUMMARY_ROWS.map((row) => (
                <tr key={row.element}>
                  <td className="afp-table__td afp-table__td--label">{row.element}</td>
                  <td className="afp-table__td">{row.portal}</td>
                  <td className="afp-table__td">{row.pdf}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* ── Footer ── */}
        <footer className="afp-footer" data-testid="afp-footer">
          <p className="afp-footer__text">Generated by Atlas · physics-driven recommendation engine</p>
        </footer>
      </div>
    </div>
  );
}
