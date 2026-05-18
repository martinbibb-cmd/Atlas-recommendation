import { useMemo, useState } from 'react';
import { REQUIRED_ANALOGY_MODES, type AnalogyMode, type AnalogyOverlayElement } from '../analogyOverlays';
import { getHydraulicTruthModel, runHydraulicTopologyQa } from '../hydraulicTruth';
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
    accessibilitySummary: 'The overlay marks the expansion vessel, pressure gauge, filling loop, and safety discharge route while the full physical system remains visible.',
    elements: [
      { id: 'basic-vessel', type: 'callout', anchorId: 'expansion_vessel', label: 'Expansion cushion', offsetX: 100, offsetY: 20 },
      { id: 'basic-gauge', type: 'callout', anchorId: 'pressure_gauge', label: 'Normal pressure check', offsetX: 100, offsetY: -18 },
      { id: 'basic-fill', type: 'callout', anchorId: 'filling_loop', label: 'Normal filling loop', offsetX: -120, offsetY: 20 },
      { id: 'basic-safety', type: 'callout', anchorId: 'd2_discharge', label: 'Tundish and discharge safety route', offsetX: 30, offsetY: 28 },
    ],
  },
  medical: {
    summary: 'The sealed circuit behaves like controlled circulation: the expansion vessel dampens pressure swings and the gauge shows the operating window.',
    accessibilitySummary: 'Clinical-mode callouts identify damped pressure control and the normal service and safety points on the physical layout.',
    elements: [
      { id: 'med-vessel', type: 'callout', anchorId: 'expansion_vessel', label: 'Pressure damping chamber', offsetX: 104, offsetY: 20 },
      { id: 'med-gauge', type: 'callout', anchorId: 'pressure_gauge', label: 'Operating pressure window', offsetX: 112, offsetY: -16 },
      { id: 'med-fill', type: 'callout', anchorId: 'filling_loop', label: 'Commissioning service point', offsetX: -128, offsetY: 20 },
      { id: 'med-safety', type: 'callout', anchorId: 'd2_discharge', label: 'Safety discharge path', offsetX: 32, offsetY: 28 },
    ],
  },
  traffic: {
    summary: 'The sealed loop is like a managed route: the gauge tracks the pressure lane, and the expansion vessel absorbs surges before they become a problem.',
    accessibilitySummary: 'Traffic-mode callouts map surge buffering and pressure window checks to the same physical vessel, gauge, and discharge hardware.',
    elements: [
      { id: 'traffic-vessel', type: 'callout', anchorId: 'expansion_vessel', label: 'Surge buffer', offsetX: 96, offsetY: 20 },
      { id: 'traffic-gauge', type: 'callout', anchorId: 'pressure_gauge', label: 'Pressure lane indicator', offsetX: 108, offsetY: -16 },
      { id: 'traffic-fill', type: 'callout', anchorId: 'filling_loop', label: 'Service access link', offsetX: -112, offsetY: 20 },
      { id: 'traffic-safety', type: 'callout', anchorId: 'd2_discharge', label: 'Safety exit route', offsetX: 24, offsetY: 28 },
    ],
  },
  electrical: {
    summary: 'Read this as a protected circuit: the gauge is the live state check, and the expansion vessel handles thermal transients in the sealed loop.',
    accessibilitySummary: 'Electrical-mode callouts keep the same physical anchors for pressure state, transient buffering, and safety discharge.',
    elements: [
      { id: 'elec-vessel', type: 'callout', anchorId: 'expansion_vessel', label: 'Transient buffer', offsetX: 94, offsetY: 20 },
      { id: 'elec-gauge', type: 'callout', anchorId: 'pressure_gauge', label: 'Live pressure state', offsetX: 102, offsetY: -16 },
      { id: 'elec-fill', type: 'callout', anchorId: 'filling_loop', label: 'Service link point', offsetX: -108, offsetY: 20 },
      { id: 'elec-safety', type: 'callout', anchorId: 'd2_discharge', label: 'Safety discharge line', offsetX: 28, offsetY: 28 },
    ],
  },
  physics_engineering: {
    summary: 'Thermal expansion in the sealed heating circuit is absorbed by expansion volume, while the pressure gauge and filling loop support normal commissioning and servicing checks.',
    accessibilitySummary: 'Engineering-mode callouts identify expansion-volume control, pressure monitoring, service fill point, and compliant discharge routing.',
    elements: [
      { id: 'eng-vessel', type: 'callout', anchorId: 'expansion_vessel', label: 'Expansion volume control', offsetX: 112, offsetY: 20 },
      { id: 'eng-gauge', type: 'callout', anchorId: 'pressure_gauge', label: 'Sealed pressure reference', offsetX: 116, offsetY: -16 },
      { id: 'eng-fill', type: 'callout', anchorId: 'filling_loop', label: 'Normal fill and top-up point', offsetX: -136, offsetY: 20 },
      { id: 'eng-safety', type: 'callout', anchorId: 'd2_discharge', label: 'Tundish discharge (safety)', offsetX: 34, offsetY: 28 },
    ],
  },
};

