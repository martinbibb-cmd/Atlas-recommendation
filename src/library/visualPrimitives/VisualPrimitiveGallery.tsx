/**
 * VisualPrimitiveGallery.tsx
 *
 * QA fixture for the canonical visual primitive library.
 *
 * Renders every extracted primitive at:
 *   - Mobile width (320px)
 *   - Print width (A4-safe, ~720px)
 *   - Light theme (default)
 *   - Print-safe mode (no colour-only cues)
 *   - No-label mode (homeowner recognisability acceptance test)
 *
 * PR 1 acceptance test:
 *   PASS if a homeowner can identify boiler, cylinder, radiator, pump,
 *        gauge, filter and valve WITHOUT labels.
 *   FAIL if any object still looks like abstract SaaS art.
 *
 * Dev-only surface — never customer-facing.
 * Route: /dev/visual-primitive-gallery
 */

import { useState } from 'react';
import {
  BoilerPrimitive,
  CylinderPrimitive,
  MixergyCylinderPrimitive,
  RadiatorPrimitive,
  ExpansionVesselPrimitive,
  PressureGaugePrimitive,
  PipeLoopPrimitive,
  MagneticFilterPrimitive,
  PumpPrimitive,
  ABVPrimitive,
} from './primitives';
import { VISUAL_PRIMITIVE_REGISTRY } from './visualPrimitiveRegistry';
import type { VisualPrimitiveEntry } from './visualPrimitiveRegistry';

// ─── View mode ────────────────────────────────────────────────────────────────

type GalleryViewMode = 'mobile' | 'print' | 'no_labels' | 'print_safe';

const VIEW_MODE_LABELS: Record<GalleryViewMode, string> = {
  mobile: '📱 Mobile (320px)',
  print: '🖨 Print width (720px)',
  no_labels: '🔍 No labels (homeowner ID test)',
  print_safe: '⬛ Print-safe (no colour cues)',
};

// ─── Primitive render map ─────────────────────────────────────────────────────

interface PrimitiveRenderConfig {
  id: string;
  label: string;
  render: (showLabel: boolean, printSafe: boolean) => React.ReactNode;
}

const PRIMITIVES: PrimitiveRenderConfig[] = [
  {
    id: 'combi_boiler',
    label: 'Combination Boiler',
    render: (showLabel, printSafe) => (
      <BoilerPrimitive variant="combi" showLabel={showLabel} printSafe={printSafe} size="md" />
    ),
  },
  {
    id: 'system_boiler',
    label: 'System Boiler',
    render: (showLabel, printSafe) => (
      <BoilerPrimitive variant="system" showLabel={showLabel} printSafe={printSafe} size="md" />
    ),
  },
  {
    id: 'regular_boiler',
    label: 'Regular Boiler',
    render: (showLabel, printSafe) => (
      <BoilerPrimitive variant="regular" showLabel={showLabel} printSafe={printSafe} size="md" />
    ),
  },
  {
    id: 'unvented_cylinder',
    label: 'Unvented Cylinder',
    render: (showLabel, printSafe) => (
      <CylinderPrimitive variant="unvented" fillLevel={0.75} showLabel={showLabel} printSafe={printSafe} size="md" />
    ),
  },
  {
    id: 'vented_cylinder',
    label: 'Vented Cylinder',
    render: (showLabel, printSafe) => (
      <CylinderPrimitive variant="vented" fillLevel={0.6} showLabel={showLabel} printSafe={printSafe} size="md" />
    ),
  },
  {
    id: 'mixergy_cylinder',
    label: 'Mixergy Cylinder',
    render: (showLabel, printSafe) => (
      <MixergyCylinderPrimitive stateOfChargePct={80} showLabel={showLabel} printSafe={printSafe} size="md" />
    ),
  },
  {
    id: 'panel_radiator_hot',
    label: 'Radiator (hot)',
    render: (showLabel, printSafe) => (
      <RadiatorPrimitive temperatureTone="hot" showLabel={showLabel} printSafe={printSafe} size="md" />
    ),
  },
  {
    id: 'panel_radiator_warm',
    label: 'Radiator (warm)',
    render: (showLabel, printSafe) => (
      <RadiatorPrimitive temperatureTone="warm" showLabel={showLabel} printSafe={printSafe} size="md" />
    ),
  },
  {
    id: 'expansion_vessel',
    label: 'Expansion Vessel',
    render: (showLabel, printSafe) => (
      <ExpansionVesselPrimitive showLabel={showLabel} printSafe={printSafe} size="md" />
    ),
  },
  {
    id: 'pressure_gauge',
    label: 'Pressure Gauge',
    render: (showLabel, printSafe) => (
      <PressureGaugePrimitive pressureBar={1.2} showLabel={showLabel} printSafe={printSafe} size="md" />
    ),
  },
  {
    id: 'pressure_gauge_low',
    label: 'Pressure Gauge (low)',
    render: (showLabel, printSafe) => (
      <PressureGaugePrimitive pressureBar={0.5} showLabel={showLabel} printSafe={printSafe} size="md" />
    ),
  },
  {
    id: 'pipe_loop',
    label: 'Sealed Circuit Loop',
    render: (showLabel, printSafe) => (
      <PipeLoopPrimitive showLabel={showLabel} printSafe={printSafe} size="md" />
    ),
  },
  {
    id: 'magnetic_filter',
    label: 'Magnetic Filter',
    render: (showLabel, printSafe) => (
      <MagneticFilterPrimitive showLabel={showLabel} printSafe={printSafe} size="md" />
    ),
  },
  {
    id: 'circulation_pump',
    label: 'Circulation Pump',
    render: (showLabel, printSafe) => (
      <PumpPrimitive showLabel={showLabel} printSafe={printSafe} size="md" />
    ),
  },
  {
    id: 'abv',
    label: 'Automatic Bypass Valve',
    render: (showLabel, printSafe) => (
      <ABVPrimitive showLabel={showLabel} printSafe={printSafe} size="md" />
    ),
  },
];

