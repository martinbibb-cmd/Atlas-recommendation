import './diagrams.css';

const SCREEN_READER_SUMMARY =
  'Two-part diagram: first section compares weather compensation and load compensation on recognisable boiler-and-radiator systems; second section shows TRVs closing while the automatic bypass valve opens between flow and return to protect circulation through the boiler.';

const WHAT_THIS_MEANS =
  'Weather compensation helps the boiler run gently before the home gets cold, while the automatic bypass valve protects flow through the boiler when radiator valves close.';

const COMPENSATION_REFERENCE_POINTS = [
  { outdoor: '-2°C', flow: '50°C' },
  { outdoor: '4°C', flow: '45°C' },
  { outdoor: '10°C', flow: '38°C' },
  { outdoor: '16°C', flow: '32°C' },
];

export interface WeatherCompensationCurveDiagramProps {
  printSafe?: boolean;
}

export function WeatherCompensationCurveDiagram({
  printSafe = false,
}: WeatherCompensationCurveDiagramProps) {
  return (
    <div
      className="atlas-edu-diagram__wrapper atlas-edu-diagram-primitives atlas-ukheating"
      aria-label="Two-part diagram: weather and load compensation comparison, then automatic bypass valve behaviour"
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
            aria-describedby="atlas-ukheating-weather-comp-labels"
            className={`atlas-ukheating__svg${printSafe ? '' : ' atlas-ukheating__svg--animated'}`}
          >
            <rect x="20" y="18" width="130" height="160" rx="10" className="atlas-ukheating__panel" />
            <rect x="170" y="18" width="130" height="160" rx="10" className="atlas-ukheating__panel" />
            <circle cx="42" cy="46" r="10" className="atlas-ukheating__sensor" />
            <path d="M 56 46 H 84" className="atlas-ukheating__pipe" />
            <rect x="88" y="34" width="30" height="24" rx="5" className="atlas-ukheating__boiler" />
            <path d="M 118 46 H 136 V 108 H 44" className="atlas-ukheating__pipe" />
            <rect x="44" y="92" width="16" height="28" className="atlas-ukheating__rad atlas-ukheating__rad-warm" />
            <rect x="68" y="92" width="16" height="28" className="atlas-ukheating__rad atlas-ukheating__rad-warm" />
            <rect x="92" y="92" width="16" height="28" className="atlas-ukheating__rad atlas-ukheating__rad-warm" />
            <path d="M 40 136 C 64 118, 88 112, 136 92" className="atlas-ukheating__curve atlas-ukheating__curve--steady" />

            <rect x="182" y="34" width="30" height="24" rx="5" className="atlas-ukheating__boiler" />
            <rect x="224" y="38" width="34" height="18" rx="4" className="atlas-ukheating__stat" />
            <path d="M 212 46 H 224" className="atlas-ukheating__pipe" />
            <path d="M 258 46 H 284 V 108 H 194" className="atlas-ukheating__pipe" />
            <rect x="194" y="92" width="16" height="28" className="atlas-ukheating__rad atlas-ukheating__rad-cool" />
            <rect x="218" y="92" width="16" height="28" className="atlas-ukheating__rad atlas-ukheating__rad-cool" />
            <rect x="242" y="92" width="16" height="28" className="atlas-ukheating__rad atlas-ukheating__rad-hot" />
            <path d="M 190 136 L 206 108 L 222 136 L 238 108 L 254 136 L 270 108" className="atlas-ukheating__curve atlas-ukheating__curve--burst" />
          </svg>
          <div id="atlas-ukheating-weather-comp-labels" style={{ display: 'grid', gap: '0.35rem' }}>
            <p className="atlas-edu-diagram__label">Weather compensation: outdoor sensor guides steady boiler flow</p>
            <p className="atlas-edu-diagram__label">Load compensation: room thermostat calls later, then boiler responds</p>
          </div>
        </section>

        <section className="atlas-edu-diagram__before-after-panel" aria-label="Automatic bypass valve behaviour">
          <p className="atlas-edu-diagram__before-after-panel-label">Automatic bypass valve (ABV)</p>
          <svg
            viewBox="0 0 320 200"
            role="img"
            aria-hidden="true"
            focusable="false"
            aria-describedby="atlas-ukheating-abv-labels"
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
          <div id="atlas-ukheating-abv-labels" style={{ display: 'grid', gap: '0.35rem' }}>
            <p className="atlas-edu-diagram__label">Flow pipe up top, return pipe below, pump keeps circulation moving</p>
            <p className="atlas-edu-diagram__label">When TRVs close, ABV opens between flow and return</p>
          </div>
        </section>
      </div>

      <ul className="atlas-edu-diagram__timeline-phases-descriptions">
        {COMPENSATION_REFERENCE_POINTS.map((point) => (
          <li key={point.outdoor} className="atlas-edu-diagram__timeline-phase-desc">
            <strong>{point.outdoor} outside:</strong> target flow around {point.flow}
          </li>
        ))}
      </ul>

      <p className="atlas-edu-diagram__caption">{WHAT_THIS_MEANS}</p>
    </div>
  );
}
