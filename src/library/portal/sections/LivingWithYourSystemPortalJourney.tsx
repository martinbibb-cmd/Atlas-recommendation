import './livingWithYourSystemPortalJourney.css';

export interface LivingWithYourSystemPortalJourneyProps {
  bathroomCount?: number;
}

const TIMELINE_STEPS = [
  {
    id: 'morning',
    heading: 'Morning',
    body: 'The cylinder is already prepared before first use, so showers and taps start from ready stored hot water.',
  },
  {
    id: 'evening',
    heading: 'Evening',
    body: 'Normal family use stays familiar, with the same controls and routines you already know.',
  },
  {
    id: 'peak-use',
    heading: 'Peak use',
    body: 'When two people need hot water at once, the stored reserve supports overlap more comfortably.',
  },
  {
    id: 'recovery',
    heading: 'Recovery',
    body: 'After heavier draw-off, recovery happens in the background without manual intervention.',
  },
] as const;

export function LivingWithYourSystemPortalJourney({
  bathroomCount = 2,
}: LivingWithYourSystemPortalJourneyProps) {
  return (
    <section
      className="lwspj-section"
      aria-labelledby="lwspj-heading"
      data-testid="lwspj-section"
      data-motion="safe"
    >
      <header className="lwspj-hero" data-testid="lwspj-hero">
        <p className="lwspj-hero__eyebrow">Living with your system</p>
        <h2 id="lwspj-heading" className="lwspj-hero__title">
          What everyday life can feel like after the upgrade
        </h2>
        <p className="lwspj-hero__summary">
          This is a calm day-to-day journey: what changes, what stays familiar,
          and why installers trust this route for homes with stored hot water.
        </p>
      </header>

      <div className="lwspj-timeline" data-testid="lwspj-timeline">
        {TIMELINE_STEPS.map((step) => (
          <article
            key={step.id}
            className="lwspj-timeline-card"
            data-testid={`lwspj-timeline-${step.id}`}
          >
            <h3>{step.heading}</h3>
            <p>{step.body}</p>
          </article>
        ))}
      </div>

      <div className="lwspj-subsections" data-testid="lwspj-subsections">
        <article className="lwspj-card" data-testid="lwspj-morning-usage">
          <h3>Morning usage</h3>
          <p>
            Your first shower does not depend on a frantic start-up moment. The
            store is prepared, so mornings feel ready rather than rushed.
          </p>
          <p className="lwspj-reassure">System already prepared before demand.</p>
        </article>

        <article className="lwspj-card" data-testid="lwspj-multiple-showers">
          <h3>Multiple showers</h3>
          <p>
            In a {bathroomCount}-bathroom home, overlap is common. Stored hot
            water helps both showers run together with steadier flow.
          </p>
          <div className="lwspj-visual lwspj-visual--showers" aria-label="Two showers overlap visual" data-testid="lwspj-showers-visual">
            <div className="lwspj-shower-row">
              <span className="lwspj-shower-label">Shower 1</span>
              <span className="lwspj-shower-track">
                <span className="lwspj-shower-run lwspj-shower-run--first" />
              </span>
            </div>
            <div className="lwspj-shower-row">
              <span className="lwspj-shower-label">Shower 2</span>
              <span className="lwspj-shower-track">
                <span className="lwspj-shower-run lwspj-shower-run--second" />
              </span>
            </div>
          </div>
        </article>

        <article className="lwspj-card" data-testid="lwspj-bath-fill-expectations">
          <h3>Bath fill expectations</h3>
          <p>
            Bath filling feels less stop-start because hot water comes from a
            ready reserve, not only from live production at that moment.
          </p>
          <div className="lwspj-visual lwspj-visual--bath" aria-label="Bath fill comparison visual" data-testid="lwspj-bath-visual">
            <div className="lwspj-bath-column lwspj-bath-column--comparison">
              <span className="lwspj-bath-column__label">On-demand only</span>
              <span className="lwspj-bath-column__bar" />
            </div>
            <div className="lwspj-bath-column lwspj-bath-column--recommended">
              <span className="lwspj-bath-column__label">Stored reserve</span>
              <span className="lwspj-bath-column__bar" />
            </div>
          </div>
        </article>

        <article className="lwspj-card" data-testid="lwspj-installation-day-changes">
          <h3>What changes after installation day</h3>
          <p>
            You keep familiar room-by-room heating behaviour while gaining a
            mains-fed hot-water store and cleaner supply confidence.
          </p>
          <ul className="lwspj-expectation-list" data-testid="lwspj-expectations">
            <li>Radiators may behave the same.</li>
            <li>Hot water may feel more consistent.</li>
            <li>The cylinder is not constantly reheating.</li>
            <li>You do not need to manage it manually.</li>
          </ul>
        </article>

        <article className="lwspj-card" data-testid="lwspj-stop-worrying">
          <h3>What customers normally stop worrying about</h3>
          <p>
            Most households stop thinking about shower clashes, bath timing,
            and sudden pressure dips at busy moments.
          </p>
          <div className="lwspj-visual-grid" data-testid="lwspj-reassurance-visuals">
            <div className="lwspj-visual lwspj-visual--reserve" aria-label="Stored hot-water reserve visual" data-testid="lwspj-reserve-visual">
              <p className="lwspj-visual-title">Stored hot-water reserve</p>
              <div className="lwspj-reserve-bar" aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
              </div>
            </div>
            <div className="lwspj-visual lwspj-visual--pressure" aria-label="Pressure stability visual" data-testid="lwspj-pressure-visual">
              <p className="lwspj-visual-title">Pressure stability</p>
              <div className="lwspj-pressure-lines" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        </article>
      </div>

      <aside className="lwspj-trust-layer" data-testid="lwspj-trust-layer" aria-label="Why this route is trusted">
        <h3>Why this path is trusted</h3>
        <ul>
          <li>Installers recommend it for larger hot-water demand and consistent daily comfort.</li>
          <li>Longevity matters because stable operation supports fewer stress points over time.</li>
          <li>Stored hot water avoids combination boiler bottlenecks during overlapping use.</li>
        </ul>
      </aside>

      <div className="lwspj-print-sheet" data-testid="lwspj-print-sheet" data-print-safe="true" aria-label="Living with your system printable sheet">
        <h3>Living with your system</h3>
        <p>
          Daily rhythm: Morning ready store, evening familiarity, peak overlap
          support, and quiet recovery in the background.
        </p>
      </div>

      <div className="lwspj-print-handout" data-testid="lwspj-print-handout" data-print-safe="true" aria-label="Compact customer handout">
        <p><strong>Compact handout:</strong> Ready hot-water reserve, steadier overlap, familiar heating behaviour, and no manual management routine.</p>
      </div>
    </section>
  );
}
