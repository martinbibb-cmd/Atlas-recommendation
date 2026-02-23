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

export interface EngineOutputV1 {
  eligibility: EligibilityItem[];
  redFlags: RedFlagItem[];
  recommendation: {
    primary: string;
    secondary?: string;
  };
  explainers: ExplainerItem[];
  trace?: TraceItem[];
  meta?: {
    engineVersion: typeof ENGINE_VERSION;
    contractVersion: typeof CONTRACT_VERSION;
  };
}
