import { useMemo, useState } from 'react';
import { BRAND_PROFILES, DEFAULT_BRAND_ID } from '../../features/branding/brandProfiles';
import { getAuditForAsset } from '../audits/auditLookup';
import { getLibraryReadyAssets } from '../audits/getLibraryReadyAssets';
import { educationalContentRegistry } from '../content/educationalContentRegistry';
import type { EducationalContentV1 } from '../content/EducationalContentV1';
import { CalmWelcomePack } from '../packRenderer/CalmWelcomePack';
import {
  PackPageStrip,
  QRDeepDivePreviewCard,
  SequencedConceptCardPreview,
  SystemJourneyMap,
  type PreviewIconName,
  type SystemJourneyStep,
  WhatYouMayNoticePreview,
  WelcomePackCoverPreview,
  PrintSheetPreviewCard,
} from '../packRenderer/visualPreview';
import { PrintableWelcomePackSkeleton } from '../packRenderer/PrintableWelcomePackSkeleton';
import {
  getContentQaErrors,
  getContentQaWarnings,
  runEducationalContentQa,
} from '../content/qa/runEducationalContentQa';
import { educationalAssetRegistry } from '../registry/educationalAssetRegistry';
import { educationalComponentRegistry } from '../registry/educationalComponentRegistry';
import {
  getAssetQaErrors,
  getAssetQaWarnings,
  runEducationalAssetQa,
} from '../registry/qa/runEducationalAssetQa';
import { educationalConceptTaxonomy } from '../taxonomy/educationalConceptTaxonomy';
import { buildDemoWelcomePack } from './buildDemoWelcomePack';
import {
  welcomePackDemoFixtureList,
  type WelcomePackDemoFixtureId,
} from './welcomePackDemoFixtures';
import type { WelcomePackEligibilityMode } from '../packComposer/WelcomePackComposerV1';
import {
  runWelcomePackValidation,
  detectRepeatedOmissionPatterns,
  collectTopMissingConcepts,
} from './runWelcomePackValidation';
import type { WelcomePackValidationReportV1 } from './WelcomePackValidationReportV1';
import { AtlasEducationalUiDemo, TrustRecoveryCard } from '../ui';
import { printEquivalentByAssetId } from '../printEquivalents/printEquivalentRegistry';
import { educationalSequenceRules } from '../sequencing/educationalSequenceRules';
import { DiagramRenderer } from '../diagrams/DiagramRenderer';
import {
  getDiagramsForConcepts,
  getMissingDiagramCoverageForConcepts,
} from '../diagrams/diagramLookup';

const GOLDEN_JOURNEY_FIXTURE_IDS: WelcomePackDemoFixtureId[] = [
  'open_vented_to_sealed_unvented',
  'regular_to_regular_unvented',
  'heat_pump_reality',
  'water_constraint_reality',
];

const GOLDEN_JOURNEY_FIXTURE_ID_SET = new Set<WelcomePackDemoFixtureId>(GOLDEN_JOURNEY_FIXTURE_IDS);
const STORYBOARD_STAGE_ORDER = [
  'reassurance',
  'expectation',
  'lived_experience',
  'misconception',
  'deeper_understanding',
  'technical_detail',
  'appendix_only',
] as const;
const STORYBOARD_STAGE_PRIORITY = new Map(STORYBOARD_STAGE_ORDER.map((stage, index) => [stage, index]));
const STORYBOARD_EMOTIONAL_PRIORITY = new Map([
  ['calming', 0],
  ['neutral', 1],
  ['cautionary', 2],
]);
const STORYBOARD_SECTION_TITLES = {
  calm_summary: 'What Atlas found',
  why_this_fits: 'Why this fits',
  living_with_the_system: 'Living with your system',
  relevant_explainers: 'Relevant explainers',
  optional_technical_appendix: 'Optional technical appendix',
  next_steps: 'Next steps',
} as const;

type PreviewMode = 'visual_storyboard' | 'calm_customer_pack' | 'diagnostics' | 'golden_journeys' | 'ui_primitives';

interface StoryboardSequencedCard {
  order: number;
  title: string;
  summary: string;
  sectionTitle: string;
  conceptId?: string;
  content?: EducationalContentV1;
  hasAuthoredContent: boolean;
}

interface StoryboardNoticeCard {
  id: string;
  title: string;
  notice: string;
  normalBecause: string;
}

interface StoryboardDiagramCard {
  diagramId: string;
  title: string;
  whatThisMeans: string;
}

function toAccessibilityProfiles(dyslexia: boolean, adhd: boolean): Array<'dyslexia' | 'adhd'> {
  const profiles: Array<'dyslexia' | 'adhd'> = [];
  if (dyslexia) {
    profiles.push('dyslexia');
  }
  if (adhd) {
    profiles.push('adhd');
  }
  return profiles;
}

function getStoryboardIcon(systemLabel: string): PreviewIconName {
  const label = systemLabel.toLowerCase();
  if (label.includes('heat pump')) {
    return 'heat-pump';
  }
  if (label.includes('cylinder') || label.includes('stored hot water')) {
    return 'cylinder';
  }
  if (label.includes('controls')) {
    return 'controls';
  }
  return 'boiler';
}

function parseWhatYouMayNotice(content: EducationalContentV1): StoryboardNoticeCard | undefined {
  const explanation = content.customerExplanation.trim();
  if (!/what you may notice:/i.test(explanation) || !/what this means:/i.test(explanation)) {
    return undefined;
  }

  const withoutNoticeLabel = explanation.replace(/^[\s\S]*?what you may notice:\s*/i, '');
  const [noticePart, meaningPart] = withoutNoticeLabel.split(/what this means:\s*/i);
  const notice = noticePart?.trim().replace(/\s+/g, ' ').replace(/[.]$/, '');
  const normalBecause = meaningPart?.trim().replace(/\s+/g, ' ');

  if (!notice || !normalBecause) {
    return undefined;
  }

  return {
    id: `${content.contentId}:${content.conceptId}`,
    title: content.title,
    notice,
    normalBecause,
  };
}

