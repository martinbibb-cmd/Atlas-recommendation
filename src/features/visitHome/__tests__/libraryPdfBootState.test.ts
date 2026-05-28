import { describe, expect, it } from 'vitest';
import {
  resolveLibraryPdfBootState,
  shouldResolveLibraryPdfSource,
} from '../libraryPdfBootState';

describe('libraryPdfBootState', () => {
  it('?library-pdf=1&visitId=known hydrates visit before PDF render', () => {
    const loadingState = resolveLibraryPdfBootState({
      explicitVisitId: 'known',
      hydrationComplete: false,
      visitLoaded: false,
      recommendationReady: false,
      customerJourneyPackReady: false,
    });
    const readyState = resolveLibraryPdfBootState({
      explicitVisitId: 'known',
      hydrationComplete: true,
      visitLoaded: true,
      recommendationReady: true,
      customerJourneyPackReady: true,
    });

    expect(loadingState).toBe('loading_visit');
    expect(readyState).toBe('ready');
  });

  it('PDF resolver is not called before visit hydration completes', () => {
    const state = resolveLibraryPdfBootState({
      explicitVisitId: 'known',
      hydrationComplete: false,
      visitLoaded: true,
      recommendationReady: true,
      customerJourneyPackReady: true,
    });
    expect(shouldResolveLibraryPdfSource(state)).toBe(false);
  });

  it('missing visitId shows blocking error', () => {
    const state = resolveLibraryPdfBootState({
      explicitVisitId: undefined,
      hydrationComplete: false,
      visitLoaded: false,
      recommendationReady: false,
      customerJourneyPackReady: false,
    });
    expect(state).toBe('blocked');
  });

  it('unknown visitId shows blocking error', () => {
    const state = resolveLibraryPdfBootState({
      explicitVisitId: 'unknown',
      hydrationComplete: true,
      visitLoaded: false,
      recommendationReady: false,
      customerJourneyPackReady: false,
    });
    expect(state).toBe('visit_not_found');
  });

  it('no basic fallback PDF is generated when explicit visitId is supplied', () => {
    const state = resolveLibraryPdfBootState({
      explicitVisitId: 'known',
      hydrationComplete: true,
      visitLoaded: true,
      recommendationReady: false,
      customerJourneyPackReady: false,
    });
    expect(state).toBe('recommendation_missing');
    expect(shouldResolveLibraryPdfSource(state)).toBe(false);
  });
});
