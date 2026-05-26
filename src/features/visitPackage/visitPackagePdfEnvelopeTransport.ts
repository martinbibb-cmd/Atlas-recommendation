import {
  validateCanonicalVisitPackage,
  type CanonicalVisitPackageValidationResult,
} from './parseCanonicalVisitPackage';
import {
  VISIT_PACKAGE_PDF_ENVELOPE_SCHEMA,
  VISIT_PACKAGE_PDF_ENVELOPE_VERSION,
  type VisitPackagePdfEnvelopeV1,
} from './VisitPackagePdfEnvelopeV1';
import type { CanonicalVisitPackageV1 } from './CanonicalVisitPackageV1';
import {
  buildCustomerDocumentModel,
  type CustomerDocumentModelV1,
} from '../../library/portal/pdf/CustomerDocumentRenderer';
import {
  buildCustomerJourneyPack,
  readCustomerJourneyPackFromGeneratedOutputs,
  resolveRecommendationConceptSelection,
  type PortalJourneyPrintModelV1,
} from '../../library/portal/pdf/buildPortalJourneyPrintModel';

export const VISIT_PACKAGE_PDF_PAYLOAD_BEGIN_MARKER = 'ATLAS_VISIT_PACKAGE_ENVELOPE_BEGIN';
export const VISIT_PACKAGE_PDF_PAYLOAD_END_MARKER = 'ATLAS_VISIT_PACKAGE_ENVELOPE_END';
export const VISIT_PACKAGE_PDF_NO_MARKER_ERROR =
  'No Atlas visit package payload marker found in PDF. This PDF is printable Atlas output only, not an importable visit package. Use Download customer PDF to create a .atlasvisit.pdf file.';

// ─── PDF layout constants ──────────────────────────────────────────────────────

const PDF_PAGE_W = 612;
const PDF_PAGE_H = 792;
const PDF_MARGIN_L = 50;
const PDF_TEXT_TOP_Y = 755;
const PDF_MIN_Y = 55; // Page bottom boundary
const SECTION_RECOMMENDATION_SUMMARY = 'Recommendation summary';
const SECTION_WHY_THIS_FITS = 'Why this fits your home';
const SECTION_PRACTICAL_OUTCOMES = 'Practical outcomes';
const SECTION_PROTECTION_AND_CONDITION = 'Protection and system condition';
const SECTION_NEXT_STEPS = 'What happens next';
const SECTION_TECHNICAL_SITE_HANDOFF = 'Technical Site Hand-off';
const INSTALLER_CHECK_HEADING = 'Installer check';
const DEEP_DIVE_LINKS_HEADING = 'Deep dive links (optional)';
const PENDING_STRUCTURAL_CALCULATION = 'Pending structural calculation';

type VisitPackagePdfEnvelopeExtractionResult =
  | { readonly ok: true; readonly envelope: VisitPackagePdfEnvelopeV1 }
  | { readonly ok: false; readonly errors: readonly string[] };

// ─── Layout item types ────────────────────────────────────────────────────────

type PdfFont = 'F1' | 'F2'; // F1 = Helvetica, F2 = Helvetica-Bold
type CustomerPdfBlockType =
  | 'section_heading'
  | 'subheading'
  | 'body'
  | 'bullet'
  | 'small'
  | 'two_column'
  | 'gap';
type CustomerPdfPageBreakPolicy = 'auto' | 'avoid' | 'always';

interface CustomerPdfDraftBlock {
  readonly kind: 'text' | 'two_column' | 'gap';
  readonly blockType: CustomerPdfBlockType;
  readonly text?: string;
  readonly leftText?: string;
  readonly rightText?: string;
  readonly font: PdfFont;
  readonly size: number;
  readonly lineHeight: number;
  readonly spacingBefore: number;
  readonly spacingAfter: number;
  readonly pageBreakPolicy: CustomerPdfPageBreakPolicy;
}

interface CustomerPdfMeasuredBlock extends CustomerPdfDraftBlock {
  readonly lines: readonly string[];
  readonly rightLines: readonly string[];
  readonly intrinsicHeight: number;
  readonly wrappedHeight: number;
  readonly totalHeight: number;
}

interface CustomerDemographicsSummary {
  readonly occupants: string;
  readonly bathrooms: string;
  readonly peakHeatLoss: string;
  readonly hotWaterDemand: string;
  readonly additionalFacts: readonly string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null && !Array.isArray(value);
}

function readNumberCandidate(
  source: Record<string, unknown> | undefined,
  keys: readonly string[],
): number | undefined {
  if (source == null) return undefined;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
}

function readCanonicalEngineMetrics(
  pkg: CanonicalVisitPackageV1 | undefined,
): Record<string, unknown> | undefined {
  if (pkg == null) return undefined;
  const loosePackage = pkg as unknown as Record<string, unknown>;
  return isRecord(loosePackage.engineMetrics) ? loosePackage.engineMetrics : undefined;
}

function readDecisionEnergyMetrics(
  pkg: CanonicalVisitPackageV1 | undefined,
): Record<string, unknown> | undefined {
  if (pkg == null) return undefined;
  const decision = isRecord(pkg.proposalTruth?.decision) ? pkg.proposalTruth?.decision : undefined;
  return isRecord(decision?.['energyMetrics']) ? decision['energyMetrics'] : undefined;
}

function readDecisionMetrics(
  pkg: CanonicalVisitPackageV1 | undefined,
): Record<string, unknown> | undefined {
  if (pkg == null) return undefined;
  const decision = isRecord(pkg.proposalTruth?.decision) ? pkg.proposalTruth?.decision : undefined;
  return isRecord(decision?.['metrics']) ? decision['metrics'] : undefined;
}

function readEngineHeatLossKw(pkg: CanonicalVisitPackageV1 | undefined): number | undefined {
  if (pkg == null) return undefined;
  const canonicalEngineMetrics = readCanonicalEngineMetrics(pkg);
  const engineInput = isRecord(pkg.engineInputSnapshot) ? pkg.engineInputSnapshot : undefined;
  const heatLossWatts = readNumberCandidate(canonicalEngineMetrics, ['heatLossWatts'])
    ?? readNumberCandidate(engineInput, ['heatLossWatts']);
  if (heatLossWatts == null) return undefined;
  return heatLossWatts / 1000;
}

