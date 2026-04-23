/**
 * VisualBlockDebugDeck.tsx — Cheap debug renderer for the VisualBlock model.
 *
 * Renders one card per block showing:
 *   - type badge
 *   - title
 *   - outcome
 *   - supporting points (as chips)
 *   - visualKey
 *   - any block-specific arrays (facts, examples, items, paths)
 *
 * This is an internal development tool only. Use it behind a dev route or
 * feature flag to verify the content model before styling.
 *
 * Do NOT use this in customer-facing or portal surfaces.
 */

import type {
  VisualBlock,
  FactsBlock,
  DailyUseBlock,
  IncludedScopeBlock,
  WarningBlock,
  FutureUpgradeBlock,
} from '../../contracts/VisualBlock';

// ─── Severity colours for warning blocks ─────────────────────────────────────

const SEVERITY_COLOR: Record<WarningBlock['severity'], string> = {
  info: '#3b82f6',
  advisory: '#f59e0b',
  important: '#ef4444',
};

// ─── Card shell ───────────────────────────────────────────────────────────────

interface CardProps {
  accentColor?: string;
  children: React.ReactNode;
}

function DebugCard({ accentColor = '#6366f1', children }: CardProps) {
  return (
    <div
      style={{
        border: `2px solid ${accentColor}`,
        borderRadius: 8,
        padding: '16px 20px',
        marginBottom: 16,
        background: '#0f172a',
        color: '#f1f5f9',
        fontFamily: 'monospace',
        fontSize: 13,
      }}
    >
      {children}
    </div>
  );
}

// ─── Chip list ────────────────────────────────────────────────────────────────

function ChipList({ items, color = '#334155' }: { items: string[]; color?: string }) {
  if (items.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
      {items.map((item, i) => (
        <span
          key={i}
          style={{
            background: color,
            borderRadius: 4,
            padding: '2px 8px',
            fontSize: 11,
            color: '#cbd5e1',
          }}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

// ─── Label / value row ────────────────────────────────────────────────────────

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ marginTop: 4, display: 'flex', gap: 8 }}>
      <span style={{ color: '#94a3b8', minWidth: 130 }}>{label}</span>
      <span style={{ color: '#f1f5f9' }}>{value}</span>
    </div>
  );
}

// ─── Block-type badge ─────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: VisualBlock['type'] }) {
  return (
    <span
      style={{
        display: 'inline-block',
        background: '#1e293b',
        border: '1px solid #475569',
        borderRadius: 4,
        padding: '1px 8px',
        fontSize: 11,
        color: '#94a3b8',
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        marginBottom: 10,
      }}
    >
      {type}
    </span>
  );
}

// ─── Per-block extra content ──────────────────────────────────────────────────

function FactsExtra({ block }: { block: FactsBlock }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 4 }}>facts</div>
      {block.facts.map((f, i) => (
        <FieldRow key={i} label={f.label} value={String(f.value)} />
      ))}
    </div>
  );
}

function DailyUseExtra({ block }: { block: DailyUseBlock }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 4 }}>examples</div>
      <ChipList items={block.examples} color='#1e3a5f' />
    </div>
  );
}

function IncludedScopeExtra({ block }: { block: IncludedScopeBlock }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 4 }}>items</div>
      <ChipList items={block.items} color='#14532d' />
    </div>
  );
}

function FutureUpgradeExtra({ block }: { block: FutureUpgradeBlock }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 4 }}>paths</div>
      <ChipList items={block.paths} color='#3b0764' />
    </div>
  );
}

// ─── Single block card ────────────────────────────────────────────────────────

function BlockCard({ block }: { block: VisualBlock }) {
  const accentColor =
    block.type === 'warning'
      ? SEVERITY_COLOR[(block as WarningBlock).severity]
      : '#6366f1';

  return (
    <DebugCard accentColor={accentColor}>
      <TypeBadge type={block.type} />
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
        {block.title}
      </div>
      <div style={{ color: '#cbd5e1', marginBottom: 10, lineHeight: 1.5 }}>
        {block.outcome}
      </div>

      {block.supportingPoints && block.supportingPoints.length > 0 && (
        <ChipList items={block.supportingPoints} color='#1e293b' />
      )}

      <div style={{ marginTop: 10 }}>
        <FieldRow label='visualKey' value={block.visualKey} />
        <FieldRow label='id' value={block.id} />
        {block.type === 'hero' && (
          <FieldRow label='recommendedScenarioId' value={block.recommendedScenarioId} />
        )}
        {block.type === 'solution' && (
          <FieldRow label='scenarioId' value={block.scenarioId} />
        )}
        {block.type === 'problem' && block.scenarioId && (
          <FieldRow label='scenarioId' value={block.scenarioId} />
        )}
        {block.type === 'warning' && (
          <FieldRow label='severity' value={(block as WarningBlock).severity} />
        )}
      </div>

      {block.type === 'facts' && <FactsExtra block={block} />}
      {block.type === 'daily_use' && <DailyUseExtra block={block} />}
      {block.type === 'included_scope' && <IncludedScopeExtra block={block} />}
      {block.type === 'future_upgrade' && <FutureUpgradeExtra block={block} />}
    </DebugCard>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

export interface VisualBlockDebugDeckProps {
  blocks: VisualBlock[];
}

/**
 * VisualBlockDebugDeck
 *
 * Renders the full VisualBlock array as a simple debug deck.
 * One card per block. For internal/dev use only.
 */
export function VisualBlockDebugDeck({ blocks }: VisualBlockDebugDeckProps) {
  if (blocks.length === 0) {
    return (
      <div
        style={{
          padding: 24,
          fontFamily: 'monospace',
          color: '#ef4444',
          background: '#0f172a',
        }}
      >
        VisualBlockDebugDeck: no blocks to render.
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 24,
        background: '#020617',
        minHeight: '100vh',
      }}
    >
      <div
        style={{
          fontFamily: 'monospace',
          fontSize: 11,
          color: '#64748b',
          marginBottom: 20,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        VisualBlock Debug Deck — {blocks.length} block{blocks.length !== 1 ? 's' : ''}
      </div>
      {blocks.map((block) => (
        <BlockCard key={block.id} block={block} />
      ))}
    </div>
  );
}
