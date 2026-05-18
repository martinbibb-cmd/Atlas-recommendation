import { useMemo, useState } from 'react';
import {
  ANALOGY_OVERLAY_REGISTRY,
  findAnalogyOverlay,
  REQUIRED_ANALOGY_MODES,
} from './analogyOverlayRegistry';
import { getTopologyOverlayAnchors } from './topologyAnchors';
import type { AnalogyMode, AnalogyOverlayElement, AnalogyTargetConcept } from './types';
import { renderVisualTopology } from '../visualTopologies/topologies';
import type { VisualTopologyId } from '../visualTopologies/visualTopologyRegistry';

interface ConceptOption {
  id: AnalogyTargetConcept;
  label: string;
  topologyId: VisualTopologyId;
}

const CONCEPT_LABELS: Record<AnalogyTargetConcept, string> = {
  abv_protected_loop: 'ABV protected loop',
  magnetic_filter: 'Magnetic filter',
  system_pressure: 'System pressure',
  stratified_mixergy: 'Stratified cylinder / Mixergy',
  powerflush: 'Powerflush',
};

const MODE_LABELS: Record<AnalogyMode, string> = {
  basic_household: 'Basic household',
  traffic: 'Traffic',
  medical: 'Medical',
  electrical: 'Electrical',
  physics_engineering: 'Physics & engineering',
};

function renderOverlayElement(
  element: AnalogyOverlayElement,
  anchorMap: ReadonlyMap<string, { x: number; y: number }>,
  printSafe: boolean,
  reducedMotion: boolean,
) {
  if (element.type === 'link') {
    const start = anchorMap.get(element.fromAnchorId);
    const end = anchorMap.get(element.toAnchorId);
    if (start == null || end == null) return null;

    const mx = (start.x + end.x) / 2;
    const my = (start.y + end.y) / 2;
    return (
      <g key={element.id}>
        <line
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
          stroke={printSafe ? '#111827' : '#7c3aed'}
          strokeWidth={2}
          strokeDasharray={printSafe ? '4 2' : '6 3'}
        />
        <rect
          x={mx - 84}
          y={my - 18}
          width={168}
          height={20}
          rx={6}
          fill={printSafe ? '#ffffff' : '#f5f3ff'}
          stroke={printSafe ? '#111827' : '#7c3aed'}
        />
        <text x={mx} y={my - 4} textAnchor="middle" fontSize={10} fill={printSafe ? '#111827' : '#4c1d95'}>
          {element.label}
        </text>
      </g>
    );
  }

  const anchor = anchorMap.get(element.anchorId);
  if (anchor == null) return null;

  const labelX = anchor.x + element.offsetX;
  const labelY = anchor.y + element.offsetY;
  return (
    <g key={element.id}>
      <circle
        cx={anchor.x}
        cy={anchor.y}
        r={6}
        fill={printSafe ? '#111827' : '#0ea5e9'}
        style={{ animation: reducedMotion ? 'none' : 'atlas-analogy-pulse 1.8s ease-in-out infinite' }}
      />
      <line
        x1={anchor.x}
        y1={anchor.y}
        x2={labelX}
        y2={labelY}
        stroke={printSafe ? '#111827' : '#0891b2'}
        strokeWidth={2}
      />
      <rect
        x={labelX - 74}
        y={labelY - 20}
        width={148}
        height={22}
        rx={6}
        fill={printSafe ? '#ffffff' : '#ecfeff'}
        stroke={printSafe ? '#111827' : '#0891b2'}
      />
      <text x={labelX} y={labelY - 5} textAnchor="middle" fontSize={10} fill={printSafe ? '#111827' : '#164e63'}>
        {element.label}
      </text>
    </g>
  );
}