function readDecisionPeakHeatLossKw(pkg: CanonicalVisitPackageV1 | undefined): number | undefined {
  const energyMetrics = readDecisionEnergyMetrics(pkg);
  return readNumberCandidate(energyMetrics, ['peakLoadKw', 'peakHeatLossKw']);
}

function readHotWaterDemandLitres(pkg: CanonicalVisitPackageV1 | undefined): number | undefined {
  if (pkg == null) return undefined;
  const canonicalEngineMetrics = readCanonicalEngineMetrics(pkg);
  const engineInput = isRecord(pkg.engineInputSnapshot) ? pkg.engineInputSnapshot : undefined;
  const fromCanonicalEngineMetrics = readNumberCandidate(canonicalEngineMetrics, [
    'dailyHotWaterLitres',
    'dailyHotWaterDemandLitres',
  ]);
  if (fromCanonicalEngineMetrics != null) return fromCanonicalEngineMetrics;
  const fromEngine = readNumberCandidate(engineInput, [
    'dailyHotWaterLitres',
    'dailyHotWaterDemandLitres',
  ]);
  if (fromEngine != null) return fromEngine;
  const energyMetrics = readDecisionEnergyMetrics(pkg);
  return readNumberCandidate(energyMetrics, [
    'dailyHotWaterLitres',
    'dailyHotWaterDemandLitres',
  ]);
}

function readTargetCylinderVolumeLitres(pkg: CanonicalVisitPackageV1 | undefined): number | undefined {
  if (pkg == null) return undefined;
  const canonicalEngineMetrics = readCanonicalEngineMetrics(pkg);
  const decisionMetrics = readDecisionMetrics(pkg);
  const engineInput = isRecord(pkg.engineInputSnapshot) ? pkg.engineInputSnapshot : undefined;
  return readNumberCandidate(canonicalEngineMetrics, ['minCylinderVolumeL', 'minimumCylinderVolumeLitres'])
    ?? readNumberCandidate(decisionMetrics, ['minCylinderVolumeL', 'minimumCylinderVolumeLitres'])
    ?? readNumberCandidate(engineInput, ['minimumCylinderVolumeLitres', 'targetCylinderVolumeLitres', 'cylinderVolumeLitres']);
}

function readTotalFloorAreaM2(pkg: CanonicalVisitPackageV1 | undefined): number | undefined {
  if (pkg == null) return undefined;
  const surveyDraft = isRecord(pkg.surveyDraft) ? pkg.surveyDraft : undefined;
  const engineInput = isRecord(pkg.engineInputSnapshot) ? pkg.engineInputSnapshot : undefined;
  const decisionMetrics = readDecisionMetrics(pkg);
  return readNumberCandidate(surveyDraft, ['floorArea', 'floorAreaM2', 'groundFloorAreaM2'])
    ?? readNumberCandidate(engineInput, ['floorArea', 'floorAreaM2', 'groundFloorAreaM2'])
    ?? readNumberCandidate(decisionMetrics, ['totalFloorAreaM2', 'floorAreaM2']);
}

function toAsciiPdfSafeText(input: string): string {
  return input.replace(/[^\x20-\x7E]/g, '?');
}

function escapePdfText(input: string): string {
  return toAsciiPdfSafeText(input)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function encodeBase64Utf8(input: string): string {
  if (typeof btoa === 'function') {
    const utf8 = encodeURIComponent(input).replace(/%([0-9A-F]{2})/gi, (_, hex) =>
      String.fromCharCode(Number.parseInt(hex, 16)));
    return btoa(utf8);
  }
  const maybeBuffer = (globalThis as { Buffer?: { from: (value: string, encoding: string) => { toString: (encoding: string) => string } } }).Buffer;
  if (maybeBuffer != null) {
    return maybeBuffer.from(input, 'utf8').toString('base64');
  }
  throw new Error('Base64 encoder unavailable.');
}

function decodeBase64Utf8(input: string): string {
  if (typeof atob === 'function') {
    const binary = atob(input);
    let encoded = '';
    for (let i = 0; i < binary.length; i += 1) {
      encoded += `%${binary.charCodeAt(i).toString(16).padStart(2, '0')}`;
    }
    return decodeURIComponent(encoded);
  }
  const maybeBuffer = (globalThis as { Buffer?: { from: (value: string, encoding: string) => { toString: (encoding: string) => string } } }).Buffer;
  if (maybeBuffer != null) {
    return maybeBuffer.from(input, 'base64').toString('utf8');
  }
  throw new Error('Base64 decoder unavailable.');
}

/**
 * Approximate max characters per line for a given font size in Helvetica,
 * fitting within the page text width (PDF_PAGE_W - 2 * PDF_MARGIN_L).
 * Helvetica average char width ≈ 0.56 × fontSize.
 */
function wrapWidth(fontSize: number): number {
  const textWidthPt = PDF_PAGE_W - 2 * PDF_MARGIN_L;
  return Math.max(20, Math.floor(textWidthPt / (fontSize * 0.56)));
}

function wordWrap(text: string, maxChars: number): readonly string[] {
  if (!hasText(text)) return [''];
  if (text.length <= maxChars) return [text];
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current.length > 0 ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current.length > 0) lines.push(current);
      current = word.length > maxChars ? word.slice(0, maxChars) : word;
    }
  }
  if (current.length > 0) lines.push(current);
  return lines.length > 0 ? lines : [text.slice(0, maxChars)];
}

function createTextBlock(
  blockType: Exclude<CustomerPdfBlockType, 'gap' | 'two_column'>,
  text: string,
  options: {
    readonly font?: PdfFont;
    readonly size?: number;
    readonly lineHeight?: number;
    readonly spacingBefore?: number;
    readonly spacingAfter?: number;
    readonly pageBreakPolicy?: CustomerPdfPageBreakPolicy;
  } = {},
): CustomerPdfDraftBlock {
  return {
    kind: 'text',
    blockType,
    text,
    font: options.font ?? (blockType === 'section_heading' || blockType === 'subheading' ? 'F2' : 'F1'),
    size: options.size ?? (blockType === 'section_heading' ? 13 : blockType === 'small' ? 9 : 11),
    lineHeight: options.lineHeight ?? (blockType === 'section_heading' ? 18 : blockType === 'small' ? 13 : 15),
    spacingBefore: options.spacingBefore ?? 0,
    spacingAfter: options.spacingAfter ?? 0,
    pageBreakPolicy: options.pageBreakPolicy ?? 'auto',
  };
}

