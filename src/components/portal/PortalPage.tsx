/**
 * PortalPage.tsx — Four-Pillar customer portal surface.
 *
 * Pillars:
 *   1. What Matters to You (identity)   — priority cards + property facts
 *   2. Verdict & Physics (verdict)      — physics proof cards, Scenario Explorer with "Why?" drill-downs
 *   3. Your Day (experience)            — 24-hour interactive timeline
 *   4. Roadmap (roadmap)               — future upgrade paths
 *
 * Design rules:
 *   - Renderer is dumb — no recommendation logic re-derived here.
 *   - Reuses existing block views from CustomerDeck for block rendering.
 *   - PortalViewModel drives all content — built externally by buildPortalViewModel.
 */

import { useState } from 'react';
import type { PortalTabId, PortalViewModel } from '../../engine/modules/buildPortalViewModel';
import { PortalTabs } from './PortalTabs';
import { ProofCard } from './cards/ProofCard';
import { ComparisonCard } from './cards/ComparisonCard';
import { DailyUseCard } from './cards/DailyUseCard';
import { SpatialProofSection } from './cards/SpatialProofSection';
import { DailyUseSimulatorPanel } from '../simulator/DailyUseSimulatorPanel';
import type { VisualBlock, HeroBlock, FactsBlock, SolutionBlock, WarningBlock, IncludedScopeBlock, SystemWorkExplainerBlock, CustomerNeedResolutionBlock, FutureUpgradeBlock } from '../../contracts/VisualBlock';
import { HeroBlockView } from '../presentation/blocks/HeroBlockView';
import { FactsBlockView } from '../presentation/blocks/FactsBlockView';
import { SolutionBlockView } from '../presentation/blocks/SolutionBlockView';
import { WarningBlockView } from '../presentation/blocks/WarningBlockView';
import { IncludedScopeBlockView } from '../presentation/blocks/IncludedScopeBlockView';
import { SystemWorkExplainerBlockView } from '../presentation/blocks/SystemWorkExplainerBlockView';
import { CustomerNeedResolutionBlockView } from '../presentation/blocks/CustomerNeedResolutionBlockView';
import { FutureUpgradeBlockView } from '../presentation/blocks/FutureUpgradeBlockView';
import { PortalShareActions } from './PortalShareActions';
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
    case 'system_work_explainer': return <SystemWorkExplainerBlockView block={block as SystemWorkExplainerBlock} />;
    case 'customer_need_resolution': return <CustomerNeedResolutionBlockView block={block as CustomerNeedResolutionBlock} />;
    case 'future_upgrade': return <FutureUpgradeBlockView block={block as FutureUpgradeBlock} />;
    default:               return null;
  }
}

// ─── Tab panels ───────────────────────────────────────────────────────────────

/**
 * Pillar 1 — Identity: "What Matters to You"
 * Shows priority cards (customer_need_resolution), property facts, and the
 * recommended system headline so the customer can see why the system was chosen
 * in the context of their stated needs.
 */
