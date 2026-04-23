/**
 * JobSummarySection.tsx
 *
 * PR7 — Top card for the engineer handoff surface.
 *
 * Shows the recommended scenario ID, system label, and one-line operational
 * summary. Styled like a job card — dark background, fast to read.
 */

import type { EngineerHandoff } from '../../../contracts/EngineerHandoff';

interface Props {
  jobSummary: EngineerHandoff['jobSummary'];
}

export function JobSummarySection({ jobSummary }: Props) {
  return (
    <div
      data-testid="engineer-handoff-job-summary"
      style={{
        background: '#1a202c',
        color: '#fff',
        borderRadius: '8px',
        padding: '1.25rem 1.5rem',
        marginBottom: '1.25rem',
      }}
    >
      <p style={{
        margin: '0 0 0.2rem',
        fontSize: '0.65rem',
        fontWeight: 700,
        color: '#718096',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
      }}>
        Recommended system
      </p>
      <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.15rem', fontWeight: 700, color: '#fff' }}>
        {jobSummary.recommendedSystemLabel}
      </h1>
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', color: '#a0aec0' }}>
        {jobSummary.summary}
      </p>
      <span style={{
        fontSize: '0.72rem',
        fontWeight: 600,
        color: '#90cdf4',
        background: 'rgba(144,205,244,0.1)',
        padding: '0.15rem 0.5rem',
        borderRadius: '4px',
        border: '1px solid rgba(144,205,244,0.3)',
      }}>
        Scenario: {jobSummary.recommendedScenarioId}
      </span>
    </div>
  );
}
