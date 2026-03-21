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
