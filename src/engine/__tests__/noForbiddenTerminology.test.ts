/**
 * noForbiddenTerminology.test.ts
 *
 * Lint-style test: ensures that no prohibited terms from docs/atlas-terminology.md
 * appear as string literals in UI copy sources under src/.
 *
 * Governed by docs/atlas-terminology.md § 8 (Prohibited Terms) and § 8c
 * (Combi DHW Ramp Behaviour).
 *
 * Allowed exceptions:
 *  - Code comments (lines starting with whitespace + // or * )
 *  - Engine-internal identifier files (type aliases, enum values — not user copy)
 *  - This test file itself
 *  - The terminology source document (docs/)
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Files that are permitted to use these terms for technical/internal reasons
// (enum values, type annotations, schema definitions, not user-facing copy)
const ALLOWED_FILES = new Set([
  // Internal type / schema files
  'explorerTypes.ts',         // dhwMethod: 'instantaneous' | ... (type annotation)
  'dhwMixing.ts',             // DhwStorageRegime type with 'instantaneous_combi'
  'EngineInputV2_3.ts',       // schema definitions
  'FullSurveyModelV1.ts',     // schema definitions
  // Internal engine helper files whose strings are never directly surfaced
  'StoredDhwModule.ts',       // assumptions (gravity-fed is a physics fact, not label)
  // Copy guardrail file — the BANNED_CUSTOMER_PHRASES list itself contains banned
  // terms as reference strings for testing, not as customer-facing copy. Its own
  // test suite (customerCopy.test.ts) verifies that no exported label uses banned phrases.
  'customerCopy.ts',
  // Presentation audit page — FORBIDDEN_PHRASES array contains banned terms as
  // detection rules for the developer audit surface, not as customer-facing copy.
  'PresentationAuditPage.tsx',
  // This test file itself
  'noForbiddenTerminology.test.ts',
  'noBrandCopy.test.ts',
]);

/** Recursively collect all .ts / .tsx files under a directory. */
function collectSourceFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectSourceFiles(full));
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

const SRC_DIR = path.resolve(__dirname, '../../../src');

/** Returns string-literal lines that contain the banned phrase (case-insensitive). */
function findPhraseLines(filePath: string, phrase: string): string[] {
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const lower = phrase.toLowerCase();
  const hits: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip pure comment lines (single-line // comments or JSDoc * lines)
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
    // Strip inline trailing comments before checking
    const codeOnly = line.replace(/\/\/.*$/, '');
    if (codeOnly.toLowerCase().includes(lower)) {
      hits.push(`  line ${i + 1}: ${line.trimEnd()}`);
    }
  }
  return hits;
}

describe('No forbidden terminology in user-facing copy (atlas-terminology.md § 8)', () => {
  const files = collectSourceFiles(SRC_DIR).filter(
    // Exclude test files: these contain mock data/fixture strings that are not
    // user-facing copy and can legitimately use any string values for assertions.
    // This mirrors the convention in noBrandCopy.test.ts.
    f => !ALLOWED_FILES.has(path.basename(f)) && !f.includes('__tests__'),
  );

  it('does not contain "instantaneous hot water"', () => {
    const violations: string[] = [];
    for (const file of files) {
      const hits = findPhraseLines(file, 'instantaneous hot water');
      if (hits.length > 0) {
        violations.push(`${path.relative(SRC_DIR, file)}:\n${hits.join('\n')}`);
      }
    }
    expect(
      violations,
      `Forbidden term "instantaneous hot water" found (use "on-demand hot water"):\n${violations.join('\n\n')}`,
    ).toHaveLength(0);
  });

  it('does not contain "Atlas quote" or "Atlas quoting"', () => {
    const violations: string[] = [];
    for (const file of files) {
      const hits = [
        ...findPhraseLines(file, 'Atlas quote'),
        ...findPhraseLines(file, 'Atlas quoting'),
      ];
      if (hits.length > 0) {
        violations.push(`${path.relative(SRC_DIR, file)}:\n${hits.join('\n')}`);
      }
    }
    expect(
      violations,
      `Forbidden term "Atlas quote/quoting" found:\n${violations.join('\n\n')}`,
    ).toHaveLength(0);
  });

  it('does not contain "gravity system" (use "tank-fed hot water")', () => {
    const violations: string[] = [];
    for (const file of files) {
      const hits = findPhraseLines(file, 'gravity system');
      if (hits.length > 0) {
        violations.push(`${path.relative(SRC_DIR, file)}:\n${hits.join('\n')}`);
      }
    }
    expect(
      violations,
      `Forbidden term "gravity system" found (use "tank-fed hot water"):\n${violations.join('\n\n')}`,
    ).toHaveLength(0);
  });

  it('does not contain "low pressure system" (use "tank-fed supply")', () => {
    const violations: string[] = [];
    for (const file of files) {
      const hits = findPhraseLines(file, 'low pressure system');
      if (hits.length > 0) {
        violations.push(`${path.relative(SRC_DIR, file)}:\n${hits.join('\n')}`);
      }
    }
    expect(
      violations,
      `Forbidden term "low pressure system" found (use "tank-fed supply"):\n${violations.join('\n\n')}`,
    ).toHaveLength(0);
  });

  it('does not contain "high pressure system" (use "mains-fed supply")', () => {
    const violations: string[] = [];
    for (const file of files) {
      const hits = findPhraseLines(file, 'high pressure system');
      if (hits.length > 0) {
        violations.push(`${path.relative(SRC_DIR, file)}:\n${hits.join('\n')}`);
      }
    }
    expect(
      violations,
      `Forbidden term "high pressure system" found (use "mains-fed supply"):\n${violations.join('\n\n')}`,
    ).toHaveLength(0);
  });

  it('does not contain "unlimited hot water" (use "stored hot water / thermal capacity")', () => {
    const violations: string[] = [];
    for (const file of files) {
      const hits = findPhraseLines(file, 'unlimited hot water');
      if (hits.length > 0) {
        violations.push(`${path.relative(SRC_DIR, file)}:\n${hits.join('\n')}`);
      }
    }
    expect(
      violations,
      `Forbidden term "unlimited hot water" found (use "stored hot water / thermal capacity"):\n${violations.join('\n\n')}`,
    ).toHaveLength(0);
  });

  it('does not contain "powerful shower" (use "supply-limited / flow-limited")', () => {
    const violations: string[] = [];
    for (const file of files) {
      const hits = findPhraseLines(file, 'powerful shower');
      if (hits.length > 0) {
        violations.push(`${path.relative(SRC_DIR, file)}:\n${hits.join('\n')}`);
      }
    }
    expect(
      violations,
      `Forbidden term "powerful shower" found (use "supply-limited / flow-limited"):\n${violations.join('\n\n')}`,
    ).toHaveLength(0);
  });
});

