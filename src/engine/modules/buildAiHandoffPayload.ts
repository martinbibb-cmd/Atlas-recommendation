/**
 * buildAiHandoffPayload.ts — Assembles the AI handoff payload for the Atlas recommendation.
 *
 * Moved from CustomerAdvicePrintPack.tsx so the builder is reusable by the
 * advice pack, portal, download/copy actions, and future API endpoints.
 *
 * Rules:
 *  - No new recommendation logic.
 *  - No external calls.
 *  - No customer personal data beyond existing advice pack facts.
 *  - All case-specific output is derived from AtlasDecisionV1 and ScenarioResult[].
 *  - Static policy fields (introduction, validationPolicy, source rules) instruct
 *    external AI assistants how to use the payload responsibly.
 */

import type { AtlasDecisionV1 } from '../../contracts/AtlasDecisionV1';
import type { ScenarioResult } from '../../contracts/ScenarioResult';
import type { AiHandoffPayload } from '../../contracts/AiHandoffPayload';
import { scopeRecommended } from './buildQuoteScope';

// ─── Static policy constants ──────────────────────────────────────────────────

export const ASSISTANT_INTRODUCTION =
  'Atlas has helped me understand your home, your current heating and hot-water setup, ' +
  'and the recommendation you have been given.\n\n' +
  'Use the information below to help explain the advice in plain English. You may also ' +
  'use trusted external sources to check general facts, such as heating physics, ' +
  'manufacturer technical documents, warranty terms, regulatory guidance, and consumer ' +
  'protections.\n\n' +
  'You are independent of Atlas. You should also be aware that AI systems can make ' +
  'mistakes or overstate certainty. Do not invent missing facts. If something is unclear, ' +
  'say what needs checking and recommend that the customer confirms it with their ' +
  'installer, surveyor, manufacturer, energy supplier, or relevant specialist.';

export const VALIDATION_POLICY = [
  'Explain the Atlas recommendation in plain English.',
  'Use the supplied Atlas payload as the primary case-specific source.',
  'Use external sources only to validate general claims, not to invent missing survey facts.',
  'Do not treat marketing claims as technical evidence.',
  'Prefer official or technically authoritative sources.',
  'Separate confirmed facts from assumptions.',
  'Flag anything that requires site verification.',
  'Do not provide financial, legal, or regulatory certainty unless supported by an official source.',
  'If sources conflict, say so.',
].join('\n');

export const TRUSTED_SOURCE_CATEGORIES: string[] = [
  'Manufacturer installation manuals',
  'Manufacturer technical data sheets',
  'Manufacturer warranty terms',
  'British Gas warranty / terms and conditions where relevant',
  'Energy Saving Trust guidance',
  'Ofgem guidance',
  'FCA guidance where finance/credit/payment products are discussed',
  'Ofcom guidance only where communications/connectivity claims are relevant',
  'Building Regulations / competent person scheme guidance where relevant',
  'Water Regulations / G3 unvented hot-water guidance where relevant',
  'Metering or network operator guidance where relevant',
];

export const SOURCE_USE_RULES: string[] = [
  'Use manufacturer documents for product limits, clearances, warranties, compatible controls, and installation requirements.',
  'Use Energy Saving Trust or official energy guidance for general efficiency/savings context.',
  'Use Ofgem for energy supplier, tariff, meter, and consumer energy rights questions.',
  'Use FCA for finance, credit, affordability, or regulated payment questions.',
  'Use Ofcom only for broadband/mobile/communications issues connected to smart controls or portal access.',
  'Use British Gas terms only for British Gas cover, warranty, servicing, cancellation, or customer obligation questions.',
  'Avoid relying on sales brochures unless no technical document is available.',
  'Never override site-specific Atlas facts unless there is a clear contradiction that should be checked by a specialist.',
];

// ─── Builder ──────────────────────────────────────────────────────────────────

/**
 * Assembles a structured AiHandoffPayload from the Atlas decision and scenarios.
 *
 * Static policy fields (introduction, validationPolicy, source rules) instruct
 * external AI assistants how to use the payload responsibly and validate claims
 * against trusted sources. Case-specific fields are derived entirely from
 * AtlasDecisionV1 and ScenarioResult[].
 */
