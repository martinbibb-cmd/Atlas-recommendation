import { useState } from 'react';
import { REQUIRED_ANALOGY_MODES, type AnalogyMode, type AnalogyOverlayElement } from '../analogyOverlays';
import { renderVisualTopology } from '../visualTopologies/topologies';

interface ExplainerOverlay {
  summary: string;
  accessibilitySummary: string;
  elements: AnalogyOverlayElement[];
}

const MODE_LABELS: Record<AnalogyMode, string> = {
  basic_household: 'Basic household',
  medical: 'Medical',
  traffic: 'Traffic',
  electrical: 'Electrical',
  physics_engineering: 'Physics & engineering',
};

const ANCHORS = new Map([
  ['cylinder', { x: 556, y: 238 }],
  ['expansion_vessel', { x: 668, y: 286 }],
  ['pressure_gauge', { x: 646, y: 124 }],
  ['filling_loop', { x: 400, y: 282 }],
  ['d2_discharge', { x: 700, y: 320 }],
]);

const OVERLAYS: Record<AnalogyMode, ExplainerOverlay> = {
  basic_household: {
    summary: 'Think of the expansion vessel as a cushion: when heating water expands, that cushion absorbs the extra push so pressure stays controlled.',
    accessibilitySummary: 'This view highlights the expansion vessel, pressure gauge, filling loop, and safety discharge route on the physical system.',
    elements: [
      { id: 'basic-vessel', type: 'callout', anchorId: 'expansion_vessel', label: 'Expansion cushion', offsetX: 100, offsetY: 20 },
      { id: 'basic-gauge', type: 'callout', anchorId: 'pressure_gauge', label: 'Normal pressure check', offsetX: 100, offsetY: -18 },
      { id: 'basic-fill', type: 'callout', anchorId: 'filling_loop', label: 'Normal filling loop', offsetX: -120, offsetY: 20 },
      { id: 'basic-safety', type: 'callout', anchorId: 'd2_discharge', label: 'Tundish and discharge safety route', offsetX: 30, offsetY: 28 },
    ],
  },
  medical: {
    summary: 'Like controlled circulation in a closed system: the expansion vessel keeps pressure steady and the gauge shows that everything is within range.',
    accessibilitySummary: 'The diagram labels the pressure buffer, the pressure window indicator, the normal top-up point, and the safety discharge route.',
    elements: [
      { id: 'med-vessel', type: 'callout', anchorId: 'expansion_vessel', label: 'Pressure buffer', offsetX: 104, offsetY: 20 },
      { id: 'med-gauge', type: 'callout', anchorId: 'pressure_gauge', label: 'Pressure within range', offsetX: 112, offsetY: -16 },
      { id: 'med-fill', type: 'callout', anchorId: 'filling_loop', label: 'Normal top-up point', offsetX: -128, offsetY: 20 },
      { id: 'med-safety', type: 'callout', anchorId: 'd2_discharge', label: 'Safety release route', offsetX: 32, offsetY: 28 },
    ],
  },
  traffic: {
    summary: 'Like a managed road network: the gauge shows pressure is in the right lane, and the expansion vessel absorbs any surges before they become a problem.',
    accessibilitySummary: 'The diagram labels the surge absorber, the pressure indicator, the normal top-up point, and the safety exit route.',
    elements: [
      { id: 'traffic-vessel', type: 'callout', anchorId: 'expansion_vessel', label: 'Surge absorber', offsetX: 96, offsetY: 20 },
      { id: 'traffic-gauge', type: 'callout', anchorId: 'pressure_gauge', label: 'Pressure in range', offsetX: 108, offsetY: -16 },
      { id: 'traffic-fill', type: 'callout', anchorId: 'filling_loop', label: 'Normal top-up point', offsetX: -112, offsetY: 20 },
      { id: 'traffic-safety', type: 'callout', anchorId: 'd2_discharge', label: 'Safety exit route', offsetX: 24, offsetY: 28 },
    ],
  },
  electrical: {
    summary: 'Like a protected circuit: the gauge confirms normal operating state, and the expansion vessel handles any extra load during warm-up.',
    accessibilitySummary: 'The diagram labels the load buffer, the normal state indicator, the top-up connection, and the safety discharge path.',
    elements: [
      { id: 'elec-vessel', type: 'callout', anchorId: 'expansion_vessel', label: 'Load buffer', offsetX: 94, offsetY: 20 },
      { id: 'elec-gauge', type: 'callout', anchorId: 'pressure_gauge', label: 'Normal operating state', offsetX: 102, offsetY: -16 },
      { id: 'elec-fill', type: 'callout', anchorId: 'filling_loop', label: 'Normal top-up point', offsetX: -108, offsetY: 20 },
      { id: 'elec-safety', type: 'callout', anchorId: 'd2_discharge', label: 'Safety discharge path', offsetX: 28, offsetY: 28 },
    ],
  },
  physics_engineering: {
    summary: 'As heating water warms it expands; the expansion vessel absorbs that extra volume so the sealed circuit stays at a steady, safe pressure.',
    accessibilitySummary: 'The diagram labels the expansion vessel, the pressure gauge, the filling loop top-up point, and the safety discharge route.',
    elements: [
      { id: 'eng-vessel', type: 'callout', anchorId: 'expansion_vessel', label: 'Expansion vessel', offsetX: 112, offsetY: 20 },
      { id: 'eng-gauge', type: 'callout', anchorId: 'pressure_gauge', label: 'Pressure gauge', offsetX: 116, offsetY: -16 },
      { id: 'eng-fill', type: 'callout', anchorId: 'filling_loop', label: 'Filling loop top-up point', offsetX: -136, offsetY: 20 },
      { id: 'eng-safety', type: 'callout', anchorId: 'd2_discharge', label: 'Tundish — safety discharge', offsetX: 34, offsetY: 28 },
    ],
  },
};

