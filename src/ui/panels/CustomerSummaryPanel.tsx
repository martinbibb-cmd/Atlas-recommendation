/**
 * CustomerSummaryPanel.tsx
 *
 * Renders a customer-facing explanation generated from the selected pathway
 * and the engine's constraint facts.
 *
 * PRINCIPLES:
 * - Never say a hard "No" — use "not advisable under current constraints",
 *   "possible, but requires prerequisite", "possible, but with performance penalty".
 * - Only hard-fail safety/legal items.
 * - Text is engine-generated from pathway + constraints — not invented by the UI.
 */
import type { PathwayOptionV1, PlanV1 } from '../../contracts/EngineOutputV1';
import { CONFIDENCE_BADGE_STYLES } from './panelConstants';

interface Props {
  /** The full pathway plan from the engine. */
  plan: PlanV1;
  /** ID of the pathway the expert has selected. */
  selectedPathwayId: string;
  /** Optional property address or reference for the summary header. */
  propertyRef?: string;
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const PANEL: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: 8,
  padding: '20px 24px',
  fontFamily: 'system-ui, sans-serif',
  fontSize: 14,
  color: '#1a202c',
  lineHeight: 1.6,
};

const SECTION_TITLE: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: '#4a5568',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 8,
  marginTop: 20,
};

const SUMMARY_BOX: React.CSSProperties = {
  background: '#ebf8ff',
  border: '1px solid #bee3f8',
  borderRadius: 6,
  padding: '14px 18px',
  marginBottom: 16,
};

const PREREQ_BOX: React.CSSProperties = {
  background: '#fffff0',
  border: '1px solid #f6e05e',
  borderRadius: 6,
  padding: '12px 16px',
  marginTop: 12,
};

const UNKNOWN_BOX: React.CSSProperties = {
  background: '#fffbeb',
  border: '1px solid #f59e0b',
  borderRadius: 6,
  padding: '10px 14px',
  marginTop: 10,
};

// ── Summary generator ─────────────────────────────────────────────────────────

