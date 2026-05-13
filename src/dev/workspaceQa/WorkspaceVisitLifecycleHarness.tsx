import { useEffect, useMemo, useState } from 'react';
import {
  evaluateWorkspaceVisitLifecycleScenario,
  getWorkspaceVisitLifecycleScenariosV1,
  type WorkspaceVisitLifecycleEvaluationV1,
  type WorkspaceVisitLifecycleProgressEntryV1,
  type WorkspaceVisitReadinessProgressEntryV1,
} from './WorkspaceVisitLifecycleScenarioV1';

interface WorkspaceVisitLifecycleHarnessProps {
  readonly onBack?: () => void;
}

function StatusPill({
  ok,
  passLabel = 'pass',
  failLabel = 'fail',
}: {
  ok: boolean;
  passLabel?: string;
  failLabel?: string;
}) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        background: ok ? '#dcfce7' : '#fee2e2',
        color: ok ? '#166534' : '#991b1b',
      }}
    >
      {ok ? passLabel : failLabel}
    </span>
  );
}

function LifecycleRow({ entry }: { entry: WorkspaceVisitLifecycleProgressEntryV1 }) {
  const colourByState: Record<WorkspaceVisitLifecycleProgressEntryV1['state'], string> = {
    pending: '#64748b',
    active: '#1d4ed8',
    done: '#166534',
    blocked: '#991b1b',
  };
  return (
    <tr>
      <td style={{ padding: '4px 8px', fontSize: 12 }}>{entry.stage}</td>
      <td style={{ padding: '4px 8px', fontSize: 12, color: colourByState[entry.state], fontWeight: 700 }}>{entry.state}</td>
      <td style={{ padding: '4px 8px', fontSize: 12, color: '#475569' }}>{entry.note ?? '—'}</td>
    </tr>
  );
}

function ReadinessRow({ entry }: { entry: WorkspaceVisitReadinessProgressEntryV1 }) {
  const colourByState: Record<WorkspaceVisitReadinessProgressEntryV1['state'], string> = {
    blocked: '#991b1b',
    ready: '#1d4ed8',
    complete: '#166534',
  };
  return (
    <tr>
      <td style={{ padding: '4px 8px', fontSize: 12 }}>{entry.key.replace(/_/g, ' ')}</td>
      <td style={{ padding: '4px 8px', fontSize: 12, color: colourByState[entry.state], fontWeight: 700 }}>{entry.state}</td>
      <td style={{ padding: '4px 8px', fontSize: 12, color: '#475569' }}>{entry.note}</td>
    </tr>
  );
}