function renderOverlayElement(element: AnalogyOverlayElement, printSafe: boolean) {
  if (element.type === 'link') return null;
  const anchor = ANCHORS.get(element.anchorId);
  if (anchor == null) return null;

  const labelX = anchor.x + element.offsetX;
  const labelY = anchor.y + element.offsetY;

  return (
    <g key={element.id}>
      <circle cx={anchor.x} cy={anchor.y} r={5} fill={printSafe ? '#111827' : '#0369a1'} />
      <line x1={anchor.x} y1={anchor.y} x2={labelX} y2={labelY} stroke={printSafe ? '#111827' : '#0369a1'} strokeWidth={1.8} />
      <rect x={labelX - 88} y={labelY - 18} width={176} height={20} rx={6} fill={printSafe ? '#fff' : '#e0f2fe'} stroke={printSafe ? '#111827' : '#0369a1'} />
      <text x={labelX} y={labelY - 4} textAnchor="middle" fontSize={10} fill={printSafe ? '#111827' : '#0c4a6e'}>
        {element.label}
      </text>
    </g>
  );
}

interface TopologyPreviewProps {
  title: string;
  showLabels: boolean;
  printSafe: boolean;
  mobileWidth: boolean;
  overlay: ExplainerOverlay | null;
  testId: string;
}

function TopologyPreview({
  title,
  showLabels,
  printSafe,
  mobileWidth,
  overlay,
  testId,
}: TopologyPreviewProps) {
  const width = mobileWidth ? 320 : 860;
  const height = mobileWidth ? 500 : 430;

  return (
    <section style={{ display: 'grid', gap: 8 }} data-testid={testId}>
      <h2 style={{ margin: 0, fontSize: 16 }}>{title}</h2>
      <div style={{ position: 'relative', width, height }}>
        {renderVisualTopology('sealed_unvented_cylinder', {
          showLabels,
          printSafe,
          pipeTrace: false,
          mobileWidth,
        })}
        {overlay != null && !mobileWidth && (
          <svg
            width={860}
            height={430}
            viewBox="0 0 860 430"
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
            aria-hidden="true"
          >
            {overlay.elements.map((element) => renderOverlayElement(element, printSafe))}
          </svg>
        )}
      </div>
    </section>
  );
}

