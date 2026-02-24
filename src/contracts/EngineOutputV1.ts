import type { ENGINE_VERSION, CONTRACT_VERSION } from './versions';
import type { AssumptionId } from './assumptions.ids';
import type { PenaltyId } from './scoring.penaltyIds';

export interface AssumptionV1 {
  id: AssumptionId;
  title: string;
  detail: string;
  affects: Array<'timeline_24h' | 'options' | 'recommendation' | 'context'>;
  severity: 'info' | 'warn';
  improveBy?: string;
}

export interface ConfidenceV1 {
  level: 'high' | 'medium' | 'low';
  reasons: string[];
}

export interface EngineMetaV1 {
  engineVersion: typeof ENGINE_VERSION;
  contractVersion: typeof CONTRACT_VERSION;
  confidence?: ConfidenceV1;
  assumptions?: AssumptionV1[];
}

export interface EligibilityItem {
  id: 'on_demand' | 'stored_vented' | 'stored_unvented' | 'ashp';
  label: string;
  status: 'viable' | 'rejected' | 'caution';
  reason?: string;
}

export interface EvidenceItemV1 {
  /** Stable identifier unique within an output. */
  id: string;
  /** JSON-path-style field reference, e.g. "services.mainsDynamicPressureBar". */
  fieldPath: string;
  /** Human-readable label for display. */
  label: string;
  /** Formatted value string including units, e.g. "2.5 bar". */
  value: string;
  /** How this value was obtained. */
  source: 'manual' | 'assumed' | 'placeholder' | 'derived';
  /** Confidence in the value and its influence on the output. */
  confidence: 'high' | 'medium' | 'low';
  /** Which option IDs this evidence item primarily affects. */
  affectsOptionIds: Array<'combi' | 'stored_vented' | 'stored_unvented' | 'ashp' | 'regular_vented' | 'system_unvented'>;
}

export interface RedFlagItem {
  id: string;
  severity: 'info' | 'warn' | 'fail';
  title: string;
  detail: string;
  action?: string;
}

export interface ExplainerItem {
  id: string;
  title: string;
  body: string;
}

export interface TraceItem {
  id: string;
  steps: string[];
}

export interface OptionPlane {
  status: 'ok' | 'caution' | 'na';
  headline: string;
  bullets: string[];
  evidenceIds?: string[];
}

export interface OptionRequirements {
  mustHave: string[];
  likelyUpgrades: string[];
  niceToHave: string[];
}

export interface SensitivityItem {
  /** The input lever that would change this outcome, e.g. "Primary pipe size". */
  lever: string;
  /** Direction of change: upgrade = more viable, downgrade = less viable. */
  effect: 'upgrade' | 'downgrade';
  /** Human-readable explanation of the boundary condition. */
  note: string;
}

export interface ScoreBreakdownItem {
  id: PenaltyId;
  label: string;
  penalty: number;
}

export interface OptionScoreV1 {
  /** Clamped 0–100. */
  total: number;
  breakdown: ScoreBreakdownItem[];
  confidencePenalty?: number;
  /** Engine-provided score band — prevents UI from inventing thresholds. */
  band?: 'excellent' | 'good' | 'mixed' | 'poor' | 'not_viable';
}

export interface OptionCardV1 {
  id: 'combi' | 'stored_vented' | 'stored_unvented' | 'ashp' | 'regular_vented' | 'system_unvented';
  label: string;
  status: 'viable' | 'caution' | 'rejected';
  headline: string;
  /**
   * Confidence badge shown at the top of the option card — not buried in an evidence table.
   * Engine-owned: prevents UI from inventing its own confidence thresholds.
   */
  confidenceBadge?: {
    level: 'high' | 'medium' | 'low';
    /** One-line label for display, e.g. "High confidence (measured)". */
    label: string;
  };
  why: string[];
  /** @deprecated Use requirements.mustHave / likelyUpgrades / niceToHave instead. */
  requirements: string[];
  evidenceIds?: string[];
  /** Wet-side hydraulics, flow temperatures, emitter suitability, cycling risk. */
  heat: OptionPlane;
  /** DHW pressure, simultaneity, recovery profile. */
  dhw: OptionPlane;
  /** Space, loft head, discharge route, buffer/header constraints. */
  engineering: OptionPlane;
  /** Typed requirements replacing the flat requirements[] array. */
  typedRequirements: OptionRequirements;
  /** "What would change this outcome?" — boundary condition explanations. */
  sensitivities?: SensitivityItem[];
  /** Deterministic 0–100 score with penalty breakdown. */
  score?: OptionScoreV1;
}

/** DHW event block within a 24-hour timeline. */
export interface Timeline24hEvent {
  startMin: number;
  endMin: number;
  kind: 'shower' | 'bath' | 'sink' | 'dishwasher' | 'washing_machine';
  intensity: 'low' | 'med' | 'high';
}

/** One system's data series within a 24-hour timeline. */
export interface Timeline24hSeries {
  id: string;
  label: string;
  heatDeliveredKw: number[];
  efficiency: number[];
  comfortTempC?: number[];
  dhwOutletTempC?: number[];
  dhwFlowLpm?: number[];
}

/** Payload for the timeline_24h visual type (96 points at 15-min intervals). */
export interface Timeline24hV1 {
  timeMinutes: number[];
  demandHeatKw: number[];
  series: Timeline24hSeries[];
  events: Timeline24hEvent[];
  legendNotes?: string[];
}

export interface VisualSpecV1 {
  /** Stable identifier for the visual (unique within an output). */
  id: string;
  /** Visual type — drives the UI renderer switch. */
  type: 'pressure_drop' | 'ashp_flow' | 'dhw_outlets' | 'space_footprint' | 'timeline_24h';
  /** Optional display title. */
  title?: string;
  /** Type-specific data payload — consumed by the matching renderer. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  /** Option IDs this visual is primarily relevant to. Undefined = relevant to all. */
  affectsOptionIds?: string[];
}

export interface EngineOutputV1 {
  eligibility: EligibilityItem[];
  redFlags: RedFlagItem[];
  recommendation: {
    primary: string;
    secondary?: string;
  };
  explainers: ExplainerItem[];
  trace?: TraceItem[];
  contextSummary?: { bullets: string[] };
  options?: OptionCardV1[];
  /** Structured list of what inputs mattered and how confident we are. */
  evidence?: EvidenceItemV1[];
  /** Engine-driven visual specs. UI renders by type switch — no business logic in UI. */
  visuals?: VisualSpecV1[];
  meta?: EngineMetaV1;
}
