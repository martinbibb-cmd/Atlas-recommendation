/**
 * QuadrantDashboardPage.tsx
 *
 * PR8a — 4-quadrant visual dashboard for the first presentation page.
 *
 * Layout: fixed 2 × 2 grid (no scrolling on iPad).
 * Each tile is an image-first OverviewInsightCard. Tapping expands a detail panel.
 *
 * Card shape (collapsed):
 *   [media area — 140 px — photo / illustration / silhouettes]
 *   title
 *   chips (2–3 strongest facts)
 *   one-liner summary
 *   [takeaway strip — visually distinct]
 *
 * Rules:
 *   - No Math.random()
 *   - All strings sourced from canonical model signals or PrioritiesState
 *   - shellSnapshotUrl shown when available; data-driven fallback otherwise
 *   - No PresentationVisualSlot colour-square on the system card
 */

import { useState } from 'react';
import type { HouseSignal, HomeSignal, CurrentSystemSignal, ObjectivesSignal, EnergySignal } from './buildCanonicalPresentation';
import type { HeatLossState } from '../../features/survey/heatLoss/heatLossTypes';
import type { PrioritiesState, PriorityKey } from '../../features/survey/priorities/prioritiesTypes';
import { PRIORITY_META } from '../../features/survey/priorities/prioritiesTypes';
import type { EngineInputV2_3 } from '../../engine/schema/EngineInputV2_3';
import OccupantSilhouettes from './OccupantSilhouettes';
import OverviewInsightCard from './OverviewInsightCard';
import { imageForControlFamily, imageForZoneLayout, imageForPipeLayout } from '../../ui/systemImages/systemImageMap';
import { SystemRealWorldImage } from '../systemImages/SystemRealWorldImage';
import { getOverviewSystemVisual, type OverviewSystemVisualKey } from '../../config/visualRegistry';
import type { SystemConceptModel } from '../../explainers/lego/model/types';
import SystemArchitectureVisualiser from '../../explainers/lego/autoBuilder/SystemArchitectureVisualiser';
import './QuadrantDashboardPage.css';

// ─── System visual registry helper ───────────────────────────────────────────

/**
 * Derive the overview visual registry key from the current system signals.
 * Returns null when no registry entry exists for the given combination.
 */
