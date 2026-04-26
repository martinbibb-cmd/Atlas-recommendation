/**
 * GeminiAISummary.tsx
 *
 * Calls the Google Gemini API with a locked CustomerSummaryV1 and asks it
 * to rewrite the summary in friendlier English without changing the
 * recommendation or adding facts.
 *
 * Rules:
 *   - API call proxied through /api/gemini (Cloudflare Pages Function).
 *   - Renders nothing when the server returns 503 (key not configured).
 *   - No Math.random() — prompt is built deterministically from CustomerSummaryV1.
 *   - All prompt data sourced from CustomerSummaryV1 only — no ranked options,
 *     no viability notes, no full survey data.
 *   - AI output validated by validateAiCustomerSummary; falls back to
 *     lockedSummary.plainEnglishDecision when validation fails.
 *   - Prompt explicitly forbids adding facts or changing the recommendation.
 */

import { useState, useEffect, useRef } from 'react';
import type { CustomerSummaryV1 } from '../../contracts/CustomerSummaryV1';
import { validateAiCustomerSummary } from '../../engine/modules/validateAiCustomerSummary';
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
 * Build the locked rewrite prompt from CustomerSummaryV1.
 *
 * The prompt instructs the AI to rewrite only — no new facts, no alternative
 * recommendations, no changes to scope or warnings, and absolutely no softening
 * of physics constraints.
 */
function buildLockedPrompt(lockedSummary: CustomerSummaryV1): string {
  const lines: string[] = [
    'Rewrite the locked Atlas summary below in plain, friendly English.',
    'Do not add facts. Do not change the recommendation. Do not recommend alternatives.',
    'Keep all warnings and required checks. Do not invent technical measurements.',
    'Write 3–5 sentences maximum.',
    '',
    'HARD RULES (non-negotiable):',
    '1. Do NOT soften, hedge, or qualify any hard constraint. If the locked summary',
    '   states a system will fail or cannot work, say exactly that — never reframe',
    '   "will fail" as "may struggle", "could be less suitable", or "might have issues".',
    '2. Do NOT compare systems or suggest alternatives not already present.',
    '3. Do NOT rebalance or reinterpret the recommendation — only translate it.',
    '4. Do NOT introduce any new claims, facts, or measurements.',
    '',
    '=== LOCKED ATLAS SUMMARY ===',
    '',
    `Recommended system: ${lockedSummary.recommendedSystemLabel}`,
    `Headline: ${lockedSummary.headline}`,
    `Decision: ${lockedSummary.fitNarrative || lockedSummary.plainEnglishDecision}`,
  ];

  if (lockedSummary.whyThisWins.length > 0) {
    lines.push('', 'Why this wins:');
    lockedSummary.whyThisWins.forEach((r) => lines.push(`- ${r}`));
  }

  if (lockedSummary.hardConstraints.length > 0) {
    lines.push('', 'Hard constraints (physics failures — preserve these exactly, do not soften):');
    lockedSummary.hardConstraints.forEach((c) => lines.push(`- ${c}`));
  }

  if (lockedSummary.performancePenalties.length > 0) {
    lines.push('', 'Performance penalties (present these directly, do not hedge):');
    lockedSummary.performancePenalties.forEach((p) => lines.push(`- ${p}`));
  }

  if (lockedSummary.whatThisAvoids.length > 0) {
    lines.push('', 'What this avoids:');
    lockedSummary.whatThisAvoids.forEach((r) => lines.push(`- ${r}`));
  }

  if (lockedSummary.includedNow.length > 0) {
    lines.push('', 'Included now:');
    lockedSummary.includedNow.forEach((i) => lines.push(`- ${i}`));
  }

  if (lockedSummary.requiredChecks.length > 0) {
    lines.push('', 'Required checks:');
    lockedSummary.requiredChecks.forEach((c) => lines.push(`- ${c}`));
  }

  if (lockedSummary.confidenceNotes.length > 0) {
    lines.push('', 'Confidence notes:');
    lockedSummary.confidenceNotes.forEach((n) => lines.push(`- ${n}`));
  }

  lines.push('', 'Please write the plain-English rewrite now:');

  return lines.join('\n');
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface GeminiAISummaryProps {
  lockedSummary?: CustomerSummaryV1;
}

type LoadState = 'idle' | 'loading' | 'done' | 'error' | 'no_key';

/**
 * GeminiAISummary
 *
 * Renders an AI-generated plain-English rewrite of the locked CustomerSummaryV1.
 * Falls back to lockedSummary.plainEnglishDecision when the AI response fails
 * validation or the API is unavailable.
 *
 * Renders nothing when lockedSummary is absent or the proxy returns 503.
 */
export default function GeminiAISummary({ lockedSummary }: GeminiAISummaryProps) {
  const [state, setState] = useState<LoadState>('idle');
  const [summary, setSummary] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const hasFetched = useRef(false);

  useEffect(() => {
    // Do not fetch when no locked summary is available.
    if (!lockedSummary) return;
    if (hasFetched.current) return;

    hasFetched.current = true;
    setState('loading');

    const prompt = buildLockedPrompt(lockedSummary);

    fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 300,
          // Low temperature for deterministic, factual rewrites.
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

        // Validate AI output against the locked summary.
        // Fall back to deterministic text when validation fails.
        const validation = validateAiCustomerSummary(text.trim(), lockedSummary);
        if (validation.valid) {
          setSummary(text.trim());
        } else {
          setSummary(lockedSummary.plainEnglishDecision);
        }
        setState('done');
      })
      .catch((err: unknown) => {
        setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
        setState('error');
      });
  // The summary is fetched once per component mount. lockedSummary is not in
  // the dependency array intentionally: re-fetching on every re-render would
  // generate duplicate API calls. The component is only ever mounted once per
  // presentation session, so this matches the expected lifecycle.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Render nothing when no locked summary is provided, when in idle state, or when API key is absent.
  if (!lockedSummary || state === 'idle' || state === 'no_key') return null;

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
