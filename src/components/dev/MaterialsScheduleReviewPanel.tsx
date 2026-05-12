/**
 * MaterialsScheduleReviewPanel.tsx
 *
 * Dev-only panel for reviewing the suggested materials schedule.
 *
 * Purpose:
 *   Renders the non-priced materials schedule grouped by category, with
 *   confidence badges, source spec-line links, unresolved checks, and
 *   audience visibility badges.  NOT customer-facing.
 *
 * Access: dev_only — never mounts in production customer journeys.
 *
 * Usage:
 *   <MaterialsScheduleReviewPanel
 *     materials={materialsSchedule}
 *     lines={specLines}
 *   />
 */

import type { SuggestedMaterialLineV1 } from '../../specification/materials/SuggestedMaterialLineV1';
import type { SpecificationLineV1 } from '../../specification/specLines';

interface Props {
  materials: readonly SuggestedMaterialLineV1[];
  lines?: readonly SpecificationLineV1[];
}

// ─── Confidence colours ───────────────────────────────────────────────────────

const CONFIDENCE_COLORS: Record<SuggestedMaterialLineV1['confidence'], string> = {
  confirmed:    '#16a34a',
  inferred:     '#d97706',
  needs_survey: '#dc2626',
};

// ─── Category labels ──────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<SuggestedMaterialLineV1['category'], string> = {
  heat_source:   'Heat Source',
  hot_water:     'Hot Water',
  safety:        'Safety',
  valves:        'Valves',
  pipework:      'Pipework',
  controls:      'Controls',
  water_quality: 'Water Quality',
  consumables:   'Consumables',
  unknown:       'Unknown',
};

const CATEGORY_ORDER: ReadonlyArray<SuggestedMaterialLineV1['category']> = [
  'heat_source',
  'hot_water',
  'safety',
  'valves',
  'pipework',
  'controls',
  'water_quality',
  'consumables',
  'unknown',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        display:       'inline-block',
        padding:       '1px 6px',
        borderRadius:  4,
        fontSize:      10,
        fontWeight:    700,
        letterSpacing: 0.4,
        color:         '#fff',
        background:    color,
        verticalAlign: 'middle',
      }}
    >
      {label}
    </span>
  );
}

function VisibilityBadge({ label, visible }: { label: string; visible: boolean }) {
  return (
    <Badge
      label={`${label}:${visible ? 'yes' : 'no'}`}
      color={visible ? '#16a34a' : '#6b7280'}
    />
  );
}

// ─── Material card ────────────────────────────────────────────────────────────