function IdentityTab({ blocks }: { blocks: PortalViewModel['identityBlocks'] }) {
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

/**
 * Pillar 2 — Verdict: "Verdict & Physics"
 * Physics-based proof cards, scenario comparison with "Why?" drill-downs,
 * and spatial evidence.  The "Why?" section on each proof card lets the
 * customer explore the physics evidence behind every rating.
 */
function VerdictTab({ verdictData }: { verdictData: PortalViewModel['verdictData'] }) {
  const { whyCards, comparisonCards, spatialProof } = verdictData;
  const hasContent = whyCards.length > 0 || comparisonCards.length > 0 || spatialProof;
  if (!hasContent) {
    return <p className="portal-page__empty">No proof cards available.</p>;
  }
  return (
    <div className="portal-page__verdict-stack">
      {/* Physics proof — key reasons and avoided risks */}
      {whyCards.length > 0 && (
        <section className="portal-page__verdict-section" aria-label="Physics evidence">
          <p className="portal-page__why-intro">
            These are the specific measurements and signals Atlas used to make this recommendation for your home
          </p>
          <div className="portal-page__card-grid">
            {whyCards.map((card) => (
              <ProofCard key={card.id} card={card} />
            ))}
          </div>
        </section>
      )}

      {/* Scenario Explorer — Atlas Pick vs alternatives */}
      {comparisonCards.length > 0 && (
        <section className="portal-page__verdict-section" aria-label="Scenario Explorer">
          <p className="portal-page__scenario-intro">
            See how the recommended system compares to the alternatives evaluated for your home
          </p>
          <div className="portal-page__comparison-stack">
            {comparisonCards.map((card) => (
              <ComparisonCard key={card.scenarioId} card={card} />
            ))}
          </div>
        </section>
      )}

      {/* Spatial proof — where the work happens */}
      {spatialProof && (
        <section className="portal-page__verdict-section" aria-label="Spatial evidence">
          <SpatialProofSection block={spatialProof} />
        </section>
      )}
    </div>
  );
}

/**
 * Pillar 3 — Experience: "Your Day"
 * Interactive 24-hour simulation showing how the recommended system performs
 * across a typical day — from the morning shower to the evening heating cycle.
 * Falls back to static day-to-day outcome cards when simulation is unavailable.
 */
function ExperienceTab({ experienceData }: { experienceData: PortalViewModel['experienceData'] }) {
  const { simulation, cards } = experienceData;
  if (simulation) {
    return (
      <>
        <div className="portal-page__daily-use-header">
          <p className="portal-page__daily-use-header-title">Your 24-hour experience</p>
          <p className="portal-page__daily-use-header-desc">
            Move through the day to see how the recommended system responds to a morning shower, kitchen tap use, and evening heating cycle.
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

/**
 * Pillar 4 — Roadmap: "Roadmap"
 * Future upgrade paths enabled by this installation.
 */
function RoadmapTab({ blocks }: { blocks: PortalViewModel['roadmapBlocks'] }) {
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

// ─── AI data blob panel ───────────────────────────────────────────────────────

/**
 * AiDataBlobPanel
 *
 * Renders the full AI agent handoff payload as a visible, copyable text block.
 * Collapsed by default — expanded on click so it does not dominate the portal.
 * The customer can copy/paste this directly into any AI assistant.
 */
function AiDataBlobPanel({ aiSummaryText }: { aiSummaryText: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section
      className="portal-ai-blob"
      data-testid="portal-ai-blob"
      aria-label="AI agent data payload"
    >
      <button
        type="button"
        className="portal-ai-blob__toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        data-testid="portal-ai-blob-toggle"
      >
        <span className="portal-ai-blob__icon" aria-hidden="true">✦</span>
        <span className="portal-ai-blob__title">AI agent payload</span>
        <span className="portal-ai-blob__hint">
          {expanded ? 'Hide' : 'Show data for AI assistant'}
        </span>
        <span className="portal-ai-blob__chevron" aria-hidden="true">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <pre
          className="portal-ai-blob__text"
          data-testid="portal-ai-blob-text"
          tabIndex={0}
          aria-label="AI handoff payload text — select all and copy to use in an AI assistant"
        >
          {aiSummaryText}
        </pre>
      )}
    </section>
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
   * Defaults to 'identity' when absent.
   */
  initialTab?: PortalTabId;
  /** Full URL of this portal page — enables copy-link and native share. */
  portalUrl?: string;
  /** Direct download URL for the advice pack PDF, if pre-generated. */
  advicePackUrl?: string;
  /** Pre-serialised AI handoff text for copy/download actions. */
  aiSummaryText?: string;
  /** Filename for the AI summary .txt download. */
  aiSummaryFilename?: string;
  /** Callback to trigger advice pack generation when no advicePackUrl exists. */
  onDownloadAdvicePack?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * PortalPage
 *
 * Four-Pillar portal surface. Renders each pillar's content using the
 * supplied PortalViewModel — no recommendation logic lives here.
 */
export function PortalPage({ viewModel, propertyTitle, initialTab, portalUrl, advicePackUrl, aiSummaryText, aiSummaryFilename, onDownloadAdvicePack }: PortalPageProps) {
  const [activeTab, setActiveTab] = useState<PortalTabId>(initialTab ?? 'identity');

  function renderActivePanel() {
    switch (activeTab) {
      case 'identity':   return <IdentityTab    blocks={viewModel.identityBlocks} />;
      case 'verdict':    return <VerdictTab      verdictData={viewModel.verdictData} />;
      case 'experience': return <ExperienceTab   experienceData={viewModel.experienceData} />;
      case 'roadmap':    return <RoadmapTab      blocks={viewModel.roadmapBlocks} />;
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

      {/* Share / export action strip */}
      <PortalShareActions
        portalUrl={portalUrl}
        advicePackUrl={advicePackUrl}
        aiSummaryText={aiSummaryText}
        aiSummaryFilename={aiSummaryFilename}
        onDownloadAdvicePack={onDownloadAdvicePack}
      />

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

      {/* AI agent data blob — full payload for pasting into any AI assistant */}
      {aiSummaryText && (
        <AiDataBlobPanel aiSummaryText={aiSummaryText} />
      )}

    </div>
  );
}

export default PortalPage;
