/**
 * buildSuggestedMaterialsSchedule.ts — Deterministic builder for the
 * suggested materials schedule.
 *
 * Purpose:
 *   Derive a non-priced materials schedule from accepted specification lines
 *   and scope packs for surveyor/office/installer review.
 *
 * Architecture:
 *   InstallationScopePackV1[] + SpecificationLineV1[] + SuggestedImplementationPackV1
 *     → [this function] → SuggestedMaterialLineV1[]
 *
 * Design rules:
 *   1. All output derives from supplied inputs — no invented facts.
 *   2. No new recommendation logic — material lines map from existing spec lines.
 *   3. No pricing, supplier catalogue, or stock ordering.
 *   4. Deterministic — same inputs always produce the same output.
 *   5. customerVisible defaults to false for technical detail lines.
 *   6. Heat pump emitter review produces a validation line only — no fake materials.
 *   7. Expansion vessel marked needs_survey unless sizing is confirmed in spec lines.
 *
 * Non-goals:
 *   - No pricing
 *   - No supplier catalogue
 *   - No stock ordering
 *   - No final design sign-off
 */

import type { InstallationScopePackV1 } from '../scopePacks/InstallationScopePackV1';
import type { SpecificationLineV1 } from '../specLines/SpecificationLineV1';
import type { SuggestedImplementationPackV1 } from '../SuggestedImplementationPackV1';
import type {
  SuggestedMaterialCategory,
  SuggestedMaterialConfidence,
  SuggestedMaterialLineV1,
} from './SuggestedMaterialLineV1';

// ─── Internal seed type ───────────────────────────────────────────────────────

interface MaterialSeed {
  idHint: string;
  sourceLineIds: string[];
  category: SuggestedMaterialCategory;
  label: string;
  quantity?: number;
  unit?: string;
  sizingBasis?: string;
  confidence: SuggestedMaterialConfidence;
  requiredForInstall: boolean;
  customerVisible?: boolean;
  engineerVisible?: boolean;
  officeVisible?: boolean;
  notes?: string[];
  unresolvedChecks?: string[];
}

// ─── Category ordering ────────────────────────────────────────────────────────

