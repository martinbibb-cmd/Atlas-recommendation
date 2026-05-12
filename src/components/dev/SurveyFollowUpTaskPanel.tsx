import { useMemo, useState } from 'react';
import type { EngineerJobPackV1 } from '../../specification/handover';
import type { SuggestedMaterialLineV1 } from '../../specification/materials';
import type { SpecificationLineV1 } from '../../specification/specLines';
import type { SurveyFollowUpTaskAssignedRole, SurveyFollowUpTaskV1 } from '../../specification/followUps';

interface Props {
  tasks: readonly SurveyFollowUpTaskV1[];
  lines: readonly SpecificationLineV1[];
  materials: readonly SuggestedMaterialLineV1[];
  engineerJobPack: EngineerJobPackV1;
}

const PRIORITY_ORDER: Readonly<Record<SurveyFollowUpTaskV1['priority'], number>> = {
  blocker: 0,
  important: 1,
  optional: 2,
};

const PRIORITY_COLORS: Readonly<Record<SurveyFollowUpTaskV1['priority'], string>> = {
  blocker: '#b91c1c',
  important: '#92400e',
  optional: '#334155',
};

const SOURCE_LABELS: Readonly<Record<SurveyFollowUpTaskV1['source'], string>> = {
  readiness_blocker: 'Readiness blocker',
  unresolved_check: 'Unresolved check',
  material_needs_survey: 'Material needs survey',
  unknown_location: 'Unknown location',
  missing_qualification: 'Missing qualification',
};

const EVIDENCE_LABELS: Readonly<Record<SurveyFollowUpTaskV1['suggestedEvidenceType'], string>> = {
  photo: 'Photo',
  measurement: 'Measurement',
  note: 'Note',
  qualification_check: 'Qualification check',
  customer_confirmation: 'Customer confirmation',
  scan_pin: 'Scan pin',
};

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

export default function SurveyFollowUpTaskPanel({ tasks, lines, materials, engineerJobPack }: Props) {
  const [roleFilter, setRoleFilter] = useState<'all' | SurveyFollowUpTaskAssignedRole>('all');

  const lineById = useMemo(() => new Map(lines.map((line) => [line.lineId, line])), [lines]);
  const materialById = useMemo(
    () => new Map(materials.map((material) => [material.materialId, material])),
    [materials],
  );

  const locationById = useMemo(() => {
    const map = new Map<string, string>();
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
        map.set(item.location.locationId, item.location.label);
      }
    }
    return map;
  }, [engineerJobPack]);

  const visibleTasks = useMemo(() => {
    const filtered = roleFilter === 'all'
      ? tasks
      : tasks.filter((task) => task.assignedRole === roleFilter);
    return [...filtered].sort((a, b) => {
      const priorityDelta = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (priorityDelta !== 0) return priorityDelta;
      return a.title.localeCompare(b.title);
    });
  }, [roleFilter, tasks]);

  return (
    <section
      style={{ border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '0.75rem', background: '#fff' }}
      data-testid="survey-follow-up-task-panel"
    >
      <h3 style={{ margin: '0 0 0.55rem', fontSize: '0.95rem' }}>Survey Follow-up Tasks</h3>

      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.65rem' }}>
        {(['all', 'surveyor', 'office', 'engineer'] as const).map((role) => (
          <button
            key={role}
            type="button"
            onClick={() => setRoleFilter(role)}
            style={{
              border: '1px solid #cbd5e1',
              borderRadius: 999,
              padding: '0.2rem 0.55rem',
              fontSize: 12,
              background: roleFilter === role ? '#0f172a' : '#f8fafc',
              color: roleFilter === role ? '#fff' : '#0f172a',
              cursor: 'pointer',
            }}
            aria-pressed={roleFilter === role}
            data-testid={`survey-follow-up-role-filter-${role}`}
          >
            {role === 'all' ? 'All roles' : role}
          </button>
        ))}
      </div>

      {visibleTasks.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12, color: '#64748b' }} data-testid="survey-follow-up-task-panel-empty">
          No follow-up tasks.
        </p>
      ) : (
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          {visibleTasks.map((task) => (
            <article
              key={task.taskId}
              style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.6rem', background: '#f8fafc' }}
              data-testid={`survey-follow-up-task-card-${task.taskId}`}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <strong style={{ fontSize: 13 }}>{task.title}</strong>
                <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                  {badge(task.priority, PRIORITY_COLORS[task.priority])}
                  {badge(task.assignedRole, '#0f172a')}
                </div>
              </div>

              <p style={{ margin: '0 0 0.4rem', fontSize: 12, color: '#334155' }}>{task.description}</p>

              <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                {badge(SOURCE_LABELS[task.source], '#e2e8f0', '#0f172a')}
                {badge(EVIDENCE_LABELS[task.suggestedEvidenceType], '#dbeafe', '#1e3a8a')}
              </div>

              {task.relatedLineIds.length > 0 ? (
                <p style={{ margin: '0 0 0.25rem', fontSize: 11, color: '#475569' }}>
                  <strong>Lines:</strong>{' '}
                  {task.relatedLineIds.map((lineId, index) => (
                    <span key={lineId}>
                      {index > 0 ? ', ' : ''}
                      {lineId}
                      {lineById.get(lineId) ? ` (${lineById.get(lineId)!.label})` : ''}
                    </span>
                  ))}
                </p>
              ) : null}

              {task.relatedMaterialIds.length > 0 ? (
                <p style={{ margin: '0 0 0.25rem', fontSize: 11, color: '#475569' }}>
                  <strong>Materials:</strong>{' '}
                  {task.relatedMaterialIds.map((materialId, index) => (
                    <span key={materialId}>
                      {index > 0 ? ', ' : ''}
                      {materialId}
                      {materialById.get(materialId) ? ` (${materialById.get(materialId)!.label})` : ''}
                    </span>
                  ))}
                </p>
              ) : null}

              {task.relatedLocationIds.length > 0 ? (
                <p style={{ margin: 0, fontSize: 11, color: '#475569' }}>
                  <strong>Locations:</strong>{' '}
                  {task.relatedLocationIds.map((locationId, index) => (
                    <span key={locationId}>
                      {index > 0 ? ', ' : ''}
                      {locationId}
                      {locationById.get(locationId) ? ` (${locationById.get(locationId)})` : ''}
                    </span>
                  ))}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