function systemVisualKeyFromSignal(
  heatSource: CurrentSystemSignal['currentHeatSourceType'],
  dhwType?: CurrentSystemSignal['systemDhwType'],
): OverviewSystemVisualKey | null {
  if (heatSource == null || heatSource === 'other') return null;
  if (heatSource === 'ashp') return 'overview_system_heat_pump';
  if (heatSource === 'combi') return 'overview_system_combi';
  if (heatSource === 'system') {
    return dhwType === 'unvented' ? 'overview_system_system_unvented' : 'overview_system_system';
  }
  if (heatSource === 'regular') {
    return dhwType === 'open_vented' ? 'overview_system_regular_vented' : 'overview_system_regular';
  }
  return null;
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
  const bathroomCount = input?.bathroomCount;
  const bedroomCount = input?.bedrooms;

  // Build chips: heat loss (primary) + up to 2 secondary facts
  const chips: string[] = [house.heatLossLabel];
  if (bathroomCount != null) chips.push(`${bathroomCount} bath`);
  if (roofOrientation && roofOrientation !== 'unknown') chips.push(`Roof ${roofOrientation}`);

  // Summary: wall type + insulation
  const summary = `${house.wallTypeLabel} · ${house.insulationLabel}`;

  // Takeaway: first note if any, otherwise heat-loss band
  const takeaway = house.notes.length > 0
    ? house.notes[0]
    : house.heatLossBand;
  const tone = house.notes.length > 0 ? 'caution' as const : 'neutral' as const;

  // Media: shell snapshot when available; heat-loss data panel otherwise
  const mediaContent = snapshot ? (
    <img src={snapshot} alt="House perimeter sketch" className="oic__media-img" />
  ) : (
    <div className="oic__media-heatloss">
      <span className="oic__media-heatloss__value">{house.heatLossLabel}</span>
      <span className="oic__media-heatloss__band">{house.heatLossBand}</span>
    </div>
  );

  const detailContent = (
    <>
      <p className="oic-detail__row"><strong>Heat loss:</strong> {house.heatLossLabel} — {house.heatLossBand}</p>
      <p className="oic-detail__row"><strong>Walls:</strong> {house.wallTypeLabel}</p>
      <p className="oic-detail__row"><strong>Insulation:</strong> {house.insulationLabel}</p>
      {bedroomCount != null && (
        <p className="oic-detail__row"><strong>Bedrooms:</strong> {bedroomCount}</p>
      )}
      {bathroomCount != null && (
        <p className="oic-detail__row"><strong>Bathrooms:</strong> {bathroomCount}</p>
      )}
      {house.roofOrientationLabel && (
        <p className="oic-detail__row"><strong>Roof orientation:</strong> {house.roofOrientationLabel}</p>
      )}
      {house.roofTypeLabel && (
        <p className="oic-detail__row"><strong>Roof type:</strong> {house.roofTypeLabel}</p>
      )}
      {house.pvPotentialLabel && (
        <p className="oic-detail__row"><strong>Solar potential:</strong> {house.pvPotentialLabel}</p>
      )}
      {energy && (
        <>
          <p className="oic-detail__row"><strong>PV status:</strong> {energy.pvStatusLabel}</p>
          <p className="oic-detail__row"><strong>Battery:</strong> {energy.batteryStatusLabel}</p>
          <p className="oic-detail__row"><strong>Energy alignment:</strong> {energy.energyAlignmentLabel}</p>
          <p className="oic-detail__row"><strong>Solar storage:</strong> {energy.solarStorageOpportunityLabel}</p>
          {energy.narrativeSignals.map((sig, i) => (
            <p key={i} className="oic-detail__note">{sig}</p>
          ))}
        </>
      )}
      {house.notes.map((note, i) => (
        <p key={i} className="oic-detail__note">⚠ {note}</p>
      ))}
    </>
  );

  return (
    <OverviewInsightCard
      title="Your House"
      chips={chips}
      summary={summary}
      takeaway={takeaway}
      tone={tone}
      mediaContent={mediaContent}
      mediaBg={snapshot ? '#f7fafc' : '#ebf8ff'}
      expanded={expanded}
      onToggle={onToggle}
      detailContent={detailContent}
      ariaLabel="Your House — tap to expand"
      detailAriaLabel="House details"
      colorClass="oic--house"
    />
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
  const occupancyCount = input?.occupancyCount ?? 1;

  // Build chips: demand profile (primary) + occupancy + timing
  const chips: string[] = [home.demandProfileLabel];
  chips.push(`${occupancyCount} ${occupancyCount === 1 ? 'person' : 'people'}`);
  if (home.occupancyTimingLabel) chips.push(home.occupancyTimingLabel);

  const summary = home.bathUseIntensityLabel;
  const takeaway = home.storageBenefitLabel;

  const mediaContent = (
    <div className="oic__media-people">
      <OccupantSilhouettes
        composition={input?.householdComposition}
        occupancyCount={occupancyCount}
      />
    </div>
  );

  const detailContent = (
    <>
      <p className="oic-detail__row"><strong>Daily hot water:</strong> {home.dailyHotWaterLabel}</p>
      <p className="oic-detail__row"><strong>Peak outlets:</strong> {home.peakOutletsLabel}</p>
      <p className="oic-detail__row"><strong>Bath / shower:</strong> {home.bathUseIntensityLabel}</p>
      <p className="oic-detail__row"><strong>Occupancy timing:</strong> {home.occupancyTimingLabel}</p>
      <p className="oic-detail__row"><strong>Storage benefit:</strong> {home.storageBenefitLabel}</p>
      {home.narrativeSignals.map((sig, i) => (
        <p key={i} className="oic-detail__note">{sig}</p>
      ))}
    </>
  );

  return (
    <OverviewInsightCard
      title="Your Home"
      chips={chips}
      summary={summary}
      takeaway={takeaway}
      tone="neutral"
      mediaContent={mediaContent}
      mediaBg="#f0fff4"
      expanded={expanded}
      onToggle={onToggle}
      detailContent={detailContent}
      ariaLabel="Your Home — tap to expand"
      detailAriaLabel="Home details"
      colorClass="oic--home"
    />
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
  const controlSchematicImage = imageForControlFamily(sys.controlFamilyRaw);
  const zoneLayoutImage       = imageForZoneLayout(sys.controlFamilyRaw);
  const pipeLayoutImage       = imageForPipeLayout(sys.pipeLayoutRaw);

  // Resolve the system photo from the visual registry (semantic key → src + alt).
  const visualKey = systemVisualKeyFromSignal(sys.currentHeatSourceType, sys.systemDhwType);
  const registryImage = visualKey != null ? getOverviewSystemVisual(visualKey) : null;

  // Build chips: system type (primary) + age
  const chips: string[] = [];
  if (sys.systemTypeLabel != null) chips.push(sys.systemTypeLabel);
  if (sys.ageLabel != null) chips.push(sys.ageLabel);

  const summary = sys.ageContext;

  // Takeaway: first warn condition pill, or ageContext
  const warnPill = sys.conditionSignalPills.find(p => p.status === 'warn');
  const takeaway = warnPill?.label ?? sys.ageContext;
  const tone = warnPill != null ? 'caution' as const : 'neutral' as const;

  // Media: system architecture visualiser provides the richest technical diagram.
  // Registry image (from visualRegistry.ts) is kept as fallback for edge cases
  // where no concept model is built.
  const mediaContent = currentSystemConcept != null ? (
    <SystemArchitectureVisualiser mode="current" currentSystem={currentSystemConcept} />
  ) : registryImage != null ? (
    <img src={registryImage.src} alt={registryImage.alt} className="oic__media-img" />
  ) : null;

  const mediaBg = '#fef9f0';

  const detailContent = (
    <>
      {sys.systemTypeLabel != null && (
        <p className="oic-detail__row"><strong>Type:</strong> {sys.systemTypeLabel}</p>
      )}
      {sys.ageLabel != null && (
        <p className="oic-detail__row"><strong>Age:</strong> {sys.ageLabel}</p>
      )}
      <p className="oic-detail__row oic-detail__row--muted">{sys.ageContext}</p>
      {sys.makeModelText && (
        <p className="oic-detail__row"><strong>Make / model:</strong> {sys.makeModelText}</p>
      )}
      {sys.outputLabel && (
        <p className="oic-detail__row"><strong>Output:</strong> {sys.outputLabel}</p>
      )}
      {sys.emittersLabel != null && (
        <p className="oic-detail__row"><strong>Emitters:</strong> {sys.emittersLabel}</p>
      )}
      {sys.controlFamilyLabel != null && (
        <p className="oic-detail__row">
          <strong>Controls:</strong> {sys.controlFamilyLabel}
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
        <p className="oic-detail__row"><strong>Programmer:</strong> {sys.programmerTypeLabel}</p>
      )}
      {sys.pipeLayoutLabel != null && (
        <p className="oic-detail__row"><strong>Pipework:</strong> {sys.pipeLayoutLabel}</p>
      )}
      {pipeLayoutImage && (
        <SystemRealWorldImage image={pipeLayoutImage} testId="pipe-layout-image" />
      )}
      {sys.sedbukBandLabel != null && (
        <p className="oic-detail__row"><strong>Efficiency band:</strong> {sys.sedbukBandLabel}</p>
      )}
      {sys.serviceHistoryLabel != null && (
        <p className="oic-detail__row"><strong>Service history:</strong> {sys.serviceHistoryLabel}</p>
      )}
      {sys.heatingSystemTypeLabel != null && (
        <p className="oic-detail__row"><strong>Circuit type:</strong> {sys.heatingSystemTypeLabel}</p>
      )}
      {sys.pipeworkAccessLabel != null && (
        <p className="oic-detail__row"><strong>Pipework access:</strong> {sys.pipeworkAccessLabel}</p>
      )}
      {sys.conditionSignalPills.length > 0 && (
        <div className="oic-detail__condition-pills">
          {sys.conditionSignalPills.map((pill, i) => (
            <span
              key={i}
              className={`oic-condition-pill oic-condition-pill--${pill.status}`}
            >
              {pill.label}
            </span>
          ))}
        </div>
      )}
    </>
  );

  return (
    <OverviewInsightCard
      title="Your System"
      chips={chips}
      summary={summary}
      takeaway={takeaway}
      tone={tone}
      mediaContent={mediaContent}
      mediaBg={mediaBg}
      expanded={expanded}
      onToggle={onToggle}
      detailContent={detailContent}
      ariaLabel="Your System — tap to expand"
      detailAriaLabel="System details"
      colorClass="oic--system"
    />
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

  // Top 3 chips for collapsed view
  const chips: string[] = selected.length > 0
    ? selected.slice(0, 3).map(key => PRIORITY_LABEL[key] ?? key)
    : fallbackPriorities.slice(0, 3).map(p => p.label);

  // Summary: first priority sub-text, or a neutral fallback
  const firstMeta = selected.length > 0
    ? PRIORITY_META.find(m => m.key === selected[0])
    : undefined;
  const summary = firstMeta?.sub ?? (
    selected.length === 0
      ? 'No preferences recorded yet — complete the Priorities step to personalise this section.'
      : ''
  );

  // Takeaway: second priority sub-text, or how priorities bias recommendations
  const secondMeta = selected.length > 1
    ? PRIORITY_META.find(m => m.key === selected[1])
    : undefined;
  const takeaway = secondMeta?.sub ?? (
    selected.length > 0 ? 'Preferences will shape which options are highlighted.' : ''
  );

  // Media: visual grid of priority pills
  const mediaPills = selected.length > 0
    ? selected.slice(0, 4).map(key => PRIORITY_LABEL[key] ?? key)
    : fallbackPriorities.slice(0, 4).map(p => p.label);

  const mediaContent = mediaPills.length > 0 ? (
    <div className="oic__media-priorities">
      {mediaPills.map((label, i) => (
        <span key={i} className="oic__media-priority-pill">{label}</span>
      ))}
    </div>
  ) : null;

  const detailContent = (
    <>
      {selected.length > 0 ? (
        PRIORITY_META.filter(m => selected.includes(m.key)).map(m => (
          <div key={m.key} className="oic-detail__priority-row">
            <span className="oic-detail__priority-label">{m.emoji} {m.label}</span>
            <span className="oic-detail__priority-sub">{m.sub}</span>
          </div>
        ))
      ) : fallbackPriorities.length > 0 ? (
        fallbackPriorities.map(priority => (
          <div key={priority.label} className="oic-detail__priority-row">
            <span className="oic-detail__priority-label">{priority.label}</span>
            <span className="oic-detail__priority-sub">{priority.value}</span>
          </div>
        ))
      ) : (
        <p className="oic-detail__row oic-detail__row--muted">
          No priorities are on record yet — complete the Priorities step to personalise this section.
        </p>
      )}
    </>
  );

  return (
    <OverviewInsightCard
      title="Your Priorities"
      chips={chips}
      summary={summary}
      takeaway={takeaway}
      tone="neutral"
      mediaContent={mediaContent}
      expanded={expanded}
      onToggle={onToggle}
      detailContent={detailContent}
      ariaLabel="Your Priorities — tap to expand"
      detailAriaLabel="Priority details"
      colorClass="oic--priorities"
    />
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