export function buildAiHandoffPayload(
  decision: AtlasDecisionV1,
  scenarios: ScenarioResult[],
): AiHandoffPayload {
  const rejected = scenarios.filter((s) => s.scenarioId !== decision.recommendedScenarioId);

  return {
    assistantIntroduction:   ASSISTANT_INTRODUCTION,
    validationPolicy:        VALIDATION_POLICY,
    trustedSourceCategories: TRUSTED_SOURCE_CATEGORIES,
    sourceUseRules:          SOURCE_USE_RULES,

    recommendedHeadline: decision.headline,
    keyReasons:          decision.keyReasons.slice(0, 3),
    rejectedAlternatives: rejected.map((s) => ({
      summary:    s.system.summary,
      constraint: s.keyConstraints[0] ?? 'not suitable for this home',
    })),
    householdFacts: decision.supportingFacts
      .slice(0, 6)
      .map((f) => ({ label: f.label, value: f.value })),
    includedScope:   decision.includedItems.slice(0, 8),
    requiredWorks:   decision.requiredWorks.slice(0, 5),
    recommendedUpgrades: scopeRecommended(decision.quoteScope)
      .map((s) => s.customerBenefit ? `${s.label} — ${s.customerBenefit}` : s.label)
      .slice(0, 5),
    warnings:        decision.compatibilityWarnings.slice(0, 3),
    futureUpgrades:  decision.futureUpgradePaths.slice(0, 4),
  };
}

// ─── Serialiser ───────────────────────────────────────────────────────────────

/**
 * Serialises an AiHandoffPayload to a visible, copyable plain-text block.
 *
 * The customer can copy/paste this into any AI assistant (ChatGPT, Claude,
 * Gemini) and ask "Explain this quote to me".
 *
 * Rules:
 *   - Visible text only — no white-on-white hidden content.
 *   - Kept concise: bullets, not paragraphs.
 */
export function serialiseAiHandoffPayload(payload: AiHandoffPayload): string {
  const lines: string[] = [
    '=== ATLAS RECOMMENDATION SUMMARY ===',
    '',
    '--- Instructions for the AI assistant ---',
    payload.assistantIntroduction,
    '',
    'When answering the customer:',
    ...payload.validationPolicy.split('\n').map((l) => `• ${l}`),
    '',
    'Trusted source categories:',
    ...payload.trustedSourceCategories.map((c) => `• ${c}`),
    '',
    'Source use rules:',
    ...payload.sourceUseRules.map((r) => `• ${r}`),
    '',
    '--- Case-specific Atlas data ---',
    '',
    `Recommended: ${payload.recommendedHeadline}`,
    '',
  ];

  if (payload.keyReasons.length > 0) {
    lines.push('Why selected:');
    payload.keyReasons.forEach((r) => lines.push(`• ${r}`));
    lines.push('');
  }

  if (payload.rejectedAlternatives.length > 0) {
    lines.push('Rejected alternatives:');
    payload.rejectedAlternatives.forEach((a) => lines.push(`• ${a.summary} — ${a.constraint}`));
    lines.push('');
  }

  if (payload.householdFacts.length > 0) {
    lines.push('Household facts:');
    payload.householdFacts.forEach((f) => lines.push(`• ${f.label}: ${f.value}`));
    lines.push('');
  }

  if (payload.includedScope.length > 0) {
    lines.push('Included scope:');
    payload.includedScope.forEach((i) => lines.push(`• ${i}`));
    lines.push('');
  }

  if (payload.requiredWorks.length > 0) {
    lines.push('Required works:');
    payload.requiredWorks.forEach((w) => lines.push(`• ${w}`));
    lines.push('');
  }

  if (payload.recommendedUpgrades.length > 0) {
    lines.push('Recommended upgrades (advised but not yet committed):');
    payload.recommendedUpgrades.forEach((u) => lines.push(`• ${u}`));
    lines.push('');
  }

  if (payload.warnings.length > 0) {
    lines.push('Warnings:');
    payload.warnings.forEach((w) => lines.push(`• ${w}`));
    lines.push('');
  }

  if (payload.futureUpgrades.length > 0) {
    lines.push('Future upgrades:');
    payload.futureUpgrades.forEach((p) => lines.push(`• ${p}`));
    lines.push('');
  }

  lines.push('Generated by Atlas — paste into any AI assistant to discuss this recommendation.');

  return lines.join('\n');
}

// ─── Convenience helper ───────────────────────────────────────────────────────

/**
 * Assembles a compact, visible handoff text from the decision and scenarios.
 *
 * Builds a structured AiHandoffPayload (with evidence-aware policy fields)
 * then serialises it to plain text for copy/paste into any AI assistant.
 */
export function buildAiHandoffText(
  decision: AtlasDecisionV1,
  scenarios: ScenarioResult[],
): string {
  return serialiseAiHandoffPayload(buildAiHandoffPayload(decision, scenarios));
}
