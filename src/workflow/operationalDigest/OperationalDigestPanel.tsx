import type {
  OperationalDigestInstallPhaseV1,
  OperationalDigestV1,
  OperationalIntentGroupV1,
  OperationalLocationStateV1,
} from './OperationalDigestV1';

interface Props {
  readonly digest: OperationalDigestV1;
}

const OWNER_ORDER: Readonly<Record<OperationalIntentGroupV1['owner'], number>> = {
  surveyor: 0,
  office: 1,
  engineer: 2,
};

const PHASE_LABELS: Readonly<Record<OperationalDigestInstallPhaseV1, string>> = {
  survey: 'Survey',
  coordination: 'Office coordination',
  installation: 'Installation',
};

const LOCATION_STATE_LABELS: Readonly<Record<OperationalLocationStateV1, string>> = {
  confirmed: 'Location confirmed',
  inferred: 'Location inferred from existing evidence',
  needs_survey: 'Location to confirm on survey',
  unresolved: 'Location unresolved',
};

const SEVERITY_COLORS: Readonly<Record<OperationalIntentGroupV1['severity'], string>> = {
  blocker: '#b91c1c',
  important: '#92400e',
  optional: '#334155',
};

function groupByOwnerAndPhase(items: readonly OperationalIntentGroupV1[]) {
  const map = new Map<OperationalIntentGroupV1['owner'], Map<OperationalDigestInstallPhaseV1, OperationalIntentGroupV1[]>>();
  for (const item of items) {
    const byPhase = map.get(item.owner) ?? new Map<OperationalDigestInstallPhaseV1, OperationalIntentGroupV1[]>();
    const phaseItems = byPhase.get(item.installPhase) ?? [];
    phaseItems.push(item);
    byPhase.set(item.installPhase, phaseItems);
    map.set(item.owner, byPhase);
  }
  return map;
}

function badge(text: string, background: string, color = '#fff') {
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

export default function OperationalDigestPanel({ digest }: Props) {
  const primaryItems = digest.items.slice(0, digest.primaryItemLimit);
  const hiddenCount = Math.max(0, digest.items.length - primaryItems.length);
  const grouped = groupByOwnerAndPhase(primaryItems);
  const ownerKeys = [...grouped.keys()].sort((a, b) => OWNER_ORDER[a] - OWNER_ORDER[b]);

  return (
    <section
      style={{ border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '0.75rem', background: '#fff' }}
      data-testid="operational-digest-panel"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center', marginBottom: '0.55rem' }}>
        <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Operational Digest</h3>
        <span style={{ fontSize: 11, color: '#475569' }}>
          Showing {primaryItems.length} of {digest.totalItems}
        </span>
      </div>

      {primaryItems.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>No operational actions pending.</p>
      ) : (
        <div style={{ display: 'grid', gap: '0.65rem' }}>
          {ownerKeys.map((owner) => {
            const phaseMap = grouped.get(owner);
            if (!phaseMap) return null;
            const phases = [...phaseMap.keys()].sort((a, b) => PHASE_LABELS[a].localeCompare(PHASE_LABELS[b]));
            return (
              <section key={owner} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.6rem', background: '#f8fafc' }}>
                <h4 style={{ margin: '0 0 0.5rem', fontSize: 13, textTransform: 'capitalize' }}>{owner}</h4>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  {phases.map((phase) => (
                    <div key={`${owner}:${phase}`}>
                      <div style={{ marginBottom: '0.35rem', fontSize: 11, color: '#334155', fontWeight: 700 }}>{PHASE_LABELS[phase]}</div>
                      <div style={{ display: 'grid', gap: '0.4rem' }}>
                        {(phaseMap.get(phase) ?? []).map((item) => (
                          <details
                            key={item.id}
                            style={{ border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', padding: '0.45rem 0.55rem' }}
                            data-testid={`operational-digest-card-${item.id}`}
                          >
                            <summary style={{ cursor: 'pointer', listStyle: 'none' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.4rem' }}>
                                <strong style={{ fontSize: 12 }}>{item.title}</strong>
                                <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                                  {badge(item.severity, SEVERITY_COLORS[item.severity])}
                                  {badge(LOCATION_STATE_LABELS[item.locationState], '#e2e8f0', '#0f172a')}
                                </div>
                              </div>
                              <p style={{ margin: '0.3rem 0 0', fontSize: 11, color: '#334155' }}>{item.summary}</p>
                            </summary>
                            <div style={{ marginTop: '0.5rem', display: 'grid', gap: '0.35rem' }}>
                              {item.evidenceRequired.length > 0 ? (
                                <p style={{ margin: 0, fontSize: 11, color: '#334155' }}>
                                  <strong>Evidence required:</strong> {item.evidenceRequired.map((evidence) => evidence.prompt).join(' | ')}
                                </p>
                              ) : null}
                              {item.unresolvedDependencies.length > 0 ? (
                                <p style={{ margin: 0, fontSize: 11, color: '#334155' }}>
                                  <strong>Unresolved dependencies:</strong> {item.unresolvedDependencies.join(' | ')}
                                </p>
                              ) : null}
                              <p style={{ margin: 0, fontSize: 11, color: '#334155' }}>
                                <strong>Linked task IDs:</strong> {item.linkedTaskIds.join(', ')}
                              </p>
                            </div>
                          </details>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {hiddenCount > 0 ? (
        <p style={{ margin: '0.6rem 0 0', fontSize: 11, color: '#64748b' }}>
          +{hiddenCount} additional digest items hidden to keep primary view compact.
        </p>
      ) : null}
    </section>
  );
}
