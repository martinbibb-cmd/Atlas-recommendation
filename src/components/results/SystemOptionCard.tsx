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
 * Each card also shows a "What to expect" section with concise lived-experience
 * copy derived from the system type.
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

// ─── What to expect — static lived-experience copy per system type ────────────

/**
 * Short, neutral bullets describing what a householder can expect in
 * real-world use for each system type.
 *
 * Terms follow docs/atlas-terminology.md:
 *   - "on-demand hot water" (not "instantaneous")
 *   - "tank-fed supply" / "mains-fed supply" (not "gravity" / "high pressure")
 */
const WHAT_TO_EXPECT: Partial<Record<OptionCardV1['id'], string[]>> = {
  combi: [
    'On-demand hot water delivered across outlets.',
    'Performance reduces when multiple outlets are used at the same time.',
    'Best suited to homes with light, sequential hot water use.',
  ],
  stored_vented: [
    'Better stability at peak demand — hot water is pre-stored.',
    'Recovery depends on cylinder condition and heat source output.',
    'Tank-fed supply; pressure is governed by cold water storage cistern height.',
  ],
  stored_unvented: [
    'Better stability at peak demand — hot water is pre-stored.',
    'Recovery depends on cylinder condition and heat source output.',
    'Mains-fed supply at higher pressure than a vented cylinder.',
  ],
  ashp: [
    'Runs most efficiently at lower flow temperatures.',
    'May require radiator upgrades to deliver full heating output.',
    'Hot water recovery is consistent but slower than a gas boiler.',
  ],
  regular_vented: [
    'Well suited to existing open vented systems.',
    'Separate cylinder and storage cistern provide a hot water buffer.',
    'Tank-fed supply; pressure governed by cistern height.',
  ],
  system_unvented: [
    'Pressurised heating circuit without open header tanks.',
    'Mains-fed hot water supply at higher pressure.',
    'Quieter in operation than open vented systems.',
  ],
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
      {/* Body is always in the DOM so @media print can force it visible */}
      <div className={`opt-card__section-body${open ? '' : ' opt-card__section-body--collapsed'}`}>
        {/* Print-only label replaces the hidden toggle heading */}
        <p className="opt-card__section-print-label" aria-hidden="true">{label}</p>
        {children}
      </div>
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

  // What to expect — static lived-experience copy for this system type
  const expectBullets = WHAT_TO_EXPECT[card.id] ?? [];

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

      {/* ── What to expect ──────────────────────────────────────────────── */}
      {expectBullets.length > 0 && (
        <div className="opt-card__expect">
          <p className="opt-card__expect-label">What to expect</p>
          <ul className="opt-card__expect-list">
            {expectBullets.map((bullet, i) => (
              <li key={i}>{bullet}</li>
            ))}
          </ul>
        </div>
      )}

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
