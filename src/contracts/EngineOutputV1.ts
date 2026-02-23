import type { ENGINE_VERSION, CONTRACT_VERSION } from './versions';

export interface EligibilityItem {
  id: 'instant' | 'stored' | 'ashp';
  label: string;
  status: 'viable' | 'rejected' | 'caution';
  reason?: string;
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
  meta?: {
    engineVersion: typeof ENGINE_VERSION;
    contractVersion: typeof CONTRACT_VERSION;
  };
}