function createGapBlock(height: number): CustomerPdfDraftBlock {
  return {
    kind: 'gap',
    blockType: 'gap',
    font: 'F1',
    // For gap blocks, `size` stores the intrinsic vertical gap height in points.
    size: height,
    lineHeight: 0,
    spacingBefore: 0,
    spacingAfter: 0,
    pageBreakPolicy: 'auto',
    text: undefined,
  };
}

// ─── Customer journey content extraction ──────────────────────────────────────

function buildFallbackPrintModel(envelope: VisitPackagePdfEnvelopeV1): PortalJourneyPrintModelV1 {
  const fallbackSummary = hasText(envelope.visibleContent.recommendationSummary)
    ? envelope.visibleContent.recommendationSummary
    : 'Journey recommendation details are missing or incomplete in this export package. Please regenerate the visit package so all customer guidance is included.';
  return {
    cover: {
      title: envelope.title,
      summary: fallbackSummary,
      customerFacts: [...envelope.visibleContent.customerPropertySummary],
    },
    recommendationReasons: [],
    sections: [],
    nextSteps: [],
    qrDestinations: [],
    pageEstimate: {
      usedPages: 1,
      maxPages: 7,
    },
  };
}

function resolveCustomerDocument(envelope: VisitPackagePdfEnvelopeV1): CustomerDocumentModelV1 {
  const canonicalVisitPackage = envelope.canonicalVisitPackage;
  const packagedJourney = readCustomerJourneyPackFromGeneratedOutputs(
    canonicalVisitPackage.generatedOutputStatus?.generatedOutputs,
  );
  const hasRecommendationContext =
    canonicalVisitPackage.proposalTruth?.decision != null
    || hasText(canonicalVisitPackage.proposalTruth?.selectedScenarioId)
    || hasText(canonicalVisitPackage.proposalTruth?.customerSummary?.headline)
    || hasText(canonicalVisitPackage.proposalTruth?.customerSummary?.recommendedSystemLabel);
  const routedSelection = resolveRecommendationConceptSelection({
    canonicalVisitPackage,
    selectedSectionIds: [],
    recommendationSummary: canonicalVisitPackage.proposalTruth?.customerSummary?.headline ?? '',
    customerFacts: [],
  });
  const staticPdfModel = (packagedJourney != null || hasRecommendationContext)
    ? buildCustomerJourneyPack({
        canonicalVisitPackage,
        customerJourneyPack: packagedJourney,
        selectedSectionIds: routedSelection.selectedSectionIds,
      educationalConceptTags: routedSelection.conceptTags,
    }).staticPdf
    : buildFallbackPrintModel(envelope);
  return buildCustomerDocumentModel({
    model: staticPdfModel,
    mode: 'packageEmbedded',
  });
}

function parseCustomerDemographicsSummary(
  customerFacts: readonly string[],
  canonicalVisitPackage?: CanonicalVisitPackageV1,
): CustomerDemographicsSummary {
  // Read core metrics directly from the canonical package — single source of truth.
  let occupants: string | undefined =
    canonicalVisitPackage?.surveyDraft.occupancyCount != null
      ? String(canonicalVisitPackage.surveyDraft.occupancyCount)
      : undefined;
  let bathrooms: string | undefined =
    canonicalVisitPackage?.surveyDraft.bathroomCount != null
      ? String(canonicalVisitPackage.surveyDraft.bathroomCount)
      : undefined;
  const peakHeatLossKw =
    readEngineHeatLossKw(canonicalVisitPackage)
    ?? readDecisionPeakHeatLossKw(canonicalVisitPackage);
  let peakHeatLoss: string | undefined =
    peakHeatLossKw != null ? `${peakHeatLossKw.toFixed(1)} kW` : undefined;
  const hotWaterDemandLitres = readHotWaterDemandLitres(canonicalVisitPackage);
  const targetCylinderVolumeLitres = readTargetCylinderVolumeLitres(canonicalVisitPackage);
  let hotWaterDemand: string | undefined =
    hotWaterDemandLitres != null
      ? `${Math.round(hotWaterDemandLitres)} L/day`
      : targetCylinderVolumeLitres != null
        ? `${Math.round(targetCylinderVolumeLitres)} L target volume`
        : undefined;

  // Scan string facts to fill any remaining gaps and collect non-standard additional facts.
  const additionalFacts: string[] = [];

  for (const fact of customerFacts) {
    if (!hasText(fact)) continue;
    const trimmed = fact.trim();
    const lower = trimmed.toLowerCase();

    const householdMatch = trimmed.match(/^household size:\s*(.+)$/i);
    if (householdMatch) {
      if (occupants == null) occupants = householdMatch[1].trim();
      continue;
    }
    const occupantsMatch = trimmed.match(/^occupants?:\s*(.+)$/i);
    if (occupantsMatch) {
      if (occupants == null) occupants = occupantsMatch[1].trim();
      continue;
    }
    if (lower.includes('household') && lower.includes('person')) {
      if (occupants == null) {
        occupants = trimmed;
        additionalFacts.push(trimmed);
      }
      continue;
    }
    const peopleInHomeMatch = trimmed.match(/^(\d+)\s*(?:people|person)\b.*\bhome\b/i);
    if (peopleInHomeMatch) {
      if (occupants == null) {
        occupants = peopleInHomeMatch[1].trim();
        additionalFacts.push(trimmed);
      }
      continue;
    }

    const bathroomsMatch = trimmed.match(/^bathrooms?:\s*(.+)$/i);
    if (bathroomsMatch) {
      if (bathrooms == null) bathrooms = bathroomsMatch[1].trim();
      continue;
    }
    if (lower.includes('bathroom')) {
      if (bathrooms == null) {
        bathrooms = trimmed;
        additionalFacts.push(trimmed);
      }
      continue;
    }

    const peakHeatLossMatch = trimmed.match(/^peak heat loss(?:\s*\(kw\))?:\s*(.+)$/i);
    if (peakHeatLossMatch) {
      if (peakHeatLoss == null) peakHeatLoss = peakHeatLossMatch[1].trim();
      continue;
    }

    const hotWaterDemandMatch = trimmed.match(/^hot water demand:\s*(.+)$/i);
    if (hotWaterDemandMatch) {
      if (hotWaterDemand == null) hotWaterDemand = hotWaterDemandMatch[1].trim();
      continue;
    }

    additionalFacts.push(trimmed);
  }

  return {
    occupants: occupants ?? 'Not recorded',
    bathrooms: bathrooms ?? 'Not recorded',
    peakHeatLoss: peakHeatLoss ?? PENDING_STRUCTURAL_CALCULATION,
    hotWaterDemand: hotWaterDemand ?? PENDING_STRUCTURAL_CALCULATION,
    additionalFacts,
  };
}

