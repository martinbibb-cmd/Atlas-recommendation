import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  clampPct,
  resolveNominalEfficiencyPct,
  computeCurrentEfficiencyPct,
} from '../utils/efficiency';

describe('clampPct', () => {
  it('returns value unchanged when within range', () => {
    expect(clampPct(75)).toBe(75);
  });

  it('clamps to min (50) when value is below range', () => {
    expect(clampPct(5)).toBe(50);
    expect(clampPct(0)).toBe(50);
    expect(clampPct(-10)).toBe(50);
  });

  it('clamps to max (99) when value is above range', () => {
    expect(clampPct(150)).toBe(99);
    expect(clampPct(100)).toBe(99);
    expect(clampPct(99)).toBe(99);
  });

  it('respects custom min/max', () => {
    expect(clampPct(10, 20, 80)).toBe(20);
    expect(clampPct(90, 20, 80)).toBe(80);
    expect(clampPct(50, 20, 80)).toBe(50);
  });
});

describe('resolveNominalEfficiencyPct', () => {
  it('returns clamped input when provided', () => {
    expect(resolveNominalEfficiencyPct(84)).toBe(84);
    expect(resolveNominalEfficiencyPct(92)).toBe(92);
  });

  it('falls back to 92 when input is undefined', () => {
    expect(resolveNominalEfficiencyPct(undefined)).toBe(92);
    expect(resolveNominalEfficiencyPct()).toBe(92);
  });

  it('clamps out-of-range inputs to [50, 99]', () => {
    expect(resolveNominalEfficiencyPct(150)).toBe(99);
    expect(resolveNominalEfficiencyPct(5)).toBe(50);
  });
});

describe('computeCurrentEfficiencyPct', () => {
  it('subtracts decay from nominal', () => {
    expect(computeCurrentEfficiencyPct(84, 8)).toBe(76);
  });

  it('clamps result to min 50 when decay is large', () => {
    expect(computeCurrentEfficiencyPct(55, 20)).toBe(50);
    expect(computeCurrentEfficiencyPct(50, 5)).toBe(50);
  });

  it('clamps result to max 99 when decay is negative (uplift)', () => {
    expect(computeCurrentEfficiencyPct(95, -10)).toBe(99);
  });

  it('zero decay returns nominal unchanged', () => {
    expect(computeCurrentEfficiencyPct(84, 0)).toBe(84);
  });
});

// ── Lint guard: single source of truth for ?? 92 ──────────────────────────────

/**
 * Collect all .ts / .tsx source files under src/ recursively.
 */
function collectSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(full));
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

describe('efficiency lint guard', () => {
  it('?? 92 appears only inside resolveNominalEfficiencyPct — no rogue fallbacks', () => {
    const srcRoot = join(__dirname, '../../');
    const files = collectSourceFiles(srcRoot);

    const violations: string[] = [];

    for (const file of files) {
      // Skip test files — they may reference 92 in assertions about expected behaviour
      if (/\.(test|spec)\.(ts|tsx)$/.test(file) || file.includes('__tests__')) continue;

      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, idx) => {
        if (!line.includes('?? 92')) return;
        // Skip comment-only lines (JSDoc / inline comments)
        const trimmed = line.trim();
        if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) return;
        // The only permitted code occurrence is in efficiency.ts: clampPct(inputSedbuk ?? 92)
        const isPermittedFile = file.endsWith('efficiency.ts');
        const isPermittedLine = isPermittedFile && line.includes('clampPct(inputSedbuk ?? 92)');
        if (!isPermittedLine) {
          violations.push(`${file}:${idx + 1}: ${trimmed}`);
        }
      });
    }

    expect(violations).toEqual([]);
  });
});
