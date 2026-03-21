/**
 * SuitabilitySummaryPanel
 *
 * Hub Section 4 — Suitability Summary Table.
 *
 * Short bullet table showing all engine options and their suitability verdict.
 * Instant visual comparison — customers see immediately why the recommendation
 * was made over the alternatives.
 */

import type { OutputHubSection } from '../../live/printSections.model';
import { OPTION_STATUS_LABEL, OPTION_STATUS_ICON } from '../../lib/copy/customerCopy';

const STATUS_LABEL: Record<string, string> = OPTION_STATUS_LABEL;

const STATUS_CLASS: Record<string, string> = {
  viable:   'hub-suitability__status--viable',
  caution:  'hub-suitability__status--caution',
  rejected: 'hub-suitability__status--rejected',
};

const STATUS_ICON: Record<string, string> = OPTION_STATUS_ICON;

interface SuitabilityRow {
  id:     string;
  label:  string;
  status: string;
  why:    string[];
}

interface Props {
  section: OutputHubSection;
}

export default function SuitabilitySummaryPanel({ section }: Props) {
  const c = section.content as { rows: SuitabilityRow[] };

  return (
    <div className="hub-graphic hub-graphic--suitability" aria-label="Suitability summary">
      <h3 className="hub-graphic__title">📊 Suitability Summary</h3>

      <table className="hub-suitability__table" aria-label="System suitability comparison">
        <thead>
          <tr>
            <th className="hub-suitability__th">System</th>
            <th className="hub-suitability__th">Suitability</th>
            <th className="hub-suitability__th hub-suitability__th--why">Why</th>
          </tr>
        </thead>
        <tbody>
          {c.rows.map(row => (
            <tr key={row.id} className="hub-suitability__row">
              <td className="hub-suitability__td hub-suitability__td--label">
                {row.label}
              </td>
              <td className="hub-suitability__td hub-suitability__td--status">
                <span
                  className={`hub-suitability__status ${STATUS_CLASS[row.status] ?? ''}`}
                  aria-label={`${row.label} suitability: ${STATUS_LABEL[row.status] ?? row.status}`}
                >
                  <span aria-hidden="true">{STATUS_ICON[row.status] ?? '○'}</span>{' '}
                  {STATUS_LABEL[row.status] ?? row.status}
                </span>
              </td>
              <td className="hub-suitability__td hub-suitability__td--why">
                {row.why.length > 0 ? row.why.join('. ') : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
