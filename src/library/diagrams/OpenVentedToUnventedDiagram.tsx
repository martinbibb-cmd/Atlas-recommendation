import './diagrams.css';

const SCREEN_READER_SUMMARY =
  'Two-panel comparison. Left: open-vented heating with a feed and expansion tank open to atmosphere. Right: sealed heating system with expansion vessel and pressure gauge in the healthy zone.';

const WHAT_THIS_MEANS =
  'A sealed heating system keeps the central heating circuit closed and stable, while the expansion vessel safely absorbs the small pressure changes as the water heats and cools.';

export interface OpenVentedToUnventedDiagramProps {
  printSafe?: boolean;
  /**
   * Surveyed cold-water storage tank volume in litres.
   * Only shown when explicitly recorded.
   */
  cwsVolumeLSurveyed?: number;
  /**
   * When true, the property has two linked loft tanks.
   */
  twinCwsTanks?: boolean;
}

export function OpenVentedToUnventedDiagram({
  printSafe = false,
  cwsVolumeLSurveyed,
  twinCwsTanks = false,
}: OpenVentedToUnventedDiagramProps) {
  const cwsLabel = twinCwsTanks
    ? 'Two linked loft tanks'
    : 'Cold water storage tank (loft)';

  const cwsCapacityLabel =
    cwsVolumeLSurveyed != null ? `${cwsVolumeLSurveyed} L (surveyed)` : undefined;

  return (
    <div
      className="atlas-edu-diagram__wrapper atlas-edu-diagram-primitives atlas-ukheating"
      aria-label="Open-vented to sealed and unvented diagram"
      data-print-safe={printSafe ? 'true' : undefined}
    >
      <p className="atlas-edu-diagram__screen-reader-summary">{SCREEN_READER_SUMMARY}</p>

      <div className="atlas-edu-diagram__before-after">
        <section className="atlas-edu-diagram__before-after-panel" aria-label="Open-vented system">
          <p className="atlas-edu-diagram__before-after-panel-label">Before: open-vented</p>
          <svg viewBox="0 0 320 210" role="img" aria-hidden="true" focusable="false" className="atlas-ukheating__svg">
            <rect x="24" y="18" width="62" height="36" rx="6" className="atlas-ukheating__tank" />
            <line x1="86" y1="36" x2="112" y2="36" className="atlas-ukheating__pipe" />
            <line x1="112" y1="36" x2="112" y2="84" className="atlas-ukheating__pipe" />
            <line x1="112" y1="84" x2="252" y2="84" className="atlas-ukheating__pipe" />
            <line x1="70" y1="18" x2="70" y2="6" className="atlas-ukheating__pipe atlas-ukheating__vent" />
            <circle cx="70" cy="3" r="2" className="atlas-ukheating__vent-dot" />
            <rect x="212" y="58" width="58" height="78" rx="14" className="atlas-ukheating__cylinder" />
            <path d="M 32 154 L 278 154 L 278 190 L 32 190 Z" className="atlas-ukheating__loop" />
            <circle cx="62" cy="172" r="8" className="atlas-ukheating__radiator" />
            <circle cx="112" cy="172" r="8" className="atlas-ukheating__radiator" />
            <circle cx="162" cy="172" r="8" className="atlas-ukheating__radiator" />
          </svg>
          <p className="atlas-edu-diagram__label">{cwsLabel}</p>
          {cwsCapacityLabel ? <p className="atlas-edu-diagram__label">{cwsCapacityLabel}</p> : null}
          <p className="atlas-edu-diagram__label">Vented hot water cylinder</p>
          <p className="atlas-edu-diagram__label">Open path to atmosphere</p>
        </section>

        <section className="atlas-edu-diagram__before-after-panel" aria-label="Sealed system">
          <p className="atlas-edu-diagram__before-after-panel-label">After: sealed + unvented</p>
          <svg
            viewBox="0 0 320 210"
            role="img"
            aria-hidden="true"
            focusable="false"
            className={`atlas-ukheating__svg${printSafe ? '' : ' atlas-ukheating__svg--animated'}`}
          >
            <path d="M 32 154 L 278 154 L 278 190 L 32 190 Z" className="atlas-ukheating__loop" />
            <circle cx="62" cy="172" r="8" className="atlas-ukheating__radiator" />
            <circle cx="112" cy="172" r="8" className="atlas-ukheating__radiator" />
            <circle cx="162" cy="172" r="8" className="atlas-ukheating__radiator" />
            <circle cx="248" cy="90" r="32" className="atlas-ukheating__vessel" />
            <path d="M 248 58 C 236 73, 236 107, 248 122 C 260 107, 260 73, 248 58 Z" className="atlas-ukheating__diaphragm" />
            <circle cx="88" cy="78" r="30" className="atlas-ukheating__gauge-face" />
            <line x1="88" y1="78" x2="102" y2="66" className="atlas-ukheating__gauge-needle" />
            <path d="M 64 95 A 27 27 0 0 1 112 95" className="atlas-ukheating__gauge-band" />
          </svg>
          <p className="atlas-edu-diagram__label">Unvented cylinder</p>
          <p className="atlas-edu-diagram__label">Expansion vessel (rubber diaphragm inside metal vessel)</p>
          <p className="atlas-edu-diagram__label">System pressure: 1.0–1.5 bar</p>
        </section>
      </div>

      <p className="atlas-edu-diagram__caption">{WHAT_THIS_MEANS}</p>
    </div>
  );
}
