import { useMemo, useState } from 'react';
import type { SpecificationLineStatus, SpecificationLineV1 } from '../../specification/specLines';

interface Props {
  lines: readonly SpecificationLineV1[];
}

const SECTION_LABELS: Record<SpecificationLineV1['sectionKey'], string> = {
  heat_source: 'Heat Source',
  hot_water: 'Hot Water',
  hydraulic_components: 'Hydraulic Components',
  water_quality: 'Water Quality',
  safety_compliance: 'Safety & Compliance',
  pipework: 'Pipework',
};

const STATUS_OPTIONS: readonly SpecificationLineStatus[] = [
  'suggested',
  'accepted',
  'edited',
  'removed',
  'needs_check',
];

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, background: color, color: '#fff', padding: '2px 6px', borderRadius: 4 }}>
      {label}
    </span>
  );
}

export default function SpecificationLineReviewPanel({ lines }: Props) {
  const [draftLines, setDraftLines] = useState<SpecificationLineV1[]>(() => lines.map((line) => ({ ...line })));

  const grouped = useMemo(() => {
    return draftLines.reduce<Record<string, SpecificationLineV1[]>>((acc, line) => {
      const key = line.sectionKey;
      if (!acc[key]) acc[key] = [];
      acc[key].push(line);
      return acc;
    }, {});
  }, [draftLines]);

  function updateLine(lineId: string, patch: Partial<SpecificationLineV1>) {
    setDraftLines((current) =>
      current.map((line) => {
        if (line.lineId !== lineId) return line;
        return { ...line, ...patch };
      }),
    );
  }

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }} data-testid="specification-line-review-panel">
      {Object.keys(SECTION_LABELS).map((sectionKey) => {
        const linesInSection = grouped[sectionKey] ?? [];
        if (linesInSection.length === 0) return null;
        return (
          <section key={sectionKey} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.75rem', background: '#f8fafc' }}>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>{SECTION_LABELS[sectionKey as SpecificationLineV1['sectionKey']]}</h3>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {linesInSection.map((line) => (
                <article key={line.lineId} style={{ border: '1px solid #dbeafe', borderRadius: 8, background: '#fff', padding: '0.65rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                      <Badge label={line.lineType} color="#1d4ed8" />
                      <Badge label={line.confidence} color="#475569" />
                      <Badge label={`customer:${line.customerVisible ? 'yes' : 'no'}`} color={line.customerVisible ? '#16a34a' : '#6b7280'} />
                      <Badge label={`engineer:${line.engineerVisible ? 'yes' : 'no'}`} color={line.engineerVisible ? '#16a34a' : '#6b7280'} />
                      <Badge label={`office:${line.officeVisible ? 'yes' : 'no'}`} color={line.officeVisible ? '#16a34a' : '#6b7280'} />
                    </div>
                    <select
                      value={line.status}
                      onChange={(event) => updateLine(line.lineId, { status: event.target.value as SpecificationLineStatus })}
                      data-testid={`spec-line-status-${line.lineId}`}
                      style={{ fontSize: 12 }}
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ marginTop: '0.5rem', display: 'grid', gap: '0.35rem' }}>
                    <label style={{ display: 'grid', gap: '0.2rem' }}>
                      <span style={{ fontSize: 11, color: '#334155' }}>Label</span>
                      <input
                        value={line.label}
                        onChange={(event) => updateLine(line.lineId, { label: event.target.value, status: 'edited' })}
                        data-testid={`spec-line-label-${line.lineId}`}
                        style={{ fontSize: 13, padding: '0.35rem' }}
                      />
                    </label>

                    <label style={{ display: 'grid', gap: '0.2rem' }}>
                      <span style={{ fontSize: 11, color: '#334155' }}>Description</span>
                      <textarea
                        value={line.description}
                        onChange={(event) => updateLine(line.lineId, { description: event.target.value, status: 'edited' })}
                        data-testid={`spec-line-description-${line.lineId}`}
                        style={{ fontSize: 12, minHeight: 58, padding: '0.35rem' }}
                      />
                    </label>
                  </div>

                  <div style={{ marginTop: '0.5rem', fontSize: 12, color: '#334155' }}>
                    <strong>Reason:</strong> {line.reason}
                  </div>

                  <div style={{ marginTop: '0.4rem', display: 'flex', gap: '1rem', fontSize: 12, color: '#334155' }}>
                    <span>
                      <strong>Risks:</strong>{' '}
                      {line.linkedRiskIds.length > 0 ? line.linkedRiskIds.join(', ') : 'None'}
                    </span>
                    <span>
                      <strong>Validations:</strong>{' '}
                      {line.linkedValidationIds.length > 0 ? line.linkedValidationIds.join(', ') : 'None'}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
