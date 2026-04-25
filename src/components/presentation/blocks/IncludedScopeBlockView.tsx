/**
 * IncludedScopeBlockView.tsx — Renders an IncludedScopeBlock listing what is covered.
 *
 * Layout:
 *   icon ring → title → outcome → grouped sections → supporting points
 *
 * Groups (each shown only when non-empty):
 *   Included now        — status='included', non-compliance items (green tick)
 *   Required            — compliance items (amber "Requirement" badge)
 *   Recommended         — status='recommended' (blue advisory pills)
 *   Future options      — status='optional', category='future' (purple chips)
 *
 * Fallback: when all groups are empty, shows "Scope not fully captured yet".
 *
 * Rules:
 *   - Items come directly from block fields — no filtering or reordering here.
 *   - Compliance items use a neutral "Requirement" label, not a benefit framing.
 */

import type { IncludedScopeBlock } from '../../../contracts/VisualBlock';
import { getVisualEntry } from '../visuals/VisualRegistry';

interface Props {
  block: IncludedScopeBlock;
}

/** Render a single included (non-compliance) item pill. */
function IncludedPill({ label, benefit }: { label: string; benefit?: string }) {
  return (
    <div className="customer-deck__scope-included-pill">
      <span className="customer-deck__scope-included-tick" aria-hidden="true">✓</span>
      <span>
        {label}
        {benefit && (
          <span className="customer-deck__scope-included-benefit">
            — {benefit}
          </span>
        )}
      </span>
    </div>
  );
}

/** Render a compliance item pill with "Requirement" badge. */
function CompliancePill({ label }: { label: string }) {
  return (
    <div className="customer-deck__scope-compliance-pill">
      <span className="customer-deck__scope-compliance-icon" aria-hidden="true">📋</span>
      <span>{label}</span>
      <span className="customer-deck__scope-compliance-badge" aria-label="Regulatory requirement">
        Requirement
      </span>
    </div>
  );
}

/** Render a recommended upgrade advisory pill. */
function RecommendedPill({ label, benefit }: { label: string; benefit?: string }) {
  return (
    <div className="customer-deck__scope-recommended-pill">
      <span className="customer-deck__scope-recommended-icon" aria-hidden="true">★</span>
      <span>
        {label}
        {benefit && (
          <span className="customer-deck__scope-included-benefit">
            — {benefit}
          </span>
        )}
      </span>
      <span className="customer-deck__scope-recommended-badge" aria-label="Recommended upgrade">
        Recommended
      </span>
    </div>
  );
}

/** Render a future-option chip. */
function FutureChip({ label }: { label: string }) {
  return (
    <li className="customer-deck__path-chip">
      <span aria-hidden="true">→</span>
      {label}
    </li>
  );
}

export function IncludedScopeBlockView({ block }: Props) {
  const visual = getVisualEntry(block.visualKey);

  const complianceItems  = block.complianceItems  ?? [];
  const recommendedItems = block.recommendedItems ?? [];
  const futureItems      = block.futureItems      ?? [];

  const allEmpty =
    block.items.length === 0 &&
    complianceItems.length === 0 &&
    recommendedItems.length === 0 &&
    futureItems.length === 0;

  return (
    <article className="customer-deck__block customer-deck__block--included-scope" aria-label={block.title}>
      <div
        className="customer-deck__visual-ring customer-deck__visual-ring--small"
        style={{ background: `radial-gradient(circle, ${visual.accentColor}22 0%, transparent 70%)` }}
        aria-label={visual.ariaLabel}
        role="img"
      >
        <span className="customer-deck__visual-icon customer-deck__visual-icon--small" aria-hidden="true">
          {visual.icon}
        </span>
      </div>

      <div className="customer-deck__block-body">
        <h2 className="customer-deck__title">{block.title}</h2>
        <p className="customer-deck__outcome">{block.outcome}</p>

        {allEmpty && (
          <p className="customer-deck__scope-empty" data-testid="capp-scope-empty">
            Scope not fully captured yet — your installer will confirm all included works.
          </p>
        )}

        {/* Included now */}
        {block.items.length > 0 && (
          <div className="customer-deck__scope-group" data-testid="capp-scope-group-included">
            <p className="customer-deck__scope-group-label">Included now</p>
            <ul className="customer-deck__scope-list" aria-label="Included now">
              {block.items.map((item) => (
                <li key={item.id}>
                  {item.category === 'compliance'
                    ? <CompliancePill label={item.label} />
                    : <IncludedPill label={item.label} benefit={item.customerBenefit} />
                  }
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Required / compliance */}
        {complianceItems.length > 0 && (
          <div className="customer-deck__scope-group" data-testid="capp-scope-group-compliance">
            <p className="customer-deck__scope-group-label">Required</p>
            <ul className="customer-deck__scope-list" aria-label="Required works">
              {complianceItems.map((item) => (
                <li key={item.id}>
                  <CompliancePill label={item.label} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommended upgrades */}
        {recommendedItems.length > 0 && (
          <div className="customer-deck__scope-group" data-testid="capp-scope-group-recommended">
            <p className="customer-deck__scope-group-label">Recommended upgrades</p>
            <ul className="customer-deck__scope-list" aria-label="Recommended upgrades">
              {recommendedItems.map((item) => (
                <li key={item.id}>
                  <RecommendedPill label={item.label} benefit={item.customerBenefit} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Future options */}
        {futureItems.length > 0 && (
          <div className="customer-deck__scope-group" data-testid="capp-scope-group-future">
            <p className="customer-deck__scope-group-label">Future options</p>
            <ul className="customer-deck__path-chips" aria-label="Future options">
              {futureItems.map((item) => (
                <FutureChip key={item.id} label={item.label} />
              ))}
            </ul>
          </div>
        )}

        {block.supportingPoints && block.supportingPoints.length > 0 && (
          <ul className="customer-deck__supporting-points" aria-label="Additional notes">
            {block.supportingPoints.slice(0, 3).map((point) => (
              <li key={point} className="customer-deck__supporting-point">
                <span className="customer-deck__point-marker" aria-hidden="true">→</span>
                {point}
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
