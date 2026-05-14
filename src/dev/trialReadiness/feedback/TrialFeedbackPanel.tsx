/**
 * TrialFeedbackPanel.tsx
 *
 * Dev-only UI for capturing and managing structured trial feedback entries.
 *
 * Allows adding and editing feedback manually, exporting/importing trial-feedback.json,
 * and viewing the aggregated feedback summary.
 *
 * Not rendered in production.
 */

import { useMemo, useState } from 'react';
import type {
  TrialFeedbackAreaV1,
  TrialFeedbackEntryV1,
  TrialFeedbackSeverityV1,
  TrialFeedbackStatusV1,
  TrialFeedbackTesterTypeV1,
} from './TrialFeedbackEntryV1';
import { buildTrialFeedbackSummary } from './buildTrialFeedbackSummary';
import type { LimitedTrialPlanV1 } from '../buildLimitedTrialPlan';

// ─── Enum constants ───────────────────────────────────────────────────────────

const TESTER_TYPES: readonly TrialFeedbackTesterTypeV1[] = [
  'internal',
  'friendly_installer',
  'friendly_customer',
];

const AREAS: readonly TrialFeedbackAreaV1[] = [
  'portal',
  'pdf',
  'implementation_workflow',
  'scan_handoff',
  'workspace',
  'general',
];

const SEVERITIES: readonly TrialFeedbackSeverityV1[] = [
  'blocker',
  'confusing',
  'polish',
  'positive',
];

const STATUSES: readonly TrialFeedbackStatusV1[] = [
  'new',
  'triaged',
  'accepted',
  'fixed',
  'rejected',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatLabel(value: string): string {
  return value.replace(/_/g, ' ');
}

function generateFeedbackId(entries: readonly TrialFeedbackEntryV1[]): string {
  const highest = entries.reduce((max, entry) => {
    const match = /^fb-(\d+)$/.exec(entry.feedbackId);
    if (match) {
      const n = parseInt(match[1] ?? '0', 10);
      return n > max ? n : max;
    }
    return max;
  }, 0);
  return `fb-${String(highest + 1).padStart(3, '0')}`;
}

// ─── Blank draft ─────────────────────────────────────────────────────────────

function blankDraft(
  entries: readonly TrialFeedbackEntryV1[],
  scenarioId: string,
): TrialFeedbackEntryV1 {
  return {
    feedbackId: generateFeedbackId(entries),
    scenarioId,
    testerType: 'internal',
    submittedAt: new Date().toISOString(),
    area: 'general',
    severity: 'polish',
    summary: '',
    relatedTrialPlanItemIds: [],
    status: 'new',
  };
}

// ─── Severity pill ────────────────────────────────────────────────────────────

const SEVERITY_PALETTE: Record<TrialFeedbackSeverityV1, { background: string; color: string }> = {
  blocker: { background: '#fee2e2', color: '#991b1b' },
  confusing: { background: '#fef3c7', color: '#92400e' },
  polish: { background: '#e0f2fe', color: '#0c4a6e' },
  positive: { background: '#dcfce7', color: '#166534' },
};

function SeverityPill({ severity }: { severity: TrialFeedbackSeverityV1 }) {
  const { background, color } = SEVERITY_PALETTE[severity];
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        background,
        color,
      }}
    >
      {formatLabel(severity)}
    </span>
  );
}

// ─── Entry form ───────────────────────────────────────────────────────────────

interface EntryFormProps {
  readonly draft: TrialFeedbackEntryV1;
  readonly scenarios: readonly { id: string; label: string }[];
  readonly onChangeDraft: (next: TrialFeedbackEntryV1) => void;
  readonly onSave: () => void;
  readonly onCancel: () => void;
}