export function AnalogyOverlayGallery() {
  const conceptOptions = useMemo<ConceptOption[]>(() => {
    const entries = new Map<AnalogyTargetConcept, ConceptOption>();
    for (const overlay of ANALOGY_OVERLAY_REGISTRY) {
      if (!entries.has(overlay.targetConcept)) {
        entries.set(overlay.targetConcept, {
          id: overlay.targetConcept,
          label: CONCEPT_LABELS[overlay.targetConcept],
          topologyId: overlay.topologyId,
        });
      }
    }
    return Array.from(entries.values());
  }, []);

  const [selectedConcept, setSelectedConcept] = useState<AnalogyTargetConcept>(conceptOptions[0]?.id ?? 'abv_protected_loop');
  const [selectedMode, setSelectedMode] = useState<AnalogyMode | 'none'>('none');
  const [hideLabels, setHideLabels] = useState(false);
  const [printSafe, setPrintSafe] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const activeOverlay =
    selectedMode === 'none'
      ? undefined
      : findAnalogyOverlay(selectedConcept, selectedMode);
  const selectedConceptMeta = conceptOptions.find((entry) => entry.id === selectedConcept);
  const topologyId = activeOverlay?.topologyId ?? selectedConceptMeta?.topologyId ?? 'abv_protected_heating_loop';
  const anchors = getTopologyOverlayAnchors(topologyId);
  const anchorMap = useMemo(
    () => new Map(anchors.map((anchor) => [anchor.id, { x: anchor.x, y: anchor.y }])),
    [anchors],
  );
  const overlayAnchorsAreValid = Boolean(
    activeOverlay
    && activeOverlay.overlayElements.every((element) =>
      element.type === 'callout'
        ? anchorMap.has(element.anchorId)
        : anchorMap.has(element.fromAnchorId) && anchorMap.has(element.toAnchorId)),
  );
  const metaphorReplacesSystem = Boolean(
    activeOverlay
    && (
      activeOverlay.overlayElements.length === 0
      || !overlayAnchorsAreValid
    ),
  );

  return (
    <main
      data-testid="analogy-overlay-gallery"
      style={{ fontFamily: 'system-ui, sans-serif', color: '#0f172a', padding: '1rem', display: 'grid', gap: '1rem' }}
    >
      <style>
        {`@keyframes atlas-analogy-pulse { 0% { opacity: 0.55; transform: scale(1);} 50% { opacity: 1; transform: scale(1.18);} 100% { opacity: 0.55; transform: scale(1);} }`}
      </style>
      <header>
        <h1 style={{ margin: '0 0 0.35rem', fontSize: 24 }}>Analogy Overlay Gallery</h1>
        <p style={{ margin: 0, color: '#475569', fontSize: 13, maxWidth: '74ch' }}>
          Canonical topology first. Analogy overlays switch narration mode without changing physical system truth.
        </p>
        <p
          data-testid="analogy-overlay-qa-callouts"
          style={{ margin: '0.65rem 0 0', fontSize: 12, color: '#1e3a8a', background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: 8, padding: '0.5rem 0.75rem' }}
        >
          QA callouts: preserve topology-anchor IDs, keep radiator/ABV/Mixergy physical realism in baseline views, and flag decorative pipe loops.
        </p>
      </header>

      <section style={{ display: 'grid', gap: '0.75rem' }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Topology shown first</h2>
        <div
          style={{ position: 'relative', width: 860, height: 430, border: '1px solid #cbd5e1', borderRadius: 10, overflow: 'hidden', background: '#fff' }}
          data-testid="analogy-overlay-topology-canvas"
        >
          {renderVisualTopology(topologyId, {
            showLabels: !hideLabels,
            printSafe,
            pipeTrace: false,
            mobileWidth: false,
          })}
          {activeOverlay && (
            <svg
              width={860}
              height={430}
              viewBox="0 0 860 430"
              style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
              aria-hidden="true"
            >
              {activeOverlay.overlayElements.map((element) =>
                renderOverlayElement(element, anchorMap, printSafe, reducedMotion))}
            </svg>
          )}
        </div>
      </section>

      <section style={{ display: 'grid', gap: '0.5rem' }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Concept and mode controls</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {conceptOptions.map((concept) => (
            <button
              key={concept.id}
              onClick={() => setSelectedConcept(concept.id)}
              aria-pressed={selectedConcept === concept.id}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                border: '1px solid',
                borderColor: selectedConcept === concept.id ? '#0ea5e9' : '#cbd5e1',
                background: selectedConcept === concept.id ? '#ecfeff' : '#fff',
                cursor: 'pointer',
              }}
            >
              {concept.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} data-testid="analogy-mode-switcher">
          <button
            onClick={() => setSelectedMode('none')}
            aria-pressed={selectedMode === 'none'}
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              border: '1px solid',
              borderColor: selectedMode === 'none' ? '#0f766e' : '#cbd5e1',
              background: selectedMode === 'none' ? '#ccfbf1' : '#fff',
              cursor: 'pointer',
            }}
          >
            No overlay baseline
          </button>
          {REQUIRED_ANALOGY_MODES.map((mode) => (
            <button
              key={mode}
              onClick={() => setSelectedMode(mode)}
              aria-pressed={selectedMode === mode}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                border: '1px solid',
                borderColor: selectedMode === mode ? '#7c3aed' : '#cbd5e1',
                background: selectedMode === mode ? '#f5f3ff' : '#fff',
                cursor: 'pointer',
              }}
            >
              {MODE_LABELS[mode]}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <label>
            <input type="checkbox" checked={hideLabels} onChange={(event) => setHideLabels(event.target.checked)} />
            {' '}No-label mode
          </label>
          <label>
            <input type="checkbox" checked={reducedMotion} onChange={(event) => setReducedMotion(event.target.checked)} />
            {' '}Reduced-motion mode
          </label>
          <label>
            <input type="checkbox" checked={printSafe} onChange={(event) => setPrintSafe(event.target.checked)} />
            {' '}Print-safe mode
          </label>
        </div>
      </section>

      <section style={{ display: 'grid', gap: '0.5rem' }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Narration and QA</h2>
        {activeOverlay ? (
          <>
            <p style={{ margin: 0, fontSize: 13 }}><strong>Customer-safe summary:</strong> {activeOverlay.customerSafeSummary}</p>
            <p style={{ margin: 0, fontSize: 13 }} data-testid="analogy-accessibility-summary">
              <strong>Accessibility summary preview:</strong> {activeOverlay.accessibilitySummary}
            </p>
            <p style={{ margin: 0, fontSize: 13 }}><strong>Narration style:</strong> {activeOverlay.narrationStyle.replace(/_/g, ' ')}</p>
            <p style={{ margin: 0, fontSize: 13 }}><strong>Cognitive load:</strong> {activeOverlay.cognitiveLoad}</p>
            <p style={{ margin: 0, fontSize: 13 }}><strong>Allowed customer use:</strong> {activeOverlay.allowedCustomerUse ? 'yes' : 'no'}</p>
            <p style={{ margin: 0, fontSize: 13 }}><strong>QA note:</strong> {activeOverlay.qaNote}</p>
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 13 }}>
            No overlay active. This baseline confirms the physical topology remains unchanged.
          </p>
        )}
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: metaphorReplacesSystem ? '#7f1d1d' : '#166534',
            background: metaphorReplacesSystem ? '#fee2e2' : '#dcfce7',
            border: `1px solid ${metaphorReplacesSystem ? '#fca5a5' : '#86efac'}`,
            borderRadius: 8,
            padding: '0.5rem 0.75rem',
          }}
          data-testid="analogy-qa-metaphor-flag"
        >
          Does the metaphor replace the system? {metaphorReplacesSystem ? 'Yes — fix required.' : 'No — physical system remains visible.'}
        </p>
      </section>
    </main>
  );
}

export default AnalogyOverlayGallery;
