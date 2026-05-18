import './diagrams.css';

const SCREEN_READER_SUMMARY =
  'Two-part visual. Part one compares weather compensation and load compensation. Part two shows radiator valves closing while the automatic bypass valve opens to keep safe flow through the boiler.';

const WHAT_THIS_MEANS =
  'Weather compensation helps the boiler run gently before the home gets cold, while the automatic bypass valve protects flow through the boiler when radiator valves close.';

export interface WeatherCompensationCurveDiagramProps {
  printSafe?: boolean;
}

export function WeatherCompensationCurveDiagram({
  printSafe = false,
}: WeatherCompensationCurveDiagramProps) {
  return (
    <div
      className="atlas-edu-diagram__wrapper atlas-edu-diagram-primitives atlas-ukheating"
      aria-label="Weather compensation, load compensation, and automatic bypass valve diagram"
      data-print-safe={printSafe ? 'true' : undefined}
    >
      <p className="atlas-edu-diagram__screen-reader-summary">{SCREEN_READER_SUMMARY}</p>

      <div className="atlas-edu-diagram__before-after">
        <section className="atlas-edu-diagram__before-after-panel" aria-label="Weather and load compensation comparison">
          <p className="atlas-edu-diagram__before-after-panel-label">Weather vs load compensation</p>
          <svg
            viewBox="0 0 320 200"
            role="img"
            aria-hidden="true"
            focusable="false"
            className={`atlas-ukheating__svg${printSafe ? '' : ' atlas-ukheating__svg--animated'}`}
          >
            <rect x="18" y="18" width="132" height="160" rx="10" className="atlas-ukheating__panel" />
            <rect x="170" y="18" width="132" height="160" rx="10" className="atlas-ukheating__panel" />
            <circle cx="50" cy="46" r="9" className="atlas-ukheating__sensor" />
            <path d="M 64 46 L 126 46" className="atlas-ukheating__pipe" />
            <path d="M 34 142 C 58 120, 92 118, 126 98" className="atlas-ukheating__curve atlas-ukheating__curve--steady" />
            <path d="M 186 140 L 204 108 L 222 140 L 240 108 L 258 140 L 276 108" className="atlas-ukheating__curve atlas-ukheating__curve--burst" />
            <rect x="44" y="120" width="18" height="22" className="atlas-ukheating__rad" />
            <rect x="76" y="112" width="18" height="30" className="atlas-ukheating__rad" />
            <rect x="108" y="118" width="18" height="24" className="atlas-ukheating__rad" />
            <rect x="198" y="120" width="18" height="22" className="atlas-ukheating__rad" />
            <rect x="230" y="112" width="18" height="30" className="atlas-ukheating__rad" />
            <rect x="262" y="118" width="18" height="24" className="atlas-ukheating__rad" />
          </svg>
          <p className="atlas-edu-diagram__label">Weather compensation: proactive warm and steady radiator flow</p>
          <p className="atlas-edu-diagram__label">Load compensation: reacts after room temperature falls</p>
        </section>

        <section className="atlas-edu-diagram__before-after-panel" aria-label="Automatic bypass valve behaviour">
          <p className="atlas-edu-diagram__before-after-panel-label">Automatic bypass valve (ABV)</p>
          <svg
            viewBox="0 0 320 200"
            role="img"
            aria-hidden="true"
            focusable="false"
            className={`atlas-ukheating__svg${printSafe ? '' : ' atlas-ukheating__svg--animated'}`}
          >
            <path d="M 34 56 H 284 V 154 H 34 Z" className="atlas-ukheating__loop" />
            <rect x="40" y="78" width="44" height="54" rx="8" className="atlas-ukheating__boiler" />
            <circle cx="102" cy="104" r="12" className="atlas-ukheating__pump" />
            <rect x="146" y="64" width="20" height="32" className="atlas-ukheating__rad" />
            <rect x="182" y="64" width="20" height="32" className="atlas-ukheating__rad atlas-ukheating__trv-closed" />
            <rect x="218" y="64" width="20" height="32" className="atlas-ukheating__rad atlas-ukheating__trv-closed" />
            <path d="M 142 134 C 172 112, 206 112, 236 134" className="atlas-ukheating__abv-path" />
            <circle cx="188" cy="124" r="8" className="atlas-ukheating__abv" />
          </svg>
          <p className="atlas-edu-diagram__label">When TRVs close, radiator flow reduces</p>
          <p className="atlas-edu-diagram__label">ABV opens to provide a safe bypass back to return</p>
        </section>
      </div>

      <p className="atlas-edu-diagram__caption">{WHAT_THIS_MEANS}</p>
    </div>
  );
}