function EntryForm({ draft, scenarios, onChangeDraft, onSave, onCancel }: EntryFormProps) {
  function field<K extends keyof TrialFeedbackEntryV1>(
    key: K,
    value: TrialFeedbackEntryV1[K],
  ) {
    onChangeDraft({ ...draft, [key]: value });
  }

  return (
    <div
      style={{
        display: 'grid',
        gap: 8,
        padding: 12,
        background: '#f8fafc',
        border: '1px solid #cbd5e1',
        borderRadius: 8,
        fontSize: 12,
      }}
      data-testid="trial-feedback-entry-form"
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <label>
          <span style={{ display: 'block', marginBottom: 2 }}>Scenario</span>
          <select
            value={draft.scenarioId}
            onChange={(e) => field('scenarioId', e.target.value)}
            style={{ width: '100%', fontFamily: 'monospace', fontSize: 12, padding: '2px 6px' }}
            data-testid="trial-feedback-form-scenario"
          >
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
            <option value="">— other —</option>
          </select>
        </label>

        <label>
          <span style={{ display: 'block', marginBottom: 2 }}>Tester type</span>
          <select
            value={draft.testerType}
            onChange={(e) => field('testerType', e.target.value as TrialFeedbackTesterTypeV1)}
            style={{ width: '100%', fontFamily: 'monospace', fontSize: 12, padding: '2px 6px' }}
            data-testid="trial-feedback-form-tester-type"
          >
            {TESTER_TYPES.map((t) => (
              <option key={t} value={t}>{formatLabel(t)}</option>
            ))}
          </select>
        </label>

        <label>
          <span style={{ display: 'block', marginBottom: 2 }}>Area</span>
          <select
            value={draft.area}
            onChange={(e) => field('area', e.target.value as TrialFeedbackAreaV1)}
            style={{ width: '100%', fontFamily: 'monospace', fontSize: 12, padding: '2px 6px' }}
            data-testid="trial-feedback-form-area"
          >
            {AREAS.map((a) => (
              <option key={a} value={a}>{formatLabel(a)}</option>
            ))}
          </select>
        </label>

        <label>
          <span style={{ display: 'block', marginBottom: 2 }}>Severity</span>
          <select
            value={draft.severity}
            onChange={(e) => field('severity', e.target.value as TrialFeedbackSeverityV1)}
            style={{ width: '100%', fontFamily: 'monospace', fontSize: 12, padding: '2px 6px' }}
            data-testid="trial-feedback-form-severity"
          >
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>{formatLabel(s)}</option>
            ))}
          </select>
        </label>

        <label>
          <span style={{ display: 'block', marginBottom: 2 }}>Status</span>
          <select
            value={draft.status}
            onChange={(e) => field('status', e.target.value as TrialFeedbackStatusV1)}
            style={{ width: '100%', fontFamily: 'monospace', fontSize: 12, padding: '2px 6px' }}
            data-testid="trial-feedback-form-status"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{formatLabel(s)}</option>
            ))}
          </select>
        </label>
      </div>

      <label>
        <span style={{ display: 'block', marginBottom: 2 }}>Summary *</span>
        <input
          type="text"
          value={draft.summary}
          onChange={(e) => field('summary', e.target.value)}
          placeholder="One-line description"
          style={{ width: '100%', fontFamily: 'monospace', fontSize: 12, padding: '2px 6px', boxSizing: 'border-box' }}
          data-testid="trial-feedback-form-summary"
        />
      </label>

      <label>
        <span style={{ display: 'block', marginBottom: 2 }}>Details (optional)</span>
        <textarea
          value={draft.details ?? ''}
          onChange={(e) => field('details', e.target.value || undefined)}
          rows={2}
          style={{ width: '100%', fontFamily: 'monospace', fontSize: 12, padding: '2px 6px', boxSizing: 'border-box', resize: 'vertical' }}
          data-testid="trial-feedback-form-details"
        />
      </label>

      <label>
        <span style={{ display: 'block', marginBottom: 2 }}>Follow-up action (optional)</span>
        <input
          type="text"
          value={draft.followUpAction ?? ''}
          onChange={(e) => field('followUpAction', e.target.value || undefined)}
          style={{ width: '100%', fontFamily: 'monospace', fontSize: 12, padding: '2px 6px', boxSizing: 'border-box' }}
          data-testid="trial-feedback-form-follow-up"
        />
      </label>

      <label>
        <span style={{ display: 'block', marginBottom: 2 }}>Related plan item IDs (comma-separated)</span>
        <input
          type="text"
          value={draft.relatedTrialPlanItemIds.join(', ')}
          onChange={(e) =>
            field(
              'relatedTrialPlanItemIds',
              e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            )
          }
          style={{ width: '100%', fontFamily: 'monospace', fontSize: 12, padding: '2px 6px', boxSizing: 'border-box' }}
          data-testid="trial-feedback-form-plan-items"
        />
      </label>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onCancel}
          style={{ fontSize: 12, padding: '4px 12px' }}
          data-testid="trial-feedback-form-cancel"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={draft.summary.trim() === ''}
          style={{ fontSize: 12, padding: '4px 12px' }}
          data-testid="trial-feedback-form-save"
        >
          Save entry
        </button>
      </div>
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export interface TrialFeedbackPanelProps {
  readonly entries: readonly TrialFeedbackEntryV1[];
  readonly limitedTrialPlan: LimitedTrialPlanV1 | null;
  readonly scenarios: readonly { id: string; label: string }[];
  readonly activeScenarioId: string;
  readonly onEntriesChange: (next: readonly TrialFeedbackEntryV1[]) => void;
  readonly onExport: () => void;
  readonly onImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
  readonly onClear: () => void;
}

