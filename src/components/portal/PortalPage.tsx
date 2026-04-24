/**
 * PortalPage.tsx — Five-tab portal proof surface.
 *
 * Tabs:
 *   1. Recommended for you  — hero/facts/solution/warning/scope blocks
 *   2. Why Atlas chose this — proof cards (reasons, risks, facts, lifecycle)
 *   3. Compare other options — one comparison card per scenario
 *   4. Daily-use demo       — day-to-day outcome cards
 *   5. Future upgrades      — future_upgrade blocks
 *
 * Design rules:
 *   - Renderer is dumb — no recommendation logic re-derived here.
 *   - Reuses existing block views from CustomerDeck for block rendering.
 *   - PortalViewModel drives all content — built externally by buildPortalViewModel.
 *   - CTA button is presentational only — no portal routing yet (PR6).
 */

import { useState } from 'react';
import type { PortalTabId, PortalViewModel } from '../../engine/modules/buildPortalViewModel';
import { PortalTabs } from './PortalTabs';
import { ProofCard } from './cards/ProofCard';
import { ComparisonCard } from './cards/ComparisonCard';
import { DailyUseCard } from './cards/DailyUseCard';
import { SpatialProofSection } from './cards/SpatialProofSection';
import { DailyUseSimulatorPanel } from '../simulator/DailyUseSimulatorPanel';
import type { VisualBlock, HeroBlock, FactsBlock, SolutionBlock, WarningBlock, IncludedScopeBlock, FutureUpgradeBlock } from '../../contracts/VisualBlock';
import { HeroBlockView } from '../presentation/blocks/HeroBlockView';
import { FactsBlockView } from '../presentation/blocks/FactsBlockView';
import { SolutionBlockView } from '../presentation/blocks/SolutionBlockView';
import { WarningBlockView } from '../presentation/blocks/WarningBlockView';
import { IncludedScopeBlockView } from '../presentation/blocks/IncludedScopeBlockView';
import { FutureUpgradeBlockView } from '../presentation/blocks/FutureUpgradeBlockView';
import '../presentation/CustomerDeck.css';
import './PortalPage.css';

// ─── Block renderer (reuses CustomerDeck block views) ─────────────────────────

function renderPortalBlock(block: VisualBlock): React.ReactElement | null {
  switch (block.type) {
    case 'hero':           return <HeroBlockView          block={block as HeroBlock} />;
    case 'facts':          return <FactsBlockView         block={block as FactsBlock} />;
    case 'solution':       return <SolutionBlockView      block={block as SolutionBlock} />;
    case 'warning':        return <WarningBlockView       block={block as WarningBlock} />;
    case 'included_scope': return <IncludedScopeBlockView block={block as IncludedScopeBlock} />;
    case 'future_upgrade': return <FutureUpgradeBlockView block={block as FutureUpgradeBlock} />;
    default:               return null;
  }
}

// ─── Tab panels ───────────────────────────────────────────────────────────────

function RecommendedTab({ blocks }: { blocks: PortalViewModel['recommendedBlocks'] }) {
  if (blocks.length === 0) {
    return <p className="portal-page__empty">No recommendation content available.</p>;
  }
  return (
    <div className="portal-page__block-stack">
      {blocks.map((block) => {
        const rendered = renderPortalBlock(block);
        return rendered ? (
          <div key={block.id} className="portal-page__block-wrapper">
            {rendered}
          </div>
        ) : null;
      })}
    </div>
  );
}

