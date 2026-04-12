/**
 * EngineerEvidencePanel.tsx
 *
 * PR11 — Evidence inspector panel for the engineer route.
 *
 * Shows grouped evidence counts (photos, voice notes, text notes, QA flags,
 * timeline events) so the engineer can see what was captured and how much
 * evidence backs the recommendation.
 *
 * This is a summary panel — a full media browser is out of scope for PR11.
 */

import type { EngineerDisplayModel } from './types/engineerDisplay.types';

interface Props {
  model: EngineerDisplayModel;
}

interface EvidenceRow {
  icon: string;
  label: string;
  count: number;
  description: string;
}

export function EngineerEvidencePanel({ model }: Props) {
  const { evidence } = model;

  const rows: EvidenceRow[] = [
    { icon: '📷', label: 'Photos',         count: evidence.photos,         description: 'Site photos captured during the survey' },
    { icon: '🎙️', label: 'Voice notes',    count: evidence.voiceNotes,     description: 'Spoken observations and customer preferences' },
    { icon: '📝', label: 'Text notes',     count: evidence.textNotes,      description: 'Written notes entered by the engineer' },
    { icon: '🚩', label: 'QA flags',       count: evidence.qaFlags,        description: 'Quality-assurance flags raised during capture' },
    { icon: '📅', label: 'Timeline events',count: evidence.timelineEvents, description: 'Session timeline events for audit trail' },
  ];

  const totalEvidence = evidence.photos + evidence.voiceNotes + evidence.textNotes;

  return (
    <div
      data-testid="engineer-evidence"
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '1rem 1.25rem',
        marginBottom: '1rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
        <h2 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#2d3748', flex: 1 }}>
          🗂️ Evidence
        </h2>
        {totalEvidence > 0 && (
          <span style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            color: '#2b6cb0',
            background: '#ebf8ff',
            padding: '0.1rem 0.45rem',
            borderRadius: '4px',
            border: '1px solid #bee3f8',
          }}>
            {totalEvidence} items captured
          </span>
        )}
      </div>

      {totalEvidence === 0 ? (
        <p style={{ margin: 0, fontSize: '0.82rem', color: '#718096', fontStyle: 'italic' }}>
          No evidence captured yet. Photos and notes will appear here after the survey.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {rows.filter(r => r.count > 0).map(row => (
            <li
              key={row.label}
              data-testid={`engineer-evidence-${row.label.toLowerCase().replace(/\s+/g, '-')}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                fontSize: '0.82rem',
                color: '#2d3748',
                padding: '0.35rem 0',
                borderBottom: '1px solid #f7fafc',
              }}
            >
              <span aria-hidden="true" style={{ fontSize: '0.9rem', width: '1.25rem', textAlign: 'center' }}>
                {row.icon}
              </span>
              <span style={{ flex: 1 }}>
                <strong>{row.label}</strong>
                <span style={{ color: '#718096', marginLeft: '0.35rem', fontSize: '0.75rem' }}>
                  — {row.description}
                </span>
              </span>
              <span style={{
                fontWeight: 700,
                fontSize: '0.9rem',
                color: '#2b6cb0',
                minWidth: '1.5rem',
                textAlign: 'right',
              }}>
                {row.count}
              </span>
            </li>
          ))}
        </ul>
      )}

      {evidence.qaFlags > 0 && (
        <p style={{
          margin: '0.75rem 0 0',
          fontSize: '0.75rem',
          color: '#744210',
          background: '#fffff0',
          border: '1px solid #fefcbf',
          borderRadius: '4px',
          padding: '0.35rem 0.6rem',
        }}>
          ⚠️ {evidence.qaFlags} QA {evidence.qaFlags === 1 ? 'flag requires' : 'flags require'} review before attending.
        </p>
      )}
    </div>
  );
}
