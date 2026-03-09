/**
 * SystemOptionCard — presents a single heating/DHW system option with
 * professional recommendation language.
 *
 * Replaces the previous PASS / FAIL / WARN labels with:
 *   viable   → ✅ Suitable
 *   caution  → ⚠ Possible with caveats
 *   rejected → ⛔ Not recommended
 *
 * For non-recommended systems it renders:
 *   • Reason explaining the physics constraint (neutral language)
 *   • Typical impact bullets
 *   • "Why this result" collapsible section (card.why + plane headlines)
 *   • "What would change the result" section (card.sensitivities)
 *
 * Rules:
 * - Never use the words "fail", "starvation", "rejected" in user-facing copy.
 * - All data comes from OptionCardV1 — no business logic in this component.
 */
import { useState } from 'react';
import type { OptionCardV1, SensitivityItem } from '../../contracts/EngineOutputV1';
import './results.css';

interface Props {
  card: OptionCardV1;
}

// ─── Status mapping ───────────────────────────────────────────────────────────

const STATUS_BADGE: Record<OptionCardV1['status'], { label: string; modifier: string }> = {
  viable:   { label: '✅ Suitable',               modifier: 'suitable' },
  caution:  { label: '⚠ Possible with caveats',  modifier: 'caveats' },
  rejected: { label: '⛔ Not recommended',        modifier: 'not-recommended' },
};

// ─── Impact bullets for non-viable systems ────────────────────────────────────

/** Collects human-readable impact bullets from the option planes. */
function impactBullets(card: OptionCardV1): string[] {
  const bullets: string[] = [];
  for (const plane of [card.dhw, card.heat, card.engineering]) {
    if (plane.status !== 'ok' && plane.bullets.length > 0) {
      bullets.push(...plane.bullets);
    }
  }
  return bullets.slice(0, 4); // cap at 4 for readability
}

// ─── Sensitivities section ───────────────────────────────────────────────────

function WouldChangeSection({ sensitivities }: { sensitivities: SensitivityItem[] }) {
  const upgrades = sensitivities.filter(s => s.effect === 'upgrade');
  if (upgrades.length === 0) return null;

  return (
    <ul className="opt-card__change-list">
      {upgrades.map((s, i) => (
        <li key={i}>{s.note}</li>
      ))}
    </ul>
  );
}

// ─── Collapsible section wrapper ─────────────────────────────────────────────

function CollapsibleSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="opt-card__section">
      <button
        className={`opt-card__section-toggle${open ? ' opt-card__section-toggle--open' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        {label}
        <span className="opt-card__section-toggle-chevron">▼</span>
      </button>
      {open && <div className="opt-card__section-body">{children}</div>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SystemOptionCard({ card }: Props) {
  const badge = STATUS_BADGE[card.status];
  const cardModifier = badge.modifier;

  // Combine why[] from the card with plane headlines for the "Why this result" block
  const whyLines: string[] = [
    ...card.why,
    ...[card.dhw, card.heat, card.engineering]
      .filter(p => p.status !== 'ok' && p.headline)
      .map(p => p.headline),
  ].filter(Boolean);

  // Impact bullets for non-viable status
  const impacts = card.status !== 'viable' ? impactBullets(card) : [];

  // What would change — only for non-viable, using sensitivities
  const sensitivities = card.sensitivities ?? [];
  const hasChanges = card.status !== 'viable' && sensitivities.some(s => s.effect === 'upgrade');

  return (
    <div className={`opt-card opt-card--${cardModifier}`}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="opt-card__header">
        <p className="opt-card__label">{card.label}</p>
        <span
          className={`opt-card__status-badge opt-card__status-badge--${cardModifier}`}
          aria-label={badge.label}
        >
          {badge.label}
        </span>
      </div>

      {/* Headline */}
      <p className="opt-card__headline">{card.headline}</p>

      {/* ── Not-recommended detail ───────────────────────────────────────── */}
      {card.status === 'rejected' && (
        <div className="opt-card__body">
          <div className="opt-card__not-rec">
            {card.why.length > 0 && (
              <>
                <p className="opt-card__not-rec-reason-label">Reason</p>
                <p className="opt-card__not-rec-reason">{card.why[0]}</p>
              </>
            )}
            {impacts.length > 0 && (
              <>
                <p className="opt-card__impact-label">Typical impact</p>
                <ul className="opt-card__impact-list">
                  {impacts.map((bullet, i) => (
                    <li key={i}>{bullet}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Why this result ─────────────────────────────────────────────── */}
      {whyLines.length > 0 && (
        <CollapsibleSection label="Why this result">
          <ul className="opt-card__why-list">
            {whyLines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </CollapsibleSection>
      )}

      {/* ── What would change the result ────────────────────────────────── */}
      {hasChanges && (
        <CollapsibleSection label="This system could become suitable if">
          <WouldChangeSection sensitivities={sensitivities} />
        </CollapsibleSection>
      )}
    </div>
  );
}
