import './diagrams.css';

const SCREEN_READER_SUMMARY =
  'Two-panel comparison. Left: open-vented setup with loft cold-water storage tank, vented cylinder, boiler, pump, and open vent path. Right: sealed system with boiler, pump, unvented cylinder, expansion vessel cutaway, filling-loop cue, and pressure gauge in the normal operating zone.';

const WHAT_THIS_MEANS =
  'A sealed heating system keeps the central heating circuit closed and stable, while the expansion vessel safely absorbs the small pressure changes as the water heats and cools.';

export interface OpenVentedToUnventedDiagramProps {
  printSafe?: boolean;
  /**
   * Surveyed cold-water storage tank volume in litres.
   * Only shown when explicitly recorded during survey; omit if not recorded
   * to avoid displaying guessed values.
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
            <rect x="20" y="14" width="72" height="38" rx="6" className="atlas-ukheating__tank" />
            <line x1="92" y1="34" x2="128" y2="34" className="atlas-ukheating__pipe" />
            <line x1="128" y1="34" x2="128" y2="88" className="atlas-ukheating__pipe" />
            <line x1="128" y1="88" x2="258" y2="88" className="atlas-ukheating__pipe" />
            <line x1="70" y1="18" x2="70" y2="6" className="atlas-ukheating__pipe atlas-ukheating__vent" />
            <circle cx="70" cy="3" r="2" className="atlas-ukheating__vent-dot" />
            <rect x="212" y="58" width="62" height="82" rx="14" className="atlas-ukheating__cylinder" />
            <rect x="34" y="118" width="46" height="50" rx="8" className="atlas-ukheating__boiler" />
            <circle cx="100" cy="142" r="11" className="atlas-ukheating__pump" />
            <path d="M 24 154 H 286 V 190 H 24 Z" className="atlas-ukheating__loop" />
            <rect x="140" y="154" width="18" height="28" className="atlas-ukheating__rad" />
            <rect x="174" y="154" width="18" height="28" className="atlas-ukheating__rad" />
            <rect x="208" y="154" width="18" height="28" className="atlas-ukheating__rad" />
          </svg>
          <p className="atlas-edu-diagram__label">{cwsLabel}</p>
          {cwsCapacityLabel ? <p className="atlas-edu-diagram__label">{cwsCapacityLabel}</p> : null}
          <p className="atlas-edu-diagram__label">Boiler + pump feed radiator loop</p>
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
            <path d="M 24 154 H 286 V 190 H 24 Z" className="atlas-ukheating__loop" />
            <rect x="34" y="118" width="46" height="50" rx="8" className="atlas-ukheating__boiler" />
            <circle cx="100" cy="142" r="11" className="atlas-ukheating__pump" />
            <rect x="140" y="154" width="18" height="28" className="atlas-ukheating__rad" />
            <rect x="174" y="154" width="18" height="28" className="atlas-ukheating__rad atlas-ukheating__rad-warm" />
            <rect x="208" y="154" width="18" height="28" className="atlas-ukheating__rad atlas-ukheating__rad-warm" />
            <circle cx="246" cy="90" r="30" className="atlas-ukheating__vessel" />
            <path d="M 246 62 C 235 76, 235 104, 246 118 C 257 104, 257 76, 246 62 Z" className="atlas-ukheating__diaphragm" />
            <circle cx="92" cy="76" r="28" className="atlas-ukheating__gauge-face" />
            <line x1="92" y1="76" x2="106" y2="64" className="atlas-ukheating__gauge-needle" />
            <path d="M 70 91 A 24 24 0 0 1 114 91" className="atlas-ukheating__gauge-band" />
            <path d="M 128 126 H 164" className="atlas-ukheating__pipe atlas-ukheating__filling-loop" />
            <circle cx="136" cy="126" r="3" className="atlas-ukheating__valve-dot" />
            <circle cx="156" cy="126" r="3" className="atlas-ukheating__valve-dot" />
          </svg>
          <p className="atlas-edu-diagram__label">Boiler + pump in sealed radiator circuit</p>
          <p className="atlas-edu-diagram__label">Unvented cylinder</p>
          <p className="atlas-edu-diagram__label">Filling loop (closed when not topping up)</p>
          <p className="atlas-edu-diagram__label">Expansion vessel (rubber diaphragm inside metal vessel)</p>
          <p className="atlas-edu-diagram__label">System pressure: 1.0–1.5 bar</p>
        </section>
      </div>

      <p className="atlas-edu-diagram__caption">{WHAT_THIS_MEANS}</p>
    </div>
  );
}
