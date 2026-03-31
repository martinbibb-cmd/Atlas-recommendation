/**
 * QuadrantDashboardPage.tsx
 *
 * PR8a — 4-quadrant visual dashboard for the first presentation page.
 *
 * Layout: fixed 2 × 2 grid (no scrolling on iPad).
 * Each tile is tappable to expand an inline detail panel.
 *
 * Quadrant content:
 *   Your House    — perimeter snapshot · house type · heat loss · solar hint · energy/PV
 *   Your Home     — demand profile · daily litres · peak outlets
 *   Your System   — current system type · age badge · strengths / weaknesses
 *   Your Priorities — priority chips
 *
 * Rules:
 *   - No Math.random()
 *   - All strings sourced from canonical model signals or PrioritiesState
 *   - shellSnapshotUrl shown when available; text-only fallback otherwise
 */

import { useState, type KeyboardEvent } from 'react';
import type { HouseSignal, HomeSignal, CurrentSystemSignal, ObjectivesSignal, EnergySignal } from './buildCanonicalPresentation';
import type { HeatLossState } from '../../features/survey/heatLoss/heatLossTypes';
import type { PrioritiesState, PriorityKey } from '../../features/survey/priorities/prioritiesTypes';
import { PRIORITY_META } from '../../features/survey/priorities/prioritiesTypes';
import type { EngineInputV2_3 } from '../../engine/schema/EngineInputV2_3';
import PresentationVisualSlot from './PresentationVisualSlot';
import OccupantSilhouettes from './OccupantSilhouettes';
import { imageForCurrentSystem, imageForOptionId, imageForControlFamily, imageForZoneLayout, imageForPipeLayout } from '../../ui/systemImages/systemImageMap';
import { SystemRealWorldImage } from '../systemImages/SystemRealWorldImage';
import type { SystemConceptModel } from '../../explainers/lego/model/types';
import SystemArchitectureVisualiser from '../../explainers/lego/autoBuilder/SystemArchitectureVisualiser';
import './QuadrantDashboardPage.css';

function onTileKeyDown(event: KeyboardEvent<HTMLElement>, onToggle: () => void) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    onToggle();
  }
}

// ─── House quadrant ───────────────────────────────────────────────────────────

