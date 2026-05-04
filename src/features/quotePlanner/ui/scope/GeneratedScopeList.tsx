/**
 * GeneratedScopeList.tsx
 *
 * Renders a grouped list of generated scope items.
 *
 * Items are grouped by category in display order, with a header for each
 * category.  Each item shows its label, optional quantity/route detail,
 * confidence badge, verification warning, and an "Edit source" link that
 * navigates back to the planner step where the source data lives.
 *
 * Design rules:
 *   - No customer-facing copy.
 *   - No pricing.
 *   - Does not alter recommendation logic.
 */

import type {
  QuoteScopeItemV1,
  QuoteScopeItemCategory,
} from '../../scope/buildQuoteScopeFromInstallationPlan';
import { ScopeConfidenceBadges } from './ScopeConfidenceBadges';

// ─── Category display ─────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<QuoteScopeItemCategory, string> = {
  existing_removal: 'Existing removal',
  new_installation: 'New installation',
  routes:           'Routes and connections',
  alterations:      'Alterations and making good',
  commissioning:    'Commissioning',
};

/** Display order for categories. */
const CATEGORY_ORDER: QuoteScopeItemCategory[] = [
  'existing_removal',
  'new_installation',
  'routes',
  'alterations',
  'commissioning',
];

// ─── Source step labels ───────────────────────────────────────────────────────

const SOURCE_STEP_LABELS: Record<NonNullable<QuoteScopeItemV1['sourceStepId']>, string> = {
  place_locations: 'Locations',
  flue_plan:       'Flue plan',
  condensate_plan: 'Condensate plan',
  pipework_plan:   'Pipework plan',
};

// ─── Props ────────────────────────────────────────────────────────────────────

export interface GeneratedScopeListProps {
  /** The scope items to display. */
  items: QuoteScopeItemV1[];
  /**
   * Called when the engineer taps an "Edit source" link.
   * Receives the source step ID so the stepper can navigate back to it.
   */
  onEditSource?: (stepId: NonNullable<QuoteScopeItemV1['sourceStepId']>) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GeneratedScopeList({ items, onEditSource }: GeneratedScopeListProps) {
  if (items.length === 0) {
    return (
      <p className="scope-list__empty">
        No scope items generated. Complete the earlier steps and return to this screen.
      </p>
    );
  }

  // Group items by category while preserving insertion order within each group.
  const grouped = new Map<QuoteScopeItemCategory, QuoteScopeItemV1[]>();
  for (const item of items) {
    const list = grouped.get(item.category) ?? [];
    list.push(item);
    grouped.set(item.category, list);
  }

  return (
    <div className="scope-list" role="list" aria-label="Generated scope items">
      {CATEGORY_ORDER.map((category) => {
        const categoryItems = grouped.get(category);
        if (!categoryItems || categoryItems.length === 0) return null;

        return (
          <section
            key={category}
            className="scope-list__group"
            aria-labelledby={`scope-cat-${category}`}
          >
            <h3
              id={`scope-cat-${category}`}
              className="scope-list__group-heading"
            >
              {CATEGORY_LABELS[category]}
            </h3>

            <ul className="scope-list__items">
              {categoryItems.map((item) => (
                <li key={item.itemId} className="scope-item" role="listitem">
                  <div className="scope-item__header">
                    <span className="scope-item__label">{item.label}</span>
                    <ScopeConfidenceBadges
                      confidence={item.confidence}
                      needsVerification={item.needsVerification}
                    />
                  </div>

                  {item.details && (
                    <p className="scope-item__details">{item.details}</p>
                  )}

                  {item.needsVerification && (
                    <p className="scope-item__verify-warning">
                      This item is based on assumed data — verify on site before quoting.
                    </p>
                  )}

                  {item.sourceStepId && onEditSource && (
                    <button
                      type="button"
                      className="scope-item__edit-link"
                      onClick={() => onEditSource(item.sourceStepId!)}
                      aria-label={`Edit source data for "${item.label}" in ${SOURCE_STEP_LABELS[item.sourceStepId]} step`}
                    >
                      Edit source: {SOURCE_STEP_LABELS[item.sourceStepId]}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