function MaterialCard({
  material,
  lineById,
}: {
  material: SuggestedMaterialLineV1;
  lineById: Map<string, SpecificationLineV1>;
}) {
  return (
    <article
      style={{
        border:       '1px solid #dbeafe',
        borderRadius: 8,
        background:   '#fff',
        padding:      '0.65rem',
      }}
      data-testid={`materials-schedule-card-${material.materialId}`}
    >
      {/* ─── Header ────────────────────────────────────────────── */}
      <div
        style={{
          display:        'flex',
          justifyContent: 'space-between',
          alignItems:     'flex-start',
          gap:            '0.75rem',
          marginBottom:   '0.4rem',
        }}
      >
        <strong style={{ fontSize: '0.9rem' }}>{material.label}</strong>
        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', flexShrink: 0 }}>
          <Badge
            label={material.confidence}
            color={CONFIDENCE_COLORS[material.confidence]}
          />
          {material.requiredForInstall ? (
            <Badge label="required" color="#1d4ed8" />
          ) : (
            <Badge label="optional" color="#6b7280" />
          )}
        </div>
      </div>

      {/* ─── Quantity / unit / sizing basis ────────────────────── */}
      {(material.quantity !== undefined || material.sizingBasis !== undefined) ? (
        <div
          style={{ fontSize: 12, color: '#475569', marginBottom: '0.4rem' }}
          data-testid={`materials-schedule-sizing-${material.materialId}`}
        >
          {material.quantity !== undefined ? (
            <span>
              Qty: <strong>{material.quantity}</strong>
              {material.unit !== undefined ? ` ${material.unit}` : ''}
            </span>
          ) : null}
          {material.quantity !== undefined && material.sizingBasis !== undefined ? ' · ' : null}
          {material.sizingBasis !== undefined ? (
            <span>{material.sizingBasis}</span>
          ) : null}
        </div>
      ) : null}

      {/* ─── Notes ─────────────────────────────────────────────── */}
      {material.notes.length > 0 ? (
        <ul
          style={{ margin: '0 0 0.4rem', paddingLeft: '1.1rem', fontSize: 12, color: '#334155' }}
          data-testid={`materials-schedule-notes-${material.materialId}`}
        >
          {material.notes.map((note, idx) => (
            <li key={idx}>{note}</li>
          ))}
        </ul>
      ) : null}

      {/* ─── Unresolved checks ─────────────────────────────────── */}
      {material.unresolvedChecks.length > 0 ? (
        <div
          style={{
            background:   '#fff7ed',
            border:       '1px solid #fed7aa',
            borderRadius: 6,
            padding:      '0.4rem 0.5rem',
            marginBottom: '0.4rem',
          }}
          data-testid={`materials-schedule-checks-${material.materialId}`}
        >
          <p style={{ margin: '0 0 0.25rem', fontSize: 10, fontWeight: 700, color: '#92400e' }}>
            UNRESOLVED CHECKS
          </p>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: 12, color: '#92400e' }}>
            {material.unresolvedChecks.map((check, idx) => (
              <li key={idx}>{check}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* ─── Source spec lines ─────────────────────────────────── */}
      {material.sourceLineIds.length > 0 ? (
        <div
          style={{ fontSize: 11, color: '#64748b', marginBottom: '0.35rem' }}
          data-testid={`materials-schedule-sources-${material.materialId}`}
        >
          <strong>Source lines: </strong>
          {material.sourceLineIds.map((id, idx) => {
            const sourceLine = lineById.get(id);
            return (
              <span key={id}>
                {idx > 0 ? ', ' : ''}
                <span title={sourceLine?.label ?? id} style={{ fontFamily: 'monospace', fontSize: 10 }}>
                  {id}
                </span>
                {sourceLine ? ` (${sourceLine.label})` : ''}
              </span>
            );
          })}
        </div>
      ) : null}

      {/* ─── Visibility badges ─────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
        <VisibilityBadge label="customer" visible={material.customerVisible} />
        <VisibilityBadge label="engineer" visible={material.engineerVisible} />
        <VisibilityBadge label="office" visible={material.officeVisible} />
      </div>
    </article>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function MaterialsScheduleReviewPanel({ materials, lines = [] }: Props) {
  const lineById = new Map(lines.map((l) => [l.lineId, l]));

  if (materials.length === 0) {
    return (
      <p
        style={{ margin: 0, color: '#6b7280', fontSize: 13 }}
        data-testid="materials-schedule-panel-empty"
      >
        No material lines generated for this fixture.
      </p>
    );
  }

  // Group by category, preserving category order
  const byCategory = new Map<SuggestedMaterialLineV1['category'], SuggestedMaterialLineV1[]>();
  for (const material of materials) {
    const group = byCategory.get(material.category) ?? [];
    group.push(material);
    byCategory.set(material.category, group);
  }

  return (
    <div
      style={{ display: 'grid', gap: '1rem' }}
      data-testid="materials-schedule-panel"
    >
      {CATEGORY_ORDER.filter((cat) => byCategory.has(cat)).map((cat) => {
        const group = byCategory.get(cat)!;
        return (
          <section
            key={cat}
            style={{
              border:       '1px solid #e2e8f0',
              borderRadius: 10,
              padding:      '0.85rem',
              background:   '#f8fafc',
            }}
            data-testid={`materials-schedule-category-${cat}`}
          >
            <h3
              style={{ margin: '0 0 0.55rem', fontSize: '0.92rem' }}
              data-testid={`materials-schedule-category-label-${cat}`}
            >
              {CATEGORY_LABELS[cat]}
              <span
                style={{ marginLeft: '0.4rem', fontSize: 11, fontWeight: 400, color: '#64748b' }}
              >
                ({group.length})
              </span>
            </h3>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {group.map((material) => (
                <MaterialCard
                  key={material.materialId}
                  material={material}
                  lineById={lineById}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