function readFactValue(
  customerFacts: readonly string[],
  patterns: readonly RegExp[],
): string | undefined {
  for (const fact of customerFacts) {
    if (!hasText(fact)) continue;
    const trimmed = fact.trim();
    for (const pattern of patterns) {
      const match = trimmed.match(pattern);
      if (match != null && hasText(match[1])) {
        return match[1].trim();
      }
    }
  }
  return undefined;
}

function coalesceMetric(
  ...values: Array<string | number | undefined | null>
): string | undefined {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
    if (hasText(value)) {
      return value.trim();
    }
  }
  return undefined;
}

function buildTechnicalSiteConstraints(
  documentModel: CustomerDocumentModelV1,
  demographics: CustomerDemographicsSummary,
  canonicalVisitPackage?: CanonicalVisitPackageV1,
): readonly string[] {
  const engineInput = isRecord(canonicalVisitPackage?.engineInputSnapshot)
    ? canonicalVisitPackage.engineInputSnapshot
    : undefined;
  const currentSystem = isRecord(engineInput?.currentSystem) ? engineInput.currentSystem : undefined;

  const perimeterM = readNumberCandidate(engineInput, ['perimeterM']);
  const groundFloorAreaM2 = readTotalFloorAreaM2(canonicalVisitPackage);
  const primaryPipeDiameter = readNumberCandidate(engineInput, ['primaryPipeDiameter'])
    ?? readNumberCandidate(currentSystem, ['primaryPipeDiameterMm']);
  const measuredPerimeterFromFacts = readFactValue(documentModel.cover.customerFacts, [
    /^measured perimeter:\s*(.+)$/i,
    /^perimeter:\s*(.+)$/i,
  ]);
  const floorAreaFromFacts = readFactValue(documentModel.cover.customerFacts, [
    /^ground floor area:\s*(.+)$/i,
    /^total floor area:\s*(.+)$/i,
    /^floor area:\s*(.+)$/i,
  ]);
  const primaryDiameterFromFacts = readFactValue(documentModel.cover.customerFacts, [
    /^current primary(?: pipe)? diameter:\s*(.+)$/i,
    /^primary(?: pipe)? diameter:\s*(.+)$/i,
  ]);

  const perimeterLabel = coalesceMetric(
    perimeterM != null ? `${perimeterM.toFixed(1)} m` : undefined,
    measuredPerimeterFromFacts,
    demographics.additionalFacts.find((fact) => /perimeter/i.test(fact)),
    hasText(documentModel.cover.addressSummary) ? documentModel.cover.addressSummary : undefined,
  ) ?? 'Not recorded';
  const groundFloorAreaLabel = coalesceMetric(
    groundFloorAreaM2 != null ? `${groundFloorAreaM2.toFixed(1)} m²` : undefined,
    floorAreaFromFacts,
    demographics.additionalFacts.find((fact) => /floor area/i.test(fact)),
  ) ?? PENDING_STRUCTURAL_CALCULATION;
  const peakHeatLossLabel = coalesceMetric(
    demographics.peakHeatLoss,
  ) ?? PENDING_STRUCTURAL_CALCULATION;
  const primaryDiameterLabel = coalesceMetric(
    primaryPipeDiameter != null ? `${primaryPipeDiameter} mm` : undefined,
    primaryDiameterFromFacts,
    demographics.additionalFacts.find((fact) => /primary/i.test(fact) && /diameter/i.test(fact)),
  ) ?? 'Not recorded';

  const lines: string[] = [
    `Measured perimeter: ${perimeterLabel}`,
    `Bathrooms: ${demographics.bathrooms}`,
    `Total floor area: ${groundFloorAreaLabel}`,
    `Calculated peak heat loss: ${peakHeatLossLabel}`,
    `Current primary diameter: ${primaryDiameterLabel}`,
  ];
  if (hasText(documentModel.cover.addressSummary)) {
    lines.push(`Property reference: ${documentModel.cover.addressSummary}`);
  }
  return lines;
}