// ─── Guardrails: absolute claims that must not appear in source  ──────────────
//
// These tests enforce the evidence-tier guardrails introduced in the
// EvidenceTiers.ts claim-governance layer (§ feat(guardrails)).
// Each banned phrase represents a claim that was previously stated as hard
// physics but is either incorrect, unsupported, or a vendor talking point.

describe('No absolute/unsupported claims in source (EvidenceTiers guardrails)', () => {
  const files = collectSourceFiles(SRC_DIR).filter(
    f => !ALLOWED_FILES.has(path.basename(f)) && !f.includes('__tests__'),
  );

  it('does not contain "uniquely compatible with salt-water" (use "explicitly supports" with manufacturer citation)', () => {
    const violations: string[] = [];
    for (const file of files) {
      const hits = findPhraseLines(file, 'uniquely compatible with salt-water');
      if (hits.length > 0) {
        violations.push(`${path.relative(SRC_DIR, file)}:\n${hits.join('\n')}`);
      }
    }
    expect(
      violations,
      `Forbidden phrase "uniquely compatible with salt-water" found — use "explicitly supports" with manufacturer source:\n${violations.join('\n\n')}`,
    ).toHaveLength(0);
  });

  it('does not contain "uniquely compatible with artificially softened" (remove "uniquely" claim)', () => {
    const violations: string[] = [];
    for (const file of files) {
      const hits = findPhraseLines(file, 'uniquely compatible with artificially softened');
      if (hits.length > 0) {
        violations.push(`${path.relative(SRC_DIR, file)}:\n${hits.join('\n')}`);
      }
    }
    expect(
      violations,
      `Forbidden phrase "uniquely compatible with artificially softened" found:\n${violations.join('\n\n')}`,
    ).toHaveLength(0);
  });

  it('does not contain "required even for modest 8kW" (use caveated pipework language)', () => {
    const violations: string[] = [];
    for (const file of files) {
      const hits = findPhraseLines(file, 'required even for modest');
      if (hits.length > 0) {
        violations.push(`${path.relative(SRC_DIR, file)}:\n${hits.join('\n')}`);
      }
    }
    expect(
      violations,
      `Forbidden phrase "required even for modest" found — pipework claims must be caveated:\n${violations.join('\n\n')}`,
    ).toHaveLength(0);
  });

  it('does not contain "Upgrade to 28mm required for ASHP" (use "may be needed" language)', () => {
    const violations: string[] = [];
    for (const file of files) {
      const hits = findPhraseLines(file, 'Upgrade to 28mm required for ASHP');
      if (hits.length > 0) {
        violations.push(`${path.relative(SRC_DIR, file)}:\n${hits.join('\n')}`);
      }
    }
    expect(
      violations,
      `Forbidden phrase "Upgrade to 28mm required for ASHP" found — use "may be needed" language:\n${violations.join('\n\n')}`,
    ).toHaveLength(0);
  });

  it('does not contain "minimum required for safe combi operation" (use flow/temperature-lift constrained model)', () => {
    const violations: string[] = [];
    for (const file of files) {
      const hits = findPhraseLines(file, 'minimum required for safe combi operation');
      if (hits.length > 0) {
        violations.push(`${path.relative(SRC_DIR, file)}:\n${hits.join('\n')}`);
      }
    }
    expect(
      violations,
      `Forbidden phrase "minimum required for safe combi operation" found — combi must be modelled as flow/temperature-lift constrained:\n${violations.join('\n\n')}`,
    ).toHaveLength(0);
  });

  it('does not contain "The unit will lock out" in combi pressure context (use flow-constrained model)', () => {
    const violations: string[] = [];
    for (const file of files) {
      const hits = findPhraseLines(file, 'The unit will lock out');
      if (hits.length > 0) {
        violations.push(`${path.relative(SRC_DIR, file)}:\n${hits.join('\n')}`);
      }
    }
    expect(
      violations,
      `Forbidden phrase "The unit will lock out" found — use flow/temperature-lift constrained model instead:\n${violations.join('\n\n')}`,
    ).toHaveLength(0);
  });
});

