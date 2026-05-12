import type { SpecificationReadinessV1 } from '../../specification/readiness';

interface Props {
  readiness: SpecificationReadinessV1;
}

function StatusBadge({ ready }: { ready: boolean }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        borderRadius: 999,
        padding: '0.15rem 0.5rem',
        color: ready ? '#166534' : '#991b1b',
        background: ready ? '#dcfce7' : '#fee2e2',
      }}
    >
      {ready ? 'READY' : 'BLOCKED'}
    </span>
  );
}

function ListOrNone({
  items,
  testId,
  noneTestId,
}: {
  items: readonly string[];
  testId: string;
  noneTestId: string;
}) {
  if (items.length === 0) {
    return <p style={{ margin: 0, fontSize: 12, color: '#64748b' }} data-testid={noneTestId}>None</p>;
  }

  return (
    <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: 12 }} data-testid={testId}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export default function SpecificationReadinessPanel({ readiness }: Props) {
  return (
    <section
      style={{ border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '0.75rem', background: '#fff' }}
      data-testid="specification-readiness-panel"
    >
      <h2 style={{ margin: '0 0 0.65rem', fontSize: '1rem' }}>Specification Readiness Gates</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.5rem' }}>
          <p style={{ margin: '0 0 0.3rem', fontSize: 12, color: '#334155' }}>Office review</p>
          <div data-testid="spec-readiness-office-status">
            <StatusBadge ready={readiness.readyForOfficeReview} />
          </div>
        </div>
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.5rem' }}>
          <p style={{ margin: '0 0 0.3rem', fontSize: 12, color: '#334155' }}>Installer handover</p>
          <div data-testid="spec-readiness-installer-status">
            <StatusBadge ready={readiness.readyForInstallerHandover} />
          </div>
        </div>
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.5rem' }}>
          <p style={{ margin: '0 0 0.3rem', fontSize: 12, color: '#334155' }}>Materials ordering</p>
          <div data-testid="spec-readiness-materials-status">
            <StatusBadge ready={readiness.readyForMaterialsOrdering} />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: '0.6rem' }}>
        <div>
          <p style={{ margin: '0 0 0.25rem', fontSize: 11, fontWeight: 700, color: '#991b1b' }}>BLOCKING REASONS</p>
          <ListOrNone
            items={readiness.blockingReasons}
            testId="spec-readiness-blocking-reasons"
            noneTestId="spec-readiness-blocking-reasons-none"
          />
        </div>
        <div>
          <p style={{ margin: '0 0 0.25rem', fontSize: 11, fontWeight: 700, color: '#92400e' }}>WARNINGS</p>
          <ListOrNone
            items={readiness.warnings}
            testId="spec-readiness-warnings"
            noneTestId="spec-readiness-warnings-none"
          />
        </div>
        <div>
          <p style={{ margin: '0 0 0.25rem', fontSize: 11, fontWeight: 700, color: '#1e3a8a' }}>UNRESOLVED CHECKS</p>
          <ListOrNone
            items={readiness.unresolvedChecks}
            testId="spec-readiness-unresolved-checks"
            noneTestId="spec-readiness-unresolved-checks-none"
          />
        </div>
      </div>
    </section>
  );
}
