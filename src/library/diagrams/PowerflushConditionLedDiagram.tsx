import './diagrams.css';

const SCREEN_READER_SUMMARY =
  'Before and after central heating loop. Before shows dark sludge, restricted flow, and cold radiator patches. After shows cleaner flow, even radiator warmth, and a magnetic filter catching debris.';

const WHAT_THIS_MEANS =
  'A Powerflush is used when system water is dirty enough to restrict flow, helping radiators heat evenly again and reducing strain on the boiler and pump.';

export interface PowerflushConditionLedDiagramProps {
  printSafe?: boolean;
}

export function PowerflushConditionLedDiagram({ printSafe = false }: PowerflushConditionLedDiagramProps) {
  return (
    <div
      className="atlas-edu-diagram__wrapper atlas-edu-diagram-primitives atlas-ukheating"
      aria-label="Condition-led Powerflush comparison"
      data-print-safe={printSafe ? 'true' : undefined}
    >
      <p className="atlas-edu-diagram__screen-reader-summary">{SCREEN_READER_SUMMARY}</p>

      <div className="atlas-edu-diagram__before-after">
        <section className="atlas-edu-diagram__before-after-panel" aria-label="Before cleaning">
          <p className="atlas-edu-diagram__before-after-panel-label">Before</p>
          <svg viewBox="0 0 320 200" role="img" aria-hidden="true" focusable="false" className="atlas-ukheating__svg">
            <path d="M 34 58 H 286 V 152 H 34 Z" className="atlas-ukheating__loop atlas-ukheating__dirty-loop" />
            <rect x="46" y="74" width="42" height="52" rx="8" className="atlas-ukheating__boiler" />
            <circle cx="104" cy="100" r="12" className="atlas-ukheating__pump atlas-ukheating__pump-stressed" />
            <rect x="146" y="68" width="20" height="34" className="atlas-ukheating__rad atlas-ukheating__rad-cold" />
            <rect x="184" y="68" width="20" height="34" className="atlas-ukheating__rad atlas-ukheating__rad-cold" />
            <rect x="222" y="68" width="20" height="34" className="atlas-ukheating__rad" />
          </svg>
          <p className="atlas-edu-diagram__label">Sludge and magnetite restrict circulation</p>
        </section>

        <section className="atlas-edu-diagram__before-after-panel" aria-label="After condition-led Powerflush">
          <p className="atlas-edu-diagram__before-after-panel-label">After</p>
          <svg
            viewBox="0 0 320 200"
            role="img"
            aria-hidden="true"
            focusable="false"
            className={`atlas-ukheating__svg${printSafe ? '' : ' atlas-ukheating__svg--animated'}`}
          >
            <path d="M 34 58 H 286 V 152 H 34 Z" className="atlas-ukheating__loop" />
            <rect x="46" y="74" width="42" height="52" rx="8" className="atlas-ukheating__boiler" />
            <circle cx="104" cy="100" r="12" className="atlas-ukheating__pump" />
            <rect x="146" y="68" width="20" height="34" className="atlas-ukheating__rad" />
            <rect x="184" y="68" width="20" height="34" className="atlas-ukheating__rad" />
            <rect x="222" y="68" width="20" height="34" className="atlas-ukheating__rad" />
            <rect x="250" y="120" width="24" height="26" rx="6" className="atlas-ukheating__filter-body" />
            <line x1="262" y1="122" x2="262" y2="144" className="atlas-ukheating__filter-magnet" />
          </svg>
          <p className="atlas-edu-diagram__label">Used when condition checks confirm flow restriction</p>
        </section>
      </div>

      <p className="atlas-edu-diagram__caption">{WHAT_THIS_MEANS}</p>
    </div>
  );
}