function buildPlannedHardwareAllocations(
  documentModel: CustomerDocumentModelV1,
  demographics: CustomerDemographicsSummary,
  canonicalVisitPackage?: CanonicalVisitPackageV1,
): readonly string[] {
  const engineInput = isRecord(canonicalVisitPackage?.engineInputSnapshot)
    ? canonicalVisitPackage.engineInputSnapshot
    : undefined;
  const decision = isRecord(canonicalVisitPackage?.proposalTruth?.decision)
    ? canonicalVisitPackage.proposalTruth.decision
    : undefined;
  const currentSystem = isRecord(engineInput?.currentSystem) ? engineInput.currentSystem : undefined;
  const boiler = isRecord(currentSystem?.boiler) ? currentSystem.boiler : undefined;
  const energyMetrics = isRecord(decision?.['energyMetrics']) ? decision['energyMetrics'] : undefined;

  const cylinderType =
    (hasText(engineInput?.dhwStorageType) ? engineInput.dhwStorageType : undefined)
    ?? (hasText(engineInput?.currentHeatSourceType) ? `${engineInput.currentHeatSourceType} pathway` : undefined)
    ?? 'Not recorded';
  const targetMinimumVolumeLitres = readTargetCylinderVolumeLitres(canonicalVisitPackage);
  const calculatedRecoveryMinutes =
    readNumberCandidate(energyMetrics, ['dhwRecoveryMinutes', 'recoveryTimeMinutes', 'calculatedRecoveryMinutes'])
    ?? readNumberCandidate(engineInput, ['dhwRecoveryMinutes', 'recoveryTimeMinutes']);
  const standingLossKwhPerDay =
    readNumberCandidate(energyMetrics, ['dailyStandingLossKwh', 'standingLossKwhPerDay', 'cylinderStandingLossKwhPerDay'])
    ?? readNumberCandidate(engineInput, ['dailyStandingLossKwh', 'standingLossKwhPerDay']);
  const activeHeatSourceKw =
    readNumberCandidate(engineInput, ['currentBoilerOutputKw'])
    ?? readNumberCandidate(boiler, ['nominalOutputKw'])
    ?? readNumberCandidate(energyMetrics, ['activeHeatSourceKw', 'heatSourceOutputKw']);
  const cylinderTypeFromFacts = readFactValue(documentModel.cover.customerFacts, [
    /^cylinder type:\s*(.+)$/i,
    /^recommended cylinder type:\s*(.+)$/i,
  ]);
  const targetVolumeFromFacts = readFactValue(documentModel.cover.customerFacts, [
    /^target minimum volume:\s*(.+)$/i,
    /^minimum cylinder volume:\s*(.+)$/i,
  ]);
  const recoveryFromFacts = readFactValue(documentModel.cover.customerFacts, [
    /^calculated recovery time:\s*(.+)$/i,
    /^recovery time:\s*(.+)$/i,
  ]);
  const standingLossFromFacts = readFactValue(documentModel.cover.customerFacts, [
    /^standing loss(?: metric)?:\s*(.+)$/i,
  ]);
  const heatSourceOutputFromFacts = readFactValue(documentModel.cover.customerFacts, [
    /^active heat source output:\s*(.+)$/i,
    /^heat source output:\s*(.+)$/i,
  ]);

  const cylinderTypeLabel = coalesceMetric(
    cylinderType,
    cylinderTypeFromFacts,
    demographics.additionalFacts.find((fact) => /cylinder type/i.test(fact)),
  ) ?? 'Not recorded';
  const targetMinimumVolumeLabel = coalesceMetric(
    targetMinimumVolumeLitres != null ? `${Math.round(targetMinimumVolumeLitres)} L` : undefined,
    targetVolumeFromFacts,
  ) ?? PENDING_STRUCTURAL_CALCULATION;
  const recoveryTimeLabel = coalesceMetric(
    calculatedRecoveryMinutes != null ? `${Math.round(calculatedRecoveryMinutes)} min` : undefined,
    recoveryFromFacts,
  ) ?? 'Not recorded';
  const standingLossLabel = coalesceMetric(
    standingLossKwhPerDay != null ? `${standingLossKwhPerDay.toFixed(1)} kWh/day` : undefined,
    standingLossFromFacts,
  ) ?? 'Not recorded';
  const activeHeatSourceLabel = coalesceMetric(
    activeHeatSourceKw != null ? `${activeHeatSourceKw.toFixed(1)} kW` : undefined,
    heatSourceOutputFromFacts,
  ) ?? 'Not recorded';

  const lines: string[] = [];
  lines.push(`Cylinder type: ${cylinderTypeLabel}`);
  lines.push(`Target minimum volume: ${targetMinimumVolumeLabel}`);
  lines.push(`Calculated recovery time: ${recoveryTimeLabel}`);
  lines.push(`Standing loss metric: ${standingLossLabel}`);
  lines.push(`Active heat source output: ${activeHeatSourceLabel}`);
  lines.push(`Hot water demand: ${demographics.hotWaterDemand || PENDING_STRUCTURAL_CALCULATION}`);
  if (hasText(documentModel.cover.title)) {
    lines.push(`Recommended system: ${documentModel.cover.title}`);
  }
  return lines;
}

// ─── Deterministic customer PDF block layout engine ───────────────────────────

function measureBlock(block: CustomerPdfDraftBlock): CustomerPdfMeasuredBlock {
  if (block.kind === 'gap') {
    const intrinsicHeight = block.size;
    return {
      ...block,
      lines: [],
      rightLines: [],
      intrinsicHeight,
      wrappedHeight: 0,
      totalHeight: block.spacingBefore + intrinsicHeight + block.spacingAfter,
    };
  }

  if (block.kind === 'two_column') {
    const columnCharWidth = Math.max(10, Math.floor(wrapWidth(block.size) / 2) - 2);
    const lines = wordWrap(block.leftText ?? '', columnCharWidth);
    const rightLines = wordWrap(block.rightText ?? '', columnCharWidth);
    const lineCount = Math.max(lines.length, rightLines.length);
    const intrinsicHeight = lineCount > 0 ? block.lineHeight : 0;
    const wrappedHeight = lineCount > 1 ? (lineCount - 1) * block.lineHeight : 0;
    return {
      ...block,
      lines,
      rightLines,
      intrinsicHeight,
      wrappedHeight,
      totalHeight: block.spacingBefore + intrinsicHeight + wrappedHeight + block.spacingAfter,
    };
  }

  const lines = wordWrap(block.text ?? '', wrapWidth(block.size));
  const intrinsicHeight = lines.length > 0 ? block.lineHeight : 0;
  const wrappedHeight = lines.length > 1 ? (lines.length - 1) * block.lineHeight : 0;
  return {
    ...block,
    lines,
    rightLines: [],
    intrinsicHeight,
    wrappedHeight,
    totalHeight: block.spacingBefore + intrinsicHeight + wrappedHeight + block.spacingAfter,
  };
}

