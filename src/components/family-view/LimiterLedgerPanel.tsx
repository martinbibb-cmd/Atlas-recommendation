/**
 * LimiterLedgerPanel.tsx — PR10: Structured evidence panel from LimiterLedger.
 *
 * Renders the entries from the selected family's LimiterLedger with their
 * severity, domain, trigger keys, and description — all sourced from real
 * engine evidence.  No cross-family data is mixed.
 *
 * This panel is family-aware: combi-only limiters never appear in stored-system
 * views, and store-only limiters never appear in combi views.  The ledger
 * itself enforces this via family ownership rules (PR8).
 */

import type { LimiterLedger, LimiterLedgerEntry, LimiterSeverity, LimiterDomain } from '../../engine/limiter/LimiterLedger';
import { LEDGER_SEVERITY_LABEL } from '../../lib/copy/customerCopy';

// ─── Labels ───────────────────────────────────────────────────────────────────

/**
 * Exhaustive severity label map typed against LimiterSeverity.
 * Uses LEDGER_SEVERITY_LABEL as the single source of truth.
 * TypeScript will error here if LimiterSeverity gains a new value without
 * a corresponding entry in LEDGER_SEVERITY_LABEL.
 */
const SEVERITY_LABELS: Record<LimiterSeverity, string> = {
  info:      LEDGER_SEVERITY_LABEL['info']      ?? 'Info',
  warning:   LEDGER_SEVERITY_LABEL['warning']   ?? 'Warning',
  limit:     LEDGER_SEVERITY_LABEL['limit']      ?? 'Limit reached',
  hard_stop: LEDGER_SEVERITY_LABEL['hard_stop'] ?? 'Not advised',
};

const SEVERITY_CLASS: Record<LimiterSeverity, string> = {
  info:      'limiter-ledger-panel__entry--info',
  warning:   'limiter-ledger-panel__entry--warning',
  limit:     'limiter-ledger-panel__entry--limit',
  hard_stop: 'limiter-ledger-panel__entry--hard-stop',
};

const DOMAIN_LABELS: Record<LimiterDomain, string> = {
  dhw:           'Hot water',
  space_heating: 'Space heating',
  hydraulic:     'Hydraulic',
  efficiency:    'Efficiency',
  installability: 'Installability',
  controls:      'Controls',
  lifecycle:     'Lifecycle',
};

// ─── Entry component ──────────────────────────────────────────────────────────

interface LimiterEntryProps {
  entry: LimiterLedgerEntry;
}

function LimiterEntry({ entry }: LimiterEntryProps) {
  const severityClass = SEVERITY_CLASS[entry.severity];
  const severityLabel = SEVERITY_LABELS[entry.severity];
  const domainLabel = DOMAIN_LABELS[entry.domain];

  return (
    <li
      className={`limiter-ledger-panel__entry ${severityClass}`}
      data-limiter-id={entry.id}
      data-testid={`limiter-entry-${entry.id}`}
    >
      <div className="limiter-ledger-panel__entry-header">
        <span
          className="limiter-ledger-panel__entry-severity"
          aria-label={`Severity: ${severityLabel}`}
        >
          {severityLabel}
        </span>
        <span className="limiter-ledger-panel__entry-domain">{domainLabel}</span>
        <code className="limiter-ledger-panel__entry-id" aria-label={`Limiter ID: ${entry.id}`}>
          {entry.id}
        </code>
      </div>
      <div className="limiter-ledger-panel__entry-title">{entry.title}</div>
      <p className="limiter-ledger-panel__entry-description">{entry.description}</p>
      <div className="limiter-ledger-panel__entry-meta">
        <span className="limiter-ledger-panel__entry-source">
          Source: <em>{entry.source}</em>
        </span>
        {entry.triggerKeys.length > 0 && (
          <span className="limiter-ledger-panel__entry-triggers">
            Triggers:{' '}
            {entry.triggerKeys.map((k) => (
              <code key={k} className="limiter-ledger-panel__entry-trigger-key">{k}</code>
            ))}
          </span>
        )}
        <span className="limiter-ledger-panel__entry-confidence">
          Confidence: <em>{entry.confidence}</em>
        </span>
      </div>
    </li>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface LimiterLedgerPanelProps {
  limiterLedger: LimiterLedger;
}

/**
 * Renders the limiter ledger for the currently selected family.
 *
 * All entries are sourced exclusively from the selected family's runner — no
 * cross-family data is ever shown here.
 */
export default function LimiterLedgerPanel({ limiterLedger }: LimiterLedgerPanelProps) {
  const { entries } = limiterLedger;

  if (entries.length === 0) {
    return (
      <section
        className="limiter-ledger-panel limiter-ledger-panel--empty"
        aria-label="Constraint evidence"
        data-testid="limiter-ledger-panel"
      >
        <h3 className="limiter-ledger-panel__heading">Constraint evidence</h3>
        <p className="limiter-ledger-panel__no-entries">
          No constraints detected for this run.
        </p>
      </section>
    );
  }

  return (
    <section
      className="limiter-ledger-panel"
      aria-label="Constraint evidence"
      data-testid="limiter-ledger-panel"
    >
      <h3 className="limiter-ledger-panel__heading">Constraint evidence</h3>
      <p className="limiter-ledger-panel__count">
        {entries.length} {entries.length === 1 ? 'constraint' : 'constraints'} detected
      </p>
      <ul
        className="limiter-ledger-panel__entries"
        aria-label="Limiter ledger entries"
        data-testid="limiter-entries-list"
      >
        {entries.map((entry) => (
          <LimiterEntry key={entry.id} entry={entry} />
        ))}
      </ul>
    </section>
  );
}
