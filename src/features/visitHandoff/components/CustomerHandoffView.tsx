/**
 * CustomerHandoffView.tsx
 *
 * PR11 — Customer-facing read-only visit review surface.
 *
 * Renders a CustomerVisitSummary in a simple, calm, non-technical style.
 *
 * Sections:
 *   1. Survey complete (confirmation header)
 *   2. What we found
 *   3. What's planned
 *   4. What happens next
 *
 * Design intent:
 *   - Simple, clear, calm
 *   - No engineering jargon
 *   - Factual and reassuring
 *
 * Terminology: docs/atlas-terminology.md applies to all rendered strings.
 * Input strings (from CustomerVisitSummary) are assumed to already comply.
 */

import type { CustomerVisitSummary } from '../types/visitHandoffPack';

// ─── Internal section components ──────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontSize: '1rem',
      fontWeight: 600,
      color: '#1e293b',
      margin: '0 0 0.75rem 0',
      paddingBottom: '0.4rem',
      borderBottom: '2px solid #e2e8f0',
    }}>
      {children}
    </h2>
  );
}

function EmptyNote({ message }: { message: string }) {
  return (
    <p style={{ color: '#94a3b8', fontSize: '0.875rem', fontStyle: 'italic', margin: 0 }}>
      {message}
    </p>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface CustomerHandoffViewProps {
  summary: CustomerVisitSummary;
}

export default function CustomerHandoffView({ summary }: CustomerHandoffViewProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

      {/* ── 1. Survey complete ─────────────────────────────────────────── */}
      <section>
        <div style={{
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: 10,
          padding: '1rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
        }}>
          <span style={{ fontSize: '1.5rem' }} aria-hidden="true">✓</span>
          <div>
            <p style={{ fontWeight: 600, color: '#166534', margin: 0, fontSize: '1rem' }}>
              Survey complete
            </p>
            <p style={{ color: '#15803d', margin: '0.2rem 0 0', fontSize: '0.875rem' }}>
              Your home survey has been completed. This is a read-only record of your visit.
            </p>
          </div>
        </div>
        {summary.currentSystemDescription && (
          <p style={{
            marginTop: '1rem',
            color: '#475569',
            fontSize: '0.9rem',
            lineHeight: 1.6,
          }}>
            {summary.currentSystemDescription}
          </p>
        )}
      </section>

      {/* ── 2. What we found ──────────────────────────────────────────────── */}
      <section>
        <SectionHeader>What we found</SectionHeader>
        {summary.findings.length === 0 ? (
          <EmptyNote message="No findings recorded." />
        ) : (
          <ul style={{
            margin: 0,
            paddingLeft: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}>
            {summary.findings.map((finding, i) => (
              <li key={i} style={{ color: '#374151', fontSize: '0.9rem', lineHeight: 1.6 }}>
                {finding}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── 3. What's planned ────────────────────────────────────────────── */}
      <section>
        <SectionHeader>What&apos;s planned</SectionHeader>
        {summary.plannedWork.length === 0 ? (
          <EmptyNote message="No planned work recorded." />
        ) : (
          <ul style={{
            margin: 0,
            paddingLeft: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}>
            {summary.plannedWork.map((item, i) => (
              <li key={i} style={{ color: '#374151', fontSize: '0.9rem', lineHeight: 1.6 }}>
                {item}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── 4. What happens next ─────────────────────────────────────────── */}
      <section>
        <SectionHeader>What happens next</SectionHeader>
        {summary.nextSteps ? (
          <p style={{ color: '#374151', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>
            {summary.nextSteps}
          </p>
        ) : (
          <EmptyNote message="No next steps recorded." />
        )}
      </section>

    </div>
  );
}
