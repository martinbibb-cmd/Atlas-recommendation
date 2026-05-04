/**
 * InstallationSpecificationPage.tsx
 *
 * Page wrapper for the Atlas Installation Specification.
 *
 * Acts as the route entry point and manages the list of specification options
 * for the active visit.  Multiple options can be created for the same canonical
 * survey — for example:
 *   - Option A  Combi, same location
 *   - Option B  Combi, relocated to airing cupboard
 *   - Option C  System boiler + Mixergy
 *   - Option D  ASHP with heat-pump cylinder
 *
 * Design rules:
 *   - Options are never framed as contractor quotes.
 *   - "Finish" always saves and exits — the app is never locked inside the stepper.
 *   - If no options exist on first open, Option A is created automatically and
 *     the stepper opens immediately.
 *   - If one option exists, the option list is shown before the stepper.
 *   - If multiple options exist, the option list is shown first.
 *   - Does NOT alter any recommendation decision or customer/safety flow.
 */

import { useState, useCallback } from 'react';
import { InstallationSpecificationStepper } from './InstallationSpecificationStepper';
import type { UiProposedHeatSourceLabel, CanonicalCurrentSystemSummary } from './installationSpecificationUiTypes';
import type { ObjectPinV2 } from '../../scanImport/contracts/sessionCaptureV2';
import type {
  InstallationSpecificationOptionV1,
  InstallationSpecificationFinishResultV1,
} from '../model/QuoteInstallationPlanV1';

// ─── Option label helpers ─────────────────────────────────────────────────────

const OPTION_ALPHABET = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

function nextOptionLabel(existingOptions: InstallationSpecificationOptionV1[]): string {
  const letter = OPTION_ALPHABET[existingOptions.length] ?? String(existingOptions.length + 1);
  return `Option ${letter}`;
}

