// src/components/simulator/SystemUpgradeComparisonPanel.tsx
//
// The PR 6 "money shot" comparison panel.
//
// Renders, for the selected system:
//   1. Chosen system header
//   2. Simple install card
//   3. Suggested upgrades strip
//   4. Best-fit install card
//   5. Headline improvements
//
// Uses existing PR 5 engine outputs only — no new physics logic.

import type { ResimulationResult } from '../../logic/resimulation/types';
import type { RecommendedUpgradePackage } from '../../logic/upgrades/types';
import OutcomeSummaryCard from './OutcomeSummaryCard';
import UpgradeListPanel from './UpgradeListPanel';
import './SystemUpgradeComparisonPanel.css';

interface SystemUpgradeComparisonPanelProps {
  /** Full re-simulation result from PR 5. */
  resimulation: ResimulationResult;
  /** Upgrade package from PR 4. */
  upgradePackage: RecommendedUpgradePackage;
  /** Human-readable label for the recommended system. */
  recommendedSystemLabel: string;
  /** Short fit-summary subtitle. */
  fitSummary: string;
}

// ─── Narrative summaries ──────────────────────────────────────────────────────

function buildSimpleInstallSummary(
  resimulation: ResimulationResult,
): string {
  const { hotWater, heating } = resimulation.simpleInstall;
  if (hotWater.conflict > 0 || heating.outsideTargetEventCount > 0) {
    return 'Works, but busy periods may feel tighter.';
  }
  if (hotWater.reduced > 0) {
    return 'Handles most demand well; some draws may feel slightly reduced.';
  }
  return 'Meets typical demand comfortably.';
}

function buildBestFitSummary(
  resimulation: ResimulationResult,
): string {
  const { hotWater, heating } = resimulation.bestFitInstall;
  const { headlineImprovements } = resimulation.comparison;
  if (headlineImprovements.length === 0) {
    return 'Already well-matched — upgrades maintain performance.';
  }
  if (hotWater.conflict === 0 && heating.outsideTargetEventCount === 0) {
    return 'Better matched to clustered demand and evening recovery.';
  }
  return 'Improved outcome with upgrades applied.';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SystemUpgradeComparisonPanel({
  resimulation,
  upgradePackage,
  recommendedSystemLabel,
  fitSummary,
}: SystemUpgradeComparisonPanelProps) {
  const { headlineImprovements } = resimulation.comparison;
  const simpleSummary  = buildSimpleInstallSummary(resimulation);
  const bestFitSummary = buildBestFitSummary(resimulation);

  return (
    <section
      className="system-upgrade-comparison-panel"
      aria-label="System upgrade comparison"
      data-testid="system-upgrade-comparison-panel"
    >
      {/* ── 1. Chosen system header ──────────────────────────────────── */}
      <div className="system-upgrade-comparison-panel__header">
        <div className="system-upgrade-comparison-panel__system-label">
          {recommendedSystemLabel}
        </div>
        <p className="system-upgrade-comparison-panel__fit-summary">{fitSummary}</p>
      </div>

      {/* ── 5. Headline improvements (shown above the cards when present) */}
      {headlineImprovements.length > 0 && (
        <div className="system-upgrade-comparison-panel__headlines" data-testid="headline-improvements">
          <div className="system-upgrade-comparison-panel__headlines-label">
            What the upgrades deliver
          </div>
          <ul className="system-upgrade-comparison-panel__headlines-list">
            {headlineImprovements.map((item, idx) => (
              <li key={idx} className="system-upgrade-comparison-panel__headline-item">
                <span className="system-upgrade-comparison-panel__headline-icon" aria-hidden="true">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Layout: [simple install] [upgrades] [best-fit install] ─── */}
      <div className="system-upgrade-comparison-panel__layout">

        {/* ── 2. Simple install card ─────────────────────────────────── */}
        <OutcomeSummaryCard
          variant="simple"
          outcome={resimulation.simpleInstall}
          summary={simpleSummary}
        />

        {/* ── 3. Suggested upgrades strip ───────────────────────────── */}
        <UpgradeListPanel upgradePackage={upgradePackage} />

        {/* ── 4. Best-fit install card ───────────────────────────────── */}
        <OutcomeSummaryCard
          variant="best-fit"
          outcome={resimulation.bestFitInstall}
          summary={bestFitSummary}
        />
      </div>
    </section>
  );
}
