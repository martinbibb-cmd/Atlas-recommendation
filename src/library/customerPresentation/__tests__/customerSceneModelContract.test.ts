import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const PORTAL_PAGE_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'components',
  'portal',
  'CustomerPortalPage.tsx',
);
const PORTAL_PRINT_PACK_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  'portal',
  'pdf',
  'PortalJourneyPrintPack.tsx',
);
const CUSTOMER_SCENE_DECK_PATH = path.resolve(__dirname, '..', 'CustomerSceneDeck.tsx');
const CUSTOMER_SCENE_PRINT_PATH = path.resolve(__dirname, '..', 'CustomerScenePrint.tsx');

describe('customer scene model contract', () => {
  it('portal and PDF renderers both consume the same canonical scene builder', () => {
    const portalSource = fs.readFileSync(PORTAL_PAGE_PATH, 'utf8');
    const printSource = fs.readFileSync(PORTAL_PRINT_PACK_PATH, 'utf8');
    expect(portalSource).toContain('buildCustomerPresentationScenes');
    expect(printSource).toContain('buildCustomerPresentationScenes');
  });

  it('CustomerSceneDeck and CustomerScenePrint both consume CustomerPresentationScene[]', () => {
    const deckSource = fs.readFileSync(CUSTOMER_SCENE_DECK_PATH, 'utf8');
    const printSource = fs.readFileSync(CUSTOMER_SCENE_PRINT_PATH, 'utf8');
    expect(deckSource).toContain('CustomerPresentationScene');
    expect(printSource).toContain('CustomerPresentationScene');
  });
});