function generateSummaryText(pathway: PathwayOptionV1, sharedConstraints: string[]): string[] {
  const lines: string[] = [];

  lines.push(`We recommend: **${pathway.title}**.`);
  lines.push('');
  lines.push(pathway.rationale);
  lines.push('');
  lines.push(`**What this means for you today:** ${pathway.outcomeToday}`);

  if (pathway.outcomeAfterTrigger) {
    lines.push('');
    lines.push(`**What changes later:** ${pathway.outcomeAfterTrigger}`);
  }

  if (sharedConstraints.length > 0) {
    lines.push('');
    lines.push('**Why we cannot take a different approach right now:**');
    for (const c of sharedConstraints) {
      lines.push(`• ${c}`);
    }
  }

  if (pathway.prerequisites.length > 0) {
    lines.push('');
    lines.push('**Steps before the upgrade pathway opens:**');
    for (const p of pathway.prerequisites) {
      const trigger = p.triggerEvent ? ` (trigger: ${p.triggerEvent})` : '';
      lines.push(`• ${p.description}${trigger}`);
    }
  }

  if (
    pathway.confidence.unknowns &&
    pathway.confidence.unknowns.length > 0
  ) {
    lines.push('');
    lines.push('**Things we do not yet know (which could change the picture):**');
    for (const u of pathway.confidence.unknowns) {
      lines.push(`• ${u}`);
    }
    if (pathway.confidence.unlockBy && pathway.confidence.unlockBy.length > 0) {
      lines.push('');
      lines.push(
        `To improve confidence: ${pathway.confidence.unlockBy.join('; ')}.`,
      );
    }
  }

  return lines;
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * CustomerSummaryPanel renders the customer-facing explanation of the expert's
 * chosen pathway.  It is driven entirely by data from the engine — no business
 * logic is invented here.
 */
export function CustomerSummaryPanel({ plan, selectedPathwayId, propertyRef }: Props) {
  const pathway = plan.pathways.find(p => p.id === selectedPathwayId);

  if (!pathway) {
    return (
      <div style={PANEL}>
        <p style={{ color: '#718096', fontSize: 13 }}>
          No pathway selected. Use the Expert Panel to choose a pathway.
        </p>
      </div>
    );
  }

  const summaryLines = generateSummaryText(pathway, plan.sharedConstraints);
  const badge = CONFIDENCE_BADGE_STYLES[pathway.confidence.level];

  return (
    <div style={PANEL}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 2 }}>
            Recommended Pathway
          </div>
          {propertyRef && (
            <div style={{ fontSize: 12, color: '#718096' }}>
              {propertyRef}
            </div>
          )}
        </div>
        <span
          style={{
            background: badge.bg,
            color: badge.text,
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 4,
            padding: '4px 10px',
          }}
        >
          {badge.label}
        </span>
      </div>

      {/* Summary box */}
      <div style={{ ...SUMMARY_BOX, marginTop: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>
          {pathway.title}
        </div>
        <div style={{ fontSize: 14, color: '#2d3748' }}>{pathway.rationale}</div>
      </div>

      {/* Outcome today */}
      <div style={SECTION_TITLE}>What this means for you today</div>
      <p style={{ margin: '0 0 8px' }}>{pathway.outcomeToday}</p>

      {/* Outcome after trigger */}
      {pathway.outcomeAfterTrigger && (
        <>
          <div style={SECTION_TITLE}>What changes later</div>
          <p style={{ margin: '0 0 8px' }}>{pathway.outcomeAfterTrigger}</p>
        </>
      )}

      {/* Shared constraints (why not a different approach) */}
      {plan.sharedConstraints.length > 0 && (
        <>
          <div style={SECTION_TITLE}>Why we cannot take a different approach right now</div>
          <ul style={{ margin: '0 0 8px', paddingLeft: 20 }}>
            {plan.sharedConstraints.map((c, i) => (
              <li key={i} style={{ fontSize: 13, marginBottom: 4 }}>{c}</li>
            ))}
          </ul>
          <div style={{ fontSize: 12, color: '#718096' }}>
            These are physics constraints — they are not a judgment about what you want, just an
            honest picture of what is possible under current conditions.
          </div>
        </>
      )}

      {/* Prerequisites */}
      {pathway.prerequisites.length > 0 && (
        <>
          <div style={SECTION_TITLE}>Steps before the next upgrade</div>
          <div style={PREREQ_BOX}>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {pathway.prerequisites.map((p, i) => (
                <li key={i} style={{ fontSize: 13, color: '#744210', marginBottom: 6 }}>
                  <strong>{p.description}</strong>
                  {p.triggerEvent && (
                    <div style={{ fontSize: 12, color: '#975a16', marginTop: 2 }}>
                      When: {p.triggerEvent}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {/* Unknowns */}
      {pathway.confidence.unknowns && pathway.confidence.unknowns.length > 0 && (
        <>
          <div style={SECTION_TITLE}>Things we do not yet know</div>
          <div style={UNKNOWN_BOX}>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {pathway.confidence.unknowns.map((u, i) => (
                <li key={i} style={{ fontSize: 13, color: '#92400e', marginBottom: 4 }}>{u}</li>
              ))}
            </ul>
            {pathway.confidence.unlockBy && pathway.confidence.unlockBy.length > 0 && (
              <div style={{ fontSize: 13, color: '#276749', marginTop: 8 }}>
                <strong>To improve confidence:</strong>{' '}
                {pathway.confidence.unlockBy.join('; ')}.
              </div>
            )}
          </div>
        </>
      )}

      {/* Confidence reasons */}
      {pathway.confidence.reasons.length > 0 && (
        <div style={{ marginTop: 16, fontSize: 12, color: '#718096' }}>
          <strong>Confidence based on:</strong>{' '}
          {pathway.confidence.reasons.join('; ')}.
        </div>
      )}

      {/* Plain-text summary for copy/export */}
      <details style={{ marginTop: 20 }}>
        <summary style={{ fontSize: 12, color: '#4a5568', cursor: 'pointer' }}>
          Plain text summary (for notes / export)
        </summary>
        <pre
          style={{
            background: '#f7fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 4,
            padding: '10px 12px',
            fontSize: 12,
            color: '#2d3748',
            whiteSpace: 'pre-wrap',
            marginTop: 8,
          }}
        >
          {summaryLines.join('\n')}
        </pre>
      </details>
    </div>
  );
}
