import { useMemo } from 'react';
import type { EngineerJobPackV1 } from '../../specification/handover';
import type { FollowUpEvidenceCapturePlanV1 } from '../../specification/followUps';

interface Props {
  plan: FollowUpEvidenceCapturePlanV1;
  engineerJobPack: EngineerJobPackV1;
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

export default function FollowUpEvidencePlanPanel({ plan, engineerJobPack }: Props) {
  const taskById = useMemo(
    () => new Map(plan.tasks.map((task) => [task.taskId, task])),
    [plan.tasks],
  );

  const locationById = useMemo(() => {
    const map = new Map<string, { label: string; confidence: string }>();
    const sectionKeys: Array<keyof EngineerJobPackV1> = [
      'jobSummary',
      'fitThis',
      'removeThis',
      'checkThis',
      'discussWithCustomer',
      'locationsAndRoutes',
      'commissioning',
      'unresolvedBeforeInstall',
      'doNotMiss',
      'locationsToConfirm',
    ];

    for (const key of sectionKeys) {
      const section = engineerJobPack[key];
      if (!Array.isArray(section)) continue;
      for (const item of section) {
        if (!item.location) continue;
        map.set(item.location.locationId, {
          label: item.location.label,
          confidence: item.location.confidence,
        });
      }
    }
    return map;
  }, [engineerJobPack]);

  const allEvidence = [...plan.requiredEvidence, ...plan.optionalEvidence];

  return (
    <section
      style={{ border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '0.75rem', background: '#fff' }}
      data-testid="follow-up-evidence-plan-panel"
    >
      <h3 style={{ margin: '0 0 0.55rem', fontSize: '0.95rem' }}>Follow-up Evidence Capture Plan</h3>
      <p style={{ margin: '0 0 0.6rem', fontSize: 12, color: '#475569' }} data-testid="follow-up-evidence-plan-id">
        <strong>Plan ID:</strong> {plan.planId}
      </p>

      {allEvidence.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12, color: '#64748b' }} data-testid="follow-up-evidence-plan-empty">
          No evidence items required.
        </p>
      ) : (
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          {allEvidence.map((item) => {
            const firstTask = taskById.get(item.taskIds[0] ?? '');
            const locationEvidence = firstTask?.relatedLocationIds
              .map((locationId) => locationById.get(locationId))
              .find(Boolean);
            const locationLabel = item.targetLocation ?? locationEvidence?.label;
            const locationConfidence = locationEvidence?.confidence;

            return (
              <article
                key={item.evidenceId}
                style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.6rem', background: '#f8fafc' }}
                data-testid={`follow-up-evidence-card-${item.evidenceId}`}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.35rem' }}>
                  <strong style={{ fontSize: 13 }}>{item.prompt}</strong>
                  <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                    {badge(item.required ? 'required' : 'optional', item.required ? '#fee2e2' : '#e2e8f0')}
                    {badge(item.evidenceType, '#dbeafe', '#1e3a8a')}
                  </div>
                </div>

                {item.taskIds.length > 0 ? (
                  <p style={{ margin: '0 0 0.25rem', fontSize: 11, color: '#475569' }}>
                    <strong>Task → evidence required:</strong>{' '}
                    {item.taskIds.map((taskId, index) => (
                      <span key={taskId}>
                        {index > 0 ? ', ' : ''}
                        {taskId}
                        {taskById.get(taskId) ? ` (${taskById.get(taskId)!.title})` : ''}
                      </span>
                    ))}
                  </p>
                ) : null}

                {item.acceptanceCriteria.length > 0 ? (
                  <div style={{ marginBottom: '0.25rem' }}>
                    <p style={{ margin: '0 0 0.1rem', fontSize: 11, color: '#334155' }}>
                      <strong>Acceptance criteria:</strong>
                    </p>
                    <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: 11, color: '#475569' }}>
                      {item.acceptanceCriteria.map((criterion) => (
                        <li key={criterion}>{criterion}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {locationLabel ? (
                  <p style={{ margin: '0 0 0.25rem', fontSize: 11, color: '#475569' }}>
                    <strong>Location/confidence:</strong> {locationLabel}
                    {locationConfidence ? ` (${locationConfidence})` : ''}
                  </p>
                ) : null}

                <p style={{ margin: 0, fontSize: 11, color: '#475569' }}>
                  <strong>Atlas Scan prompt:</strong> {item.prompt}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
