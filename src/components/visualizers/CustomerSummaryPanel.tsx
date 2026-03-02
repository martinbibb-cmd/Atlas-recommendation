/**
 * CustomerSummaryPanel – Customer-Facing Explanation Panel
 *
 * Generates a plain-English explanation of the selected pathway,
 * suitable for depot notes or direct presentation to the customer.
 *
 * Language rules:
 *  - Avoids hard "No" — uses "not advisable under current constraints"
 *  - "Possible, but requires prerequisite" for blocked paths
 *  - Plain text export suitable for copy-paste to depot notes
 */

import { useState } from 'react';
import type { PathwayOptionV1, PlanV1 } from '../../contracts/EngineOutputV1';
import { CONFIDENCE_BADGE_STYLE, CONFIDENCE_LABEL } from './panelConstants';

interface Props {
  plan: PlanV1;
  selectedPathwayId?: PlanV1['selectedPathwayId'];
}

// ─── Plain text generator ─────────────────────────────────────────────────────

function generatePlainText(pathway: PathwayOptionV1): string {
  const lines: string[] = [];
  lines.push(`RECOMMENDED APPROACH: ${pathway.title}`);
  lines.push('');
  lines.push('Why this approach:');
  pathway.rationale.forEach(r => lines.push(`  • ${r}`));
  lines.push('');
  lines.push('What this means today:');
  pathway.outcomeToday.forEach(o => lines.push(`  • ${o}`));

  if (pathway.outcomeAfterTrigger && pathway.outcomeAfterTrigger.length > 0) {
    lines.push('');
    lines.push('What becomes possible later:');
    pathway.outcomeAfterTrigger.forEach(o => lines.push(`  • ${o}`));
  }

  if (pathway.prerequisites.length > 0) {
    lines.push('');
    lines.push('Before the next stage:');
    pathway.prerequisites.forEach(p => lines.push(`  • ${p.text}`));
  }

  if (pathway.confidence.unknowns && pathway.confidence.unknowns.length > 0) {
    lines.push('');
    lines.push('To increase certainty:');
    (pathway.confidence.unlockBy ?? []).forEach(u => lines.push(`  • ${u}`));
  }

  lines.push('');
  lines.push(`Confidence: ${CONFIDENCE_LABEL[pathway.confidence.level]}`);

  return lines.join('\n');
}

// ─── Customer explanation builders ───────────────────────────────────────────

function rationale(pathway: PathwayOptionV1): string {
  if (pathway.rationale.length === 0) return '';
  return pathway.rationale.join(' ');
}

function prerequisiteExplanation(pathway: PathwayOptionV1): string {
  if (pathway.prerequisites.length === 0) return '';
  const texts = pathway.prerequisites.map(p => p.text);
  return `This is possible, but requires the following steps first: ${texts.join('; ')}.`;
}

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * CustomerSummaryPanel
 *
 * Generates a customer-facing summary from the selected pathway.
 * Includes a plain-text export button for depot notes.
 * Only renders when a pathway is selected.
 */
