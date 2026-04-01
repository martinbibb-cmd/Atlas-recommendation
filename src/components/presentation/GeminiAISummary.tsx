/**
 * GeminiAISummary.tsx
 *
 * Calls the Google Gemini API with the full canonical survey stepper data
 * and engine output, then renders a concise AI-generated summary of the
 * results and advice at the bottom of the first presentation page.
 *
 * Rules:
 *   - API call proxied through /api/gemini (Cloudflare Pages Function).
 *   - Renders nothing when the server returns 503 (key not configured).
 *   - No Math.random() — prompt is built deterministically from model data.
 *   - All prompt data sourced from CanonicalPresentationModel + engine I/O.
 */

import { useState, useEffect, useRef } from 'react';
import type { FullEngineResult, EngineInputV2_3 } from '../../engine/schema/EngineInputV2_3';
import type { RecommendationResult } from '../../engine/recommendation/RecommendationModel';
import type {
  CanonicalPresentationModel,
  PhysicsRankingItem,
} from './buildCanonicalPresentation';
import './GeminiAISummary.css';

// ─── Gemini API types ─────────────────────────────────────────────────────────

interface GeminiResponsePart {
  text: string;
}
interface GeminiResponseContent {
  parts: GeminiResponsePart[];
}
interface GeminiResponseCandidate {
  content: GeminiResponseContent;
}
interface GeminiApiResponse {
  candidates?: GeminiResponseCandidate[];
  error?: { message: string };
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

/**
 * Build a structured plain-text prompt from canonical model + engine I/O.
 * The prompt includes:
 *   1. House fabric (heat loss, walls, insulation)
 *   2. Household demand (occupancy, hot water, simultaneous outlets)
 *   3. Current heating system (type, age, condition)
 *   4. User priorities / objectives
 *   5. Physics-ranked system options (top 4)
 *   6. Key viability notes per option
 */
function buildGeminiPrompt(
  model: CanonicalPresentationModel,
  input: EngineInputV2_3,
  result: FullEngineResult,
  recommendationResult?: RecommendationResult,
): string {
  const { page1, page3 } = model;
  const { house, home, currentSystem, objectives, energy } = page1;

  // ── House fabric ──────────────────────────────────────────────────────────
  const houseFacts = [
    `Heat loss: ${house.heatLossLabel} (${house.heatLossBand})`,
    `Wall type: ${house.wallTypeLabel}`,
    `Insulation: ${house.insulationLabel}`,
    `Water supply: ${house.waterSupplyLabel}`,
    `Pipework: ${house.pipeworkLabel}`,
  ];
  if (house.roofOrientationLabel) {
    houseFacts.push(`Roof orientation: ${house.roofOrientationLabel}`);
  }
  if (house.roofTypeLabel) {
    houseFacts.push(`Roof type: ${house.roofTypeLabel}`);
  }
  if (input.bedrooms != null) houseFacts.push(`Bedrooms: ${input.bedrooms}`);
  if (input.bathroomCount != null) houseFacts.push(`Bathrooms: ${input.bathroomCount}`);
  if (house.notes.length > 0) houseFacts.push(`Notes: ${house.notes.join('; ')}`);

  // ── Household demand ──────────────────────────────────────────────────────
  const demandFacts = [
    `Demand profile: ${home.demandProfileLabel}`,
    `Daily hot water: ${home.dailyHotWaterLabel}`,
    `Peak simultaneous outlets: ${home.peakOutletsLabel}`,
    `Bath use intensity: ${home.bathUseIntensityLabel}`,
    `Occupancy timing: ${home.occupancyTimingLabel}`,
    `Storage benefit: ${home.storageBenefitLabel}`,
  ];
  if (input.occupancyCount != null) demandFacts.push(`Occupants: ${input.occupancyCount}`);
  if (home.narrativeSignals.length > 0) {
    demandFacts.push(`Signals: ${home.narrativeSignals.join('; ')}`);
  }

  // ── Current system ────────────────────────────────────────────────────────
  const systemFacts: string[] = [];
  if (currentSystem.systemTypeLabel) systemFacts.push(`System type: ${currentSystem.systemTypeLabel}`);
  if (currentSystem.ageLabel) systemFacts.push(`Age: ${currentSystem.ageLabel}`);
  if (currentSystem.makeModelText) systemFacts.push(`Make/model: ${currentSystem.makeModelText}`);
  if (currentSystem.outputLabel) systemFacts.push(`Output: ${currentSystem.outputLabel}`);
  if (currentSystem.emittersLabel) systemFacts.push(`Emitters: ${currentSystem.emittersLabel}`);
  if (currentSystem.pipeLayoutLabel) systemFacts.push(`Pipe layout: ${currentSystem.pipeLayoutLabel}`);
  if (currentSystem.controlFamilyLabel) systemFacts.push(`Controls: ${currentSystem.controlFamilyLabel}`);
  if (currentSystem.sedbukBandLabel) systemFacts.push(`SEDBUK band: ${currentSystem.sedbukBandLabel}`);
  systemFacts.push(`Age context: ${currentSystem.ageContext}`);
  if (currentSystem.conditionSignalPills.length > 0) {
    const conditions = currentSystem.conditionSignalPills
      .map(p => `${p.label} (${p.status})`)
      .join(', ');
    systemFacts.push(`Condition signals: ${conditions}`);
  }

  // ── Energy / PV ───────────────────────────────────────────────────────────
  const energyFacts = [
    `PV status: ${energy.pvStatusLabel}`,
    `PV suitability: ${energy.pvSuitabilityLabel}`,
    `Energy alignment: ${energy.energyAlignmentLabel}`,
    `Solar/storage opportunity: ${energy.solarStorageOpportunityLabel}`,
  ];

  // ── User priorities ───────────────────────────────────────────────────────
  const priorityFacts = objectives.priorities.length > 0
    ? objectives.priorities.map(p => p.label)
    : ['No priorities recorded'];

  // ── Ranked options ────────────────────────────────────────────────────────
  const rankingLines = page3.items.slice(0, 4).map((item: PhysicsRankingItem) => {
    const notes = [item.reasonLine];
    if (item.demandFitNote) notes.push(`Demand: ${item.demandFitNote}`);
    if (item.waterFitNote) notes.push(`Water: ${item.waterFitNote}`);
    if (item.infrastructureFitNote) notes.push(`Infrastructure: ${item.infrastructureFitNote}`);
    if (item.energyFitNote) notes.push(`Energy: ${item.energyFitNote}`);
    return `  ${item.rank}. ${item.label} — score ${item.overallScore}/100\n     ${notes.join(' | ')}`;
  });

  // ── Option cards viability ────────────────────────────────────────────────
  const optionCards = result.engineOutput?.options ?? [];
  const viabilityLines = optionCards.map(card =>
    `  ${card.label}: ${card.status} — ${card.headline}`,
  );

  // ── Winning recommendation ────────────────────────────────────────────────
  let recommendationLine = '';
  if (recommendationResult?.bestOverall) {
    const winner = recommendationResult.bestOverall;
    const winnerItem = page3.items.find(i => i.family === winner.family);
    const label = winnerItem?.label ?? winner.family;
    recommendationLine = `Top recommendation: ${label} (overall score: ${winner.overallScore}/100, suitability: ${winner.suitability})`;
  }

  // ── Assemble prompt ───────────────────────────────────────────────────────
  const sections = [
    'You are an expert heating engineer advisor. Based on the survey data and engine analysis below, provide a clear and concise summary (3–5 sentences) of the key findings and the advice for this household. Focus on: the most suitable heating system, the main reasons it was recommended, any key constraints or concerns, and one practical next step.',
    '',
    '=== HOUSE FABRIC ===',
    houseFacts.join('\n'),
    '',
    '=== HOUSEHOLD DEMAND ===',
    demandFacts.join('\n'),
    '',
    '=== CURRENT SYSTEM ===',
    systemFacts.length > 0 ? systemFacts.join('\n') : 'Not recorded',
    '',
    '=== ENERGY / PV ===',
    energyFacts.join('\n'),
    '',
    '=== USER PRIORITIES ===',
    priorityFacts.join('\n'),
    '',
    '=== PHYSICS-RANKED OPTIONS ===',
    rankingLines.length > 0 ? rankingLines.join('\n') : 'No options ranked',
    '',
    '=== OPTION VIABILITY ===',
    viabilityLines.length > 0 ? viabilityLines.join('\n') : 'No option cards',
  ];

  if (recommendationLine) {
    sections.push('', '=== ENGINE RECOMMENDATION ===', recommendationLine);
  }

  sections.push('', 'Please write the summary now:');

  return sections.join('\n');
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface GeminiAISummaryProps {
  model: CanonicalPresentationModel;
  input: EngineInputV2_3;
  result: FullEngineResult;
  recommendationResult?: RecommendationResult;
}

type LoadState = 'idle' | 'loading' | 'done' | 'error' | 'no_key';

/**
 * GeminiAISummary
 *
 * Renders an AI-generated summary section at the bottom of the first
 * presentation page. Calls the Gemini 1.5 Flash API via the /api/gemini
 * server-side proxy (which reads GRMINI_API_KEY from Cloudflare secrets)
 * and shows the concise result.
 *
 * Renders nothing when the proxy returns 503 (key not configured).
 */
export default function GeminiAISummary({
  model,
  input,
  result,
  recommendationResult,
}: GeminiAISummaryProps) {
  const [state, setState] = useState<LoadState>('idle');
  const [summary, setSummary] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;

    hasFetched.current = true;
    setState('loading');

    const prompt = buildGeminiPrompt(model, input, result, recommendationResult);

    fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 300,
          // Low temperature for factual, deterministic summaries.
          temperature: 0.3,
        },
      }),
    })
      .then(res => {
        if (res.status === 503) {
          setState('no_key');
          return null;
        }
        return res.json() as Promise<GeminiApiResponse>;
      })
      .then(data => {
        if (!data) return;
        if (data.error) {
          throw new Error(data.error.message);
        }
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        if (!text) throw new Error('Empty response from Gemini');
        setSummary(text.trim());
        setState('done');
      })
      .catch((err: unknown) => {
        setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
        setState('error');
      });
  // The summary is fetched once per component mount. model/input/result are
  // not in the dependency array intentionally: re-fetching on every re-render
  // would generate duplicate API calls. The component is only ever mounted
  // once per presentation session, so this matches the expected lifecycle.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Render nothing until a fetch attempt has been made or when the key is absent.
  if (state === 'idle' || state === 'no_key') return null;

  return (
    <section
      className="gemini-summary"
      aria-label="AI-generated summary"
      data-testid="gemini-ai-summary"
    >
      <div className="gemini-summary__header">
        <span className="gemini-summary__icon" aria-hidden="true">✦</span>
        <span className="gemini-summary__title">AI Summary</span>
        <span className="gemini-summary__badge">Gemini</span>
      </div>

      {state === 'loading' && (
        <div className="gemini-summary__loading" aria-live="polite">
          <span className="gemini-summary__spinner" aria-hidden="true" />
          <span>Generating summary…</span>
        </div>
      )}

      {state === 'done' && (
        <p className="gemini-summary__text" aria-live="polite">
          {summary}
        </p>
      )}

      {state === 'error' && (
        <p className="gemini-summary__error" aria-live="polite" role="alert">
          Unable to generate summary: {errorMsg}
        </p>
      )}
    </section>
  );
}
