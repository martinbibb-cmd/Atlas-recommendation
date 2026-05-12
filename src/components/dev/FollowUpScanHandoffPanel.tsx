import type { FollowUpScanHandoffV1 } from '../../specification/followUps';

interface Props {
  handoff: FollowUpScanHandoffV1;
}

function badge(text: string, background: string, color = '#0f172a') {
  return (
    <span
      style={{
        borderRadius: 999,
        padding: '0.1rem 0.45rem',
        fontSize: 11,
        fontWeight: 700,
        background,
        color,
      }}
    >
      {text}
    </span>
  );
}

const PRIORITY_COLORS: Readonly<Record<'blocker' | 'important' | 'optional', string>> = {
  blocker: '#fee2e2',
  important: '#fef3c7',
  optional: '#e2e8f0',
};

export default function FollowUpScanHandoffPanel({ handoff }: Props) {
  return (
    <section
      style={{ border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '0.75rem', background: '#fff' }}
      data-testid="follow-up-scan-handoff-panel"
    >
      <h3 style={{ margin: '0 0 0.55rem', fontSize: '0.95rem' }}>Follow-up Scan Handoff</h3>
      <p style={{ margin: '0 0 0.35rem', fontSize: 12, color: '#475569' }}>
        <strong>Send to Scan</strong> preview — dev-only Atlas Scan handoff package. No persistence or send action yet.
      </p>
      <p style={{ margin: '0 0 0.6rem', fontSize: 12, color: '#475569' }} data-testid="follow-up-scan-handoff-id">
        <strong>Handoff ID:</strong> {handoff.handoffId}
      </p>

      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <div>
          <strong style={{ display: 'block', marginBottom: '0.35rem', fontSize: 13 }}>Capture items</strong>
          {handoff.captureItems.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12, color: '#64748b' }} data-testid="follow-up-scan-handoff-empty">
              No Scan capture items.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {handoff.captureItems.map((item) => (
                <article
                  key={item.captureItemId}
                  style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.6rem', background: '#f8fafc' }}
                  data-testid={`follow-up-scan-capture-card-${item.captureItemId}`}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.35rem' }}>
                    <strong style={{ fontSize: 13 }}>{item.prompt}</strong>
                    <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                      {badge(item.priority, PRIORITY_COLORS[item.priority])}
                      {badge(item.captureMode, '#dbeafe', '#1e3a8a')}
                      {item.targetLocation ? badge(item.targetLocation, '#dcfce7', '#166534') : null}
                    </div>
                  </div>

                  {item.acceptanceCriteria.length > 0 ? (
                    <ul style={{ margin: '0 0 0.35rem', paddingLeft: '1rem', fontSize: 11, color: '#475569' }}>
                      {item.acceptanceCriteria.map((criterion) => (
                        <li key={criterion}>{criterion}</li>
                      ))}
                    </ul>
                  ) : null}

                  <p style={{ margin: 0, fontSize: 11, color: '#475569' }}>
                    <strong>Linked tasks/lines/materials:</strong>{' '}
                    {item.linkedTaskIds.length}/{item.linkedLineIds.length}/{item.linkedMaterialIds.length}
                  </p>
                </article>
              ))}
            </div>
          )}
        </div>

        <div>
          <strong style={{ display: 'block', marginBottom: '0.35rem', fontSize: 13 }}>Unresolved dependencies</strong>
          {handoff.unresolvedDependencies.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
              No unresolved dependencies.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {handoff.unresolvedDependencies.map((item) => (
                <article
                  key={item.dependencyId}
                  style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.6rem', background: '#f8fafc' }}
                  data-testid={`follow-up-scan-dependency-card-${item.dependencyId}`}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <strong style={{ fontSize: 13 }}>{item.prompt}</strong>
                    <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                      {badge(item.priority, PRIORITY_COLORS[item.priority])}
                      {badge(item.dependencyType, '#ede9fe', '#5b21b6')}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