// ─── Registry summary ─────────────────────────────────────────────────────────

function RecognisabilityBadge({ entry }: { entry: VisualPrimitiveEntry }) {
  const colour: Record<string, string> = {
    immediately_recognisable: '#dcfce7',
    recognisable_with_context: '#fef9c3',
    abstract_placeholder: '#fed7aa',
    needs_rebuild: '#fee2e2',
  };
  const textColour: Record<string, string> = {
    immediately_recognisable: '#166534',
    recognisable_with_context: '#713f12',
    abstract_placeholder: '#7c2d12',
    needs_rebuild: '#7f1d1d',
  };

  return (
    <span
      style={{
        display: 'inline-block',
        background: colour[entry.recognisability] ?? '#f1f5f9',
        color: textColour[entry.recognisability] ?? '#0f172a',
        borderRadius: 4,
        padding: '2px 6px',
        fontSize: 10,
        fontWeight: 600,
      }}
    >
      {entry.recognisability.replace(/_/g, ' ')}
    </span>
  );
}

// ─── Gallery card ─────────────────────────────────────────────────────────────

function PrimitiveCard({
  config,
  viewMode,
  containerWidth,
}: {
  config: PrimitiveRenderConfig;
  viewMode: GalleryViewMode;
  containerWidth: number;
}) {
  const showLabel = viewMode !== 'no_labels';
  const printSafe = viewMode === 'print_safe';
  const registryEntry = VISUAL_PRIMITIVE_REGISTRY.find(p => p.id === config.id);

  return (
    <article
      data-testid={`vp-gallery-card-${config.id}`}
      style={{
        border: '1px solid #cbd5e1',
        borderRadius: 12,
        background: '#fff',
        padding: '0.85rem',
        display: 'grid',
        gap: '0.75rem',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <h3 style={{ margin: '0 0 2px', fontSize: 14 }}>{config.label}</h3>
          <code style={{ fontSize: 10, color: '#64748b' }}>{config.id}</code>
        </div>
        {registryEntry && <RecognisabilityBadge entry={registryEntry} />}
      </div>

      {/* Primitive render */}
      <div
        style={{
          width: containerWidth,
          maxWidth: '100%',
          border: '1px solid #e2e8f0',
          borderRadius: 10,
          padding: '1rem',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 80,
          background: printSafe ? '#f8fafc' : '#fff',
        }}
      >
        {config.render(showLabel, printSafe)}
      </div>

      {/* Registry metadata */}
      {registryEntry && (
        <div style={{ fontSize: 11, color: '#475569', display: 'grid', gap: 2 }}>
          <p style={{ margin: 0 }}>
            <strong>Purpose:</strong> {registryEntry.canonicalPurpose}
          </p>
          <p style={{ margin: 0 }}>
            <strong>Abstraction:</strong> {registryEntry.abstractionLevel.replace(/_/g, ' ')} ·{' '}
            <strong>Print safe:</strong> {registryEntry.printSafe ? '✓' : '✗'} ·{' '}
            <strong>Motion safe:</strong> {registryEntry.motionSafe ? '✓' : '✗'}
          </p>
          {registryEntry.qaNote && (
            <p
              style={{
                margin: 0,
                color: '#7c2d12',
                background: '#fff7ed',
                border: '1px solid #fdba74',
                borderRadius: 6,
                padding: '4px 8px',
              }}
            >
              QA note: {registryEntry.qaNote}
            </p>
          )}
        </div>
      )}
    </article>
  );
}

// ─── Main gallery ─────────────────────────────────────────────────────────────

export function VisualPrimitiveGallery() {
  const [viewMode, setViewMode] = useState<GalleryViewMode>('mobile');

  const containerWidth = viewMode === 'print' ? 680 : 300;

  const needsRebuildCount = VISUAL_PRIMITIVE_REGISTRY.filter(
    p => p.recognisability === 'needs_rebuild',
  ).length;
  const abstractCount = VISUAL_PRIMITIVE_REGISTRY.filter(
    p => p.recognisability === 'abstract_placeholder',
  ).length;

  return (
    <main
      style={{ fontFamily: 'system-ui, sans-serif', color: '#0f172a', padding: '1rem' }}
      data-testid="visual-primitive-gallery"
    >
      {/* Header */}
      <header style={{ marginBottom: '1rem' }}>
        <h1 style={{ margin: '0 0 0.35rem', fontSize: 24 }}>
          Visual Primitive Gallery — PR 1
        </h1>
        <p style={{ margin: '0 0 0.5rem', color: '#475569', fontSize: 13, maxWidth: '72ch' }}>
          Canonical heating-system physical object primitives. Physical truth layer only — no analogies, no
          metaphors. A homeowner must be able to identify each object without labels.
        </p>

        {/* Acceptance test banner */}
        <div
          style={{
            background: needsRebuildCount > 0 ? '#fee2e2' : '#dcfce7',
            border: `1px solid ${needsRebuildCount > 0 ? '#fca5a5' : '#86efac'}`,
            borderRadius: 8,
            padding: '0.5rem 0.75rem',
            fontSize: 12,
            color: needsRebuildCount > 0 ? '#7f1d1d' : '#166534',
            marginBottom: '0.75rem',
          }}
        >
          {needsRebuildCount > 0
            ? `⚠ ${needsRebuildCount} primitive(s) marked "needs_rebuild" — must be redrawn before customer exposure.`
            : '✓ No primitives marked needs_rebuild.'}
          {abstractCount > 0 && (
            <> · {abstractCount} abstract placeholder(s) — acceptable for concept explainers only, not as equipment symbols.</>
          )}
        </div>

        {/* View mode tabs */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(Object.keys(VIEW_MODE_LABELS) as GalleryViewMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                border: '1px solid',
                borderColor: viewMode === mode ? '#3b82f6' : '#cbd5e1',
                background: viewMode === mode ? '#eff6ff' : '#fff',
                color: viewMode === mode ? '#1d4ed8' : '#374151',
                fontSize: 12,
                fontWeight: viewMode === mode ? 600 : 400,
                cursor: 'pointer',
              }}
              aria-pressed={viewMode === mode}
            >
              {VIEW_MODE_LABELS[mode]}
            </button>
          ))}
        </div>
      </header>

      {/* No-label test instruction */}
      {viewMode === 'no_labels' && (
        <div
          style={{
            background: '#fef9c3',
            border: '1px solid #fde047',
            borderRadius: 8,
            padding: '0.5rem 0.75rem',
            fontSize: 12,
            color: '#713f12',
            marginBottom: '1rem',
          }}
        >
          <strong>Homeowner ID test:</strong> Labels are hidden. Can you identify each piece of equipment?
          Boiler, cylinder, radiator, pump, gauge, filter and valve must all be identifiable without text.
        </div>
      )}

      {/* Grid */}
      <section
        data-testid="vp-gallery-grid"
        style={{
          display: 'grid',
          gap: '1rem',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
        }}
      >
        {PRIMITIVES.map(config => (
          <PrimitiveCard
            key={config.id}
            config={config}
            viewMode={viewMode}
            containerWidth={containerWidth}
          />
        ))}
      </section>

      {/* Registry summary */}
      <section style={{ marginTop: '2rem' }}>
        <h2 style={{ fontSize: 16, margin: '0 0 0.75rem' }}>
          Registry summary ({VISUAL_PRIMITIVE_REGISTRY.length} entries)
        </h2>
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              borderCollapse: 'collapse',
              width: '100%',
              fontSize: 11,
              minWidth: 640,
            }}
          >
            <thead>
              <tr style={{ background: '#f1f5f9' }}>
                {['ID', 'Category', 'Abstraction', 'Recognisability', 'Print', 'Motion', 'Reuse'].map(h => (
                  <th
                    key={h}
                    style={{
                      textAlign: 'left',
                      padding: '6px 8px',
                      border: '1px solid #cbd5e1',
                      fontWeight: 600,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {VISUAL_PRIMITIVE_REGISTRY.map(entry => (
                <tr key={entry.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '5px 8px', border: '1px solid #e2e8f0' }}>
                    <code style={{ fontSize: 10 }}>{entry.id}</code>
                  </td>
                  <td style={{ padding: '5px 8px', border: '1px solid #e2e8f0' }}>
                    {entry.category.replace(/_/g, ' ')}
                  </td>
                  <td style={{ padding: '5px 8px', border: '1px solid #e2e8f0' }}>
                    {entry.abstractionLevel.replace(/_/g, ' ')}
                  </td>
                  <td style={{ padding: '5px 8px', border: '1px solid #e2e8f0' }}>
                    <RecognisabilityBadge entry={entry} />
                  </td>
                  <td style={{ padding: '5px 8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    {entry.printSafe ? '✓' : '✗'}
                  </td>
                  <td style={{ padding: '5px 8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    {entry.motionSafe ? '✓' : '✗'}
                  </td>
                  <td style={{ padding: '5px 8px', border: '1px solid #e2e8f0' }}>
                    {entry.reuseStatus.replace(/_/g, ' ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

export default VisualPrimitiveGallery;