// ─── Guardrails: thermal store must never be conflated with cylinder language ─
//
// A thermal store stores HEAT in primary circuit water, not finished domestic
// hot water. The DHW is produced via a heat exchanger on draw-off.
// Using "cylinder" or "stores hot water" for a thermal store is a physics error.

describe('No thermal-store / cylinder conflation in source', () => {
  const files = collectSourceFiles(SRC_DIR).filter(
    f => !ALLOWED_FILES.has(path.basename(f)) && !f.includes('__tests__'),
  );

  it('does not contain "thermal store cylinder" (a thermal store is not a cylinder)', () => {
    const violations: string[] = [];
    for (const file of files) {
      const hits = findPhraseLines(file, 'thermal store cylinder');
      if (hits.length > 0) {
        violations.push(`${path.relative(SRC_DIR, file)}:\n${hits.join('\n')}`);
      }
    }
    expect(
      violations,
      `Forbidden phrase "thermal store cylinder" found — a thermal store is not a cylinder:\n${violations.join('\n\n')}`,
    ).toHaveLength(0);
  });

  it('does not contain "thermal store stores hot water" (it stores heat in primary water, not finished DHW)', () => {
    const violations: string[] = [];
    for (const file of files) {
      const hits = findPhraseLines(file, 'thermal store stores hot water');
      if (hits.length > 0) {
        violations.push(`${path.relative(SRC_DIR, file)}:\n${hits.join('\n')}`);
      }
    }
    expect(
      violations,
      `Forbidden phrase "thermal store stores hot water" found — use "stores heat in primary water":\n${violations.join('\n\n')}`,
    ).toHaveLength(0);
  });
});

// ─── Guardrails: simulator naming — only the proof simulator may use these ───
//
// "Simulator", "System Lab", and "System Simulator" are reserved exclusively
// for the full interactive proof surface (ExplainersHubPage + SimulatorDashboard)
// with live taps, heating behaviour, and full system diagram.
//
// Non-proof surfaces (summary dashboards, educational panels, preview cards)
// must not use the word "simulator" in their user-facing copy.
// See docs/atlas-terminology.md § 16.

describe('Simulator naming reserved for proof surface only (atlas-terminology.md § 16)', () => {
  const files = collectSourceFiles(SRC_DIR).filter(
    f => !ALLOWED_FILES.has(path.basename(f)) && !f.includes('__tests__'),
  );

  it('does not contain "educational simulator" (use "educational model" for non-proof explainer panels)', () => {
    const violations: string[] = [];
    for (const file of files) {
      const hits = findPhraseLines(file, 'educational simulator');
      if (hits.length > 0) {
        violations.push(`${path.relative(SRC_DIR, file)}:\n${hits.join('\n')}`);
      }
    }
    expect(
      violations,
      `Forbidden phrase "educational simulator" found — use "educational model" for non-proof explainer panels:\n${violations.join('\n\n')}`,
    ).toHaveLength(0);
  });

  it('does not contain "scenario simulator" (use "Scenario Explorer" or "Scenario Explainer" for non-proof educational tools)', () => {
    const violations: string[] = [];
    for (const file of files) {
      const hits = findPhraseLines(file, 'scenario simulator');
      if (hits.length > 0) {
        violations.push(`${path.relative(SRC_DIR, file)}:\n${hits.join('\n')}`);
      }
    }
    expect(
      violations,
      `Forbidden phrase "scenario simulator" found — non-proof educational tools must not use "simulator":\n${violations.join('\n\n')}`,
    ).toHaveLength(0);
  });
});