/**
 * TrialFeedbackPanel
 *
 * Dev-only panel for manually adding/editing trial feedback, viewing the
 * aggregated summary, and exporting/importing trial-feedback.json.
 */
export function TrialFeedbackPanel({
  entries,
  limitedTrialPlan,
  scenarios,
  activeScenarioId,
  onEntriesChange,
  onExport,
  onImport,
  onClear,
}: TrialFeedbackPanelProps) {
  const [formState, setFormState] = useState<
    | { readonly mode: 'add'; readonly draft: TrialFeedbackEntryV1 }
    | { readonly mode: 'edit'; readonly index: number; readonly draft: TrialFeedbackEntryV1 }
    | null
  >(null);

  const summary = useMemo(
    () =>
      limitedTrialPlan
        ? buildTrialFeedbackSummary(entries, limitedTrialPlan)
        : null,
    [entries, limitedTrialPlan],
  );

  function handleAddClick() {
    setFormState({ mode: 'add', draft: blankDraft(entries, activeScenarioId) });
  }

  function handleEditClick(index: number) {
    const entry = entries[index];
    if (!entry) return;
    setFormState({ mode: 'edit', index, draft: entry });
  }

  function handleSaveForm() {
    if (!formState) return;
    if (formState.draft.summary.trim() === '') return;
    if (formState.mode === 'add') {
      onEntriesChange([...entries, formState.draft]);
    } else {
      const next = entries.map((entry, i) =>
        i === formState.index ? formState.draft : entry,
      );
      onEntriesChange(next);
    }
    setFormState(null);
  }

  function handleDeleteEntry(index: number) {
    onEntriesChange(entries.filter((_, i) => i !== index));
  }

  return (
    <section
      style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, display: 'grid', gap: 10 }}
      data-testid="trial-feedback-panel"
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: 14 }}>Trial feedback capture</h2>
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
            Structured first-tester feedback — dev-only, local storage only.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            type="button"
            onClick={onExport}
            disabled={entries.length === 0}
            style={{ fontSize: 12, padding: '4px 12px' }}
            data-testid="trial-feedback-export-json"
          >
            Export JSON
          </button>
          <label style={{ fontSize: 12, padding: '4px 12px', cursor: 'pointer', border: '1px solid #cbd5e1', borderRadius: 4 }}>
            Import JSON
            <input
              type="file"
              accept="application/json,.json"
              onChange={onImport}
              style={{ display: 'none' }}
              data-testid="trial-feedback-import-json"
            />
          </label>
          <button
            type="button"
            onClick={onClear}
            disabled={entries.length === 0}
            style={{ fontSize: 12, padding: '4px 12px', color: '#dc2626' }}
            data-testid="trial-feedback-clear"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Summary */}
      {summary !== null && entries.length > 0 && (
        <div
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, fontSize: 12 }}
          data-testid="trial-feedback-summary"
        >
          <div
            style={{
              padding: 8,
              borderRadius: 6,
              background: summary.stopCriteriaTriggered ? '#fee2e2' : '#f0fdf4',
              border: `1px solid ${summary.stopCriteriaTriggered ? '#fca5a5' : '#bbf7d0'}`,
            }}
            data-testid="trial-feedback-summary-stop-criteria"
          >
            <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 2 }}>Stop criteria</div>
            <div style={{ color: summary.stopCriteriaTriggered ? '#991b1b' : '#166534', fontWeight: 700 }}>
              {summary.stopCriteriaTriggered ? '⚠ TRIGGERED' : 'clear'}
            </div>
          </div>
          <div
            style={{ padding: 8, borderRadius: 6, background: '#fafafa', border: '1px solid #e2e8f0' }}
            data-testid="trial-feedback-summary-blockers"
          >
            <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 2 }}>Open blockers</div>
            <div>{summary.blockerCount}</div>
          </div>
          <div
            style={{ padding: 8, borderRadius: 6, background: '#fafafa', border: '1px solid #e2e8f0' }}
            data-testid="trial-feedback-summary-confusion"
          >
            <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 2 }}>Confusion themes</div>
            <div>{summary.confusionThemes.length}</div>
          </div>
          <div
            style={{ padding: 8, borderRadius: 6, background: '#fafafa', border: '1px solid #e2e8f0' }}
            data-testid="trial-feedback-summary-positive"
          >
            <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 2 }}>Positive signals</div>
            <div>{summary.positiveSignals.length}</div>
          </div>
        </div>
      )}

      {/* Add button / form */}
      {formState === null ? (
        <button
          type="button"
          onClick={handleAddClick}
          style={{ fontSize: 12, padding: '4px 12px', alignSelf: 'start' }}
          data-testid="trial-feedback-add-entry"
        >
          + Add feedback entry
        </button>
      ) : (
        <EntryForm
          draft={formState.draft}
          scenarios={scenarios}
          onChangeDraft={(next) => setFormState({ ...formState, draft: next })}
          onSave={handleSaveForm}
          onCancel={() => setFormState(null)}
        />
      )}

      {/* Entry table */}
      {entries.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>No feedback entries yet.</p>
      ) : (
        <table
          style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}
          data-testid="trial-feedback-entry-table"
        >
          <thead>
            <tr style={{ textAlign: 'left', fontSize: 11, color: '#64748b' }}>
              <th style={{ padding: '4px 8px' }}>ID</th>
              <th style={{ padding: '4px 8px' }}>Severity</th>
              <th style={{ padding: '4px 8px' }}>Area</th>
              <th style={{ padding: '4px 8px' }}>Status</th>
              <th style={{ padding: '4px 8px' }}>Summary</th>
              <th style={{ padding: '4px 8px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, index) => (
              <tr
                key={entry.feedbackId}
                data-testid={`trial-feedback-row-${entry.feedbackId}`}
              >
                <td style={{ padding: '4px 8px', fontFamily: 'monospace', color: '#475569' }}>{entry.feedbackId}</td>
                <td style={{ padding: '4px 8px' }}><SeverityPill severity={entry.severity} /></td>
                <td style={{ padding: '4px 8px' }}>{formatLabel(entry.area)}</td>
                <td style={{ padding: '4px 8px', color: '#475569' }}>{formatLabel(entry.status)}</td>
                <td style={{ padding: '4px 8px' }}>{entry.summary}</td>
                <td style={{ padding: '4px 8px' }}>
                  <button
                    type="button"
                    onClick={() => handleEditClick(index)}
                    style={{ fontSize: 11, padding: '2px 8px', marginRight: 4 }}
                    data-testid={`trial-feedback-edit-${entry.feedbackId}`}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteEntry(index)}
                    style={{ fontSize: 11, padding: '2px 8px', color: '#dc2626' }}
                    data-testid={`trial-feedback-delete-${entry.feedbackId}`}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