function splitMeasuredTextBlockForPage(
  block: CustomerPdfMeasuredBlock,
  availableHeight: number,
): { readonly fit: CustomerPdfMeasuredBlock; readonly remainder: CustomerPdfMeasuredBlock } | null {
  if (block.kind !== 'text' || block.lines.length < 2) return null;
  const maxRenderableLines = Math.floor((availableHeight - block.spacingBefore) / block.lineHeight);
  const fitLineCount = Math.max(1, Math.min(block.lines.length - 1, maxRenderableLines));
  if (fitLineCount < 1) return null;

  const fitLines = block.lines.slice(0, fitLineCount);
  const remainderLines = block.lines.slice(fitLineCount);
  if (remainderLines.length === 0) return null;

  const fit: CustomerPdfMeasuredBlock = {
    ...block,
    lines: fitLines,
    intrinsicHeight: fitLines.length > 0 ? block.lineHeight : 0,
    wrappedHeight: fitLines.length > 1 ? (fitLines.length - 1) * block.lineHeight : 0,
    spacingAfter: 0,
    totalHeight: 0,
  };
  const fitTotalHeight = fit.spacingBefore + fit.intrinsicHeight + fit.wrappedHeight;

  const remainder: CustomerPdfMeasuredBlock = {
    ...block,
    lines: remainderLines,
    intrinsicHeight: remainderLines.length > 0 ? block.lineHeight : 0,
    wrappedHeight: remainderLines.length > 1 ? (remainderLines.length - 1) * block.lineHeight : 0,
    spacingBefore: 0,
    totalHeight: 0,
  };
  const remainderTotalHeight = remainder.spacingBefore + remainder.intrinsicHeight + remainder.wrappedHeight + remainder.spacingAfter;

  return {
    fit: {
      ...fit,
      totalHeight: fitTotalHeight,
      rightLines: [],
    },
    remainder: {
      ...remainder,
      totalHeight: remainderTotalHeight,
      rightLines: [],
    },
  };
}

class CustomerPdfBlockLayoutEngine {
  private readonly measuredBlocks: readonly CustomerPdfMeasuredBlock[];

  constructor(blocks: readonly CustomerPdfDraftBlock[]) {
    this.measuredBlocks = blocks.map(measureBlock);
  }

  private paginate(): CustomerPdfMeasuredBlock[][] {
    const pages: CustomerPdfMeasuredBlock[][] = [];
    let currentPage: CustomerPdfMeasuredBlock[] = [];
    let currentY = PDF_TEXT_TOP_Y;
    const queue: CustomerPdfMeasuredBlock[] = [...this.measuredBlocks];

    while (queue.length > 0) {
      const block = queue.shift() as CustomerPdfMeasuredBlock;

      if (block.pageBreakPolicy === 'always' && currentPage.length > 0) {
        pages.push(currentPage);
        currentPage = [];
        currentY = PDF_TEXT_TOP_Y;
      }

      const availableHeight = currentY - PDF_MIN_Y;
      if (block.totalHeight <= availableHeight) {
        currentPage.push(block);
        currentY -= block.totalHeight;
        continue;
      }

      if (currentPage.length > 0) {
        pages.push(currentPage);
        currentPage = [];
        currentY = PDF_TEXT_TOP_Y;
        queue.unshift(block);
        continue;
      }

      const split = splitMeasuredTextBlockForPage(block, availableHeight);
      if (split != null) {
        currentPage.push(split.fit);
        pages.push(currentPage);
        currentPage = [];
        currentY = PDF_TEXT_TOP_Y;
        queue.unshift(split.remainder);
        continue;
      }

      currentPage.push(block);
      pages.push(currentPage);
      currentPage = [];
      currentY = PDF_TEXT_TOP_Y;
    }

    if (currentPage.length > 0) pages.push(currentPage);
    return pages;
  }

  private drawPageContentStream(pageBlocks: readonly CustomerPdfMeasuredBlock[]): string {
    const cmds: string[] = [];
    let y = PDF_TEXT_TOP_Y;
    const textWidthPt = PDF_PAGE_W - 2 * PDF_MARGIN_L;
    const columnGapPt = 18;
    const columnWidthPt = (textWidthPt - columnGapPt) / 2;
    const rightColumnX = PDF_MARGIN_L + columnWidthPt + columnGapPt;
    let currentFont: PdfFont | null = null;
    let currentSize = 0;
    let inBt = false;

    const ensureFont = (font: PdfFont, size: number) => {
      if (currentFont !== font || currentSize !== size) {
        if (inBt) {
          cmds.push('ET');
          inBt = false;
        }
        currentFont = font;
        currentSize = size;
      }
      if (!inBt) {
        cmds.push(`BT\n/${currentFont} ${currentSize} Tf`);
        inBt = true;
      }
    };

    for (const block of pageBlocks) {
      y -= block.spacingBefore;
      if (block.kind === 'gap') {
        y -= block.intrinsicHeight;
        y -= block.spacingAfter;
        continue;
      }

      ensureFont(block.font, block.size);
      if (block.kind === 'two_column') {
        const lineCount = Math.max(block.lines.length, block.rightLines.length);
        for (let i = 0; i < lineCount; i += 1) {
          if (i < block.lines.length) {
            cmds.push(`${PDF_MARGIN_L} ${y} Td\n(${escapePdfText(block.lines[i])}) Tj\n0 0 Td`);
          }
          if (i < block.rightLines.length) {
            cmds.push(`${rightColumnX} ${y} Td\n(${escapePdfText(block.rightLines[i])}) Tj\n0 0 Td`);
          }
          y -= block.lineHeight;
        }
        y -= block.spacingAfter;
        continue;
      }

      for (const line of block.lines) {
        cmds.push(`${PDF_MARGIN_L} ${y} Td\n(${escapePdfText(line)}) Tj\n0 0 Td`);
        y -= block.lineHeight;
      }
      y -= block.spacingAfter;
    }

    if (inBt) cmds.push('ET');
    return cmds.join('\n');
  }

  layout(): readonly string[] {
    const pages = this.paginate();
    return pages.map((page) => this.drawPageContentStream(page));
  }
}

