/**
 * buildInstallationScopePacks.ts — Deterministic builder for installation scope packs.
 *
 * Purpose:
 *   Group generated specification lines into reusable surveyor-facing scope
 *   bundles (InstallationScopePackV1) that can be accepted, edited, or expanded.
 *
 * Architecture:
 *   SpecificationLineV1[] + SuggestedImplementationPackV1
 *     → [this function] → InstallationScopePackV1[]
 *
 * Design rules:
 *   1. All output derives from supplied inputs — no invented facts.
 *   2. No new recommendation logic — only grouping and summarisation.
 *   3. No customer-facing language in engineer/office summaries.
 *   4. Deterministic — same inputs always produce the same output.
 *   5. Pack status changes never mutate the source spec lines.
 *   6. Customer summary must omit technical-only implementation detail.
 *   7. NOT customer-facing. NOT quote pricing. NOT compliance pass/fail.
 *      NOT final engineering design.
 */

import type { SuggestedImplementationPackV1 } from '../SuggestedImplementationPackV1';
import type {
  SpecificationLineType,
  SpecificationLineV1,
} from '../specLines/SpecificationLineV1';
import type { InstallationScopePackV1, ScopePackReviewStatus } from './InstallationScopePackV1';

// ─── Pack template ────────────────────────────────────────────────────────────

/**
 * Internal template used to define each pack's static metadata and matching
 * logic before line IDs are injected from the actual spec lines.
 */
