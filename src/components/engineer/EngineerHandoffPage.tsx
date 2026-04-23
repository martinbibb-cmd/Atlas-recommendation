/**
 * EngineerHandoffPage.tsx
 *
 * PR7 — Dedicated engineer-first handoff surface.
 *
 * Reads from canonical AtlasDecisionV1 + ScenarioResult[] truth via
 * buildEngineerHandoff(). No customer narrative structure — this page is
 * operational and install-oriented.
 *
 * Page order:
 *   1. Job summary       — what is being installed
 *   2. Included scope    — what is included + required works
 *   3. Existing system   — what was there before
 *   4. Measured facts    — surveyed and engine-derived values
 *   5. Warnings          — compatibility warnings + key reasons
 *   6. Install notes     — pre-install operational notes + future path
 *   7. Layout overview   — room count, named spaces, measurements
 *   8. Objects           — key components and dimensions
 *   9. Routes            — existing / proposed / assumed routes
 *
 * Data source: AtlasDecisionV1 + ScenarioResult[] passed in as props.
 * Optional PropertyPlan provides spatial layout data for sections 7–9.
 * The builder runs synchronously — no async data fetching in this component.
 */

import type { AtlasDecisionV1 } from '../../contracts/AtlasDecisionV1';
import type { ScenarioResult } from '../../contracts/ScenarioResult';
import type { EngineInputV2_3Contract } from '../../contracts/EngineInputV2_3';
import type { PropertyPlan } from '../floorplan/propertyPlan.types';
import { buildEngineerHandoff } from '../../engine/modules/buildEngineerHandoff';
import { JobSummarySection }      from './sections/JobSummarySection';
import { IncludedScopeSection }   from './sections/IncludedScopeSection';
import { ExistingSystemSection }  from './sections/ExistingSystemSection';
import { MeasuredFactsSection }   from './sections/MeasuredFactsSection';
import { WarningsSection }        from './sections/WarningsSection';
import { InstallNotesSection }    from './sections/InstallNotesSection';
import { LayoutOverviewSection }  from './sections/LayoutOverviewSection';
import { ObjectsSection }         from './sections/ObjectsSection';
import { RoutesSection }          from './sections/RoutesSection';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /** The canonical Atlas decision for this job. */
  decision: AtlasDecisionV1;
  /** All evaluated scenario options for this job. */
  scenarios: ScenarioResult[];
  /** Optional engine input — surfaces measured facts not already in decision. */
  engineInput?: EngineInputV2_3Contract;
  /** Optional floor-plan model — surfaces spatial layout sections when present. */
  propertyPlan?: PropertyPlan;
  /** Called when the user navigates back. */
  onBack?: () => void;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function EngineerHandoffPage({ decision, scenarios, engineInput, propertyPlan, onBack }: Props) {
  const handoff = buildEngineerHandoff(decision, scenarios, engineInput, propertyPlan);

  return (
    <div
      data-testid="engineer-handoff-page"
      style={{
        maxWidth: '720px',
        margin: '0 auto',
        padding: '1rem 1rem 3rem',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Header bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        marginBottom: '1rem',
        padding: '0.5rem 0',
        borderBottom: '1px solid #e2e8f0',
      }}>
        {onBack && (
          <button
            aria-label="Back"
            onClick={onBack}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.9rem',
              color: '#4a5568',
              padding: '0.25rem 0.5rem',
              borderRadius: '4px',
            }}
          >
            ←
          </button>
        )}
        <span style={{
          fontSize: '0.8rem',
          fontWeight: 700,
          color: '#718096',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}>
          Engineer handoff
        </span>
      </div>

      {/* 1. Job summary */}
      <JobSummarySection jobSummary={handoff.jobSummary} />

      {/* 2. Included scope + required works */}
      <IncludedScopeSection
        includedScope={handoff.includedScope}
        requiredWorks={handoff.requiredWorks}
      />

      {/* 3. Existing system */}
      <ExistingSystemSection existingSystem={handoff.existingSystem} />

      {/* 4. Measured facts */}
      <MeasuredFactsSection measuredFacts={handoff.measuredFacts} />

      {/* 5. Compatibility warnings + key reasons */}
      <WarningsSection
        compatibilityWarnings={handoff.compatibilityWarnings}
        keyReasons={handoff.keyReasons}
      />

      {/* 6. Install notes + future path */}
      <InstallNotesSection
        installNotes={handoff.installNotes}
        futurePath={handoff.futurePath}
      />

      {/* 7. Spatial layout — overview, objects, routes */}
      <LayoutOverviewSection layout={handoff.layout} layoutSummary={handoff.layoutSummary} />
      <ObjectsSection layout={handoff.layout} />
      <RoutesSection  layout={handoff.layout} />
    </div>
  );
}