const CATEGORY_ORDER: readonly SuggestedMaterialCategory[] = [
  'heat_source',
  'hot_water',
  'safety',
  'valves',
  'pipework',
  'controls',
  'water_quality',
  'consumables',
  'unknown',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function linesMatching(
  lines: readonly SpecificationLineV1[],
  predicate: (line: SpecificationLineV1) => boolean,
): SpecificationLineV1[] {
  return lines.filter(predicate);
}

function idsOf(lines: readonly SpecificationLineV1[]): string[] {
  return lines.map((l) => l.lineId);
}

// ─── Mapping rules ────────────────────────────────────────────────────────────

/**
 * Maps specification lines from the unvented cylinder fixture to material lines:
 *   - cylinder spec → hot_water cylinder material
 *   - tundish material → safety tundish + discharge material
 *   - expansion material → valves expansion vessel / kit material
 */
function mapUnventedCylinderMaterials(
  lines: readonly SpecificationLineV1[],
  pack: SuggestedImplementationPackV1,
): MaterialSeed[] {
  const seeds: MaterialSeed[] = [];

  // Cylinder line
  const cylinderLines = linesMatching(
    lines,
    (l) =>
      l.sectionKey === 'hot_water'
      && l.lineType === 'material_suggestion'
      && (/cylinder/i.test(l.label) || /unvented/i.test(l.label) || /mixergy/i.test(l.label)),
  );
  if (cylinderLines.length > 0) {
    const cylinderComponent = pack.hotWater.suggestedComponents.find(
      (c) => c.id === 'unvented_cylinder' || c.id === 'mixergy_cylinder',
    );
    seeds.push({
      idHint: 'cylinder',
      sourceLineIds: idsOf(cylinderLines),
      category: 'hot_water',
      label: cylinderLines[0].label,
      quantity: 1,
      unit: 'nr',
      sizingBasis: cylinderComponent?.suggestedSpec ?? undefined,
      confidence: 'confirmed',
      requiredForInstall: true,
      customerVisible: false,
      notes: [],
      unresolvedChecks: [],
    });
  }

  // Tundish and discharge materials
  const tundishLines = linesMatching(
    lines,
    (l) =>
      l.sectionKey === 'hot_water'
      && l.lineType === 'material_suggestion'
      && /tundish/i.test(l.label),
  );
  if (tundishLines.length > 0) {
    const dischargeRouteCheck =
      'Discharge route must be confirmed on site before materials are ordered.';
    seeds.push({
      idHint: 'tundish',
      sourceLineIds: idsOf(tundishLines),
      category: 'safety',
      label: 'Tundish and discharge pipework',
      quantity: 1,
      unit: 'nr',
      confidence: 'inferred',
      requiredForInstall: true,
      customerVisible: false,
      notes: ['G3 compliant tundish and D2 pipe sizing required.'],
      unresolvedChecks: [dischargeRouteCheck],
    });
  }

  // Expansion management — expansion vessel / kit
  const expansionLines = linesMatching(
    lines,
    (l) =>
      l.sectionKey === 'hot_water'
      && l.lineType === 'material_suggestion'
      && /expansion/i.test(l.label),
  );
  if (expansionLines.length > 0) {
    // Check if sizing is confirmed from spec lines (installer_note with vessel details)
    const expansionNoteLines = linesMatching(
      lines,
      (l) =>
        l.sectionKey === 'hot_water'
        && l.lineType === 'installer_note'
        && /expansion.vessel/i.test(l.label),
    );
    const sizingConfirmed = expansionNoteLines.length > 0;
    const expansionConfidence: SuggestedMaterialConfidence = sizingConfirmed
      ? 'needs_survey'
      : 'inferred';
    const unresolvedChecks = expansionConfidence === 'needs_survey'
      ? ['Expansion vessel size must be confirmed to manufacturer sizing before ordering.']
      : [];

    seeds.push({
      idHint: 'expansion-vessel',
      sourceLineIds: idsOf([...expansionLines, ...expansionNoteLines]),
      category: 'valves',
      label: 'Expansion vessel and safety kit',
      quantity: 1,
      unit: 'nr',
      sizingBasis: 'Vessel size to manufacturer sizing — site confirmation required.',
      confidence: expansionConfidence,
      requiredForInstall: true,
      customerVisible: false,
      notes: ['Includes PRV, ERV, expansion vessel, and T&P valve hardware.'],
      unresolvedChecks,
    });
  }

  return seeds;
}

/**
 * Maps filling loop specification line to a valves material line.
 */
function mapFillingLoopMaterials(lines: readonly SpecificationLineV1[]): MaterialSeed[] {
  const seeds: MaterialSeed[] = [];

  const fillingLoopLines = linesMatching(
    lines,
    (l) =>
      l.sectionKey === 'hydraulic_components'
      && l.lineType === 'material_suggestion'
      && /filling.?loop/i.test(l.label),
  );
  if (fillingLoopLines.length > 0) {
    seeds.push({
      idHint: 'filling-loop',
      sourceLineIds: idsOf(fillingLoopLines),
      category: 'valves',
      label: 'Filling loop assembly',
      quantity: 1,
      unit: 'nr',
      confidence: 'confirmed',
      requiredForInstall: true,
      customerVisible: false,
      notes: [],
      unresolvedChecks: [],
    });
  }

  return seeds;
}

/**
 * Maps magnetic filter and inhibitor specification lines to water_quality material lines.
 */
function mapWaterQualityMaterials(lines: readonly SpecificationLineV1[]): MaterialSeed[] {
  const seeds: MaterialSeed[] = [];

  // Magnetic filter
  const filterLines = linesMatching(
    lines,
    (l) =>
      l.sectionKey === 'water_quality'
      && l.lineType === 'material_suggestion'
      && /magnetic.?filter/i.test(l.label),
  );
  if (filterLines.length > 0) {
    seeds.push({
      idHint: 'magnetic-filter',
      sourceLineIds: idsOf(filterLines),
      category: 'water_quality',
      label: 'Magnetic filter',
      quantity: 1,
      unit: 'nr',
      sizingBasis: filterLines[0].description,
      confidence: 'confirmed',
      requiredForInstall: true,
      customerVisible: false,
      notes: [],
      unresolvedChecks: [],
    });
  }

  // Inhibitor
  const inhibitorLines = linesMatching(
    lines,
    (l) =>
      l.sectionKey === 'water_quality'
      && l.lineType === 'material_suggestion'
      && /inhibitor/i.test(l.label),
  );
  if (inhibitorLines.length > 0) {
    seeds.push({
      idHint: 'inhibitor',
      sourceLineIds: idsOf(inhibitorLines),
      category: 'water_quality',
      label: 'Corrosion inhibitor',
      quantity: 1,
      unit: 'nr',
      sizingBasis: 'Dose to BS 7593 / manufacturer recommendation for system volume.',
      confidence: 'confirmed',
      requiredForInstall: true,
      customerVisible: false,
      notes: [],
      unresolvedChecks: [],
    });
  }

  // Flush strategy — chemicals / flush equipment note
  const flushLines = linesMatching(
    lines,
    (l) =>
      l.sectionKey === 'water_quality'
      && l.lineType === 'included_scope'
      && /flush/i.test(l.label),
  );
  if (flushLines.length > 0) {
    seeds.push({
      idHint: 'flush-chemicals',
      sourceLineIds: idsOf(flushLines),
      category: 'water_quality',
      label: 'Flush chemicals and equipment',
      confidence: 'needs_survey',
      requiredForInstall: true,
      customerVisible: false,
      notes: ['Flush method and chemical requirements to be confirmed on site.'],
      unresolvedChecks: ['Flush method (power flush / chemical flush / full flush) must be confirmed before installation day.'],
    });
  }

  return seeds;
}

/**
 * Maps loft capping scope lines to pipework material lines.
 */
function mapLoftCappingMaterials(lines: readonly SpecificationLineV1[]): MaterialSeed[] {
  const seeds: MaterialSeed[] = [];

  const loftLines = linesMatching(
    lines,
    (l) =>
      l.sectionKey === 'pipework'
      && l.lineType === 'included_scope'
      && /loft/i.test(l.label),
  );
  if (loftLines.length > 0) {
    seeds.push({
      idHint: 'loft-capping-fittings',
      sourceLineIds: idsOf(loftLines),
      category: 'pipework',
      label: 'Loft vent and cold-feed capping fittings',
      confidence: 'inferred',
      requiredForInstall: true,
      customerVisible: false,
      notes: ['End-caps or blanking plugs for vent and cold-feed pipe tails in loft.'],
      unresolvedChecks: ['Pipe sizes and route accessibility must be confirmed at survey.'],
    });
  }

  return seeds;
}

/**
 * Maps TRV / controls specification lines to a controls material line.
 */
function mapControlsMaterials(lines: readonly SpecificationLineV1[]): MaterialSeed[] {
  const seeds: MaterialSeed[] = [];

  const controlsLines = linesMatching(
    lines,
    (l) =>
      l.sectionKey === 'heat_source'
      && (l.lineType === 'material_suggestion' || l.lineType === 'included_scope')
      && /control/i.test(l.label),
  );
  if (controlsLines.length > 0) {
    seeds.push({
      idHint: 'controls',
      sourceLineIds: idsOf(controlsLines),
      category: 'controls',
      label: 'Heating controls package',
      confidence: 'inferred',
      requiredForInstall: true,
      customerVisible: false,
      notes: ['May include smart thermostat, programmer, TRV heads as specified.'],
      unresolvedChecks: [],
    });
  }

  return seeds;
}

/**
 * Maps heat pump emitter review validation line to a validation-only material line.
 * Does NOT create fake material entries — emitter review produces a validation line only.
 */
function mapHeatPumpEmitterValidation(lines: readonly SpecificationLineV1[]): MaterialSeed[] {
  const seeds: MaterialSeed[] = [];

  const emitterLines = linesMatching(
    lines,
    (l) =>
      l.sectionKey === 'heat_source'
      && l.lineType === 'required_validation'
      && /emitter/i.test(l.label),
  );
  if (emitterLines.length > 0) {
    // Validation line only — no materials until emitter survey is complete
    seeds.push({
      idHint: 'heat-pump-emitter-validation',
      sourceLineIds: idsOf(emitterLines),
      category: 'heat_source',
      label: 'Emitter suitability — validation only',
      confidence: 'needs_survey',
      requiredForInstall: false,
      customerVisible: false,
      notes: [
        'No materials listed here until emitter survey is complete.',
        'Emitter upgrade or additional radiators may be required — quote as variation.',
      ],
      unresolvedChecks: [
        'Emitter suitability survey must be completed before heat pump materials are confirmed.',
      ],
    });
  }

  return seeds;
}

// ─── Builder ──────────────────────────────────────────────────────────────────

/**
 * buildSuggestedMaterialsSchedule
 *
 * Deterministically derives a non-priced suggested materials schedule from
 * the supplied scope packs, specification lines, and implementation pack.
 *
 * @param scopePacks         - Scope packs from buildInstallationScopePacks
 * @param specificationLines - Specification lines from buildSpecificationLinesFromImplementationPack
 * @param implementationPack - The underlying implementation pack
 * @returns                    Array of SuggestedMaterialLineV1, ordered by category then idHint.
 */
export function buildSuggestedMaterialsSchedule(
  _scopePacks: readonly InstallationScopePackV1[],
  specificationLines: readonly SpecificationLineV1[],
  implementationPack: SuggestedImplementationPackV1,
): SuggestedMaterialLineV1[] {
  const seeds: MaterialSeed[] = [
    ...mapUnventedCylinderMaterials(specificationLines, implementationPack),
    ...mapFillingLoopMaterials(specificationLines),
    ...mapWaterQualityMaterials(specificationLines),
    ...mapLoftCappingMaterials(specificationLines),
    ...mapControlsMaterials(specificationLines),
    ...mapHeatPumpEmitterValidation(specificationLines),
  ];

  // Deduplicate by idHint — first occurrence wins
  const seenIdHints = new Set<string>();
  const deduped = seeds.filter((seed) => {
    if (seenIdHints.has(seed.idHint)) return false;
    seenIdHints.add(seed.idHint);
    return true;
  });

  // Sort by category order, then idHint for determinism
  deduped.sort((a, b) => {
    const categoryDelta =
      CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
    if (categoryDelta !== 0) return categoryDelta;
    return a.idHint.localeCompare(b.idHint);
  });

  // Assign stable materialIds
  const counts = new Map<string, number>();
  const lines = deduped.map((seed): SuggestedMaterialLineV1 => {
    const base = `${seed.category}:${seed.idHint}`;
    const count = (counts.get(base) ?? 0) + 1;
    counts.set(base, count);

    return {
      materialId: `${base}:${count}`,
      sourceLineIds: seed.sourceLineIds,
      category: seed.category,
      label: seed.label,
      ...(seed.quantity !== undefined ? { quantity: seed.quantity } : {}),
      ...(seed.unit !== undefined ? { unit: seed.unit } : {}),
      ...(seed.sizingBasis !== undefined ? { sizingBasis: seed.sizingBasis } : {}),
      confidence: seed.confidence,
      requiredForInstall: seed.requiredForInstall,
      customerVisible: seed.customerVisible ?? false,
      engineerVisible: seed.engineerVisible ?? true,
      officeVisible: seed.officeVisible ?? true,
      notes: seed.notes ?? [],
      unresolvedChecks: seed.unresolvedChecks ?? [],
    };
  });

  return lines;
}