function buildCustomerPdfDraftBlocks(
  documentModel: CustomerDocumentModelV1,
  canonicalVisitPackage?: CanonicalVisitPackageV1,
): CustomerPdfDraftBlock[] {
  const blocks: CustomerPdfDraftBlock[] = [];
  const demographics = parseCustomerDemographicsSummary(
    documentModel.cover.customerFacts,
    canonicalVisitPackage,
  );

  blocks.push(createTextBlock('section_heading', SECTION_RECOMMENDATION_SUMMARY, { pageBreakPolicy: 'always', spacingAfter: 6 }));
  if (hasText(documentModel.cover.title)) {
    blocks.push(createTextBlock('subheading', documentModel.cover.title, { spacingAfter: 4 }));
  }
  if (hasText(documentModel.cover.summary)) {
    blocks.push(createTextBlock('body', documentModel.cover.summary, { spacingAfter: 6 }));
  }
  if (hasText(documentModel.cover.addressSummary)) {
    blocks.push(createTextBlock('body', documentModel.cover.addressSummary, { spacingAfter: 6 }));
  }
  blocks.push(createTextBlock('subheading', 'Demographics Grid', { spacingAfter: 6 }));
  blocks.push(createTextBlock('body', `Occupants: ${demographics.occupants}`, { spacingAfter: 2 }));
  blocks.push(createTextBlock('body', `Bathrooms: ${demographics.bathrooms}`, { spacingAfter: 2 }));
  blocks.push(createTextBlock('body', `Peak heat loss: ${demographics.peakHeatLoss}`, { spacingAfter: 2 }));
  blocks.push(createTextBlock('body', `Hot water demand: ${demographics.hotWaterDemand}`, { spacingAfter: 10 }));
  if (demographics.additionalFacts.length > 0) {
    blocks.push(createTextBlock('subheading', 'Additional home facts', { spacingAfter: 3 }));
    for (const fact of demographics.additionalFacts) {
      blocks.push(createTextBlock('body', fact, { spacingAfter: 2 }));
    }
  }

  if (documentModel.recommendationReasons.length > 0) {
    blocks.push(createTextBlock('section_heading', SECTION_WHY_THIS_FITS, { pageBreakPolicy: 'always', spacingAfter: 6 }));
    for (const reason of documentModel.recommendationReasons) {
      blocks.push(createTextBlock('subheading', reason.homeFact, { spacingAfter: 3 }));
      blocks.push(createTextBlock('body', `Why it matters: ${reason.whyItMatters}`, { spacingAfter: 2 }));
      blocks.push(createTextBlock('body', `Atlas recommendation: ${reason.atlasRecommendationOutcome}`, { spacingAfter: 2 }));
      blocks.push(createTextBlock('body', `What you will notice: ${reason.practicalEffect}`, { spacingAfter: 3 }));
      if (hasText(reason.detail)) {
        blocks.push(createTextBlock('body', reason.detail, { spacingAfter: 4 }));
      }
    }
  }

  if (documentModel.sections.length > 0) {
    blocks.push(createTextBlock('section_heading', SECTION_PRACTICAL_OUTCOMES, { pageBreakPolicy: 'always', spacingAfter: 6 }));
    documentModel.sections.forEach((section) => {
      blocks.push(createTextBlock('body', section.summary, { spacingAfter: 3 }));
      if (hasText(section.keyTakeaway)) {
        blocks.push(createTextBlock('body', `Key takeaway: ${section.keyTakeaway}`, { spacingAfter: 3 }));
      }
      for (const item of section.items) {
        blocks.push(createTextBlock('bullet', `- ${item}`, { spacingAfter: 2 }));
      }
      blocks.push(createGapBlock(6));
    });
  }

  if (documentModel.systemProtection != null) {
    blocks.push(createTextBlock('section_heading', SECTION_PROTECTION_AND_CONDITION, { pageBreakPolicy: 'always', spacingAfter: 6 }));
    blocks.push(createTextBlock('subheading', documentModel.systemProtection.title, { spacingAfter: 3 }));
    blocks.push(createTextBlock('body', documentModel.systemProtection.customerSummary, { spacingAfter: 3 }));
    for (const bullet of documentModel.systemProtection.customerVisibleBullets) {
      blocks.push(createTextBlock('bullet', `- ${bullet}`, { spacingAfter: 2 }));
    }
    if (hasText(documentModel.systemProtection.whatInstallerWillCheck)) {
      blocks.push(createTextBlock('subheading', INSTALLER_CHECK_HEADING, { spacingBefore: 4, spacingAfter: 3 }));
      blocks.push(createTextBlock('body', documentModel.systemProtection.whatInstallerWillCheck, { spacingAfter: 3 }));
    }
  }

  blocks.push(createTextBlock('section_heading', SECTION_NEXT_STEPS, { pageBreakPolicy: 'always', spacingAfter: 6 }));
  for (const step of documentModel.nextSteps) {
    if (hasText(step.label)) {
      blocks.push(createTextBlock('subheading', step.label, { spacingAfter: 2 }));
    }
    if (hasText(step.body)) {
      blocks.push(createTextBlock('body', step.body, { spacingAfter: 3 }));
    }
  }
  if (documentModel.qrDestinations.length > 0) {
    blocks.push(createTextBlock('subheading', DEEP_DIVE_LINKS_HEADING, { spacingBefore: 4, spacingAfter: 3 }));
    for (const destination of documentModel.qrDestinations) {
      if (hasText(destination.heading)) {
        blocks.push(createTextBlock('body', destination.heading, { spacingAfter: 2 }));
      }
      if (hasText(destination.note)) {
        blocks.push(createTextBlock('small', destination.note, { spacingAfter: 3 }));
      }
    }
  }

  blocks.push(createTextBlock('section_heading', SECTION_TECHNICAL_SITE_HANDOFF, { pageBreakPolicy: 'always', spacingAfter: 6 }));
  const siteConstraintLines = buildTechnicalSiteConstraints(documentModel, demographics, canonicalVisitPackage);
  const hardwareAllocationLines = buildPlannedHardwareAllocations(documentModel, demographics, canonicalVisitPackage);
  blocks.push(createTextBlock('subheading', 'Physical Site Constraints', { spacingAfter: 4 }));
  for (const line of siteConstraintLines) {
    blocks.push(createTextBlock('body', line, { spacingAfter: 2 }));
  }
  blocks.push(createGapBlock(6));
  blocks.push(createTextBlock('subheading', 'Planned Hardware Allocations', { spacingAfter: 4 }));
  for (const line of hardwareAllocationLines) {
    blocks.push(createTextBlock('body', line, { spacingAfter: 2 }));
  }

  return blocks;
}

// ─── Multi-page PDF assembly ──────────────────────────────────────────────────

