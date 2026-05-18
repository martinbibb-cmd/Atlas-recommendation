import './diagrams.css';

const SCREEN_READER_SUMMARY =
  'Side-by-side cylinder cutaway. Traditional cylinder shows broader blending and lukewarm middle water. Stratified Mixergy cylinder keeps a clear hot top layer, cold lower layer, and sharper thermocline boundary during draw-off.';

const WHAT_THIS_MEANS =
  'A stratified cylinder keeps hot water at the top and cold water at the bottom, so the useful hot layer is protected instead of mixing the whole cylinder lukewarm.';

export interface StratifiedCylinderMixergyDiagramProps {
  printSafe?: boolean;
}

export function StratifiedCylinderMixergyDiagram({ printSafe = false }: StratifiedCylinderMixergyDiagramProps) {
  return (
    <div
      className="atlas-edu-diagram__wrapper atlas-edu-diagram-primitives atlas-ukheating"
      aria-label="Traditional and stratified cylinder comparison"
      data-print-safe={printSafe ? 'true' : undefined}
    >
      <p className="atlas-edu-diagram__screen-reader-summary">{SCREEN_READER_SUMMARY}</p>

      <div className="atlas-edu-diagram__before-after">
        <section className="atlas-edu-diagram__before-after-panel" aria-label="Traditional hot water cylinder">
          <p className="atlas-edu-diagram__before-after-panel-label">Traditional cylinder</p>
          <svg
            viewBox="0 0 320 220"
            role="img"
            aria-hidden="true"
            focusable="false"
            className={`atlas-ukheating__svg${printSafe ? '' : ' atlas-ukheating__svg--animated'}`}
          >
            <rect x="112" y="24" width="96" height="172" rx="42" className="atlas-ukheating__cylinder-shell" />
            <rect x="118" y="30" width="84" height="160" rx="38" className="atlas-ukheating__mixing-zone" />
            <path d="M 118 96 C 146 80, 176 106, 202 94" className="atlas-ukheating__thermocline atlas-ukheating__thermocline--blur" />
            <line x1="204" y1="48" x2="248" y2="48" className="atlas-ukheating__pipe" />
            <line x1="118" y1="166" x2="78" y2="166" className="atlas-ukheating__pipe" />
          </svg>
          <p className="atlas-edu-diagram__label">Broader lukewarm middle zone during draw-off</p>
        </section>

        <section className="atlas-edu-diagram__before-after-panel" aria-label="Mixergy stratified hot water cylinder">
          <p className="atlas-edu-diagram__before-after-panel-label">Mixergy cylinder (stratified)</p>
          <svg
            viewBox="0 0 320 220"
            role="img"
            aria-hidden="true"
            focusable="false"
            className={`atlas-ukheating__svg${printSafe ? '' : ' atlas-ukheating__svg--animated'}`}
          >
            <rect x="112" y="24" width="96" height="172" rx="42" className="atlas-ukheating__cylinder-shell" />
            <rect x="118" y="30" width="84" height="74" rx="34" className="atlas-ukheating__hot-layer" />
            <rect x="118" y="104" width="84" height="86" rx="34" className="atlas-ukheating__cold-layer" />
            <line x1="118" y1="104" x2="202" y2="104" className="atlas-ukheating__thermocline atlas-ukheating__thermocline--sharp" />
            <path d="M 88 166 H 118" className="atlas-ukheating__pipe" />
            <path d="M 202 48 H 246" className="atlas-ukheating__pipe" />
            <path d="M 88 166 C 98 166, 102 154, 112 150" className="atlas-ukheating__diffuser" />
            <path d="M 202 48 H 256" className="atlas-ukheating__draw-off-arrow" />
            <path d="M 84 166 H 118" className="atlas-ukheating__mains-arrow" />
          </svg>
          <p className="atlas-edu-diagram__label">Top draw-off stays hottest, cold mains entry remains low in the vessel</p>
          <p className="atlas-edu-diagram__label">Clear hot top layer with protected usable draw-off</p>
        </section>
      </div>

      <p className="atlas-edu-diagram__caption">{WHAT_THIS_MEANS}</p>
    </div>
  );
}