interface ScopePackTemplate {
  readonly packId: string;
  readonly label: string;
  readonly description: string;
  readonly appliesToScenarioTypes: readonly string[];
  readonly requiredLineTypes: readonly SpecificationLineType[];
  readonly optionalLineTypes: readonly SpecificationLineType[];
  readonly customerSummary: string;
  readonly engineerSummary: string;
  readonly officeSummary: string;
  /**
   * Returns true if this pack should be emitted for the given implementation
   * pack and spec lines.  Should not mutate inputs.
   */
  isApplicable(
    pack: SuggestedImplementationPackV1,
    lines: readonly SpecificationLineV1[],
  ): boolean;
  /** Returns the line IDs to include by default. */
  selectRequired(lines: readonly SpecificationLineV1[]): string[];
  /** Returns the optional line IDs (in scope but not included by default). */
  selectOptional(lines: readonly SpecificationLineV1[]): string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hasLineMatching(
  lines: readonly SpecificationLineV1[],
  predicate: (line: SpecificationLineV1) => boolean,
): boolean {
  return lines.some(predicate);
}

function idsMatching(
  lines: readonly SpecificationLineV1[],
  predicate: (line: SpecificationLineV1) => boolean,
): string[] {
  return lines.filter(predicate).map((l) => l.lineId);
}

// ─── Pack template definitions ────────────────────────────────────────────────

const PACK_TEMPLATES: readonly ScopePackTemplate[] = [
  // ─── 1. Standard unvented cylinder installation ────────────────────────────
  {
    packId: 'standard_unvented_cylinder_install',
    label: 'Standard Unvented Cylinder Installation',
    description:
      'Installation scope for a mains-fed unvented hot water cylinder, including '
      + 'safety controls, discharge arrangements, and G3 compliance notification.',
    appliesToScenarioTypes: [
      'system_unvented',
      'regular_unvented',
      'stored_unvented',
      'mixergy',
    ],
    requiredLineTypes: ['included_scope', 'material_suggestion', 'compliance_item'],
    optionalLineTypes: ['required_validation', 'installer_note'],
    customerSummary:
      'Your new mains-fed hot water cylinder will be installed with the required '
      + 'safety controls and discharge pipework.',
    engineerSummary:
      'Scope covers cylinder installation, safety pack (T&P valve, ERV, expansion '
      + 'vessel), tundish and compliant discharge route, G3 notification, and '
      + 'commissioning to manufacturer and Building Regulations Part G3 requirements.',
    officeSummary:
      'G3 unvented scope: cylinder supply and fit, safety controls, tundish/discharge '
      + 'pipework. G3 notification required. Verify discharge route accessibility at '
      + 'survey stage.',

    isApplicable(_pack, lines) {
      return hasLineMatching(
        lines,
        (l) =>
          l.sectionKey === 'hot_water'
          && (l.lineType === 'material_suggestion' || l.lineType === 'included_scope')
          && (/unvented/i.test(l.label) || /cylinder/i.test(l.label) || /mixergy/i.test(l.label)),
      );
    },

    selectRequired(lines) {
      return idsMatching(
        lines,
        (l) =>
          (l.sectionKey === 'hot_water'
            && (l.lineType === 'included_scope' || l.lineType === 'material_suggestion')
            && (/unvented/i.test(l.label)
              || /cylinder/i.test(l.label)
              || /mixergy/i.test(l.label)
              || /tundish/i.test(l.label)
              || /expansion/i.test(l.label)))
          || (l.sectionKey === 'safety_compliance' && /g3/i.test(l.label)),
      );
    },

    selectOptional(lines) {
      return idsMatching(
        lines,
        (l) =>
          l.sectionKey === 'hot_water'
          && (l.lineType === 'required_validation' || l.lineType === 'installer_note')
          && (/tundish/i.test(l.label)
            || /discharge/i.test(l.label)
            || /expansion/i.test(l.label)),
      );
    },
  },

  // ─── 2. Open-vented to sealed system conversion ───────────────────────────
  {
    packId: 'open_vented_to_sealed_conversion',
    label: 'Open-Vented to Sealed System Conversion',
    description:
      'Conversion scope from an open-vented (tank-fed) circuit to a sealed pressurised '
      + 'system, including loft tank decommissioning, filling loop, and sealed '
      + 'commissioning.',
    appliesToScenarioTypes: ['system_unvented', 'regular_unvented', 'stored_unvented'],
    requiredLineTypes: ['included_scope', 'material_suggestion'],
    optionalLineTypes: ['required_validation'],
    customerSummary:
      'The existing tank-fed heating circuit will be converted to a modern sealed '
      + 'pressurised system.',
    engineerSummary:
      'Scope covers loft feed/vent capping or tank removal, sealed filling loop '
      + 'installation, pressure-test, and recommissioning of the sealed circuit.',
    officeSummary:
      'Open-vented conversion: cap/remove loft tank and cold-feed pipework, fit '
      + 'sealed filling loop. Confirm loft access at survey. Site validation required '
      + 'for vent/cold-feed routes.',

    isApplicable(_pack, lines) {
      return hasLineMatching(
        lines,
        (l) =>
          l.sectionKey === 'pipework'
          && l.lineType === 'included_scope'
          && /loft/i.test(l.label),
      );
    },

    selectRequired(lines) {
      return idsMatching(
        lines,
        (l) =>
          (l.sectionKey === 'pipework'
            && l.lineType === 'included_scope'
            && /loft/i.test(l.label))
          || (l.sectionKey === 'hydraulic_components'
            && /filling.?loop/i.test(l.label)),
      );
    },

    selectOptional(lines) {
      return idsMatching(
        lines,
        (l) =>
          l.sectionKey === 'pipework'
          && l.lineType === 'required_validation'
          && /loft/i.test(l.label),
      );
    },
  },

  // ─── 3. Boiler replacement with water quality ─────────────────────────────
  {
    packId: 'boiler_replacement_with_water_quality',
    label: 'Boiler Replacement with Water Quality Pack',
    description:
      'Boiler replacement scope including primary circuit water-quality treatment: '
      + 'magnetic filtration, flush strategy, and inhibitor dosing.',
    appliesToScenarioTypes: [],
    requiredLineTypes: ['material_suggestion', 'included_scope'],
    optionalLineTypes: ['included_scope'],
    customerSummary:
      'Your new boiler installation includes a water treatment programme to protect '
      + 'the heating system and maintain efficiency.',
    engineerSummary:
      'Scope covers magnetic filter supply and fit, primary circuit flush (method '
      + 'to be confirmed on site), and corrosion inhibitor dosing to BS 7593.',
    officeSummary:
      'Water quality pack: magnetic filter, flush (method TBC on site), inhibitor '
      + 'dose. Flush method may affect programme duration — confirm with engineer.',

    isApplicable(_pack, lines) {
      return hasLineMatching(lines, (l) => l.sectionKey === 'water_quality');
    },

    selectRequired(lines) {
      return idsMatching(
        lines,
        (l) =>
          l.sectionKey === 'water_quality'
          && (l.lineType === 'material_suggestion')
          && (/magnetic.?filter/i.test(l.label) || /inhibitor/i.test(l.label)),
      );
    },

    selectOptional(lines) {
      return idsMatching(
        lines,
        (l) =>
          l.sectionKey === 'water_quality'
          && l.lineType === 'included_scope'
          && /flush/i.test(l.label),
      );
    },
  },

  // ─── 4. Heat pump — emitter review ───────────────────────────────────────
  {
    packId: 'heat_pump_emitter_review',
    label: 'Heat Pump Emitter Suitability Review',
    description:
      'Pre-installation emitter review to confirm all radiators and underfloor '
      + 'zones can deliver design heat output at low flow temperatures.',
    appliesToScenarioTypes: ['ashp', 'heat_pump'],
    requiredLineTypes: ['required_validation'],
    optionalLineTypes: [],
    customerSummary:
      'Before your heat pump is installed, each radiator will be checked to '
      + 'confirm it can keep your home warm at the lower temperatures a heat pump '
      + 'operates at.',
    engineerSummary:
      'Emitter survey required before installation: confirm each radiator output '
      + 'at design delta-T for heat pump flow temperatures. Upgrade or addition '
      + 'of emitters may be required.',
    officeSummary:
      'Emitter review scope: confirm all emitters adequate at heat pump flow '
      + 'temperatures. May identify additional radiator or underfloor work — '
      + 'quote as variation if required.',

    isApplicable(_pack, lines) {
      return hasLineMatching(
        lines,
        (l) =>
          l.sectionKey === 'heat_source'
          && l.lineType === 'required_validation'
          && /emitter/i.test(l.label),
      );
    },

    selectRequired(lines) {
      return idsMatching(
        lines,
        (l) =>
          l.sectionKey === 'heat_source'
          && l.lineType === 'required_validation'
          && /emitter/i.test(l.label),
      );
    },

    selectOptional() {
      return [];
    },
  },

  // ─── 5. Heat pump — hydraulic review ─────────────────────────────────────
  {
    packId: 'heat_pump_hydraulic_review',
    label: 'Heat Pump Hydraulic Circuit Review',
    description:
      'Hydraulic separation, buffer vessel assessment, and primary circuit '
      + 'flow-rate confirmation for heat pump compatibility.',
    appliesToScenarioTypes: ['ashp', 'heat_pump'],
    requiredLineTypes: ['material_suggestion', 'installer_note'],
    optionalLineTypes: ['required_validation'],
    customerSummary:
      'Your heating circuit will be checked and, if needed, adapted so that your '
      + 'heat pump can run efficiently and quietly.',
    engineerSummary:
      'Scope covers hydraulic separation assessment, buffer vessel sizing if '
      + 'required, primary circuit flow-rate confirmation, and low-loss header or '
      + 'plate heat exchanger supply and fit if indicated.',
    officeSummary:
      'Heat pump hydraulic scope: flow-rate assessment, buffer/separation '
      + 'hardware if required. MCS compliance applies. Confirm requirements '
      + 'after emitter review.',

    isApplicable(pack) {
      return (
        pack.recommendedScenarioId.includes('ashp')
        || pack.recommendedScenarioId.includes('heat_pump')
      );
    },

    selectRequired(lines) {
      return idsMatching(
        lines,
        (l) =>
          l.sectionKey === 'hydraulic_components'
          && (l.lineType === 'material_suggestion' || l.lineType === 'installer_note'),
      );
    },

    selectOptional(lines) {
      return idsMatching(
        lines,
        (l) =>
          l.sectionKey === 'hydraulic_components'
          && l.lineType === 'required_validation',
      );
    },
  },

  // ─── 6. Smart controls setup ──────────────────────────────────────────────
  {
    packId: 'smart_controls_setup',
    label: 'Smart Controls Setup',
    description:
      'Supply, installation, and commissioning of smart heating controls, '
      + 'including wireless room thermostat, programmer, and TRV upgrade.',
    appliesToScenarioTypes: [],
    requiredLineTypes: ['material_suggestion', 'included_scope'],
    optionalLineTypes: ['installer_note'],
    customerSummary:
      'New smart controls will be set up so you can manage your heating from '
      + 'your phone or by voice, and the system can learn your schedule.',
    engineerSummary:
      'Scope covers smart thermostat supply and fit, programmer configuration, '
      + 'TRV upgrade where indicated, and wireless commissioning and app setup.',
    officeSummary:
      'Smart controls: thermostat, programmer, TRV upgrade. Confirm connectivity '
      + 'requirements and app registration at handover.',

    isApplicable(_pack, lines) {
      return hasLineMatching(lines, (l) => l.sectionKey === 'heat_source' && /control/i.test(l.label));
    },

    selectRequired(lines) {
      return idsMatching(
        lines,
        (l) =>
          l.sectionKey === 'heat_source'
          && /control/i.test(l.label)
          && (l.lineType === 'material_suggestion' || l.lineType === 'included_scope'),
      );
    },

    selectOptional(lines) {
      return idsMatching(
        lines,
        (l) =>
          l.sectionKey === 'heat_source'
          && /control/i.test(l.label)
          && l.lineType === 'installer_note',
      );
    },
  },

  // ─── 7. Future-ready allowances ───────────────────────────────────────────
  {
    packId: 'future_ready_allowances',
    label: 'Future-Ready Allowances',
    description:
      'Provisional scope items to keep future upgrade pathways open, including '
      + 'heat pump pipework sizing, PV-ready wiring allowances, and smart-grid '
      + 'readiness.',
    appliesToScenarioTypes: [],
    requiredLineTypes: ['provisional_allowance'],
    optionalLineTypes: ['installer_note'],
    customerSummary:
      'A small number of future-proofing allowances are included so that adding '
      + 'a heat pump, solar panels, or smart-grid controls later is straightforward.',
    engineerSummary:
      'Provisional allowances: oversized primary pipework where indicated, '
      + 'wiring provision for future heat pump controller, spare capacity in '
      + 'cylinder wiring centre. Confirm scope at design stage.',
    officeSummary:
      'Future-ready provisional allowances — include in quote as separate '
      + 'provisional sums. Confirm with customer and engineer before finalising.',

    isApplicable(pack) {
      return pack.futureReady.items.length > 0;
    },

    selectRequired(lines) {
      return idsMatching(
        lines,
        (l) => l.lineType === 'provisional_allowance',
      );
    },

    selectOptional(lines) {
      return idsMatching(
        lines,
        (l) =>
          l.lineType === 'installer_note'
          && (/future/i.test(l.label) || /ashp/i.test(l.label) || /heat.?pump/i.test(l.label)),
      );
    },
  },
];

// ─── Builder ──────────────────────────────────────────────────────────────────

/**
 * buildInstallationScopePacks
 *
 * Deterministically groups the supplied specification lines into
 * installer-ready scope bundles based on the implementation pack context.
 *
 * @param lines            - Specification lines from buildSpecificationLinesFromImplementationPack
 * @param implementationPack - The implementation pack used to generate the lines
 * @returns                  Array of applicable InstallationScopePackV1 instances,
 *                           ordered by pack definition order.
 */
export function buildInstallationScopePacks(
  lines: readonly SpecificationLineV1[],
  implementationPack: SuggestedImplementationPackV1,
): InstallationScopePackV1[] {
  const result: InstallationScopePackV1[] = [];

  for (const template of PACK_TEMPLATES) {
    if (!template.isApplicable(implementationPack, lines)) continue;

    const defaultIncludedLineIds = template.selectRequired(lines);
    const optionalLineIds = template.selectOptional(lines);

    // Exclude optional lines that are already in the required set.
    const includedSet = new Set(defaultIncludedLineIds);
    const defaultExcludedLineIds = optionalLineIds.filter((id) => !includedSet.has(id));

    const reviewStatus: ScopePackReviewStatus = 'suggested';

    result.push({
      packId: template.packId,
      label: template.label,
      description: template.description,
      appliesToScenarioTypes: template.appliesToScenarioTypes,
      requiredLineTypes: template.requiredLineTypes,
      optionalLineTypes: template.optionalLineTypes,
      defaultIncludedLineIds,
      defaultExcludedLineIds,
      customerSummary: template.customerSummary,
      engineerSummary: template.engineerSummary,
      officeSummary: template.officeSummary,
      reviewStatus,
    });
  }

  return result;
}
