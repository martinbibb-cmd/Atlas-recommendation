import type { ENGINE_VERSION, CONTRACT_VERSION } from './versions';

export interface EligibilityItem {
  id: 'on_demand' | 'stored' | 'ashp';
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
  affectsOptionIds: Array<'combi' | 'stored' | 'ashp' | 'regular_vented' | 'system_unvented'>;
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

export interface OptionCardV1 {
  id: 'combi' | 'stored' | 'ashp' | 'regular_vented' | 'system_unvented';
  label: string;
  status: 'viable' | 'caution' | 'rejected';
  headline: string;
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
}

export interface VisualSpecV1 {
  /** Stable identifier for the visual (unique within an output). */
  id: string;
  /** Visual type — drives the UI renderer switch. */
  type: 'pressure_drop' | 'ashp_flow' | 'dhw_outlets' | 'space_footprint';
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
  meta?: {
    engineVersion: typeof ENGINE_VERSION;
    contractVersion: typeof CONTRACT_VERSION;
  };
}
