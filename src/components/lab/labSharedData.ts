/**
 * labSharedData.ts
 *
 * Shared placeholder data and types used by both LabShell and the print-layout
 * components.  A future PR will replace the PLACEHOLDER_* constants with live
 * engine output once the recommendation scoring module is wired into the UI.
 */

import type { ConfidenceStripData } from './LabConfidenceStrip';

// ─── Live print data type ─────────────────────────────────────────────────────

/**
 * All configurable data consumed by the three print-layout components.
 *
 * When provided as a prop the print components use this data instead of the
 * PLACEHOLDER_* constants, allowing the Full Survey results flow to render
 * real engine output in the same print surfaces.
 */
export interface LabPrintData {
  /** Confidence level label, e.g. "High", "Medium", "Low". */
  confidence: string;
  /** Human-readable current system label, e.g. "Gas Combi". */
  currentSystem: string;
  /** Headline verdict for the print document. */
  verdict: { system: string; note: string };
  /** ID of the recommended system within `candidates`. */
  recommendedSystemId: string;
  /** Confidence strip data (measured / inferred / missing / nextStep). */
  confidenceStrip: ConfidenceStripData;
  /** Candidate systems to compare (up to 2). */
  candidates: CandidateSystem[];
  /**
   * Current system represented as a CandidateSystem for the comparison sheet.
   * Includes the same row structure as candidates for table alignment.
   */
  currentSystemForComparison: CandidateSystem;
}

// ─── Placeholder context ──────────────────────────────────────────────────────

/** Fallback current system label — replaced by engine/stepper context in a later PR. */
export const PLACEHOLDER_CURRENT_SYSTEM = 'Gas Combi';

/** Confidence level label shown in the context row badge. Replaced by engine output. */
export const PLACEHOLDER_CONFIDENCE = 'Medium';

// ─── Confidence strip data ────────────────────────────────────────────────────

export const PLACEHOLDER_CONFIDENCE_STRIP: ConfidenceStripData = {
  measured: [
    'Current system type',
    'Bathroom count',
    'Simultaneous outlets',
    'Occupancy count',
  ],
  inferred: [
    'DHW demand (from occupancy pattern)',
    'Cylinder suitability baseline',
    'Storage regime default (not explicitly confirmed)',
  ],
  missing: [
    'Emitter output verification',
    'Flow temperature confirmation',
    'Cylinder siting / routing confirmation',
  ],
  nextStep: 'Complete a Full Survey to confirm compatibility and tighten recommendation confidence.',
};

// ─── Headline verdict ─────────────────────────────────────────────────────────

export const PLACEHOLDER_VERDICT = {
  system: 'ASHP with unvented cylinder',
  note:   'Meets heat and hot water demand with efficient operating cost tendency. Requires emitter check before installation.',
};

/**
 * ID of the candidate system that the headline verdict points to.
 * Replaced by engine output in a later PR.
 */
export const PLACEHOLDER_RECOMMENDED_SYSTEM_ID = 'ashp';

// ─── Normalized comparison headings ──────────────────────────────────────────

export const COMPARISON_HEADINGS = [
  { key: 'heat',        label: 'Heat performance' },
  { key: 'dhw',         label: 'Hot water performance' },
  { key: 'reliability', label: 'Reliability' },
  { key: 'longevity',   label: 'Longevity' },
  { key: 'disruption',  label: 'Disruption' },
  { key: 'control',     label: 'Control' },
  { key: 'eco',         label: 'Eco / operating behaviour' },
  { key: 'future',      label: 'Future compatibility' },
] as const;

export type HeadingKey = typeof COMPARISON_HEADINGS[number]['key'];

// ─── Candidate system types ───────────────────────────────────────────────────

export interface CandidateExplanation {
  suits: string;
  struggles: string;
  changes: string;
  /** Optional context-aware hint surfacing missing or estimated inputs. Shown below suits. */
  suitsHint?: string;
  /** Optional context-aware hint surfacing missing or estimated inputs. Shown below struggles. */
  strugglesHint?: string;
  /** Optional context-aware hint surfacing missing or estimated inputs. Shown below changes. */
  changesHint?: string;
}

export interface CandidateSystem {
  id: string;
  label: string;
  rows: Record<HeadingKey, string>;
  explanation: CandidateExplanation;
}