function generateOptionId(): string {
  return `opt-${new Date().toISOString().replace(/[^0-9]/g, '')}`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface InstallationSpecificationPageProps {
  /**
   * Called when the surveyor exits the specification (Back on the first step,
   * or when Finish has no onFinish callback and origin is unknown).
   */
  onBack: () => void;
  /**
   * Called when the surveyor taps "Correct canonical survey".
   * Should navigate back to the survey flow — must not silently edit spec data.
   */
  onCorrectSurvey?: () => void;
  /**
   * Current system data from the canonical survey.
   * When provided, the first step shows a read-only summary of the existing
   * installation rather than asking the surveyor to re-enter it.
   */
  canonicalCurrentSystem?: CanonicalCurrentSystemSummary | null;
  /**
   * Optional proposed heat-source value seeded from the Atlas recommendation.
   * When provided, the first new option's stepper pre-selects this tile.
   */
  seedProposedSystem?: UiProposedHeatSourceLabel | null;
  /**
   * Optional floor-plan image URI from the scan session.
   */
  floorPlanUri?: string;
  /**
   * Object pins captured during the scan session.
   */
  scanObjectPins?: ObjectPinV2[];
  /**
   * Active visit ID for saving.
   * When provided, Finish calls onSave and the caller can persist to the API.
   */
  visitId?: string;
  /**
   * Where the page was opened from.  Controls Finish navigation fallback.
   *
   * visit-hub    — Finish navigates back to Visit Hub.
   * survey-step  — Finish navigates back to the Installation Specification survey step.
   * direct       — Finish falls back to onBack / browser history.
   */
  origin?: 'visit-hub' | 'survey-step' | 'direct';
  /**
   * Called immediately after Finish when scope and option have been built.
   * Use this to persist the option to the visit working_payload.
   */
  onSave?: (option: InstallationSpecificationOptionV1) => void;
  /**
   * Called after onSave when the surveyor taps Finish.
   * Receives the full result including generated scope and status.
   * When provided, navigation is the caller's responsibility.
   * When absent, the page navigates back based on `origin` or calls onBack.
   */
  onFinish?: (result: InstallationSpecificationFinishResultV1) => void;
  /**
   * Existing specification options for this visit.
   * When provided, the option list is pre-populated from this array.
   */
  existingOptions?: InstallationSpecificationOptionV1[];
}

// ─── Status badge helpers ─────────────────────────────────────────────────────

function statusLabel(status: InstallationSpecificationOptionV1['status']): string {
  switch (status) {
    case 'complete':       return 'Complete';
    case 'in_progress':    return 'In progress';
    case 'needs_decision': return 'Decisions needed';
    case 'draft':          return 'Draft';
  }
}

// ─── InstallationSpecificationPage ───────────────────────────────────────────

export function InstallationSpecificationPage({
  onBack,
  onCorrectSurvey,
  canonicalCurrentSystem,
  seedProposedSystem,
  floorPlanUri,
  scanObjectPins,
  origin,
  onSave,
  onFinish,
  existingOptions,
}: InstallationSpecificationPageProps) {
  // ── State ────────────────────────────────────────────────────────────────────

  const [options, setOptions] = useState<InstallationSpecificationOptionV1[]>(() => {
    if (existingOptions && existingOptions.length > 0) return existingOptions;
    // Create the first option (Option A) on first open — seeded from Atlas recommendation.
    const id = generateOptionId();
    const now = new Date().toISOString();
    const initial: InstallationSpecificationOptionV1 = {
      id,
      label: 'Option A',
      createdAt: now,
      updatedAt: now,
      status: 'draft',
      source: 'atlas_recommendation',
      isRecommended: true,
      specification: {
        planId: id,
        createdAt: now,
        currentSystem: { family: 'unknown' },
        proposedSystem: { family: 'unknown' },
        locations: [],
        routes: [],
        flueRoutes: [],
        pipeworkRoutes: [],
        jobClassification: { jobType: 'needs_review', rationale: '' },
        generatedScope: [],
      },
      generatedScope: [],
    };
    return [initial];
  });

  // Which option is currently open in the stepper (null = showing list).
  const [activeOptionId, setActiveOptionId] = useState<string | null>(() => {
    // If only one draft option exists, auto-open the stepper.
    if (!existingOptions || existingOptions.length === 0) return options[0]?.id ?? null;
    return null;
  });

  // ── Derived values ───────────────────────────────────────────────────────────

  const activeOption = options.find((o) => o.id === activeOptionId) ?? null;

  // ── Callbacks ────────────────────────────────────────────────────────────────

  const handleStepperFinish = useCallback((result: InstallationSpecificationFinishResultV1) => {
    // Update the option in the list.
    setOptions((prev) =>
      prev.map((o) => (o.id === result.option.id ? result.option : o)),
    );

    // Persist via caller.
    onSave?.(result.option);

    // Navigate.
    if (onFinish) {
      onFinish(result);
    } else if (origin === 'visit-hub' || origin === 'survey-step') {
      // No onFinish provided but origin mandates returning to a parent screen.
      // Fall back to onBack to avoid locking the user inside the stepper shell.
      onBack();
    } else {
      // Default: return to the option list within this page.
      setActiveOptionId(null);
    }
  }, [onFinish, onSave, origin, onBack]);

  const handleStepperBack = useCallback(() => {
    // Return to the option list from the stepper.
    setActiveOptionId(null);
  }, []);

  const handleAddOption = useCallback(() => {
    const now = new Date().toISOString();
    const id = generateOptionId();
    const label = nextOptionLabel(options);
    const newOption: InstallationSpecificationOptionV1 = {
      id,
      label,
      createdAt: now,
      updatedAt: now,
      status: 'draft',
      source: 'surveyor_variant',
      specification: {
        planId: id,
        createdAt: now,
        currentSystem: { family: 'unknown' },
        proposedSystem: { family: 'unknown' },
        locations: [],
        routes: [],
        flueRoutes: [],
        pipeworkRoutes: [],
        jobClassification: { jobType: 'needs_review', rationale: '' },
        generatedScope: [],
      },
      generatedScope: [],
    };
    setOptions((prev) => [...prev, newOption]);
    setActiveOptionId(id);
  }, [options]);

  const handleDuplicateOption = useCallback((sourceOption: InstallationSpecificationOptionV1) => {
    const now = new Date().toISOString();
    const id = generateOptionId();
    const label = `${nextOptionLabel(options)} — copy of ${sourceOption.label}`;
    const duplicate: InstallationSpecificationOptionV1 = {
      ...sourceOption,
      id,
      label,
      createdAt: now,
      updatedAt: now,
      status: 'draft',
      source: 'duplicated_option',
      isRecommended: false,
      isSelectedForQuote: false,
      specification: { ...sourceOption.specification, planId: id },
    };
    setOptions((prev) => [...prev, duplicate]);
    setActiveOptionId(id);
  }, [options]);

  const handleMarkSelected = useCallback((optionId: string) => {
    setOptions((prev) =>
      prev.map((o) => ({
        ...o,
        isSelectedForQuote: o.id === optionId,
      })),
    );
  }, []);

  // ── Render: stepper view ────────────────────────────────────────────────────

  if (activeOption != null) {
    return (
      <InstallationSpecificationStepper
        onBack={handleStepperBack}
        onCorrectSurvey={onCorrectSurvey}
        canonicalCurrentSystem={canonicalCurrentSystem}
        seedProposedSystem={activeOption.source === 'atlas_recommendation' ? seedProposedSystem : null}
        floorPlanUri={floorPlanUri}
        scanObjectPins={scanObjectPins}
        optionId={activeOption.id}
        optionLabel={activeOption.label}
        optionCreatedAt={activeOption.createdAt}
        optionSource={activeOption.source}
        optionIsRecommended={activeOption.isRecommended}
        initialPlan={activeOption.specification.proposedSpec != null ? activeOption.specification : undefined}
        onFinish={handleStepperFinish}
      />
    );
  }

  // ── Render: option list ─────────────────────────────────────────────────────

  const selectedOption = options.find((o) => o.isSelectedForQuote);
  const recommendedOption = options.find((o) => o.isRecommended);

  return (
    <div className="qp-page" data-testid="spec-options-list">
      <div className="qp-content">
        <h2 className="qp-step-heading">Installation Specification</h2>
        <p className="qp-step-subheading">
          Specification options for this visit
        </p>

        {options.length > 0 && (
          <div className="spec-options-list" data-testid="spec-option-cards">
            {options.map((opt) => {
              const isSelected = opt.isSelectedForQuote;
              const isRecommended = opt.isRecommended;
              const scopeCount = opt.generatedScope.length;
              const decisionsCount = opt.generatedScope.filter((i) => i.needsVerification).length;

              return (
                <div
                  key={opt.id}
                  className={`spec-option-card${isSelected ? ' spec-option-card--selected' : ''}`}
                  data-testid={`spec-option-card-${opt.id}`}
                >
                  <div className="spec-option-card__header">
                    <span className="spec-option-card__label">{opt.label}</span>
                    {isRecommended && (
                      <span className="spec-option-card__badge spec-option-card__badge--recommended">
                        Atlas selected
                      </span>
                    )}
                    {isSelected && (
                      <span className="spec-option-card__badge spec-option-card__badge--selected-for-output">
                        Selected for output
                      </span>
                    )}
                  </div>
                  <div className="spec-option-card__meta">
                    <span className="spec-option-card__status">{statusLabel(opt.status)}</span>
                    {scopeCount > 0 && (
                      <span className="spec-option-card__scope-count">
                        Generated install scope: {scopeCount} item{scopeCount !== 1 ? 's' : ''}
                        {decisionsCount > 0 && (
                          <span className="spec-option-card__decisions-needed">
                            {' '}· {decisionsCount} decision{decisionsCount !== 1 ? 's' : ''} needed
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="spec-option-card__actions">
                    <button
                      type="button"
                      className="spec-option-card__btn"
                      onClick={() => setActiveOptionId(opt.id)}
                      data-testid={`open-option-btn-${opt.id}`}
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      className="spec-option-card__btn spec-option-card__btn--secondary"
                      onClick={() => handleDuplicateOption(opt)}
                      data-testid={`duplicate-option-btn-${opt.id}`}
                    >
                      Duplicate option
                    </button>
                    {!isSelected && (
                      <button
                        type="button"
                        className="spec-option-card__btn spec-option-card__btn--secondary"
                        onClick={() => handleMarkSelected(opt.id)}
                        data-testid={`select-option-btn-${opt.id}`}
                      >
                        Mark as selected
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!selectedOption && !recommendedOption && options.length > 0 && (
          <p className="qp-context-hint" data-testid="no-selected-option-hint">
            No selected specification option yet
          </p>
        )}

        <div className="spec-options-actions">
          <button
            type="button"
            className="qp-nav__next"
            onClick={handleAddOption}
            data-testid="add-specification-option-btn"
          >
            Add specification option
          </button>
        </div>
      </div>

      <div className="qp-nav">
        <button type="button" className="qp-nav__back" onClick={onBack}>
          ← Back
        </button>
      </div>
    </div>
  );
}