function renderOverlayElement(element: AnalogyOverlayElement, printSafe: boolean) {
  if (element.type === 'link') return null;
  const anchor = ANCHORS.get(element.anchorId);
  if (anchor == null) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn(`[SealedUnventedExplainerSlicePage] Missing overlay anchor: ${element.anchorId}`);
    }
    return null;
  }

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
  const truthModel = useMemo(() => getHydraulicTruthModel('sealed_unvented_cylinder'), []);
  const qa = useMemo(() => runHydraulicTopologyQa('sealed_unvented_cylinder'), []);

  return (
    <main
      data-testid="sealed-unvented-explainer-slice"
      style={{ fontFamily: 'system-ui, sans-serif', color: '#0f172a', padding: '1rem', display: 'grid', gap: '1rem' }}
    >
      <header style={{ display: 'grid', gap: 8 }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>Customer Explainer Slice — Sealed heating + unvented hot water</h1>
        <p style={{ margin: 0, fontSize: 13, color: '#475569', maxWidth: '78ch' }}>
          One concept, one physical system: this page proves hydraulic truth, topology rendering, optional analogy overlays, and customer-safe copy in one end-to-end flow.
        </p>
      </header>

      <article
        data-testid="sealed-unvented-customer-card"
        style={{ border: '1px solid #cbd5e1', borderRadius: 10, background: '#fff', padding: '0.9rem', display: 'grid', gap: 8 }}
      >
        <h2 style={{ margin: 0, fontSize: 18 }}>What this upgrade means at home</h2>
        <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6, fontSize: 14 }}>
          <li>The loft tanks are removed.</li>
          <li>A sealed heating circuit is added for pressure-managed heating.</li>
          <li>An unvented cylinder provides stored hot water from mains-fed supply.</li>
          <li>This route uses stored hot water, not on-demand hot water.</li>
          <li>The expansion vessel absorbs heating-water expansion during warm-up.</li>
          <li>The pressure gauge and filling loop are normal sealed-system features.</li>
          <li>The tundish and discharge route are safety features, not faults.</li>
        </ul>
      </article>

      <section
        style={{ border: '1px solid #cbd5e1', borderRadius: 10, background: '#fff', padding: '0.9rem', display: 'grid', gap: 10 }}
        data-testid="sealed-unvented-hydraulic-truth-summary"
      >
        <h2 style={{ margin: 0, fontSize: 18 }}>Hydraulic truth baseline</h2>
        <p style={{ margin: 0, fontSize: 13 }}>
          <strong>Template:</strong> Sealed heating with unvented hot-water storage.
        </p>
        <p style={{ margin: 0, fontSize: 13 }}>
          <strong>Physical intent:</strong> {truthModel.hydraulicIntentSummary}
        </p>
        <p style={{ margin: 0, fontSize: 13 }}>
          <strong>QA result:</strong> {qa.passed ? 'Pass' : 'Check required'} ({qa.plausibilityScore}/100).
        </p>
      </section>

      <section
        style={{ border: '1px solid #cbd5e1', borderRadius: 10, background: '#fff', padding: '0.9rem', display: 'grid', gap: 8 }}
        data-testid="sealed-unvented-analogy-controls"
      >
        <h2 style={{ margin: 0, fontSize: 18 }}>Analogy mode selector</h2>
        <p style={{ margin: 0, fontSize: 13 }}>
          Default mode is Basic household. The physical system stays visible at all times.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button
            onClick={() => setOverlayEnabled(false)}
            aria-pressed={!overlayEnabled}
            style={{ border: '1px solid #cbd5e1', borderRadius: 6, padding: '4px 10px', background: !overlayEnabled ? '#dbeafe' : '#fff', cursor: 'pointer' }}
          >
            Physical system baseline
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
              }}
            >
              {MODE_LABELS[mode]}
            </button>
          ))}
        </div>
        <p style={{ margin: 0, fontSize: 13 }} data-testid="sealed-unvented-analogy-summary">
          {overlayEnabled ? overlay.summary : 'Overlay off: baseline physical system shown with no analogy layer.'}
        </p>
        {overlayEnabled ? (
          <p style={{ margin: 0, fontSize: 13 }} data-testid="sealed-unvented-analogy-accessibility-summary">
            <strong>Accessibility summary:</strong> {overlay.accessibilitySummary}
          </p>
        ) : null}
      </section>

      <TopologyPreview
        title="Customer page"
        showLabels
        printSafe={false}
        mobileWidth={false}
        overlay={overlayEnabled ? overlay : null}
        testId="sealed-unvented-customer-page-preview"
      />

      <TopologyPreview
        title="Mobile preview"
        showLabels={false}
        printSafe={false}
        mobileWidth
        overlay={null}
        testId="sealed-unvented-mobile-preview"
      />

      <TopologyPreview
        title="Print preview"
        showLabels
        printSafe
        mobileWidth={false}
        overlay={null}
        testId="sealed-unvented-print-preview"
      />

      <section
        style={{ border: '1px solid #cbd5e1', borderRadius: 10, background: '#fff', padding: '0.9rem', display: 'grid', gap: 6 }}
        data-testid="sealed-unvented-accessibility-checks"
      >
        <h2 style={{ margin: 0, fontSize: 18 }}>No-label accessibility checks</h2>
        <p style={{ margin: 0, fontSize: 13 }}>
          No-label support: {truthModel.accessibilityCompatibility.noLabelMode ? 'Pass' : 'Review required'}.
        </p>
        <p style={{ margin: 0, fontSize: 13 }}>
          Print-safe support: {truthModel.accessibilityCompatibility.monochromePrintSafeMode ? 'Pass' : 'Review required'}.
        </p>
      </section>
    </main>
  );
}

export default SealedUnventedExplainerSlicePage;
