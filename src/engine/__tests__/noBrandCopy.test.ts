/**
 * noBrandCopy.test.ts
 *
 * Lint-style test: ensures that no user-facing brand names (Nest, Hive) appear
 * as string literals in the UI copy sources under src/.
 *
 * Allowed exceptions:
 *  - Code comments (lines starting with whitespace + // or * )
 *  - Schema/type comments (EngineInputV2_3.ts, FullSurveyModelV1.ts)
 *  - Technical integration modules (ConnectedInsightModule, MaintenanceROI,
 *    RegionalHardness, SurveySummaryGenerator, TenantConfigProvider,
 *    FullSurveyStepper) — these reference brand-specific integration logic
 *    and are not customer-visible copy.
 *  - Test files themselves
 *  - assumptions.catalog.ts — internal improvement hints
 *  - AssumptionsBuilder.ts  — internal derivation notes
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Files that are permitted to reference brand names for technical/integration reasons
const ALLOWED_FILES = new Set([
  'ConnectedInsightModule.ts',
  'MaintenanceROI.ts',
  'RegionalHardness.ts',
  'SurveySummaryGenerator.ts',
  'TenantConfigProvider.tsx',
  'FullSurveyStepper.tsx',
  'EngineInputV2_3.ts',
  'FullSurveyModelV1.ts',
  'assumptions.catalog.ts',
  'AssumptionsBuilder.ts',
  // This test file itself
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

/** Returns string-literal lines that contain the banned term. */
function findBrandLines(filePath: string, brand: string): string[] {
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const hits: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip pure comment lines (single-line // comments or JSDoc * lines)
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
    // Skip inline trailing comments by stripping them before checking
    const codeOnly = line.replace(/\/\/.*$/, '');
    if (codeOnly.includes(brand)) {
      hits.push(`  line ${i + 1}: ${line.trimEnd()}`);
    }
  }
  return hits;
}

describe('No brand names in user-facing copy', () => {
  const files = collectSourceFiles(SRC_DIR).filter(
    f => !ALLOWED_FILES.has(path.basename(f)) && !f.includes('__tests__'),
  );

  it('does not contain "Nest" in string literals', () => {
    const violations: string[] = [];
    for (const file of files) {
      const hits = findBrandLines(file, 'Nest');
      if (hits.length > 0) {
        violations.push(`${path.relative(SRC_DIR, file)}:\n${hits.join('\n')}`);
      }
    }
    expect(violations, `Brand term "Nest" found:\n${violations.join('\n\n')}`).toHaveLength(0);
  });

  it('does not contain "Hive" in string literals', () => {
    const violations: string[] = [];
    for (const file of files) {
      const hits = findBrandLines(file, 'Hive');
      if (hits.length > 0) {
        violations.push(`${path.relative(SRC_DIR, file)}:\n${hits.join('\n')}`);
      }
    }
    expect(violations, `Brand term "Hive" found:\n${violations.join('\n\n')}`).toHaveLength(0);
  });
});