function WhyTab({ cards, spatialProof }: { cards: PortalViewModel['whyCards']; spatialProof: PortalViewModel['spatialProof'] }) {
  if (cards.length === 0 && !spatialProof) {
    return <p className="portal-page__empty">No proof cards available.</p>;
  }
  return (
    <div className="portal-page__why-stack">
      {spatialProof && (
        <SpatialProofSection block={spatialProof} />
      )}
      {cards.length > 0 && (
        <>
          <p className="portal-page__why-intro">
            These are the specific measurements and signals Atlas used to make this recommendation for your home
          </p>
          <div className="portal-page__card-grid">
            {cards.map((card) => (
              <ProofCard key={card.id} card={card} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CompareTab({ cards }: { cards: PortalViewModel['comparisonCards'] }) {
  if (cards.length === 0) {
    return <p className="portal-page__empty">No comparison data available.</p>;
  }
  return (
    <div className="portal-page__comparison-stack">
      {cards.map((card) => (
        <ComparisonCard key={card.scenarioId} card={card} />
      ))}
    </div>
  );
}

function DailyUseTab({ cards, simulation }: { cards: PortalViewModel['dailyUseCards']; simulation: PortalViewModel['dailyUseSimulation'] }) {
  if (simulation) {
    return (
      <>
        <div className="portal-page__daily-use-header">
          <p className="portal-page__daily-use-header-title">See how it works day-to-day</p>
          <p className="portal-page__daily-use-header-desc">
            Adjust occupancy, outdoor temperature, and usage patterns to see how the recommended system responds in real time.
          </p>
        </div>
        <DailyUseSimulatorPanel simulation={simulation} />
      </>
    );
  }
  if (cards.length === 0) {
    return <p className="portal-page__empty">No daily-use outcomes available.</p>;
  }
  return (
    <div className="portal-page__card-grid">
      {cards.map((card) => (
        <DailyUseCard key={card.scenarioId} card={card} />
      ))}
    </div>
  );
}

function FutureTab({ blocks }: { blocks: PortalViewModel['futureBlocks'] }) {
  if (blocks.length === 0) {
    return <p className="portal-page__empty">No future upgrade paths available.</p>;
  }
  return (
    <div className="portal-page__block-stack">
      {blocks.map((block) => {
        const rendered = renderPortalBlock(block);
        return rendered ? (
          <div key={block.id} className="portal-page__block-wrapper">
            {rendered}
          </div>
        ) : null;
      })}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PortalPageProps {
  /** The fully-built portal view model from buildPortalViewModel. */
  viewModel: PortalViewModel;
  /** Optional property reference shown in the header. */
  propertyTitle?: string;
  /**
   * Optional tab to activate on first render.
   * Defaults to 'recommended' when absent.
   */
  initialTab?: PortalTabId;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * PortalPage
 *
 * Five-tab portal proof surface. Renders each tab's content using the
 * supplied PortalViewModel — no recommendation logic lives here.
 */
export function PortalPage({ viewModel, propertyTitle, initialTab }: PortalPageProps) {
  const [activeTab, setActiveTab] = useState<PortalTabId>(initialTab ?? 'recommended');

  function renderActivePanel() {
    switch (activeTab) {
      case 'recommended': return <RecommendedTab blocks={viewModel.recommendedBlocks} />;
      case 'why':         return <WhyTab         cards={viewModel.whyCards} spatialProof={viewModel.spatialProof} />;
      case 'compare':     return <CompareTab     cards={viewModel.comparisonCards} />;
      case 'daily_use':   return <DailyUseTab    cards={viewModel.dailyUseCards} simulation={viewModel.dailyUseSimulation} />;
      case 'future':      return <FutureTab      blocks={viewModel.futureBlocks} />;
    }
  }

  return (
    <div className="portal-page__shell" data-testid="portal-page">

      {/* Header */}
      {propertyTitle && (
        <header className="portal-page__header">
          <span className="portal-page__property-title">{propertyTitle}</span>
        </header>
      )}

      {/* Tab bar */}
      <PortalTabs
        tabs={viewModel.tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Active panel */}
      <main
        id={`portal-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`portal-tab-${activeTab}`}
        className="portal-page__panel"
        data-testid={`portal-panel-${activeTab}`}
      >
        {renderActivePanel()}
      </main>

    </div>
  );
}

export default PortalPage;