export function SealedUnventedExplainerSlicePage() {
  // Default mode remains pre-selected even when overlays start off so first activation is deterministic.
  const [selectedMode, setSelectedMode] = useState<AnalogyMode>('basic_household');
  const [overlayEnabled, setOverlayEnabled] = useState(false);
  const overlay = OVERLAYS[selectedMode];

  return (
    <main
      data-testid="sealed-unvented-explainer-slice"
      style={{ fontFamily: 'system-ui, sans-serif', color: '#0f172a', padding: '1rem', display: 'grid', gap: '1.5rem', maxWidth: 920 /* ~70ch at 13px — comfortable reading width */, margin: '0 auto' }}
    >
      <header style={{ display: 'grid', gap: 6 }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>Sealed heating and stored hot water — what it means for your home</h1>
        <p style={{ margin: 0, fontSize: 14, color: '#475569', maxWidth: '72ch' }}>
          This upgrade removes the cold-water tanks from your loft and delivers hot water at mains pressure. Your heating stays exactly as it is.
        </p>
      </header>

      <article
        data-testid="sealed-unvented-customer-card"
        style={{ border: '1px solid #cbd5e1', borderRadius: 10, background: '#f0fdf4' /* green-50: reassuring, signals a positive change */, padding: '1rem 1.1rem', display: 'grid', gap: 10 }}
      >
        <h2 style={{ margin: 0, fontSize: 17, color: '#166534' }}>What changes — and why it's better</h2>
        <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 8, fontSize: 14, lineHeight: 1.55 }}>
          <li>The loft tanks are removed. Your loft space clears and the frost risk from exposed pipework goes away.</li>
          <li>A sealed heating circuit is added for pressure-managed heating — more reliable and quieter over time.</li>
          <li>An unvented cylinder provides stored hot water from mains-fed supply, so every tap and shower runs at your full mains pressure.</li>
          <li>This route uses stored hot water, not on-demand hot water — the cylinder keeps a ready supply so you're never waiting.</li>
          <li>The expansion vessel absorbs heating-water expansion during warm-up, keeping pressure steady automatically.</li>
          <li>The pressure gauge and filling loop are normal sealed-system features your installer will walk you through in minutes.</li>
          <li>The tundish and discharge route are safety features, not faults — they show the safety system is working as designed.</li>
        </ul>
      </article>

      <TopologyPreview
        title="How your system will look"
        showLabels
        printSafe={false}
        mobileWidth={false}
        overlay={overlayEnabled ? overlay : null}
        testId="sealed-unvented-customer-page-preview"
      />

      <section
        style={{ border: '1px solid #cbd5e1', borderRadius: 10, background: '#fff', padding: '0.9rem 1rem', display: 'grid', gap: 10 }}
        data-testid="sealed-unvented-analogy-controls"
      >
        <h2 style={{ margin: 0, fontSize: 16 }}>Understand it in your own way</h2>
        <p style={{ margin: 0, fontSize: 13, color: '#475569' }}>
          Choose a description style that makes most sense to you. The diagram stays the same — only the labels change.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button
            onClick={() => setOverlayEnabled(false)}
            aria-pressed={!overlayEnabled}
            style={{ border: '1px solid #cbd5e1', borderRadius: 6, padding: '4px 10px', background: !overlayEnabled ? '#dbeafe' : '#fff', cursor: 'pointer', fontSize: 13 }}
          >
            Plain view
          </button>
          {REQUIRED_ANALOGY_MODES.map((mode) => (
            <button
              key={mode}
              onClick={() => {
                setSelectedMode(mode);
                setOverlayEnabled(true);
              }}
              aria-pressed={overlayEnabled && selectedMode === mode}
              style={{
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                padding: '4px 10px',
                background: overlayEnabled && selectedMode === mode ? '#ede9fe' : '#fff',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              {MODE_LABELS[mode]}
            </button>
          ))}
        </div>
        <p style={{ margin: 0, fontSize: 13, color: '#334155' }} data-testid="sealed-unvented-analogy-summary">
          {overlayEnabled ? overlay.summary : 'Overlay off: baseline physical system shown with no analogy layer.'}
        </p>
        {overlayEnabled ? (
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }} data-testid="sealed-unvented-analogy-accessibility-summary">
            {overlay.accessibilitySummary}
          </p>
        ) : null}
      </section>

      <TopologyPreview
        title="On mobile"
        showLabels={false}
        printSafe={false}
        mobileWidth
        overlay={null}
        testId="sealed-unvented-mobile-preview"
      />

      <TopologyPreview
        title="For your records"
        showLabels
        printSafe
        mobileWidth={false}
        overlay={null}
        testId="sealed-unvented-print-preview"
      />
    </main>
  );
}

export default SealedUnventedExplainerSlicePage;
