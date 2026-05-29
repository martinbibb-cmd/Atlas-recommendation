import { act, useEffect, useState, type ReactNode } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type {
  LibraryPdfBootResult,
  LibraryPdfReadyState,
  RunLibraryPdfBootStateInput,
} from '../libraryPdfBootState';
import * as libraryPdfBootStateModule from '../libraryPdfBootState';

const mockPortalJourneyPrintPack = vi.fn(() => <div data-testid="pjpp-document" />);

vi.mock('../../../library/portal/pdf/PortalJourneyPrintPack', () => ({
  PortalJourneyPrintPack: ({ model }: { model: unknown }) => mockPortalJourneyPrintPack(model),
}));

import { PortalJourneyPrintPack } from '../../../library/portal/pdf/PortalJourneyPrintPack';

type TestPrintModel = Record<string, unknown>;

const GOOD_PRINT_MODEL: TestPrintModel = {
  sections: [],
};
const ALWAYS_FALSE = () => false;
const FALLBACK_BOOT_ERROR_MESSAGE = 'Customer PDF could not be prepared due to an unexpected error.';

function hasExplicitVisitId(visitId: string | null): boolean {
  return typeof visitId === 'string' && visitId.trim().length > 0;
}

function setLibraryPdfUrl(visitId = 'visit-123'): void {
  window.history.replaceState({}, '', `/?library-pdf=1&visitId=${visitId}`);
}

interface LibraryPdfRouteAcceptanceHarnessProps {
  readonly input: Omit<RunLibraryPdfBootStateInput, 'visitId' | 'explicitVisitId' | 'onTransition' | 'isFallbackOnlyPrintModel'>;
  readonly isFallbackOnlyPrintModel?: (model: TestPrintModel) => boolean;
  readonly onStateCommit?: (state: LibraryPdfBootResult) => void;
  readonly renderPrintPack?: (model: TestPrintModel) => ReactNode;
}

function LibraryPdfRouteAcceptanceHarness({
  input,
  isFallbackOnlyPrintModel = ALWAYS_FALSE,
  onStateCommit,
  renderPrintPack = (model) => <PortalJourneyPrintPack model={model as any} />,
}: LibraryPdfRouteAcceptanceHarnessProps) {
  const [state, setState] = useState<LibraryPdfBootResult | null>(null);

  const params = new URLSearchParams(window.location.search);
  const isLibraryPdfJourney = params.get('library-pdf') === '1';
  const visitId = params.get('visitId');

  useEffect(() => {
    if (!isLibraryPdfJourney) {
      setState(null);
      return;
    }

    let cancelled = false;
    const commit = (nextState: LibraryPdfBootResult) => {
      setState(nextState);
      onStateCommit?.(nextState);
    };

    async function boot(): Promise<void> {
      let finalState: LibraryPdfBootResult = {
        status: 'blocked',
        message: FALLBACK_BOOT_ERROR_MESSAGE,
      };

      try {
        const result = await libraryPdfBootStateModule.runLibraryPdfBootState({
          ...input,
          visitId,
          explicitVisitId: hasExplicitVisitId(visitId),
          isFallbackOnlyPrintModel: (model) => isFallbackOnlyPrintModel(model as unknown as TestPrintModel),
          onTransition: (nextState) => {
            if (!cancelled) commit(nextState);
          },
        });
        finalState = result;
      } catch {
        // Keep fallback blocked final state.
      } finally {
        if (!cancelled) commit(finalState);
      }
    }

    void boot();

    return () => {
      cancelled = true;
    };
  }, [isLibraryPdfJourney, input, isFallbackOnlyPrintModel, onStateCommit, visitId]);

  if (!isLibraryPdfJourney) {
    return <div data-testid="not-library-pdf" />;
  }

  if (state == null || state.status === 'loading_visit' || state.status === 'rebuilding_customer_pack') {
    return (
      <div>
        <h1>Preparing supporting PDF</h1>
        <p role="status">Loading visit and rebuilding customer journey pack…</p>
      </div>
    );
  }

  if (state.status === 'visit_not_found' || state.status === 'blocked') {
    return (
      <div data-testid="blocked-notice">
        <h1>Supporting PDF blocked</h1>
        <p>{state.message}</p>
      </div>
    );
  }

  if (state.status === 'recommendation_missing') {
    return (
      <div data-testid="blocked-notice">
        <h1>Supporting PDF unavailable</h1>
        <p>{state.message}</p>
      </div>
    );
  }

  const printModel = (state as LibraryPdfReadyState).printModel as unknown as TestPrintModel | null;

  if (printModel == null) {
    return (
      <div data-testid="blocked-notice">
        <h1>Supporting PDF blocked</h1>
        <p>Customer PDF could not be prepared because this visit data is incomplete.</p>
      </div>
    );
  }

  if (hasExplicitVisitId(visitId) && isFallbackOnlyPrintModel(printModel)) {
    return (
      <div data-testid="blocked-notice">
        <h1>Supporting PDF blocked</h1>
        <p>Customer PDF blocked: this package does not yet meet customer story quality checks. Regenerate recommendation outputs and export again.</p>
      </div>
    );
  }

  return <div data-testid="library-pdf-route">{renderPrintPack(printModel)}</div>;
}

