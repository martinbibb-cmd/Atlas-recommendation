import './diagrams.css';

const SCREEN_READER_SUMMARY =
  'Heating return pipe feeds a magnetic filter body before the boiler. Dark magnetite particles are captured at the magnet core while cleaner heating water continues toward the boiler.';

const WHAT_THIS_MEANS =
  'A magnetic filter protects the boiler by catching tiny black iron particles from the central heating water before they can build up inside important components.';

export interface MagneticFilterDiagramProps {
  printSafe?: boolean;
}

export function MagneticFilterDiagram({ printSafe = false }: MagneticFilterDiagramProps) {
  return (
    <div
      className="atlas-edu-diagram__wrapper atlas-edu-diagram-primitives atlas-ukheating"
      aria-label="Magnetic filter capture diagram"
      data-print-safe={printSafe ? 'true' : undefined}
    >
      <p className="atlas-edu-diagram__screen-reader-summary">{SCREEN_READER_SUMMARY}</p>

      <svg
        viewBox="0 0 520 170"
        role="img"
        aria-hidden="true"
        focusable="false"
        className={`atlas-ukheating__svg atlas-ukheating__svg--wide${printSafe ? '' : ' atlas-ukheating__svg--animated'}`}
      >
        <line x1="24" y1="88" x2="180" y2="88" className="atlas-ukheating__pipe" />
        <path d="M 24 88 H 56" className="atlas-ukheating__dirty-path" />
        <rect x="180" y="46" width="120" height="84" rx="12" className="atlas-ukheating__filter-body" />
        <line x1="240" y1="54" x2="240" y2="122" className="atlas-ukheating__filter-magnet" />
        <rect x="228" y="34" width="24" height="12" rx="3" className="atlas-ukheating__filter-cap" />
        <circle cx="224" cy="84" r="4" className="atlas-ukheating__particle" />
        <circle cx="232" cy="94" r="4" className="atlas-ukheating__particle" />
        <circle cx="248" cy="76" r="4" className="atlas-ukheating__particle" />
        <line x1="300" y1="88" x2="462" y2="88" className="atlas-ukheating__pipe" />
        <path d="M 300 88 H 336" className="atlas-ukheating__clean-path" />
        <rect x="462" y="60" width="36" height="56" rx="8" className="atlas-ukheating__boiler" />
      </svg>

      <p className="atlas-edu-diagram__label">Return pipe → magnetic filter body on return → cleaner flow to boiler</p>
      <p className="atlas-edu-diagram__label">Removable magnet core captures magnetite during service checks</p>
      <p className="atlas-edu-diagram__caption">{WHAT_THIS_MEANS}</p>
    </div>
  );
}
