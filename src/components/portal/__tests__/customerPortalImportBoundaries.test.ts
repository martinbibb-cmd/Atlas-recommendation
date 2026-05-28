import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const CUSTOMER_PORTAL_PAGE_PATH = path.resolve(
  __dirname,
  '..',
  'CustomerPortalPage.tsx',
);

describe('customer portal import boundaries', () => {
  it('does not import legacy renderer namespaces', () => {
    const source = fs.readFileSync(CUSTOMER_PORTAL_PAGE_PATH, 'utf8');
    expect(source).not.toMatch(/from\s+['"][^'"]*src\/legacy\//);
    expect(source).not.toMatch(/from\s+['"][^'"]*legacy\/customerOutputPrototype\//);
  });

  it('does not import InsightPackDeck', () => {
    const source = fs.readFileSync(CUSTOMER_PORTAL_PAGE_PATH, 'utf8');
    expect(source).not.toContain('InsightPackDeck');
  });
});