function HouseQuadrant({
  house,
  energy,
  heatLossState,
  input,
  expanded,
  onToggle,
}: {
  house: HouseSignal;
  energy?: EnergySignal;
  heatLossState?: HeatLossState;
  input?: EngineInputV2_3;
  expanded: boolean;
  onToggle: () => void;
}) {
  const snapshot = heatLossState?.shellSnapshotUrl;
  const roofOrientation = heatLossState?.roofOrientation;
  const solarHint = house.pvPotentialLabel;
  const bathroomCount = input?.bathroomCount;
  const bedroomCount = input?.bedrooms;

  return (
    <div
      role="button"
      tabIndex={0}
      className={`qdp-quadrant qdp-quadrant--house${expanded ? ' qdp-quadrant--expanded' : ''}`}
      onClick={onToggle}
      onKeyDown={event => onTileKeyDown(event, onToggle)}
      aria-expanded={expanded}
      aria-label="Your House — tap to expand"
    >
      <div className="qdp-quadrant__header">
        <span className="qdp-quadrant__icon" aria-hidden="true">🏠</span>
        <span className="qdp-quadrant__title">Your House</span>
        {expanded && (
          <button type="button" className="qdp-quadrant__close" onClick={e => { e.stopPropagation(); onToggle(); }}>
            Close
          </button>
        )}
      </div>

      {/* Visual: perimeter snapshot when available */}
      {snapshot && (
        <div className="qdp-quadrant__visual">
          <img
            src={snapshot}
            alt="House perimeter sketch"
            className="qdp-quadrant__snapshot"
          />
        </div>
      )}

      {/* Summary row */}
      <div className="qdp-quadrant__summary">
        <span className="qdp-quadrant__badge">{house.heatLossLabel}</span>
        {bedroomCount != null && (
          <span className="qdp-quadrant__badge qdp-quadrant__badge--secondary">
            {bedroomCount} bed
          </span>
        )}
        {bathroomCount != null && (
          <span className="qdp-quadrant__badge qdp-quadrant__badge--secondary">
            {bathroomCount} bath
          </span>
        )}
        {roofOrientation && roofOrientation !== 'unknown' && (
          <span className="qdp-quadrant__badge qdp-quadrant__badge--secondary">
            Roof {roofOrientation}
          </span>
        )}
      </div>

      {/* Collapsed: wall type + insulation, issues as chips */}
      {!expanded && (
        <>
          <p className="qdp-quadrant__collapsed-copy">
            {house.wallTypeLabel} · {house.insulationLabel}
          </p>
          {house.notes.length > 0 && (
            <div className="qdp-house__issues">
              {house.notes.map((note, i) => (
                <span key={i} className="qdp-issue-chip">⚠ {note}</span>
              ))}
            </div>
          )}
        </>
      )}

      {expanded && (
        <div className="qdp-quadrant__detail" role="region" aria-label="House details">
          <p className="qdp-detail__row"><strong>Heat loss:</strong> {house.heatLossLabel} — {house.heatLossBand}</p>
          <p className="qdp-detail__row"><strong>Walls:</strong> {house.wallTypeLabel}</p>
          <p className="qdp-detail__row"><strong>Insulation:</strong> {house.insulationLabel}</p>
          {bedroomCount != null && (
            <p className="qdp-detail__row"><strong>Bedrooms:</strong> {bedroomCount}</p>
          )}
          {bathroomCount != null && (
            <p className="qdp-detail__row"><strong>Bathrooms:</strong> {bathroomCount}</p>
          )}
          {house.roofOrientationLabel && (
            <p className="qdp-detail__row"><strong>Roof orientation:</strong> {house.roofOrientationLabel}</p>
          )}
          {house.roofTypeLabel && (
            <p className="qdp-detail__row"><strong>Roof type:</strong> {house.roofTypeLabel}</p>
          )}
          {solarHint && <p className="qdp-detail__row"><strong>Solar potential:</strong> {solarHint}</p>}
          {energy && (
            <>
              <p className="qdp-detail__row"><strong>PV status:</strong> {energy.pvStatusLabel}</p>
              <p className="qdp-detail__row"><strong>Battery:</strong> {energy.batteryStatusLabel}</p>
              <p className="qdp-detail__row"><strong>Energy alignment:</strong> {energy.energyAlignmentLabel}</p>
              <p className="qdp-detail__row"><strong>Solar storage:</strong> {energy.solarStorageOpportunityLabel}</p>
              {energy.narrativeSignals.map((sig, i) => (
                <p key={i} className="qdp-detail__note">{sig}</p>
              ))}
            </>
          )}
          {house.notes.map((note, i) => (
            <p key={i} className="qdp-detail__note">⚠ {note}</p>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Home quadrant ────────────────────────────────────────────────────────────

function HomeQuadrant({
  home,
  input,
  expanded,
  onToggle,
}: {
  home: HomeSignal;
  input?: EngineInputV2_3;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      className={`qdp-quadrant qdp-quadrant--home${expanded ? ' qdp-quadrant--expanded' : ''}`}
      onClick={onToggle}
      onKeyDown={event => onTileKeyDown(event, onToggle)}
      aria-expanded={expanded}
      aria-label="Your Home — tap to expand"
    >
      <div className="qdp-quadrant__header">
        <span className="qdp-quadrant__icon" aria-hidden="true">👥</span>
        <span className="qdp-quadrant__title">Your Home</span>
        {expanded && (
          <button type="button" className="qdp-quadrant__close" onClick={e => { e.stopPropagation(); onToggle(); }}>
            Close
          </button>
        )}
      </div>

      {/* Occupant silhouettes — sized by age group */}
      <div className="qdp-quadrant__visual qdp-quadrant__visual--people">
        <OccupantSilhouettes
          composition={input?.householdComposition}
          occupancyCount={input?.occupancyCount ?? 2}
        />
      </div>

      <div className="qdp-quadrant__summary">
        <span className="qdp-quadrant__badge">{home.demandProfileLabel}</span>
      </div>

      {!expanded && (
        <div className="qdp-home__collapsed">
          <p className="qdp-quadrant__collapsed-copy">{home.bathUseIntensityLabel}</p>
          <p className="qdp-quadrant__collapsed-copy">{home.dailyHotWaterLabel}</p>
        </div>
      )}

      {expanded && (
        <div className="qdp-quadrant__detail" role="region" aria-label="Home details">
          <p className="qdp-detail__row"><strong>Daily hot water:</strong> {home.dailyHotWaterLabel}</p>
          <p className="qdp-detail__row"><strong>Peak outlets:</strong> {home.peakOutletsLabel}</p>
          <p className="qdp-detail__row"><strong>Bath / shower:</strong> {home.bathUseIntensityLabel}</p>
          <p className="qdp-detail__row"><strong>Occupancy timing:</strong> {home.occupancyTimingLabel}</p>
          <p className="qdp-detail__row"><strong>Storage benefit:</strong> {home.storageBenefitLabel}</p>
          {home.narrativeSignals.map((sig, i) => (
            <p key={i} className="qdp-detail__note">{sig}</p>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── System quadrant ──────────────────────────────────────────────────────────

function SystemQuadrant({
  sys,
  currentSystemConcept,
  expanded,
  onToggle,
}: {
  sys: CurrentSystemSignal;
  currentSystemConcept?: SystemConceptModel;
  expanded: boolean;
  onToggle: () => void;
}) {
  const image = sys.currentHeatSourceType === 'ashp'
    ? imageForOptionId('ashp')
    : imageForCurrentSystem(
      sys.currentHeatSourceType === 'other' || sys.currentHeatSourceType == null ? null : sys.currentHeatSourceType,
      sys.systemDhwType,
    );

  const controlSchematicImage = imageForControlFamily(sys.controlFamilyRaw);
  const zoneLayoutImage       = imageForZoneLayout(sys.controlFamilyRaw);
  const pipeLayoutImage       = imageForPipeLayout(sys.pipeLayoutRaw);

  return (
    <div
      role="button"
      tabIndex={0}
      className={`qdp-quadrant qdp-quadrant--system${expanded ? ' qdp-quadrant--expanded' : ''}`}
      onClick={onToggle}
      onKeyDown={event => onTileKeyDown(event, onToggle)}
      aria-expanded={expanded}
      aria-label="Your System — tap to expand"
    >
      <div className="qdp-quadrant__header">
        <span className="qdp-quadrant__icon" aria-hidden="true">🔧</span>
        <span className="qdp-quadrant__title">Your System</span>
        {expanded && (
          <button type="button" className="qdp-quadrant__close" onClick={e => { e.stopPropagation(); onToggle(); }}>
            Close
          </button>
        )}
      </div>

      <div className="qdp-quadrant__visual">
        {image ? (
          <img src={image.src} alt={image.alt} className="qdp-quadrant__snapshot" />
        ) : currentSystemConcept ? (
          <SystemArchitectureVisualiser mode="current" currentSystem={currentSystemConcept} />
        ) : (
          <PresentationVisualSlot visualId="driving_style" visualData={{ mode: sys.drivingStyleMode }} hideExplainer />
        )}
      </div>

      <div className="qdp-quadrant__summary">
        {sys.systemTypeLabel != null && (
          <span className="qdp-quadrant__badge">{sys.systemTypeLabel}</span>
        )}
        {sys.ageLabel != null && (
          <span className="qdp-quadrant__badge qdp-quadrant__badge--secondary">{sys.ageLabel}</span>
        )}
      </div>

      {!expanded && <p className="qdp-quadrant__collapsed-copy">{sys.ageContext}</p>}

      {expanded && (
        <div className="qdp-quadrant__detail" role="region" aria-label="System details">
          {sys.systemTypeLabel != null && (
            <p className="qdp-detail__row"><strong>Type:</strong> {sys.systemTypeLabel}</p>
          )}
          {sys.ageLabel != null && (
            <p className="qdp-detail__row"><strong>Age:</strong> {sys.ageLabel}</p>
          )}
          <p className="qdp-detail__row qdp-detail__row--muted">{sys.ageContext}</p>
          {sys.makeModelText && (
            <p className="qdp-detail__row"><strong>Make / model:</strong> {sys.makeModelText}</p>
          )}
          {sys.outputLabel && (
            <p className="qdp-detail__row"><strong>Output:</strong> {sys.outputLabel}</p>
          )}
          {sys.emittersLabel != null && (
            <p className="qdp-detail__row"><strong>Emitters:</strong> {sys.emittersLabel}</p>
          )}
          {sys.controlFamilyLabel != null && (
            <p className="qdp-detail__row"><strong>Controls:</strong> {sys.controlFamilyLabel}
              {sys.thermostatStyleLabel != null ? ` · ${sys.thermostatStyleLabel}` : ''}
            </p>
          )}
          {controlSchematicImage && (
            <SystemRealWorldImage image={controlSchematicImage} testId="control-schematic-image" />
          )}
          {zoneLayoutImage && (
            <SystemRealWorldImage image={zoneLayoutImage} testId="zone-layout-image" />
          )}
          {sys.programmerTypeLabel != null && (
            <p className="qdp-detail__row"><strong>Programmer:</strong> {sys.programmerTypeLabel}</p>
          )}
          {sys.pipeLayoutLabel != null && (
            <p className="qdp-detail__row"><strong>Pipework:</strong> {sys.pipeLayoutLabel}</p>
          )}
          {pipeLayoutImage && (
            <SystemRealWorldImage image={pipeLayoutImage} testId="pipe-layout-image" />
          )}
          {sys.sedbukBandLabel != null && (
            <p className="qdp-detail__row"><strong>Efficiency band:</strong> {sys.sedbukBandLabel}</p>
          )}
          {sys.serviceHistoryLabel != null && (
            <p className="qdp-detail__row"><strong>Service history:</strong> {sys.serviceHistoryLabel}</p>
          )}
          {sys.heatingSystemTypeLabel != null && (
            <p className="qdp-detail__row"><strong>Circuit type:</strong> {sys.heatingSystemTypeLabel}</p>
          )}
          {sys.pipeworkAccessLabel != null && (
            <p className="qdp-detail__row"><strong>Pipework access:</strong> {sys.pipeworkAccessLabel}</p>
          )}
          {sys.conditionSignalPills.length > 0 && (
            <div className="qdp-detail__condition-pills">
              {sys.conditionSignalPills.map((pill, i) => (
                <span
                  key={i}
                  className={`qdp-condition-pill qdp-condition-pill--${pill.status}`}
                >
                  {pill.label}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Priorities quadrant ──────────────────────────────────────────────────────

/** Label map for priority keys (used as fallback when meta lookup fails). */
const PRIORITY_LABEL: Record<PriorityKey, string> = Object.fromEntries(
  PRIORITY_META.map(m => [m.key, `${m.emoji} ${m.label}`])
) as Record<PriorityKey, string>;

function PrioritiesQuadrant({
  prioritiesState,
  objectives,
  expanded,
  onToggle,
}: {
  prioritiesState?: PrioritiesState;
  objectives?: ObjectivesSignal;
  expanded: boolean;
  onToggle: () => void;
}) {
  const selected = prioritiesState?.selected ?? [];
  const fallbackPriorities = objectives?.priorities ?? [];

  return (
    <div
      role="button"
      tabIndex={0}
      className={`qdp-quadrant qdp-quadrant--priorities${expanded ? ' qdp-quadrant--expanded' : ''}`}
      onClick={onToggle}
      onKeyDown={event => onTileKeyDown(event, onToggle)}
      aria-expanded={expanded}
      aria-label="Your Priorities — tap to expand"
    >
      <div className="qdp-quadrant__header">
        <span className="qdp-quadrant__icon" aria-hidden="true">🎯</span>
        <span className="qdp-quadrant__title">Your Priorities</span>
        {expanded && (
          <button type="button" className="qdp-quadrant__close" onClick={e => { e.stopPropagation(); onToggle(); }}>
            Close
          </button>
        )}
      </div>

      <div className="qdp-quadrant__chips">
        {selected.length > 0 ? (
          selected.map(key => (
            <span key={key} className="qdp-chip">
              {PRIORITY_LABEL[key] ?? key}
            </span>
          ))
        ) : fallbackPriorities.length > 0 ? (
          fallbackPriorities.map(priority => (
            <span key={priority.label} className="qdp-chip">
              {priority.label}
            </span>
          ))
        ) : (
          <span className="qdp-chip qdp-chip--empty">No priorities selected yet</span>
        )}
      </div>

      {!expanded && selected.length === 0 && (
        <p className="qdp-quadrant__collapsed-copy">Tell us what matters most to tune recommendations.</p>
      )}

      {expanded && (
        <div className="qdp-quadrant__detail" role="region" aria-label="Priority details">
          {selected.length > 0 ? (
            PRIORITY_META.filter(m => selected.includes(m.key)).map(m => (
              <p key={m.key} className="qdp-detail__priority-row">
                <span className="qdp-detail__priority-label">{m.emoji} {m.label}</span>
                <span className="qdp-detail__priority-sub">{m.sub}</span>
              </p>
            ))
          ) : fallbackPriorities.length > 0 ? (
            fallbackPriorities.map(priority => (
              <p key={priority.label} className="qdp-detail__priority-row">
                <span className="qdp-detail__priority-label">{priority.label}</span>
                <span className="qdp-detail__priority-sub">{priority.value}</span>
              </p>
            ))
          ) : (
            <p className="qdp-detail__row qdp-detail__row--muted">
              No priorities are on record yet — complete the Priorities step to personalise this section.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface QuadrantDashboardPageProps {
  house: HouseSignal;
  home: HomeSignal;
  currentSystem: CurrentSystemSignal;
  currentSystemConcept?: SystemConceptModel;
  heatLossState?: HeatLossState;
  prioritiesState?: PrioritiesState;
  objectives?: ObjectivesSignal;
  /** Energy/PV signal from the engine output — displayed in expanded House tile. */
  energy?: EnergySignal;
  /** Engine input — used for bedrooms, bathroomCount, householdComposition. */
  input?: EngineInputV2_3;
}

type QuadrantId = 'house' | 'home' | 'system' | 'priorities';

/**
 * QuadrantDashboardPage
 *
 * Fixed 2×2 grid of tappable tiles. Tapping a tile expands its inline
 * detail panel. Only one tile can be expanded at a time.
 */
export default function QuadrantDashboardPage({
  house,
  home,
  currentSystem,
  currentSystemConcept,
  heatLossState,
  prioritiesState,
  objectives,
  energy,
  input,
}: QuadrantDashboardPageProps) {
  const [expanded, setExpanded] = useState<QuadrantId | null>(null);

  function toggle(id: QuadrantId) {
    setExpanded(prev => (prev === id ? null : id));
  }

  return (
    <div
      className="qdp"
      data-testid="quadrant-dashboard-page"
      aria-label="Summary dashboard — Your House, Home, System and Objectives"
    >
      <HouseQuadrant
        house={house}
        energy={energy}
        heatLossState={heatLossState}
        input={input}
        expanded={expanded === 'house'}
        onToggle={() => toggle('house')}
      />
      <HomeQuadrant
        home={home}
        input={input}
        expanded={expanded === 'home'}
        onToggle={() => toggle('home')}
      />
      <SystemQuadrant
        sys={currentSystem}
        currentSystemConcept={currentSystemConcept}
        expanded={expanded === 'system'}
        onToggle={() => toggle('system')}
      />
      <PrioritiesQuadrant
        prioritiesState={prioritiesState}
        objectives={objectives}
        expanded={expanded === 'priorities'}
        onToggle={() => toggle('priorities')}
      />
    </div>
  );
}