function sortConceptIdsForStoryboard(selectedConceptIds: readonly string[]) {
  return [...selectedConceptIds].sort((left, right) => {
    const leftRule = educationalSequenceRules.find((rule) => rule.conceptId === left);
    const rightRule = educationalSequenceRules.find((rule) => rule.conceptId === right);
    const leftStage = STORYBOARD_STAGE_PRIORITY.get(leftRule?.sequenceStage ?? 'technical_detail') ?? STORYBOARD_STAGE_ORDER.length;
    const rightStage = STORYBOARD_STAGE_PRIORITY.get(rightRule?.sequenceStage ?? 'technical_detail') ?? STORYBOARD_STAGE_ORDER.length;

    if (leftStage !== rightStage) {
      return leftStage - rightStage;
    }

    const leftEmotion = STORYBOARD_EMOTIONAL_PRIORITY.get(leftRule?.emotionalWeight ?? 'neutral') ?? 99;
    const rightEmotion = STORYBOARD_EMOTIONAL_PRIORITY.get(rightRule?.emotionalWeight ?? 'neutral') ?? 99;

    if (leftEmotion !== rightEmotion) {
      return leftEmotion - rightEmotion;
    }

    return left.localeCompare(right);
  });
}

export function WelcomePackDevPreview() {
  const [previewMode, setPreviewMode] = useState<PreviewMode>('visual_storyboard');
  const [fixtureId, setFixtureId] = useState<WelcomePackDemoFixtureId>('open_vented_to_sealed_unvented');
  const [printFirst, setPrintFirst] = useState(false);
  const [dyslexia, setDyslexia] = useState(false);
  const [adhd, setAdhd] = useState(false);
  const [technicalAppendix, setTechnicalAppendix] = useState(false);
  const [showValidationAudit, setShowValidationAudit] = useState(false);
  const [eligibilityMode, setEligibilityMode] = useState<WelcomePackEligibilityMode>('off');
  const [brandId, setBrandId] = useState(DEFAULT_BRAND_ID);

  const fixtureOptions = useMemo(
    () => previewMode === 'golden_journeys'
      ? welcomePackDemoFixtureList.filter((fixture) => GOLDEN_JOURNEY_FIXTURE_ID_SET.has(fixture.id))
      : welcomePackDemoFixtureList,
    [previewMode],
  );

  const selectedFixture = useMemo(
    () => fixtureOptions.find((fixture) => fixture.id === fixtureId) ?? fixtureOptions[0] ?? welcomePackDemoFixtureList[0],
    [fixtureId, fixtureOptions],
  );
  const fixtureById = useMemo(
    () => new Map(welcomePackDemoFixtureList.map((fixtureOption) => [fixtureOption.id, fixtureOption])),
    [],
  );

  const brandOptions = useMemo(
    () => Object.values(BRAND_PROFILES).map((profile) => ({ id: profile.brandId, label: profile.companyName })),
    [],
  );

  function applyFixtureSelection(nextFixtureId: WelcomePackDemoFixtureId) {
    const nextFixture = fixtureById.get(nextFixtureId);
    if (!nextFixture) {
      return;
    }
    setFixtureId(nextFixtureId);
    setPrintFirst(Boolean(nextFixture.accessibilityPreferences.prefersPrint));
    setDyslexia(nextFixture.accessibilityPreferences.profiles?.includes('dyslexia') ?? false);
    setAdhd(nextFixture.accessibilityPreferences.profiles?.includes('adhd') ?? false);
    setTechnicalAppendix(Boolean(nextFixture.accessibilityPreferences.includeTechnicalAppendix));
  }

  function handlePreviewModeChange(nextMode: PreviewMode) {
    setPreviewMode(nextMode);
    if (nextMode === 'golden_journeys' && !GOLDEN_JOURNEY_FIXTURE_ID_SET.has(fixtureId)) {
      applyFixtureSelection(GOLDEN_JOURNEY_FIXTURE_IDS[0]);
    }
  }

  const {
    fixture,
    plan,
    viewModel,
    calmViewModel,
    brandedCalmViewModel,
    educationalContent,
  } = useMemo(() => buildDemoWelcomePack({
    fixtureId: selectedFixture.id,
    accessibilityOverrides: {
      prefersPrint: printFirst,
      includeTechnicalAppendix: technicalAppendix,
      profiles: toAccessibilityProfiles(dyslexia, adhd),
    },
    eligibilityMode,
    brandId,
  }), [
    brandId,
    dyslexia,
    eligibilityMode,
    printFirst,
    selectedFixture.id,
    technicalAppendix,
    adhd,
  ]);

  const { contentQaFindings, contentQaErrors, contentQaWarnings } = useMemo(() => {
    const findings = runEducationalContentQa(educationalContentRegistry);
    return {
      contentQaFindings: findings,
      contentQaErrors: getContentQaErrors(findings),
      contentQaWarnings: getContentQaWarnings(findings),
    };
  }, []);

  const { assetQaFindings, assetQaErrors, assetQaWarnings } = useMemo(() => {
    const findings = runEducationalAssetQa(
      educationalAssetRegistry,
      educationalComponentRegistry,
      educationalConceptTaxonomy,
    );
    return {
      assetQaFindings: findings,
      assetQaErrors: getAssetQaErrors(findings),
      assetQaWarnings: getAssetQaWarnings(findings),
    };
  }, []);

  const selectedConceptContentStatus = useMemo(() => plan.selectedConceptIds.map((conceptId) => {
    const contentEntry = educationalContentRegistry.find((entry) => entry.conceptId === conceptId);
    if (!contentEntry) {
      return {
        conceptId,
        contentId: 'missing',
        status: 'error' as const,
        errorCount: 1,
        warningCount: 0,
      };
    }

    const findings = contentQaFindings.filter((finding) => finding.contentId === contentEntry.contentId);
    const errorCount = findings.filter((finding) => finding.severity === 'error').length;
    const warningCount = findings.filter((finding) => finding.severity === 'warning').length;
    const status = errorCount > 0 ? 'error' : warningCount > 0 ? 'warning' : 'pass';
    return {
      conceptId,
      contentId: contentEntry.contentId,
      status,
      errorCount,
      warningCount,
    };
  }), [plan.selectedConceptIds, contentQaFindings]);

  const selectedAssetQaStatus = useMemo(() => {
    const assets = educationalAssetRegistry.filter((asset) =>
      asset.conceptIds.some((conceptId) => plan.selectedConceptIds.includes(conceptId)),
    );
    return assets.map((asset) => {
      const findings = assetQaFindings.filter((finding) => finding.assetId === asset.id);
      const errorCount = findings.filter((finding) => finding.severity === 'error').length;
      const warningCount = findings.filter((finding) => finding.severity === 'warning').length;
      const status = errorCount > 0 ? 'error' : warningCount > 0 ? 'warning' : 'pass';
      return {
        assetId: asset.id,
        status,
        errorCount,
        warningCount,
      };
    });
  }, [plan.selectedConceptIds, assetQaFindings]);

  const selectedAssetAuditStatus = useMemo(() => {
    const assets = educationalAssetRegistry.filter((asset) =>
      asset.conceptIds.some((conceptId) => plan.selectedConceptIds.includes(conceptId)),
    );
    const { blockedAssets } = getLibraryReadyAssets(
      assets,
      assetQaFindings,
      educationalComponentRegistry as Record<string, unknown>,
    );
    const blockedById = new Map(blockedAssets.map((b) => [b.assetId, b]));
    return assets.map((asset) => {
      const audit = getAuditForAsset(asset.id);
      const blocked = blockedById.get(asset.id);
      return {
        assetId: asset.id,
        auditStatus: audit ? audit.status : 'no_audit',
        approvedFor: audit ? audit.approvedFor : [],
        blockedReasons: blocked ? blocked.blockedReasons : [],
        ready: !blocked,
      };
    });
  }, [plan.selectedConceptIds, assetQaFindings]);

  const validationReports = useMemo<WelcomePackValidationReportV1[]>(() => {
    if (!showValidationAudit) {
      return [];
    }
    return runWelcomePackValidation('warn');
  }, [showValidationAudit]);

  const repeatedOmissions = useMemo(
    () => detectRepeatedOmissionPatterns(validationReports, 3),
    [validationReports],
  );

  const topMissingConcepts = useMemo(
    () => collectTopMissingConcepts(validationReports),
    [validationReports],
  );

  const educationalContentByConceptId = useMemo(
    () => new Map(educationalContent.map((entry) => [entry.conceptId, entry])),
    [educationalContent],
  );

  const assetById = useMemo(
    () => new Map(educationalAssetRegistry.map((asset) => [asset.id, asset])),
    [],
  );

  const storyboardSequencedCards = useMemo<StoryboardSequencedCard[]>(() => {
    const sectionTitleByConceptId = new Map<string, string>();

    for (const section of plan.sections) {
      for (const assetId of section.includedAssetIds) {
        const asset = assetById.get(assetId);
        for (const conceptId of asset?.conceptIds ?? []) {
          if (!sectionTitleByConceptId.has(conceptId)) {
            sectionTitleByConceptId.set(conceptId, STORYBOARD_SECTION_TITLES[section.id]);
          }
        }
      }
    }

    const orderedConceptIds = sortConceptIdsForStoryboard(plan.selectedConceptIds);

    return orderedConceptIds
      .map((conceptId) => {
        const content = educationalContentByConceptId.get(conceptId);
        const asset = [...assetById.values()].find((item) => item.conceptIds.includes(conceptId));
        const hasAuthoredContent = content !== undefined;

        return {
          title: content?.title ?? asset?.title ?? conceptId,
          summary: content?.printSummary
            || content?.customerExplanation
            || content?.plainEnglishSummary
            || `This storyboard beat is currently carried by ${asset?.title ?? 'a linked asset'}.`,
          sectionTitle: sectionTitleByConceptId.get(conceptId) ?? 'Relevant explainers',
          conceptId,
          content,
          hasAuthoredContent,
        };
      })
      .map((card, index) => ({
        ...card,
        order: index + 1,
      }));
  }, [assetById, educationalContentByConceptId, plan]);

  const storyboardNoticeCards = useMemo(
    () => storyboardSequencedCards
      .map((card) => card.content ? parseWhatYouMayNotice(card.content) : undefined)
      .filter((item): item is StoryboardNoticeCard => Boolean(item))
      .slice(0, 3),
    [storyboardSequencedCards],
  );

  const storyboardPrintCards = useMemo(
    () => plan.selectedAssetIds
      .map((assetId) => {
        const printEquivalent = printEquivalentByAssetId.get(assetId);
        if (printEquivalent) {
          return printEquivalent;
        }

        const asset = assetById.get(assetId);
        if (!asset) {
          return undefined;
        }

        return {
          assetId,
          conceptIds: asset.conceptIds,
          title: asset.title,
          printTitle: `${asset.title} (print handover)`,
          summary: 'Printable handover card for the same learning goal in the storyboard.',
          steps: [
            'Keep this page in the welcome pack.',
            'Use it in the first handover conversation.',
            'Use deeper detail only if more explanation is helpful.',
          ],
          labels: ['Print handover'],
          accessibilityNotes: 'Static summary for print-first review.',
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .slice(0, 3),
    [assetById, plan.selectedAssetIds],
  );

  const storyboardDiagramCards = useMemo<StoryboardDiagramCard[]>(
    () => getDiagramsForConcepts(plan.selectedConceptIds).map((diagram) => ({
      diagramId: diagram.diagramId,
      title: diagram.title,
      whatThisMeans: diagram.whatThisMeans,
    })),
    [plan.selectedConceptIds],
  );

  const missingDiagramCoverageConceptIds = useMemo(
    () => getMissingDiagramCoverageForConcepts(plan.selectedConceptIds),
    [plan.selectedConceptIds],
  );

  const deferredDiagramCoverageConceptIds = useMemo(() => {
    const missingSet = new Set(missingDiagramCoverageConceptIds);
    return plan.deferredConceptIds.filter((conceptId) => missingSet.has(conceptId));
  }, [missingDiagramCoverageConceptIds, plan.deferredConceptIds]);

  const whyThisFitsCardCount = storyboardSequencedCards.filter((card) => card.sectionTitle === 'Why this fits').length;
  const noticeCardCount = storyboardNoticeCards.length;
  const printCardCount = storyboardPrintCards.length;
  const storyboardDiagramCount = storyboardDiagramCards.length;
  const safetyCardCount = storyboardSequencedCards.filter((card) => card.content?.safetyNotice).length;
  const qrCardCount = calmViewModel.qrDestinations.length;
  const activeAnxietyPatternIds = calmViewModel.sequencingMetadata?.activeAnxietyPatternIds ?? [];
  const reassuranceConceptCount = calmViewModel.sequencingMetadata?.reassuranceConceptCount ?? 0;
  const hasSelectedConcepts = plan.selectedConceptIds.length > 0;
  const reassuranceConceptPercent = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (reassuranceConceptCount / Math.max(1, plan.selectedConceptIds.length)) * 100,
      ),
    ),
  );

  const contentReadyCount = storyboardSequencedCards.filter((card) => card.content !== undefined).length;
  const contentMissingCount = storyboardSequencedCards.filter((card) => card.content === undefined).length;

  const goldenJourneyFixtures = useMemo(
    () => welcomePackDemoFixtureList.filter((item) => GOLDEN_JOURNEY_FIXTURE_ID_SET.has(item.id)),
    [],
  );

  const journeySteps = useMemo<SystemJourneyStep[]>(() => [
    {
      id: 'home-now',
      label: 'Home now',
      icon: 'comfort',
      description: fixture.customerSummary.plainEnglishDecision,
    },
    {
      id: 'what-changes',
      label: 'What changes',
      icon: getStoryboardIcon(fixture.customerSummary.recommendedSystemLabel),
      description: `${whyThisFitsCardCount || 1} fit card${whyThisFitsCardCount === 1 ? '' : 's'}`,
    },
    {
      id: 'what-you-may-notice',
      label: 'What you may notice',
      icon: 'radiator',
      description: `${noticeCardCount} expectation card${noticeCardCount === 1 ? '' : 's'}`,
    },
    {
      id: 'how-to-use-it',
      label: 'How to use it',
      icon: 'controls',
      description: `${printCardCount} print sheet${printCardCount === 1 ? '' : 's'}`,
    },
    {
      id: 'what-to-keep-safe',
      label: 'What to keep safe',
      icon: 'safety',
      description: `${safetyCardCount} safety-led card${safetyCardCount === 1 ? '' : 's'}`,
    },
    {
      id: 'go-deeper',
      label: 'Go deeper',
      icon: 'qr',
      description: `${qrCardCount} QR deep dive${qrCardCount === 1 ? '' : 's'}`,
    },
  ], [
    fixture.customerSummary.plainEnglishDecision,
    fixture.customerSummary.recommendedSystemLabel,
    noticeCardCount,
    printCardCount,
    qrCardCount,
    safetyCardCount,
    whyThisFitsCardCount,
  ]);

  const storyboardPageStripItems = useMemo(() => [
    {
      id: 'cover',
      label: 'Cover',
      meta: fixture.customerSummary.recommendedSystemLabel,
      icon: getStoryboardIcon(fixture.customerSummary.recommendedSystemLabel),
    },
    {
      id: 'journey',
      label: 'Journey map',
      meta: `${journeySteps.length} storyboard beats`,
      icon: 'comfort' as const,
    },
    {
      id: 'concepts',
      label: 'Sequenced concepts',
      meta: `${storyboardSequencedCards.length} cards`,
      icon: 'controls' as const,
    },
    {
      id: 'print',
      label: 'Print sheets',
      meta: `${printCardCount} cards`,
      icon: 'print' as const,
    },
    {
      id: 'diagrams',
      label: 'Diagrams',
      meta: `${storyboardDiagramCount} cards`,
      icon: 'controls' as const,
    },
    {
      id: 'qr',
      label: 'Go deeper',
      meta: `${qrCardCount} cards`,
      icon: 'qr' as const,
    },
  ], [
    fixture.customerSummary.recommendedSystemLabel,
    journeySteps.length,
    printCardCount,
    qrCardCount,
    storyboardDiagramCount,
    storyboardSequencedCards.length,
  ]);

  const showEligibilityControls = previewMode === 'diagnostics' || previewMode === 'calm_customer_pack';

  return (
    <main style={{ margin: '0 auto', maxWidth: 1200, padding: '1rem' }}>
      <h1>Welcome pack development preview</h1>
      <p><strong>Development preview — not customer content.</strong></p>

      <section aria-label="Fixture and preview controls" style={{ marginBottom: '1rem' }}>
        <fieldset>
          <legend>Display mode</legend>
          <label style={{ display: 'block' }}>
            <input
              type="radio"
              name="preview-mode"
              value="visual_storyboard"
              checked={previewMode === 'visual_storyboard'}
              onChange={() => handlePreviewModeChange('visual_storyboard')}
            />
            {' '}
            Visual storyboard
          </label>
          <label style={{ display: 'block' }}>
            <input
              type="radio"
              name="preview-mode"
              value="calm_customer_pack"
              checked={previewMode === 'calm_customer_pack'}
              onChange={() => handlePreviewModeChange('calm_customer_pack')}
            />
            {' '}
            Calm customer pack
          </label>
          <label style={{ display: 'block' }}>
            <input
              type="radio"
              name="preview-mode"
              value="diagnostics"
              checked={previewMode === 'diagnostics'}
              onChange={() => handlePreviewModeChange('diagnostics')}
            />
            {' '}
            Diagnostics
          </label>
          <label style={{ display: 'block' }}>
            <input
              type="radio"
              name="preview-mode"
              value="golden_journeys"
              checked={previewMode === 'golden_journeys'}
              onChange={() => handlePreviewModeChange('golden_journeys')}
            />
            {' '}
            Golden journeys
          </label>
          <label style={{ display: 'block' }}>
            <input
              type="radio"
              name="preview-mode"
              value="ui_primitives"
              checked={previewMode === 'ui_primitives'}
              onChange={() => handlePreviewModeChange('ui_primitives')}
            />
            {' '}
            UI primitives
          </label>
        </fieldset>

        <label htmlFor="welcome-pack-fixture-select" style={{ display: 'block', marginTop: '1rem', marginBottom: '0.5rem' }}>
          {previewMode === 'golden_journeys' ? 'Golden journey' : 'Fixture'}
        </label>
        <select
          id="welcome-pack-fixture-select"
          aria-label="Fixture selector"
          value={selectedFixture.id}
          onChange={(event) => applyFixtureSelection(event.target.value as WelcomePackDemoFixtureId)}
        >
          {fixtureOptions.map((fixtureOption) => (
            <option key={fixtureOption.id} value={fixtureOption.id}>{fixtureOption.label}</option>
          ))}
        </select>

        {previewMode === 'golden_journeys' && (
          <section className="atlas-storyboard-panel" aria-label="Golden journeys" style={{ marginTop: '1rem' }}>
            <div className="atlas-storyboard-panel__header">
              <p className="atlas-storyboard-panel__eyebrow">Golden journeys</p>
              <h2 className="atlas-storyboard-panel__title">Start the next 25 content entries from the journey anchors</h2>
              <p
                className="atlas-storyboard-panel__content-status"
                data-testid="golden-journey-content-status"
                style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}
              >
                <span
                  style={{ color: contentMissingCount === 0 ? '#166534' : '#1d4ed8', fontWeight: 600 }}
                  data-testid="content-ready-count"
                >
                  {contentReadyCount} concept{contentReadyCount !== 1 ? 's' : ''} with authored content
                </span>
                {' · '}
                <span
                  style={{ color: contentMissingCount > 0 ? '#b45309' : '#166534', fontWeight: 600 }}
                  data-testid="content-missing-count"
                >
                  {contentMissingCount} missing
                </span>
              </p>
            </div>
            <div className="atlas-storyboard-golden-list" data-testid="golden-journey-list">
              {goldenJourneyFixtures.map((goldenFixture) => (
                <button
                  key={goldenFixture.id}
                  type="button"
                  className="atlas-storyboard-golden-button"
                  data-active={goldenFixture.id === selectedFixture.id}
                  onClick={() => applyFixtureSelection(goldenFixture.id)}
                >
                  <strong>{goldenFixture.label}</strong>
                </button>
              ))}
            </div>
          </section>
        )}

        {previewMode !== 'ui_primitives' && (
          <fieldset style={{ marginTop: '1rem' }}>
            <legend>Accessibility toggles</legend>
            <label style={{ display: 'block' }}>
              <input
                type="checkbox"
                checked={printFirst}
                onChange={(event) => setPrintFirst(event.target.checked)}
              />
              {' '}
              print-first
            </label>
            <label style={{ display: 'block' }}>
              <input
                type="checkbox"
                checked={dyslexia}
                onChange={(event) => setDyslexia(event.target.checked)}
              />
              {' '}
              dyslexia
            </label>
            <label style={{ display: 'block' }}>
              <input
                type="checkbox"
                checked={adhd}
                onChange={(event) => setAdhd(event.target.checked)}
              />
              {' '}
              ADHD
            </label>
            <label style={{ display: 'block' }}>
              <input
                type="checkbox"
                checked={technicalAppendix}
                onChange={(event) => setTechnicalAppendix(event.target.checked)}
              />
              {' '}
              technical appendix
            </label>
          </fieldset>
        )}

        {showEligibilityControls && (
          <fieldset style={{ marginTop: '1rem' }}>
            <legend>Production eligibility</legend>
            <label style={{ display: 'block' }}>
              <input
                type="radio"
                name="eligibility-mode"
                value="off"
                checked={eligibilityMode === 'off'}
                onChange={() => setEligibilityMode('off')}
              />
              {' '}
              off (dev preview — show all assets)
            </label>
            <label style={{ display: 'block' }}>
              <input
                type="radio"
                name="eligibility-mode"
                value="warn"
                checked={eligibilityMode === 'warn'}
                onChange={() => setEligibilityMode('warn')}
              />
              {' '}
              warn (show production eligibility, keep assets selected)
            </label>
            <label style={{ display: 'block' }}>
              <input
                type="radio"
                name="eligibility-mode"
                value="filter"
                checked={eligibilityMode === 'filter'}
                onChange={() => setEligibilityMode('filter')}
              />
              {' '}
              filter (remove ineligible assets from production customer pack)
            </label>
          </fieldset>
        )}

        {previewMode === 'calm_customer_pack' && (
          <>
            <label htmlFor="welcome-pack-brand-select" style={{ display: 'block', marginTop: '1rem', marginBottom: '0.5rem' }}>
              Brand profile
            </label>
            <select
              id="welcome-pack-brand-select"
              aria-label="Brand profile selector"
              value={brandId}
              onChange={(event) => setBrandId(event.target.value)}
            >
              {brandOptions.map((brand) => (
                <option key={brand.id} value={brand.id}>{brand.label}</option>
              ))}
            </select>
          </>
        )}

        {previewMode === 'diagnostics' && (
          <label style={{ display: 'block', marginTop: '1rem' }}>
            <input
              type="checkbox"
              checked={showValidationAudit}
              onChange={(event) => setShowValidationAudit(event.target.checked)}
            />
            {' '}
            Run validation audit (all 12 real-world fixtures)
          </label>
        )}
      </section>

      {(previewMode === 'visual_storyboard' || previewMode === 'golden_journeys') && (
        <section className="atlas-storyboard-shell" aria-label="Visual storyboard" data-testid="visual-storyboard">
          <WelcomePackCoverPreview
            title={`Welcome pack — ${fixture.customerSummary.recommendedSystemLabel}`}
            summary={fixture.customerSummary.headline}
            systemLabel={fixture.customerSummary.recommendedSystemLabel}
            pageCountLabel={`${viewModel.pageEstimate.usedPages} of ${viewModel.pageEstimate.maxPages} pages in scope`}
            iconName={getStoryboardIcon(fixture.customerSummary.recommendedSystemLabel)}
          />

          <PackPageStrip items={storyboardPageStripItems} />
          <SystemJourneyMap steps={journeySteps} />
          <WhatYouMayNoticePreview items={storyboardNoticeCards} />

          <section className="atlas-storyboard-panel" aria-labelledby="atlas-storyboard-sequenced-title">
            <div className="atlas-storyboard-panel__header">
              <p className="atlas-storyboard-panel__eyebrow">Sequenced concept cards</p>
              <h2 id="atlas-storyboard-sequenced-title" className="atlas-storyboard-panel__title">
                Sequenced cards follow the calm pack ordering already set by the library
              </h2>
            </div>
            <div className="atlas-storyboard-card-grid" data-testid="storyboard-sequenced-cards">
              {(previewMode === 'golden_journeys'
                ? storyboardSequencedCards.filter((card) => card.hasAuthoredContent)
                : storyboardSequencedCards
              ).map((card) => (
                <SequencedConceptCardPreview
                  key={`${card.order}:${card.conceptId ?? card.title}`}
                  order={card.order}
                  title={card.title}
                  summary={card.summary}
                  content={card.content}
                  sectionTitle={card.sectionTitle}
                />
              ))}
            </div>
          </section>

          <section className="atlas-storyboard-panel" aria-labelledby="atlas-storyboard-support-title">
            <div className="atlas-storyboard-panel__header">
              <p className="atlas-storyboard-panel__eyebrow">Print-first support</p>
              <h2 id="atlas-storyboard-support-title" className="atlas-storyboard-panel__title">
                Print sheet cards and deeper-detail handoff
              </h2>
            </div>
            <div className="atlas-storyboard-support-grid">
              <TrustRecoveryCard
                title="Some detail stays off the first page"
                thisCanHappen="The first-view pack stays short on purpose."
                whatItMeans={`${plan.deferredConceptIds.length} deferred concept(s) and ${viewModel.omittedSummary.omittedAssets.length} omitted asset(s) stay out of the first pass.`}
                whatToDoNext={calmViewModel.qrDestinations.length > 0
                  ? 'Use the QR deep dives when someone wants more detail.'
                  : 'Use Diagnostics mode if you need the full omission trail.'}
                ariaLabel="Storyboard pacing summary"
              />
            </div>
            <div className="atlas-storyboard-card-grid" data-testid="storyboard-print-cards">
              {storyboardPrintCards.map((printEquivalent) => (
                <PrintSheetPreviewCard key={printEquivalent.assetId} printEquivalent={printEquivalent} />
              ))}
            </div>
          </section>

          <section className="atlas-storyboard-panel" aria-labelledby="atlas-storyboard-diagrams-title">
            <div className="atlas-storyboard-panel__header">
              <p className="atlas-storyboard-panel__eyebrow">Educational diagrams</p>
              <h2 id="atlas-storyboard-diagrams-title" className="atlas-storyboard-panel__title">
                Diagram cards for matched concepts
              </h2>
              <p className="atlas-storyboard-panel__content-status" data-testid="storyboard-diagram-badge">
                {storyboardDiagramCount}
                {' '}
                diagrams matched
              </p>
            </div>
            <div className="atlas-storyboard-card-grid" data-testid="storyboard-diagram-cards">
              {storyboardDiagramCards.map((diagram) => (
                <article key={diagram.diagramId} className="atlas-storyboard-diagram-card">
                  <h3 className="atlas-storyboard-diagram-card__title">{diagram.title}</h3>
                  <DiagramRenderer diagramId={diagram.diagramId} reducedMotion={dyslexia || adhd} />
                  <p className="atlas-storyboard-diagram-card__caption">{diagram.whatThisMeans}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="atlas-storyboard-panel" aria-labelledby="atlas-storyboard-qr-title">
            <div className="atlas-storyboard-panel__header">
              <p className="atlas-storyboard-panel__eyebrow">Go deeper</p>
              <h2 id="atlas-storyboard-qr-title" className="atlas-storyboard-panel__title">
                QR-linked deeper detail cards
              </h2>
            </div>
            <div className="atlas-storyboard-card-grid" data-testid="storyboard-qr-cards">
              {calmViewModel.qrDestinations.map((item) => (
                <QRDeepDivePreviewCard
                  key={`${item.assetId}:${item.destination}`}
                  assetId={item.assetId}
                  title={item.title}
                  reason={item.reason}
                  destination={item.destination}
                />
              ))}
            </div>
          </section>
        </section>
      )}

      {previewMode === 'calm_customer_pack' && (
        <section aria-label="Calm customer pack preview" style={{ marginBottom: '1rem' }}>
          <h2>Calm customer pack preview</h2>
          <CalmWelcomePack viewModel={brandedCalmViewModel} />
        </section>
      )}

      {previewMode === 'diagnostics' && (
        <>
          <section aria-label="Plan metadata" style={{ marginBottom: '1rem' }}>
            <h2>Plan metadata</h2>
            <dl>
              <dt>archetypeId</dt>
              <dd>{plan.archetypeId}</dd>
              <dt>pageBudgetUsed</dt>
              <dd>{plan.pageBudgetUsed} / {plan.printPageBudget}</dd>
              <dt>recommendedScenarioId</dt>
              <dd>{plan.recommendedScenarioId}</dd>
              <dt>Technical appendix visibility</dt>
              <dd data-testid="technical-appendix-visibility">{technicalAppendix ? 'visible' : 'hidden'}</dd>
            </dl>

            <h3>selectedConceptIds</h3>
            <ul>
              {plan.selectedConceptIds.map((conceptId) => (
                <li key={`selected-${conceptId}`}>{conceptId}</li>
              ))}
            </ul>

            <h3>deferredConceptIds</h3>
            <ul>
              {plan.deferredConceptIds.length === 0 ? <li>None</li> : plan.deferredConceptIds.map((conceptId) => (
                <li key={`deferred-${conceptId}`}>{conceptId}</li>
              ))}
            </ul>

            <h3>QR destinations</h3>
            <ul>
              {plan.qrDestinations.length === 0 ? <li>None</li> : plan.qrDestinations.map((destination) => (
                <li key={destination}>{destination}</li>
              ))}
            </ul>

            <h3>Omitted assets and reasons</h3>
            <ul>
              {viewModel.omittedSummary.omittedAssets.length === 0 ? <li>None</li> : viewModel.omittedSummary.omittedAssets.map((item) => (
                <li key={item.assetId}>
                  <strong>{item.assetId}</strong>: {item.reason}
                </li>
              ))}
            </ul>
          </section>

          <section aria-label="Customer anxiety diagnostics" style={{ marginBottom: '1rem' }}>
            <h2>Customer anxiety diagnostics</h2>

            <h3>Active reassurance patterns</h3>
            <ul data-testid="diagnostics-active-anxiety-patterns">
              {activeAnxietyPatternIds.length === 0 ? <li>None</li> : activeAnxietyPatternIds.map((patternId) => (
                <li key={`anxiety-pattern-${patternId}`}>{patternId}</li>
              ))}
            </ul>

            <h3>Reassurance pacing</h3>
            <p data-testid="diagnostics-reassurance-pacing-text">
              {hasSelectedConcepts ? (
                <>
                  {reassuranceConceptCount}
                  {' '}
                  reassurance concept(s) out of
                  {' '}
                  {plan.selectedConceptIds.length}
                  {' '}
                  selected concept(s)
                </>
              ) : 'N/A — no selected concepts to pace.'}
            </p>
            <div
              aria-label="Reassurance pacing visual"
              data-testid="diagnostics-reassurance-pacing-visual"
              style={{
                width: '100%',
                maxWidth: 360,
                height: 12,
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${reassuranceConceptPercent}%`,
                  height: '100%',
                  background: '#0f766e',
                }}
              />
            </div>
          </section>

          <section aria-label="Diagram coverage diagnostics" style={{ marginBottom: '1rem' }}>
            <h2>Diagram coverage diagnostics</h2>
            <p data-testid="diagnostics-diagram-count">
              Matched diagrams:
              {' '}
              {storyboardDiagramCount}
            </p>

            <h3>Missing diagram coverage concepts</h3>
            <ul data-testid="diagnostics-missing-diagram-coverage">
              {missingDiagramCoverageConceptIds.length === 0 ? (
                <li>None</li>
              ) : missingDiagramCoverageConceptIds.map((conceptId) => (
                <li key={`missing-diagram-${conceptId}`}>{conceptId}</li>
              ))}
            </ul>

            <h3>Deferred concepts without diagram coverage</h3>
            <ul data-testid="diagnostics-deferred-diagram-coverage">
              {deferredDiagramCoverageConceptIds.length === 0 ? (
                <li>None</li>
              ) : deferredDiagramCoverageConceptIds.map((conceptId) => (
                <li key={`deferred-missing-diagram-${conceptId}`}>{conceptId}</li>
              ))}
            </ul>
          </section>

          <section aria-label="Content QA" style={{ marginBottom: '1rem' }}>
            <h2>Content QA</h2>

            <h3>Content QA Errors</h3>
            <ul data-testid="content-qa-errors">
              {contentQaErrors.length === 0 ? <li>None</li> : contentQaErrors.map((finding) => (
                <li key={`${finding.contentId}-${finding.ruleId}-${finding.field}`}>
                  <strong>{finding.contentId}</strong> [{finding.field}]: {finding.message}
                </li>
              ))}
            </ul>

            <h3>Content QA Warnings</h3>
            <ul data-testid="content-qa-warnings">
              {contentQaWarnings.length === 0 ? <li>None</li> : contentQaWarnings.map((finding) => (
                <li key={`${finding.contentId}-${finding.ruleId}-${finding.field}`}>
                  <strong>{finding.contentId}</strong> [{finding.field}]: {finding.message}
                </li>
              ))}
            </ul>

            <h3>Per selected concept content status</h3>
            <ul data-testid="selected-concept-content-status">
              {selectedConceptContentStatus.map((item) => (
                <li key={`${item.conceptId}-${item.contentId}`}>
                  <strong>{item.conceptId}</strong> → {item.contentId} ({item.status}; errors: {item.errorCount}; warnings: {item.warningCount})
                </li>
              ))}
            </ul>
          </section>

          <section aria-label="Asset QA" style={{ marginBottom: '1rem' }}>
            <h2>Asset QA</h2>

            <h3>Asset QA Errors</h3>
            <ul data-testid="asset-qa-errors">
              {assetQaErrors.length === 0 ? <li>None</li> : assetQaErrors.map((finding) => (
                <li key={`${finding.assetId}-${finding.ruleId}-${finding.field}`}>
                  <strong>{finding.assetId}</strong> [{finding.field}]: {finding.message}
                </li>
              ))}
            </ul>

            <h3>Asset QA Warnings</h3>
            <ul data-testid="asset-qa-warnings">
              {assetQaWarnings.length === 0 ? <li>None</li> : assetQaWarnings.map((finding) => (
                <li key={`${finding.assetId}-${finding.ruleId}-${finding.field}`}>
                  <strong>{finding.assetId}</strong> [{finding.field}]: {finding.message}
                </li>
              ))}
            </ul>

            <h3>Per selected asset QA status</h3>
            <ul data-testid="selected-asset-qa-status">
              {selectedAssetQaStatus.length === 0 ? <li>None</li> : selectedAssetQaStatus.map((item) => (
                <li key={item.assetId}>
                  <strong>{item.assetId}</strong> ({item.status}; errors: {item.errorCount}; warnings: {item.warningCount})
                </li>
              ))}
            </ul>
          </section>

          <section aria-label="Asset accessibility audit" style={{ marginBottom: '1rem' }}>
            <h2>Asset accessibility audit</h2>
            <p>
              Audit status is diagnostic only. An asset moves to{' '}
              <code>library_ready</code> only when its audit status is{' '}
              <code>passed</code> and all checks are satisfied.
            </p>

            <h3>Per selected asset audit status</h3>
            <ul data-testid="selected-asset-audit-status">
              {selectedAssetAuditStatus.length === 0 ? (
                <li>None</li>
              ) : (
                selectedAssetAuditStatus.map((item) => (
                  <li key={`audit-${item.assetId}`}>
                    <strong>{item.assetId}</strong>
                    {' — audit: '}
                    <span data-testid={`audit-status-${item.assetId}`}>{item.auditStatus}</span>
                    {item.approvedFor.length > 0 && (
                      <>{'; approved for: '}<span data-testid={`approved-for-${item.assetId}`}>{item.approvedFor.join(', ')}</span></>
                    )}
                    {item.blockedReasons.length > 0 && (
                      <ul data-testid={`blocked-reasons-${item.assetId}`}>
                        {item.blockedReasons.map((reason, index) => (
                          <li key={`${item.assetId}:${reason}:${index}`}>{reason}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))
              )}
            </ul>
          </section>

          <section aria-label="Production eligibility" style={{ marginBottom: '1rem' }}>
            <h2>Production eligibility</h2>
            <p>
              Eligibility gates output delivery readiness only. They do not alter recommendations,
              scenario ranking, or engine truth. Dev preview can show unapproved assets; production
              customer pack should use <code>filter</code> mode.
            </p>
            <p data-testid="eligibility-mode-label">
              Mode: <strong data-testid="eligibility-mode-value">{eligibilityMode}</strong>
            </p>

            {eligibilityMode === 'off' ? (
              <p>Eligibility gate is off. All routing-selected assets are shown without delivery-readiness checks.</p>
            ) : (
              <>
                <h3>Per selected asset eligibility status</h3>
                <ul data-testid="selected-asset-eligibility-status">
                  {(plan.eligibilityFindings ?? []).length === 0 ? (
                    <li>None</li>
                  ) : (
                    (plan.eligibilityFindings ?? []).map((finding) => (
                      <li key={`eligibility-${finding.assetId}`} data-testid={`eligibility-${finding.assetId}`}>
                        <strong>{finding.assetId}</strong>
                        {' — '}
                        <span data-testid={`eligibility-status-${finding.assetId}`}>
                          {finding.eligible ? 'eligible' : 'blocked'}
                        </span>
                        {' (mode: '}
                        {finding.mode}
                        {')'}
                        {finding.reasons.length > 0 && (
                          <ul data-testid={`eligibility-reasons-${finding.assetId}`}>
                            {finding.reasons.map((reason, index) => (
                              <li key={`${finding.assetId}:${reason}:${index}`}>{reason}</li>
                            ))}
                          </ul>
                        )}
                        {finding.replacementHint && (
                          <p data-testid={`eligibility-hint-${finding.assetId}`}>
                            Hint: {finding.replacementHint}
                          </p>
                        )}
                      </li>
                    ))
                  )}
                </ul>

                {eligibilityMode === 'filter' && (
                  <>
                    <h3>Assets removed from production customer pack</h3>
                    <ul data-testid="eligibility-filtered-assets">
                      {(plan.eligibilityFindings ?? []).filter((f) => !f.eligible).length === 0 ? (
                        <li>None — all selected assets are eligible for this delivery mode.</li>
                      ) : (
                        (plan.eligibilityFindings ?? []).filter((f) => !f.eligible).map((finding) => (
                          <li key={`filtered-${finding.assetId}`} data-testid={`filtered-${finding.assetId}`}>
                            <strong>{finding.assetId}</strong>: {finding.reasons.join(' ')}
                            {finding.replacementHint && <> — {finding.replacementHint}</>}
                          </li>
                        ))
                      )}
                    </ul>
                  </>
                )}
              </>
            )}
          </section>

          {showValidationAudit && (
            <section aria-label="Validation audit" style={{ marginBottom: '1rem' }}>
              <h2>Real-world validation audit</h2>
              <p>
                Stress-testing the calm welcome-pack pipeline using 12 realistic customer journeys.
                This audit does not change recommendations — it surfaces content, routing, accessibility, and trust gaps.
              </p>

              <h3>Top missing concepts (across all fixtures)</h3>
              <ul data-testid="validation-top-missing-concepts">
                {topMissingConcepts.length === 0 ? (
                  <li>None — all selected concepts have registered content.</li>
                ) : (
                  topMissingConcepts.map((item) => (
                    <li key={item.conceptId}>
                      <strong>{item.conceptId}</strong>: missing in {item.count} fixture(s) — {item.missingInFixtures.join(', ')}
                    </li>
                  ))
                )}
              </ul>

              <h3>Repeated omission patterns (omitted in ≥ 3 fixtures)</h3>
              <ul data-testid="validation-repeated-omissions">
                {repeatedOmissions.length === 0 ? (
                  <li>None — no assets are repeatedly omitted across 3 or more fixtures.</li>
                ) : (
                  repeatedOmissions.map((item) => (
                    <li key={item.assetId}>
                      <strong>{item.assetId}</strong>: omitted in {item.count} fixture(s) — {item.omittedInFixtures.join(', ')}
                    </li>
                  ))
                )}
              </ul>

              <h3>Fixture comparison table</h3>
              <table data-testid="validation-fixture-table" style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid #ccc' }}>Fixture</th>
                    <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid #ccc' }}>Archetype</th>
                    <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid #ccc' }}>Readiness</th>
                    <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid #ccc' }}>Selected</th>
                    <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid #ccc' }}>Pages</th>
                    <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid #ccc' }}>Missing content</th>
                    <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid #ccc' }}>Trust risks</th>
                    <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid #ccc' }}>A11y risks</th>
                    <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid #ccc' }}>Print risks</th>
                  </tr>
                </thead>
                <tbody>
                  {validationReports.map((report) => (
                    <tr key={report.fixtureId} data-testid={`validation-row-${report.fixtureId}`}>
                      <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee' }}>{report.fixtureLabel}</td>
                      <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee' }}>{report.archetypeId}</td>
                      <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee' }}>
                        <span data-testid={`validation-readiness-${report.fixtureId}`}>{report.readiness}</span>
                      </td>
                      <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee' }}>{report.selectedAssetIds.length}</td>
                      <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee' }}>{report.pageCount}/{report.printPageBudget}</td>
                      <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee' }}>{report.missingContent.length}</td>
                      <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee' }}>{report.trustRisks.length}</td>
                      <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee' }}>{report.accessibilityRisks.length}</td>
                      <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee' }}>{report.printRisks.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h3>Per-fixture gap details</h3>
              {validationReports.map((report) => (
                <details key={report.fixtureId} style={{ marginBottom: '0.5rem' }}>
                  <summary data-testid={`validation-summary-${report.fixtureId}`}>
                    <strong>{report.fixtureLabel}</strong>
                    {' — '}
                    {report.archetypeId}
                    {' — '}
                    readiness: {report.readiness}
                  </summary>
                  <dl style={{ paddingLeft: '1rem' }}>
                    {report.missingContent.length > 0 && (
                      <>
                        <dt>Missing content</dt>
                        <dd>
                          <ul>
                            {report.missingContent.map((gap) => (
                              <li key={gap.conceptId}>{gap.conceptId}: {gap.reason}</li>
                            ))}
                          </ul>
                        </dd>
                      </>
                    )}
                    {report.missingAnalogies.length > 0 && (
                      <>
                        <dt>Missing analogies / misconception coverage</dt>
                        <dd>
                          <ul>
                            {report.missingAnalogies.map((a) => (
                              <li key={`${report.fixtureId}:analogy:${a}`}>{a}</li>
                            ))}
                          </ul>
                        </dd>
                      </>
                    )}
                    {report.trustRisks.length > 0 && (
                      <>
                        <dt>Trust risks</dt>
                        <dd>
                          <ul>
                            {report.trustRisks.map((r) => (
                              <li key={`${report.fixtureId}:trust:${r}`}>{r}</li>
                            ))}
                          </ul>
                        </dd>
                      </>
                    )}
                    {report.accessibilityRisks.length > 0 && (
                      <>
                        <dt>Accessibility risks</dt>
                        <dd>
                          <ul>
                            {report.accessibilityRisks.map((r) => (
                              <li key={`${report.fixtureId}:a11y:${r}`}>{r}</li>
                            ))}
                          </ul>
                        </dd>
                      </>
                    )}
                    {report.printRisks.length > 0 && (
                      <>
                        <dt>Print risks</dt>
                        <dd>
                          <ul>
                            {report.printRisks.map((r) => (
                              <li key={`${report.fixtureId}:print:${r}`}>{r}</li>
                            ))}
                          </ul>
                        </dd>
                      </>
                    )}
                    {report.cognitiveOverloadWarnings.length > 0 && (
                      <>
                        <dt>Cognitive overload warnings</dt>
                        <dd>
                          <ul>
                            {report.cognitiveOverloadWarnings.map((w) => (
                              <li key={`${report.fixtureId}:overload:${w}`}>{w}</li>
                            ))}
                          </ul>
                        </dd>
                      </>
                    )}
                    {report.likelyCustomerConfusionPoints.length > 0 && (
                      <>
                        <dt>Likely customer confusion points</dt>
                        <dd>
                          <ul>
                            {report.likelyCustomerConfusionPoints.map((p) => (
                              <li key={`${report.fixtureId}:confusion:${p}`}>{p}</li>
                            ))}
                          </ul>
                        </dd>
                      </>
                    )}
                    {report.recommendedNextContentAdditions.length > 0 && (
                      <>
                        <dt>Recommended next content additions</dt>
                        <dd>
                          <ul>
                            {report.recommendedNextContentAdditions.map((a) => (
                              <li key={`${report.fixtureId}:next:${a}`}>{a}</li>
                            ))}
                          </ul>
                        </dd>
                      </>
                    )}
                  </dl>
                </details>
              ))}
            </section>
          )}

          <PrintableWelcomePackSkeleton viewModel={viewModel} />
        </>
      )}

      {previewMode === 'ui_primitives' && <AtlasEducationalUiDemo />}
    </main>
  );
}

export default WelcomePackDevPreview;