export default function CustomerSummaryPanel({ plan, selectedPathwayId }: Props) {
  const [copied, setCopied] = useState(false);

  const pathway = selectedPathwayId
    ? plan.pathways.find(p => p.id === selectedPathwayId)
    : plan.pathways[0];

  if (!pathway) {
    return (
      <div
        style={{
          border: '1px solid #e2e8f0',
          borderRadius: 10,
          padding: 16,
          color: '#718096',
          fontSize: '0.85rem',
        }}
      >
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#2d3748', marginTop: 0 }}>
          📄 Customer Summary
        </h3>
        <p>No pathway selected. Choose a pathway in the Expert Panel above to generate a customer explanation.</p>
      </div>
    );
  }

  const confBadge = CONFIDENCE_BADGE_STYLE[pathway.confidence.level];
  const plainText = generatePlainText(pathway);

  function handleCopy() {
    navigator.clipboard.writeText(plainText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Fallback: select the textarea text
    });
  }

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#2d3748', margin: 0, flex: 1 }}>
          📄 Customer Summary
        </h3>
        <span
          style={{
            ...confBadge,
            borderRadius: 4,
            padding: '2px 8px',
            fontSize: '0.72rem',
            border: confBadge.border,
          }}
        >
          {CONFIDENCE_LABEL[pathway.confidence.level]}
        </span>
      </div>

      {/* Approach title */}
      <div
        style={{
          background: '#ebf8ff',
          border: '1px solid #90cdf4',
          borderRadius: 8,
          padding: '10px 14px',
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: '0.78rem', color: '#2c5282', fontWeight: 600, marginBottom: 2 }}>
          RECOMMENDED APPROACH
        </div>
        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#2b6cb0' }}>{pathway.title}</div>
      </div>

      {/* Why */}
      <div style={{ marginBottom: 12 }}>
        <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#4a5568', margin: '0 0 6px' }}>
          Why this approach
        </h4>
        <p style={{ fontSize: '0.85rem', color: '#4a5568', margin: 0, lineHeight: 1.55 }}>
          {rationale(pathway)}
        </p>
      </div>

      {/* Outcome today */}
      <div style={{ marginBottom: 12 }}>
        <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#4a5568', margin: '0 0 6px' }}>
          What this means for you today
        </h4>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.85rem', color: '#4a5568', lineHeight: 1.6 }}>
          {pathway.outcomeToday.map(o => <li key={o}>{o}</li>)}
        </ul>
      </div>

      {/* Outcome later */}
      {pathway.outcomeAfterTrigger && pathway.outcomeAfterTrigger.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#4a5568', margin: '0 0 6px' }}>
            What becomes possible in the future
          </h4>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.85rem', color: '#4a5568', lineHeight: 1.6 }}>
            {pathway.outcomeAfterTrigger.map(o => <li key={o}>{o}</li>)}
          </ul>
        </div>
      )}

      {/* Prerequisites — honest staging language */}
      {pathway.prerequisites.length > 0 && (
        <div
          style={{
            background: '#fffaf0',
            border: '1px solid #fbd38d',
            borderRadius: 6,
            padding: '8px 12px',
            marginBottom: 12,
            fontSize: '0.82rem',
            color: '#744210',
          }}
        >
          <strong>Not yet possible to go all the way today</strong> — {prerequisiteExplanation(pathway)}
        </div>
      )}

      {/* Unknowns */}
      {pathway.confidence.unknowns && pathway.confidence.unknowns.length > 0 && (
        <div
          style={{
            background: '#f7fafc',
            border: '1px solid #cbd5e0',
            borderRadius: 6,
            padding: '8px 12px',
            marginBottom: 12,
            fontSize: '0.82rem',
            color: '#4a5568',
          }}
        >
          <strong>To improve confidence in this recommendation:</strong>
          <ul style={{ margin: '4px 0 0 14px', padding: 0 }}>
            {(pathway.confidence.unlockBy ?? []).map(u => <li key={u}>{u}</li>)}
          </ul>
        </div>
      )}

      {/* Plain text export */}
      <div style={{ marginTop: 14, borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <h4 style={{ fontSize: '0.82rem', fontWeight: 700, color: '#4a5568', margin: 0, flex: 1 }}>
            📋 Depot notes export
          </h4>
          <button
            onClick={handleCopy}
            style={{
              padding: '4px 12px',
              fontSize: '0.78rem',
              background: copied ? '#38a169' : '#f7fafc',
              color: copied ? '#fff' : '#2d3748',
              border: '1px solid #cbd5e0',
              borderRadius: 5,
              cursor: 'pointer',
              fontWeight: 600,
              transition: 'background 0.15s',
            }}
          >
            {copied ? '✓ Copied!' : 'Copy to clipboard'}
          </button>
        </div>
        <textarea
          readOnly
          value={plainText}
          style={{
            width: '100%',
            minHeight: 120,
            fontSize: '0.78rem',
            fontFamily: 'monospace',
            color: '#4a5568',
            background: '#f7fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 6,
            padding: 8,
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
          aria-label="Depot notes plain text export"
        />
      </div>
    </div>
  );
}