export default function WorkspaceVisitLifecycleHarness({ onBack }: WorkspaceVisitLifecycleHarnessProps) {
  const scenarios = useMemo(() => getWorkspaceVisitLifecycleScenariosV1(), []);
  const [scenarioId, setScenarioId] = useState(scenarios[0]?.id ?? 'new_demo_visit');
  const activeScenario = useMemo(
    () => scenarios.find((scenario) => scenario.id === scenarioId) ?? scenarios[0],
    [scenarioId, scenarios],
  );
  const [evaluation, setEvaluation] = useState<WorkspaceVisitLifecycleEvaluationV1 | null>(null);

  useEffect(() => {
    let active = true;
    if (!activeScenario) {
      setEvaluation(null);
      return () => {
        active = false;
      };
    }
    setEvaluation(null);
    (async () => {
      const next = await evaluateWorkspaceVisitLifecycleScenario(activeScenario);
      if (active) setEvaluation(next);
    })();
    return () => {
      active = false;
    };
  }, [activeScenario]);

  if (!activeScenario) {
    return (
      <div style={{ padding: 24, fontFamily: 'monospace' }}>
        <strong>No workspace lifecycle QA scenarios found.</strong>
      </div>
    );
  }

  return (
    <div
      style={{ fontFamily: 'monospace', maxWidth: 1100, margin: '0 auto', padding: 24, display: 'grid', gap: 12 }}
      data-testid="workspace-visit-lifecycle-harness"
    >
      <header style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            style={{ fontSize: 12, padding: '4px 12px' }}
            data-testid="workspace-visit-lifecycle-harness-back"
          >
            ← Back
          </button>
        )}
        <div>
          <h1 style={{ margin: 0, fontSize: 20 }}>Workspace Visit Lifecycle QA Harness</h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: 12 }}>
            Deterministic dev-only lifecycle verification for workspace-scoped visits.
          </p>
        </div>
      </header>

      <section style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
        <label htmlFor="workspace-qa-scenario" style={{ display: 'block', fontSize: 12, marginBottom: 6 }}>
          Scenario
        </label>
        <select
          id="workspace-qa-scenario"
          value={activeScenario.id}
          onChange={(event) => setScenarioId(event.target.value as typeof activeScenario.id)}
          style={{ fontFamily: 'monospace', fontSize: 12, padding: '4px 8px', width: '100%' }}
          data-testid="workspace-visit-lifecycle-scenario-select"
        >
          {scenarios.map((scenario) => (
            <option key={scenario.id} value={scenario.id}>
              {scenario.label}
            </option>
          ))}
        </select>
      </section>

      <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 14 }}>Current state</h2>
        <div style={{ display: 'grid', gap: 4, fontSize: 12 }}>
          <div data-testid="workspace-qa-current-workspace">
            <strong>Current workspace:</strong> {activeScenario.session.workspaceName ?? 'none'}
            {activeScenario.session.workspaceId ? ` (${activeScenario.session.workspaceId})` : ''}
          </div>
          <div data-testid="workspace-qa-active-brand">
            <strong>Active brand:</strong> {activeScenario.session.activeBrandId} ({activeScenario.session.brandResolutionSource})
          </div>
          <div data-testid="workspace-qa-visit-ownership">
            <strong>Visit ownership:</strong> {activeScenario.visit.ownership ? `${activeScenario.visit.ownership.workspaceId} / ${activeScenario.visit.ownership.createdByUserId}` : 'unowned'}
          </div>
          <div data-testid="workspace-qa-storage-target">
            <strong>Storage target:</strong> {activeScenario.session.storageTarget}
          </div>
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 14 }}>Lifecycle progression</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }} data-testid="workspace-qa-lifecycle-progression">
          <thead>
            <tr style={{ textAlign: 'left', fontSize: 11, color: '#64748b' }}>
              <th style={{ padding: '4px 8px' }}>Stage</th>
              <th style={{ padding: '4px 8px' }}>State</th>
              <th style={{ padding: '4px 8px' }}>Note</th>
            </tr>
          </thead>
          <tbody>
            {activeScenario.lifecycleProgression.map((entry) => (
              <LifecycleRow key={entry.stage} entry={entry} />
            ))}
          </tbody>
        </table>
      </section>

      <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 14 }}>Readiness progression</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }} data-testid="workspace-qa-readiness-progression">
          <thead>
            <tr style={{ textAlign: 'left', fontSize: 11, color: '#64748b' }}>
              <th style={{ padding: '4px 8px' }}>Gate</th>
              <th style={{ padding: '4px 8px' }}>State</th>
              <th style={{ padding: '4px 8px' }}>Note</th>
            </tr>
          </thead>
          <tbody>
            {activeScenario.readinessProgression.map((entry) => (
              <ReadinessRow key={entry.key} entry={entry} />
            ))}
          </tbody>
        </table>
      </section>

      <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }} data-testid="workspace-qa-export-package-status">
        <h2 style={{ margin: '0 0 8px', fontSize: 14 }}>Export package status</h2>
        {evaluation === null ? (
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Evaluating export package…</p>
        ) : (
          <div style={{ display: 'grid', gap: 6, fontSize: 12 }}>
            <div><strong>Package built:</strong> <StatusPill ok={evaluation.exportPackageStatus.packageBuilt} /></div>
            <div><strong>Import round-trip:</strong> <StatusPill ok={evaluation.exportPackageStatus.importSucceeded} /></div>
            <div><strong>Ownership metadata:</strong> <StatusPill ok={evaluation.exportPackageStatus.includesOwnershipMetadata} /></div>
            <div><strong>Brand metadata:</strong> <StatusPill ok={evaluation.exportPackageStatus.includesBrandMetadata} /></div>
            <div><strong>Ownership preserved on import:</strong> <StatusPill ok={evaluation.exportPackageStatus.importPreservedOwnership} /></div>
            <div><strong>Brand preserved on import:</strong> <StatusPill ok={evaluation.exportPackageStatus.importPreservedBrand} /></div>
          </div>
        )}
      </section>

      <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }} data-testid="workspace-qa-follow-up-resolution-state">
        <h2 style={{ margin: '0 0 8px', fontSize: 14 }}>Follow-up resolution state</h2>
        <div style={{ display: 'grid', gap: 4, fontSize: 12 }}>
          <div><strong>Handoff visit reference:</strong> {activeScenario.followUpResolutionState.handoffVisitReference}</div>
          <div><strong>Resolved tasks:</strong> {activeScenario.followUpResolutionState.resolvedTaskCount}</div>
          <div><strong>Unresolved tasks:</strong> {activeScenario.followUpResolutionState.unresolvedTaskCount}</div>
          <div><strong>Revisit reference:</strong> {activeScenario.followUpResolutionState.revisitVisitReference ?? '—'}</div>
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }} data-testid="workspace-qa-validation-checks">
        <h2 style={{ margin: '0 0 8px', fontSize: 14 }}>Validation checks</h2>
        {evaluation === null ? (
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Running validation checks…</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6, fontSize: 12 }}>
            <li>visit has workspaceId <StatusPill ok={evaluation.checks.visitHasWorkspaceId} /></li>
            <li>visit has brandId <StatusPill ok={evaluation.checks.visitHasBrandId} /></li>
            <li>export contains ownership metadata <StatusPill ok={evaluation.checks.exportContainsOwnershipMetadata} /></li>
            <li>implementation workflow resolves correctly <StatusPill ok={evaluation.checks.implementationWorkflowResolvesCorrectly} /></li>
            <li>customer outputs use resolved brand <StatusPill ok={evaluation.checks.customerOutputsUseResolvedBrand} /></li>
            <li>follow-up handoff contains correct visit ownership <StatusPill ok={evaluation.checks.followUpHandoffContainsCorrectVisitOwnership} /></li>
          </ul>
        )}
      </section>

      <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }} data-testid="workspace-qa-pass-fail-summary">
        <h2 style={{ margin: '0 0 8px', fontSize: 14 }}>Pass / fail summary</h2>
        {evaluation === null ? (
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Preparing summary…</p>
        ) : (
          <div style={{ display: 'grid', gap: 6, fontSize: 12 }}>
            <div><strong>ownership valid:</strong> <StatusPill ok={evaluation.summary.ownershipValid} /></div>
            <div><strong>branding valid:</strong> <StatusPill ok={evaluation.summary.brandingValid} /></div>
            <div><strong>storage valid:</strong> <StatusPill ok={evaluation.summary.storageValid} /></div>
            <div><strong>workflow valid:</strong> <StatusPill ok={evaluation.summary.workflowValid} /></div>
            <div><strong>export valid:</strong> <StatusPill ok={evaluation.summary.exportValid} /></div>
            <div data-testid="workspace-qa-lifecycle-passed">
              <strong>lifecycle passed:</strong>{' '}
              <StatusPill ok={evaluation.lifecyclePassed} passLabel="pass" failLabel="fail" />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
