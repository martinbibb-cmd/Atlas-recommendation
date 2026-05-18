import './diagrams.css';

const SCREEN_READER_SUMMARY =
  'A large sealed-system pressure gauge with low zone below 1.0 bar, healthy green range around 1.0–1.5 bar when cold, and high warning zone above normal. Labels explain low pressure and high pressure household effects.';

const WHAT_THIS_MEANS =
  'System pressure is the sealed heating circuit’s starting pressure; too low can stop radiators heating properly, while too high may cause the system to discharge for safety.';

export interface SystemPressureWindowDiagramProps {
  printSafe?: boolean;
}

export function SystemPressureWindowDiagram({ printSafe = false }: SystemPressureWindowDiagramProps) {
  return (
    <div
      className="atlas-edu-diagram__wrapper atlas-edu-diagram-primitives atlas-ukheating"
      aria-label="System pressure operating window diagram"
      data-print-safe={printSafe ? 'true' : undefined}
    >
      <p className="atlas-edu-diagram__screen-reader-summary">{SCREEN_READER_SUMMARY}</p>

      <svg
        viewBox="0 0 420 240"
        role="img"
        aria-hidden="true"
        focusable="false"
        className={`atlas-ukheating__svg atlas-ukheating__svg--wide${printSafe ? '' : ' atlas-ukheating__svg--animated'}`}
      >
        <circle cx="210" cy="124" r="92" className="atlas-ukheating__gauge-face" />
        <path d="M 128 168 A 92 92 0 0 1 172 58" className="atlas-ukheating__zone atlas-ukheating__zone--low" />
        <path d="M 172 58 A 92 92 0 0 1 252 52" className="atlas-ukheating__zone atlas-ukheating__zone--healthy" />
        <path d="M 252 52 A 92 92 0 0 1 292 168" className="atlas-ukheating__zone atlas-ukheating__zone--high" />
        <line x1="210" y1="124" x2="244" y2="88" className="atlas-ukheating__gauge-needle atlas-ukheating__gauge-needle--healthy" />
      </svg>

      <div style={{ display: 'grid', gap: '0.35rem' }}>
        <p className="atlas-edu-diagram__label">Low zone: below 1.0 bar</p>
        <p className="atlas-edu-diagram__label">Healthy zone (cold): around 1.0–1.5 bar</p>
        <p className="atlas-edu-diagram__label">High warning zone: above normal range</p>
      </div>

      <div style={{ display: 'grid', gap: '0.35rem' }}>
        <p className="atlas-edu-diagram__label">Low pressure: radiators may not heat properly</p>
        <p className="atlas-edu-diagram__label">High pressure: system may discharge through safety pipework</p>
      </div>

      <p className="atlas-edu-diagram__caption">{WHAT_THIS_MEANS}</p>
    </div>
  );
}
