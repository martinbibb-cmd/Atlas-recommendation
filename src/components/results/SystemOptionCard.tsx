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
import type { PriorityKey } from '../../features/survey/priorities/prioritiesTypes';
import { PRIORITY_META } from '../../features/survey/priorities/prioritiesTypes';
import { imageForOptionId } from '../../ui/systemImages/systemImageMap';
import './results.css';

interface Props {
  card: OptionCardV1;
  /** Selected priorities from the survey — drives the "Supports your priorities" block. */
  selectedPriorities?: PriorityKey[];
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
    'Runs most efficiently at lower flow temperatures — low-temp space heating protects COP.',
    'Cylinder heating at typical DHW temperatures (55–60°C) pushes COP down sharply.',
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

// ─── Priority support mapping ─────────────────────────────────────────────────

/**
 * Maps each system option to the priorities it inherently supports well.
 * Used to derive the "Supports your priorities" block — purely presentational.
 * Physics-based suitability/ranking is unchanged.
 *
 * Rationale by system:
 *   combi          — simple swap (disruption) + fewer components (reliability); no stored water
 *                    means it cannot claim performance at peak demand or future-compatibility.
 *   stored_vented  — pre-stored supply (performance) + proven tech (reliability, longevity) +
 *                    keeps existing loft infrastructure (disruption); open vented limits
 *                    future-compatibility (not HP-ready without pressurisation).
 *   stored_unvented — pre-stored supply (performance) + mature tech (reliability, longevity) +
 *                    mains-pressure supply makes it HP-ready (future_compatibility).
 *   ashp           — renewable electricity (eco) + seasonal efficiency gain (cost_tendency) +
 *                    aligned with Future Homes Standard (future_compatibility) + long compressor
 *                    lifespan (longevity) + fewer combustion parts (reliability).
 *   regular_vented — like stored_vented: performance + reliability + longevity + minimal
 *                    change to existing pipework (disruption).
 *   system_unvented — like stored_unvented: performance + reliability + longevity +
 *                    mains-pressure ready for HP upgrade (future_compatibility).
 */
const OPTION_PRIORITY_SUPPORT: Record<OptionCardV1['id'], PriorityKey[]> = {
  combi:           ['reliability', 'disruption'],
  stored_vented:   ['performance', 'reliability', 'longevity', 'disruption'],
  stored_unvented: ['performance', 'reliability', 'longevity', 'future_compatibility'],
  ashp:            ['eco', 'cost_tendency', 'future_compatibility', 'longevity', 'reliability'],
  regular_vented:  ['performance', 'reliability', 'longevity', 'disruption'],
  system_unvented: ['performance', 'reliability', 'longevity', 'future_compatibility'],
};

/**
 * Returns priority labels from the user's selected set that this option supports.
 * Returns an empty array when there is no intersection or no priorities were selected.
 */
function supportedPriorityLabels(
  cardId: OptionCardV1['id'],
  selectedPriorities: PriorityKey[],
): string[] {
  if (selectedPriorities.length === 0) return [];
  const supported = new Set(OPTION_PRIORITY_SUPPORT[cardId] ?? []);
  return selectedPriorities
    .filter(k => supported.has(k))
    .map(k => PRIORITY_META.find(m => m.key === k)?.label ?? k);
}

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

export default function SystemOptionCard({ card, selectedPriorities = [] }: Props) {
  const badge = STATUS_BADGE[card.status];
  const cardModifier = badge.modifier;

  const isViableOrCaution = card.status === 'viable' || card.status === 'caution';

  // For viable/caution cards, show the first 2 why[] lines as a visible
  // "Why this fits" block, and keep the rest in a collapsible.
  // For rejected cards, why[0] is shown as "Reason" above the collapsible.
  const visibleWhyLines = isViableOrCaution ? card.why.slice(0, 2) : [];
  const collapsibleWhySource = isViableOrCaution ? card.why.slice(2) : card.why.slice(1);
  const whyLines: string[] = [
    ...collapsibleWhySource,
    ...[card.dhw, card.heat, card.engineering]
      .filter(p => p.status !== 'ok' && p.headline)
      .map(p => p.headline),
  ].filter(Boolean);

  // Trade-off: first downgrade sensitivity for viable/caution cards
  const sensitivities = card.sensitivities ?? [];
  const tradeOffNote = isViableOrCaution
    ? (sensitivities.find(s => s.effect === 'downgrade')?.note ?? null)
    : null;

  // Impact bullets for non-viable status
  const impacts = card.status !== 'viable' ? impactBullets(card) : [];

  // What would change — only for non-viable, using sensitivities
  const hasChanges = card.status !== 'viable' && sensitivities.some(s => s.effect === 'upgrade');

  // What to expect — static lived-experience copy for this system type
  const expectBullets = WHAT_TO_EXPECT[card.id] ?? [];

  // Supports your priorities — intersection of user's selected priorities and this option's strengths
  const supportedPriorities = supportedPriorityLabels(card.id, selectedPriorities);

  // System topology thumbnail — real-world reference image for this option
  const thumbnail = imageForOptionId(card.id);

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

      {/* ── System topology thumbnail ─────────────────────────────────── */}
      {thumbnail && (
        <img
          src={thumbnail.src}
          alt={thumbnail.alt}
          className="opt-card__thumbnail"
        />
      )}

      {/* Headline */}
      <p className="opt-card__headline">{card.headline}</p>

      {/* ── Why this fits (visible, first 2 reasons — viable/caution only) ── */}
      {visibleWhyLines.length > 0 && (
        <div className="opt-card__why-fits">
          <p className="opt-card__why-fits-label">Why this fits</p>
          <ul className="opt-card__why-fits-list">
            {visibleWhyLines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Trade-off (visible, viable/caution only) ─────────────────────── */}
      {tradeOffNote && (
        <div className="opt-card__tradeoff-block">
          <p className="opt-card__tradeoff-label">The trade-off here is</p>
          <p className="opt-card__tradeoff-note">{tradeOffNote}</p>
        </div>
      )}

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
      {card.status === 'rejected' && (card.why.length > 0 || impacts.length > 0) && (
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

      {/* ── Supports your priorities ─────────────────────────────────────── */}
      {supportedPriorities.length > 0 && (
        <div className="opt-card__priorities">
          <p className="opt-card__priorities-label">Supports your priorities</p>
          <div className="opt-card__priority-pills">
            {supportedPriorities.map(label => (
              <span key={label} className="opt-card__priority-pill">{label}</span>
            ))}
          </div>
        </div>
      )}

      {/* ── Why this result (collapsible — remaining reasons + plane detail) */}
      {whyLines.length > 0 && (
        <CollapsibleSection label={isViableOrCaution ? 'More detail' : 'Why this result'}>
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