/**
 * Assembles a complete PDF from an array of content streams and an embedded payload.
 *
 * Object layout (N pages):
 *   1       – Catalog
 *   2       – Pages tree
 *   3..N+2  – Page objects (odd-indexed pairs)
 *   N+3     – Font F1 (Helvetica)
 *   N+4     – Font F2 (Helvetica-Bold)
 *   N+5     – Payload stream (not linked to any page)
 *
 * Content streams are interleaved at page+1 object IDs, so page i occupies
 * objects 3+2*(i-1) and 4+2*(i-1).
 */
function assemblePdf(pageContentStreams: readonly string[], payloadStream: string): string {
  const n = pageContentStreams.length;

  // Object IDs
  const pageObjIds: number[] = [];
  const contentObjIds: number[] = [];
  for (let i = 0; i < n; i += 1) {
    pageObjIds.push(3 + 2 * i);
    contentObjIds.push(4 + 2 * i);
  }
  const fontF1ObjId = 3 + 2 * n;
  const fontF2ObjId = 4 + 2 * n;
  const payloadObjId = 5 + 2 * n;
  const totalObjects = payloadObjId;

  const fontResourceRef = `<< /Font << /F1 ${fontF1ObjId} 0 R /F2 ${fontF2ObjId} 0 R >> >>`;
  const pageKidsStr = pageObjIds.map((id) => `${id} 0 R`).join(' ');

  // Build object strings
  const objectStrings: string[] = new Array<string>(totalObjects);
  objectStrings[0] = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
  objectStrings[1] = `2 0 obj\n<< /Type /Pages /Kids [${pageKidsStr}] /Count ${n} >>\nendobj\n`;

  for (let i = 0; i < n; i += 1) {
    const pageId = pageObjIds[i];
    const contentId = contentObjIds[i];
    objectStrings[pageId - 1] = `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_PAGE_W} ${PDF_PAGE_H}] /Contents ${contentId} 0 R /Resources ${fontResourceRef} >>\nendobj\n`;
    const cs = pageContentStreams[i];
    objectStrings[contentId - 1] = `${contentId} 0 obj\n<< /Length ${cs.length} >>\nstream\n${cs}\nendstream\nendobj\n`;
  }

  objectStrings[fontF1ObjId - 1] = `${fontF1ObjId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`;
  objectStrings[fontF2ObjId - 1] = `${fontF2ObjId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n`;
  objectStrings[payloadObjId - 1] = `${payloadObjId} 0 obj\n<< /Length ${payloadStream.length} >>\nstream\n${payloadStream}\nendstream\nendobj\n`;

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0]; // offset[0] unused (free object), offsets[1..totalObjects] = byte offsets
  for (const objStr of objectStrings) {
    offsets.push(pdf.length);
    pdf += objStr;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${totalObjects + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= totalObjects; i += 1) {
    pdf += `${offsets[i].toString().padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return pdf;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Renders a customer-facing PDF with the full recommendation content as visible
 * pages and the canonical visit package embedded as a hidden payload stream.
 *
 * Visible content is sourced from CustomerJourneyPackV1.staticPdf when present
 * in the package's generatedOutputs; otherwise falls back to envelope metadata.
 * The embedded payload is always the complete VisitPackagePdfEnvelopeV1 and is
 * used for digital import — it does not affect browser print or save behaviour.
 */
export function renderVisitPackagePdfDocument(envelope: VisitPackagePdfEnvelopeV1): string {
  const payloadBase64 = encodeBase64Utf8(JSON.stringify(envelope));
  const payloadStream = `${VISIT_PACKAGE_PDF_PAYLOAD_BEGIN_MARKER}\n${payloadBase64}\n${VISIT_PACKAGE_PDF_PAYLOAD_END_MARKER}`;

  const customerDocument = resolveCustomerDocument(envelope);

  const layoutEngine = new CustomerPdfBlockLayoutEngine(
    buildCustomerPdfDraftBlocks(customerDocument, envelope.canonicalVisitPackage),
  );
  const contentStreams = layoutEngine.layout();
  return assemblePdf(contentStreams, payloadStream);
}

export function extractVisitPackagePdfEnvelope(
  input: string,
): VisitPackagePdfEnvelopeExtractionResult {
  const begin = input.indexOf(VISIT_PACKAGE_PDF_PAYLOAD_BEGIN_MARKER);
  const end = input.indexOf(VISIT_PACKAGE_PDF_PAYLOAD_END_MARKER);
  if (begin < 0 || end < 0 || end <= begin) {
    return { ok: false, errors: [VISIT_PACKAGE_PDF_NO_MARKER_ERROR] };
  }
  const payloadBase64 = input
    .slice(begin + VISIT_PACKAGE_PDF_PAYLOAD_BEGIN_MARKER.length, end)
    .trim();
  if (!hasText(payloadBase64)) {
    return { ok: false, errors: ['Embedded Atlas visit package payload is empty.'] };
  }
  try {
    const raw = JSON.parse(decodeBase64Utf8(payloadBase64)) as unknown;
    if (!isRecord(raw)) {
      return { ok: false, errors: ['Embedded payload must be an object.'] };
    }
    if (raw['schema'] !== VISIT_PACKAGE_PDF_ENVELOPE_SCHEMA) {
      return { ok: false, errors: ['Embedded payload schema mismatch for visit package PDF envelope.'] };
    }
    if (raw['version'] !== VISIT_PACKAGE_PDF_ENVELOPE_VERSION) {
      return { ok: false, errors: ['Embedded payload version mismatch for visit package PDF envelope.'] };
    }
    if (!isRecord(raw['canonicalVisitPackage'])) {
      return { ok: false, errors: ['Embedded payload missing canonical visit package object.'] };
    }
    return {
      ok: true,
      envelope: raw as unknown as VisitPackagePdfEnvelopeV1,
    };
  } catch {
    return { ok: false, errors: ['Embedded Atlas visit package payload is not valid.'] };
  }
}

export function parseCanonicalVisitPackageFromPdfEnvelope(
  input: string,
): CanonicalVisitPackageValidationResult {
  const extracted = extractVisitPackagePdfEnvelope(input);
  if (!extracted.ok) {
    return { ok: false, errors: extracted.errors };
  }
  return validateCanonicalVisitPackage(extracted.envelope.canonicalVisitPackage);
}
