import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

describe('Visit Home simulator routing in App', () => {
  const appSource = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), '../../../App.tsx'),
    'utf8',
  );

  it('routes Visit Home simulator CTA to unified-simulator wrapper journey', () => {
    expect(appSource).toContain("setLastOpenedFromHome({ label: 'Simulator', journey: 'unified-simulator' });");
    expect(appSource).toContain("setJourney('unified-simulator');");
  });

  it('renders UnifiedSimulatorView on unified-simulator journey', () => {
    expect(appSource).toContain("{journey === 'unified-simulator' && (");
    expect(appSource).toContain('<UnifiedSimulatorView');
  });
});
