/**
 * FirstTesterSessionScriptPanel.tsx
 *
 * Dev-only UI panel for displaying the First Tester Session Script.
 *
 * Renders the per-tester scripts (internal, friendly installer, friendly
 * customer) generated from the current LimitedTrialPlanV1 and
 * TrialReadinessSummaryV1.  Not rendered in production.
 */

import { useState } from 'react';
import type { FirstTesterSessionScriptV1, TesterSessionScriptV1 } from './FirstTesterSessionScriptV1';
import type { TrialFeedbackTesterTypeV1 } from '../feedback/TrialFeedbackEntryV1';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTesterType(type: TrialFeedbackTesterTypeV1): string {
  return type.replace(/_/g, ' ');
}

// ─── Section list ─────────────────────────────────────────────────────────────

function ScriptSection({ title, items, testId }: { title: string; items: readonly string[]; testId?: string }) {
  if (items.length === 0) return null;
  return (
    <div style={{ display: 'grid', gap: 4 }} data-testid={testId}>
      <strong style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {title}
      </strong>
      <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4, fontSize: 12 }}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

// ─── Per-tester script card ───────────────────────────────────────────────────

function TesterScriptCard({
  testerScript,
  expanded,
  onToggle,
}: {
  testerScript: TesterSessionScriptV1;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}
      data-testid={`first-tester-script-card-${testerScript.testerType}`}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          background: expanded ? '#f0f9ff' : '#f8fafc',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'monospace',
          fontSize: 13,
          fontWeight: 700,
          textAlign: 'left',
        }}
        data-testid={`first-tester-script-toggle-${testerScript.testerType}`}
      >
        <span style={{ textTransform: 'capitalize' }}>
          {formatTesterType(testerScript.testerType)}
        </span>
        <span style={{ fontSize: 11, color: '#64748b' }}>{expanded ? '▲ collapse' : '▼ expand'}</span>
      </button>

      {expanded && (
        <div style={{ padding: 12, display: 'grid', gap: 12 }}>
          <ScriptSection
            title="Pre-session setup"
            items={testerScript.preSessionSetup}
            testId={`first-tester-script-pre-session-${testerScript.testerType}`}
          />
          <ScriptSection
            title="Tester introduction"
            items={testerScript.testerIntro}
            testId={`first-tester-script-intro-${testerScript.testerType}`}
          />
          <ScriptSection
            title="Scenario to run"
            items={testerScript.scenarioToRun}
            testId={`first-tester-script-scenario-${testerScript.testerType}`}
          />
          <ScriptSection
            title="Observer checklist"
            items={testerScript.observationChecklist}
            testId={`first-tester-script-observation-${testerScript.testerType}`}
          />
          <ScriptSection
            title="Tasks for tester"
            items={testerScript.tasksForTester}
            testId={`first-tester-script-tasks-${testerScript.testerType}`}
          />
          <ScriptSection
            title="Prompts to ask"
            items={testerScript.promptsToAsk}
            testId={`first-tester-script-prompts-${testerScript.testerType}`}
          />
          <ScriptSection
            title="Success signals"
            items={testerScript.successSignals}
            testId={`first-tester-script-success-${testerScript.testerType}`}
          />
          <ScriptSection
            title="Stop signals"
            items={testerScript.stopSignals}
            testId={`first-tester-script-stop-${testerScript.testerType}`}
          />
          <ScriptSection
            title="Feedback capture reminder"
            items={testerScript.feedbackCaptureReminder}
            testId={`first-tester-script-feedback-reminder-${testerScript.testerType}`}
          />
          <ScriptSection
            title="Post-session actions"
            items={testerScript.postSessionActions}
            testId={`first-tester-script-post-session-${testerScript.testerType}`}
          />
        </div>
      )}
    </div>
  );
}

// ─── Public panel ─────────────────────────────────────────────────────────────

interface FirstTesterSessionScriptPanelProps {
  readonly sessionScript: FirstTesterSessionScriptV1 | null;
  readonly onExport: () => void;
}

export function FirstTesterSessionScriptPanel({
  sessionScript,
  onExport,
}: FirstTesterSessionScriptPanelProps) {
  const [expandedType, setExpandedType] = useState<TrialFeedbackTesterTypeV1 | null>('internal');

  const testerTypes: readonly TrialFeedbackTesterTypeV1[] = [
    'internal',
    'friendly_installer',
    'friendly_customer',
  ];

  function handleToggle(type: TrialFeedbackTesterTypeV1) {
    setExpandedType((current) => (current === type ? null : type));
  }

  return (
    <section
      style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, display: 'grid', gap: 12 }}
      data-testid="first-tester-session-script-panel"
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: 14 }}>First Tester Session Script</h2>
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
            Guided script for running the first Atlas trial session consistently.
          </p>
        </div>
        <button
          type="button"
          onClick={onExport}
          disabled={sessionScript === null}
          style={{ fontSize: 12, padding: '4px 12px' }}
          data-testid="first-tester-session-script-export-json"
        >
          Export JSON
        </button>
      </div>

      {sessionScript === null ? (
        <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
          Building first tester session script…
        </p>
      ) : sessionScript.trialRecommendation === 'not_ready' ? (
        <p
          style={{ margin: 0, fontSize: 12, color: '#991b1b' }}
          data-testid="first-tester-session-script-not-ready"
        >
          No live tester scripts — trial recommendation is{' '}
          <strong>not ready</strong>. Resolve blockers before running a tester session.
        </p>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {testerTypes.map((type) => {
            const testerScript = sessionScript.scripts[type];
            if (!testerScript) return null;
            return (
              <TesterScriptCard
                key={type}
                testerScript={testerScript}
                expanded={expandedType === type}
                onToggle={() => handleToggle(type)}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
