/**
 * CustomerSummaryPanel.tsx
 *
 * Generates a customer-facing explanation from the expert-selected pathway.
 *
 * RULES
 * - Language avoids hard "No" — uses "not advisable under current constraints"
 *   or "possible, but requires a prerequisite step".
 * - Content is derived 100% from the selected PathwayOptionV1.
 * - Includes a plain-text export for depot notes.
 */

import { useState } from 'react';
import type { PathwayOptionV1 } from '../../contracts/EngineOutputV1';
import { toPlainText } from './panelConstants';

interface Props {
  pathway: PathwayOptionV1 | undefined;
}

export default function CustomerSummaryPanel({ pathway }: Props) {
  const [copied, setCopied] = useState(false);

  if (!pathway) {
    return (
      <div style={{ padding: '0.75rem', background: '#f7fafc', borderRadius: '7px', border: '1px solid #e2e8f0', fontSize: '0.85rem', color: '#718096' }}>
        <em>Select a pathway above to generate the customer summary.</em>
      </div>
    );
  }

  const plainText = buildPlainText(pathway);

  const handleCopy = () => {
    navigator.clipboard.writeText(plainText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{ border: '1px solid #c3dafe', borderRadius: '8px', background: '#ebf8ff', overflow: 'hidden', fontSize: '0.85rem' }}>
      {/* Header */}
      <div style={{ padding: '0.65rem 0.9rem', borderBottom: '1px solid #c3dafe', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 700, color: '#2b6cb0', fontSize: '0.9rem' }}>
          📋 Customer Summary — {pathway.title}
        </span>
        <button
          onClick={handleCopy}
          style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', borderRadius: '4px', border: '1px solid #90cdf4', background: copied ? '#c6f6d5' : '#fff', color: copied ? '#276749' : '#2b6cb0', cursor: 'pointer' }}
        >
          {copied ? '✓ Copied' : 'Copy for depot notes'}
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: '0.9rem', color: '#2d3748', lineHeight: 1.6 }}>
        <Section title="What we're recommending">
          <p style={{ margin: 0 }}>{pathway.rationale}</p>
        </Section>

        <Section title="What you get today">
          <p style={{ margin: 0 }}>{pathway.outcomeToday}</p>
        </Section>

        {pathway.outcomeAfterTrigger && (
          <Section title="Future upgrade path">
            <p style={{ margin: 0 }}>{pathway.outcomeAfterTrigger}</p>
          </Section>
        )}

        {pathway.prerequisites.length > 0 && (
          <Section title="Steps required before upgrade">
            <ul style={{ margin: '0.25rem 0 0 1.1rem', padding: 0 }}>
              {pathway.prerequisites.map((p, i) => (
                <li key={i} style={{ marginBottom: '0.3rem' }}>
                  {p.description}
                  {p.triggerEvent && (
                    <span style={{ color: '#4a5568' }}> (when: {p.triggerEvent})</span>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {pathway.confidence.unknowns && pathway.confidence.unknowns.length > 0 && (
          <Section title="What we still need to confirm">
            <ul style={{ margin: '0.25rem 0 0 1.1rem', padding: 0, color: '#744210' }}>
              {pathway.confidence.unknowns.map((u, i) => <li key={i}>{u}</li>)}
            </ul>
            {pathway.confidence.unlockBy && pathway.confidence.unlockBy.length > 0 && (
              <>
                <p style={{ margin: '0.4rem 0 0.1rem', fontWeight: 600, color: '#276749' }}>How to resolve:</p>
                <ul style={{ margin: 0, paddingLeft: '1.1rem', color: '#276749' }}>
                  {pathway.confidence.unlockBy.map((u, i) => <li key={i}>{u}</li>)}
                </ul>
              </>
            )}
          </Section>
        )}
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '0.8rem' }}>
      <h5 style={{ margin: '0 0 0.3rem', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#4a5568' }}>
        {title}
      </h5>
      {children}
    </div>
  );
}

/**
 * Builds a plain-text version of the customer summary for depot notes / clipboard.
 */
function buildPlainText(pathway: PathwayOptionV1): string {
  const lines: string[] = [];

  lines.push(`CUSTOMER SUMMARY — ${toPlainText(pathway.title)}`);
  lines.push('');
  lines.push('RECOMMENDATION');
  lines.push(toPlainText(pathway.rationale));
  lines.push('');
  lines.push('WHAT YOU GET TODAY');
  lines.push(toPlainText(pathway.outcomeToday));

  if (pathway.outcomeAfterTrigger) {
    lines.push('');
    lines.push('FUTURE UPGRADE PATH');
    lines.push(toPlainText(pathway.outcomeAfterTrigger));
  }

  if (pathway.prerequisites.length > 0) {
    lines.push('');
    lines.push('STEPS REQUIRED BEFORE UPGRADE');
    for (const p of pathway.prerequisites) {
      const trigger = p.triggerEvent ? ` (when: ${p.triggerEvent})` : '';
      lines.push(`• ${toPlainText(p.description)}${trigger}`);
    }
  }

  if (pathway.confidence.unknowns && pathway.confidence.unknowns.length > 0) {
    lines.push('');
    lines.push('STILL TO CONFIRM');
    for (const u of pathway.confidence.unknowns) {
      lines.push(`• ${toPlainText(u)}`);
    }
  }

  if (pathway.confidence.unlockBy && pathway.confidence.unlockBy.length > 0) {
    lines.push('');
    lines.push('HOW TO RESOLVE');
    for (const u of pathway.confidence.unlockBy) {
      lines.push(`• ${toPlainText(u)}`);
    }
  }

  return lines.join('\n');
}