// ─── Candidate systems ────────────────────────────────────────────────────────

export const CANDIDATE_SYSTEMS: CandidateSystem[] = [
  {
    id: 'gas_system',
    label: 'Gas System + Cylinder',
    rows: {
      heat:        'Adequate for most UK heat losses. Flow temps 65–70 °C support standard radiators.',
      dhw:         'Stored supply; reheat time ~30–45 min depending on cylinder size.',
      reliability: 'Mature technology with established supply chain and servicing.',
      longevity:   'Boiler lifespan 12–15 years typical; cylinder 20–25 years.',
      disruption:  'Cylinder installation requires space and pipework changes.',
      control:     'S-plan or Y-plan zone control. Smart thermostat compatible.',
      eco:         'Efficiency peaks when condensing; reduced cycling with stored supply.',
      future:      'Gas grid uncertainty post-2035. Hydrogen-ready boilers emerging.',
    },
    explanation: {
      suits:       'Strong on-demand hot water resilience, familiar controls, and proven compatibility with existing radiator systems at standard flow temperatures.',
      suitsHint:   'Hot water demand estimated from occupancy count. Cylinder sizing not yet confirmed.',
      struggles:   'Higher carbon pathway as gas prices and grid carbon intensity work against it long-term. Requires cylinder space and dedicated pipework changes.',
      changes:     'Confirm cylinder siting, primary routing, and zoning/control layout before proceeding.',
      changesHint: 'Cylinder siting and primary routing are currently assumed. A full survey is required to confirm.',
    },
  },
  {
    id: 'ashp',
    label: 'ASHP',
    rows: {
      heat:        'Best at low flow temps (35–50 °C). May require emitter upgrades on older homes.',
      dhw:         'Stored supply via dedicated cylinder. COP drops at high DHW temps.',
      reliability: 'Fewer combustion components; outdoor unit exposed to weather.',
      longevity:   'Compressor lifespan 15–20 years with annual maintenance.',
      disruption:  'Significant: outdoor unit, cylinder, revised controls, emitter check.',
      control:     'Weather compensation standard. Smart integration widely supported.',
      eco:         'Lowest carbon per kWh at current grid mix. COP 2.5–4.5 typical.',
      future:      'Eligible for BUS grant. Aligned with Future Homes Standard trajectory.',
    },
    explanation: {
      suits:          'Meets heat demand efficiently at low flow temperature with strong seasonal efficiency. Carbon intensity drops further as the grid decarbonises, supporting a lower running cost tendency.',
      struggles:      'Performance depends on emitter adequacy — undersized radiators force higher flow temperatures and reduce COP. DHW temperature lifts also reduce seasonal efficiency.',
      strugglesHint:  'Emitter adequacy has not been verified in this survey. Performance estimate assumes adequate radiator output.',
      changes:        'Confirm emitter output, flow temperatures, and cylinder strategy before installation. Emitter upgrade may be required.',
      changesHint:    'Emitter output and flow temperature data are currently estimated. A full survey is required to confirm compatibility.',
    },
  },
];

// ─── Current system (for comparison sheet) ───────────────────────────────────
// Represents the existing Gas Combi — used as the baseline column in the
// Comparison print layout alongside the two candidate systems.

export const CURRENT_SYSTEM: CandidateSystem = {
  id: 'current_gas_combi',
  label: 'Gas Combi (Current)',
  rows: {
    heat:        'Adequate for most UK heat losses at standard flow temperatures (65–70 °C).',
    dhw:         'On-demand hot water. Output limited by mains flow rate and combi power output.',
    reliability: 'Established platform with a widespread servicing network.',
    longevity:   'Typical lifespan 12–15 years. Age and condition affect risk profile.',
    disruption:  'No change — existing system remains in place.',
    control:     'Basic zone control. Smart thermostat integration possible.',
    eco:         'Efficiency depends on cycling pattern and return temperature.',
    future:      'Gas grid trajectory post-2035 adds long-term uncertainty.',
  },
  explanation: {
    suits:     'Familiar, low-disruption baseline with no installation cost.',
    struggles: 'Limited by simultaneous demand. Carbon pathway weakens over time.',
    changes:   'No changes required — this is the current state.',
  },
};