function buildRunInput(): LibraryPdfRouteAcceptanceHarnessProps['input'] {
  return {
    hydrateVisitById: async (visitId) => ({
      visitId,
    }),
    enrichGeneratedOutputs: () => ({
      portal: {
        url: '/portal',
      },
    } as any),
    resolveDocumentSource: () => ({
      ok: true,
      source: {
        visitReference: 'REF-123',
        acceptedScenarioId: 'scenario-1',
        customerJourneyPack: {
          staticPdf: GOOD_PRINT_MODEL,
        },
      },
    } as any),
  };
}

describe('library PDF route acceptance harness', () => {
  beforeEach(() => {
    setLibraryPdfUrl();
    mockPortalJourneyPrintPack.mockClear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState({}, '', '/');
  });

  it('good hydrated visit reaches ready and renders PortalJourneyPrintPack', async () => {
    render(<LibraryPdfRouteAcceptanceHarness input={buildRunInput()} />);

    await waitFor(() => {
      expect(screen.getByTestId('library-pdf-route')).toBeInTheDocument();
    });
    expect(screen.getByTestId('pjpp-document')).toBeInTheDocument();
    expect(mockPortalJourneyPrintPack).toHaveBeenCalled();
  });

  it('boot throws and route renders blocked notice instead of permanent Preparing', async () => {
    vi.spyOn(libraryPdfBootStateModule, 'runLibraryPdfBootState').mockRejectedValueOnce(new Error('boot failed'));

    render(<LibraryPdfRouteAcceptanceHarness input={buildRunInput()} />);

    await waitFor(() => {
      expect(screen.getByTestId('blocked-notice')).toBeInTheDocument();
    });
    expect(screen.getByText('Supporting PDF blocked')).toBeInTheDocument();
    expect(screen.queryByText('Preparing supporting PDF')).not.toBeInTheDocument();
  });

  it('missing printModel shows incomplete-data block and does not render PortalJourneyPrintPack', async () => {
    const renderPrintPack = vi.fn(() => <div data-testid="mock-print-pack" />);

    vi.spyOn(libraryPdfBootStateModule, 'runLibraryPdfBootState').mockResolvedValueOnce({
      status: 'ready',
      printModel: null,
      generatedOutputs: {} as any,
      hydratedSnapshot: { visitId: 'visit-123' },
      source: {
        ok: true,
        source: {
          visitReference: 'REF-123',
          acceptedScenarioId: 'scenario-1',
          customerJourneyPack: { staticPdf: GOOD_PRINT_MODEL },
        },
      } as any,
    } as any);

    render(
      <LibraryPdfRouteAcceptanceHarness
        input={buildRunInput()}
        renderPrintPack={renderPrintPack}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Customer PDF could not be prepared because this visit data is incomplete.')).toBeInTheDocument();
    });
    expect(renderPrintPack).not.toHaveBeenCalled();
    expect(screen.queryByTestId('mock-print-pack')).not.toBeInTheDocument();
  });

  it('cancelled boot unmount does not commit state after cancellation', async () => {
    let resolveBoot: ((value: LibraryPdfBootResult) => void) | null = null;
    const bootPromise = new Promise<LibraryPdfBootResult>((resolve) => {
      resolveBoot = resolve;
    });

    vi.spyOn(libraryPdfBootStateModule, 'runLibraryPdfBootState').mockReturnValueOnce(bootPromise);

    const commits: LibraryPdfBootResult[] = [];
    const { unmount } = render(
      <LibraryPdfRouteAcceptanceHarness
        input={buildRunInput()}
        onStateCommit={(state) => commits.push(state)}
      />,
    );

    unmount();

    await act(async () => {
      resolveBoot?.({ status: 'blocked', message: 'late block' });
      await bootPromise;
    });

    expect(commits).toEqual([]);
  });

  it('explicit visitId with fallback-only model blocks PDF output', async () => {
    setLibraryPdfUrl('visit-explicit');
    vi.spyOn(libraryPdfBootStateModule, 'runLibraryPdfBootState').mockResolvedValueOnce({
      status: 'ready',
      printModel: GOOD_PRINT_MODEL as any,
      generatedOutputs: {} as any,
      hydratedSnapshot: { visitId: 'visit-explicit' },
      source: {
        ok: true,
        source: {
          visitReference: 'REF-123',
          acceptedScenarioId: 'scenario-1',
          customerJourneyPack: { staticPdf: GOOD_PRINT_MODEL },
        },
      } as any,
    } as any);

    render(
      <LibraryPdfRouteAcceptanceHarness
        input={buildRunInput()}
        isFallbackOnlyPrintModel={() => true}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('blocked-notice')).toBeInTheDocument();
    });
    expect(
      screen.getByText(
        'Customer PDF blocked: this package does not yet meet customer story quality checks. Regenerate recommendation outputs and export again.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('pjpp-document')).not.toBeInTheDocument();
  });
});
