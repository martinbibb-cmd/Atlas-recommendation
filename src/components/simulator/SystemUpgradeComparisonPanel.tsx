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
    return 'Works for lighter demand, but busy periods may feel tighter.';
  }
  if (hotWater.reduced > 0) {
    return 'Handles most demand well; some outlets may deliver reduced flow during peak times.';
  }
  return 'Meets typical demand comfortably.';
}

function buildBestFitSummary(
  resimulation: ResimulationResult,
): string {
  const { headlineImprovements } = resimulation.comparison;
  if (headlineImprovements.length === 0) {
    return 'Already well-matched — upgrades maintain performance.';
  }
  return 'Better matched to your home and daily demand.';
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
  const visibleHeadlines = headlineImprovements.slice(0, 3);

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

      {/* ── 2. Headline improvements — the emotional payoff ──────────── */}
      {visibleHeadlines.length > 0 && (
        <div className="system-upgrade-comparison-panel__headlines" data-testid="headline-improvements">
          <div className="system-upgrade-comparison-panel__headlines-label">
            What the upgrades deliver
          </div>
          <ul className="system-upgrade-comparison-panel__headlines-list">
            {visibleHeadlines.map((item, idx) => (
              <li key={idx} className="system-upgrade-comparison-panel__headline-item">
                <span className="system-upgrade-comparison-panel__headline-icon" aria-hidden="true">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── 3. Layout: [simple install] [upgrades] [best-fit install] ── */}
      <div className="system-upgrade-comparison-panel__layout">

        {/* ── Simple install card ────────────────────────────────────── */}
        <OutcomeSummaryCard
          variant="simple"
          outcome={resimulation.simpleInstall}
          summary={simpleSummary}
        />

        {/* ── Suggested upgrades strip ───────────────────────────────── */}
        <UpgradeListPanel upgradePackage={upgradePackage} />

        {/* ── Best-fit install card ──────────────────────────────────── */}
        <OutcomeSummaryCard
          variant="best-fit"
          outcome={resimulation.bestFitInstall}
          summary={bestFitSummary}
        />
      </div>
    </section>
  );
}
