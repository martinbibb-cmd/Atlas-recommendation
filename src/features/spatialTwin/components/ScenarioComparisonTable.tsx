/**
 * ScenarioComparisonTable.tsx — PR6
 *
 * Renders a side-by-side comparison table from a ScenarioComparisonMatrix.
 * Scenarios are displayed as columns; comparison dimensions are rows.
 *
 * The recommended scenario column is highlighted with a blue header.
 * The customer-selected column is highlighted with a dark header.
 */

import type { ScenarioComparisonMatrix } from '../synthesis/ScenarioSynthesisModel';

export interface ScenarioComparisonTableProps {
  matrix: ScenarioComparisonMatrix;
  recommendedScenarioId?: string | null;
  selectedScenarioId?: string | null;
  /** Map from scenarioId → display name. Used to label each column. */
  scenarioNames?: Record<string, string>;
}

function formatCellValue(value: string | number | boolean | null): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

function getColumnHeaderStyle(
  scenarioId: string,
  recommendedId: string | null | undefined,
  selectedId: string | null | undefined,
): React.CSSProperties {
  if (scenarioId === recommendedId) {
    return { background: '#2563eb', color: '#fff', fontWeight: 700 };
  }
  if (scenarioId === selectedId) {
    return { background: '#0f172a', color: '#fff', fontWeight: 700 };
  }
  return { background: '#f8fafc', color: '#0f172a', fontWeight: 600 };
}

export function ScenarioComparisonTable({
  matrix,
  recommendedScenarioId,
  selectedScenarioId,
  scenarioNames = {},
}: ScenarioComparisonTableProps) {
  if (matrix.scenarioIds.length === 0) {
    return (
      <div style={{ padding: 16, color: '#94a3b8', fontSize: 13 }}>
        No scenarios to compare.
      </div>
    );
  }

  const cellBase: React.CSSProperties = {
    padding: '8px 12px',
    fontSize: 13,
    borderBottom: '1px solid #f1f5f9',
    verticalAlign: 'top',
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{
          borderCollapse: 'collapse',
          width: '100%',
          fontSize: 13,
          tableLayout: 'fixed',
        }}
        aria-label="Scenario comparison table"
      >
        <thead>
          <tr>
            <th
              style={{
                ...cellBase,
                textAlign: 'left',
                background: '#f8fafc',
                color: '#64748b',
                width: 160,
                borderBottom: '2px solid #e2e8f0',
              }}
            >
              Dimension
            </th>
            {matrix.scenarioIds.map(id => (
              <th
                key={id}
                style={{
                  ...cellBase,
                  textAlign: 'left',
                  borderBottom: '2px solid #e2e8f0',
                  ...getColumnHeaderStyle(id, recommendedScenarioId, selectedScenarioId),
                }}
              >
                {scenarioNames[id] ?? id}
                {id === recommendedScenarioId && (
                  <span
                    style={{
                      display: 'block',
                      fontSize: 10,
                      fontWeight: 400,
                      marginTop: 2,
                      opacity: 0.85,
                    }}
                  >
                    Atlas recommends
                  </span>
                )}
                {id === selectedScenarioId && id !== recommendedScenarioId && (
                  <span
                    style={{
                      display: 'block',
                      fontSize: 10,
                      fontWeight: 400,
                      marginTop: 2,
                      opacity: 0.85,
                    }}
                  >
                    Customer selected
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((row, rowIndex) => (
            <tr key={row.label} style={{ background: rowIndex % 2 === 0 ? '#fff' : '#f8fafc' }}>
              <td
                style={{
                  ...cellBase,
                  fontWeight: 600,
                  color: '#374151',
                  whiteSpace: 'nowrap',
                }}
              >
                {row.label}
              </td>
              {matrix.scenarioIds.map(id => (
                <td
                  key={id}
                  style={{
                    ...cellBase,
                    color: '#0f172a',
                    borderLeft: id === recommendedScenarioId ? '2px solid #2563eb' : id === selectedScenarioId ? '2px solid #0f172a' : '1px solid #f1f5f9',
                  }}
                >
                  {formatCellValue(row.values[id] ?? null)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
