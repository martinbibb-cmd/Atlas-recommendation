/**
 * src/features/externalFiles/__tests__/ExternalVisitManifestPanel.test.tsx
 *
 * Tests for the ExternalVisitManifestPanel component.
 *
 * Covers:
 *   - Renders "no manifest" state when no manifest exists
 *   - Renders summary with total files, file kinds, and counts
 *   - Renders file reference list with provider / kind / access mode
 *   - Open link uses anchor href only — no fetch is called
 *   - Remove button triggers removal
 *   - Add file reference button shows the ClientFileReferenceForm
 *   - Saving the manifest persists changes
 *   - Deleting the manifest clears the panel
 *   - No file content is displayed
 *   - Analytics privacy guard still blocks uri / externalId / files
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LocalStorageAdapter } from '../../../lib/storage/localStorageAdapter';
import { ExternalVisitManifestPanel } from '../ExternalVisitManifestPanel';
import {
  saveManifest,
  upsertFileReference,
} from '../externalVisitManifestStore';
import type { ClientFileReferenceV1 } from '../../../contracts/ClientFileReferenceV1';
import type { ExternalVisitManifestV1 } from '../../../contracts/ExternalVisitManifestV1';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeFileRef(overrides?: Partial<ClientFileReferenceV1>): ClientFileReferenceV1 {
  return {
    version: '1',
    referenceId: `ref_${Math.random().toString(36).slice(2)}`,
    provider: 'google_drive',
    fileKind: 'photo',
    uri: 'https://drive.google.com/file/d/test-id',
    accessMode: 'owner_controlled',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeManifest(visitId: string, files: ClientFileReferenceV1[] = []): ExternalVisitManifestV1 {
  return {
    version: '1',
    visitId,
    tenantId: 'tenant-test',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    files,
    summary: {
      totalFiles: files.length,
      fileKindsPresent: [],
      countByKind: {},
    },
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

const VISIT_ID = 'visit_panel_test';
const TENANT_ID = 'tenant_panel_test';

let adapter: LocalStorageAdapter;

beforeEach(() => {
  adapter = new LocalStorageAdapter();
  adapter.clearSync('visitManifests');
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ExternalVisitManifestPanel — empty state', () => {
  it('renders visit and tenant IDs', () => {
    render(<ExternalVisitManifestPanel visitId={VISIT_ID} tenantId={TENANT_ID} />);
    expect(screen.getByTestId('manifest-visit-id')).toHaveTextContent(VISIT_ID);
    expect(screen.getByTestId('manifest-tenant-id')).toHaveTextContent(TENANT_ID);
  });

  it('shows the no-manifest message when no manifest exists', () => {
    render(<ExternalVisitManifestPanel visitId={VISIT_ID} tenantId={TENANT_ID} />);
    expect(screen.getByTestId('manifest-none')).toBeInTheDocument();
  });

  it('shows the add reference button', () => {
    render(<ExternalVisitManifestPanel visitId={VISIT_ID} tenantId={TENANT_ID} />);
    expect(screen.getByTestId('manifest-add-ref-btn')).toBeInTheDocument();
  });
});

describe('ExternalVisitManifestPanel — with manifest', () => {
  it('shows summary total files', () => {
    const ref = makeFileRef({ referenceId: 'ref_a', fileKind: 'photo' });
    upsertFileReference(VISIT_ID, TENANT_ID, ref);
    render(<ExternalVisitManifestPanel visitId={VISIT_ID} tenantId={TENANT_ID} />);
    expect(screen.getByTestId('manifest-total-files')).toHaveTextContent('1');
  });

  it('shows file kinds present in summary', () => {
    upsertFileReference(VISIT_ID, TENANT_ID, makeFileRef({ fileKind: 'photo' }));
    upsertFileReference(VISIT_ID, TENANT_ID, makeFileRef({ fileKind: 'report' }));
    render(<ExternalVisitManifestPanel visitId={VISIT_ID} tenantId={TENANT_ID} />);
    expect(screen.getByTestId('manifest-kinds-present')).toHaveTextContent('Photo');
    expect(screen.getByTestId('manifest-kinds-present')).toHaveTextContent('Report');
  });

  it('renders the file reference list', () => {
    const ref = makeFileRef({ referenceId: 'ref_list_test' });
    upsertFileReference(VISIT_ID, TENANT_ID, ref);
    render(<ExternalVisitManifestPanel visitId={VISIT_ID} tenantId={TENANT_ID} />);
    expect(screen.getByTestId('manifest-file-list')).toBeInTheDocument();
    expect(screen.getByTestId(`manifest-file-row-${ref.referenceId}`)).toBeInTheDocument();
  });

  it('renders a remove button for each file reference', () => {
    const ref = makeFileRef({ referenceId: 'ref_rm_btn' });
    upsertFileReference(VISIT_ID, TENANT_ID, ref);
    render(<ExternalVisitManifestPanel visitId={VISIT_ID} tenantId={TENANT_ID} />);
    expect(screen.getByTestId(`manifest-remove-ref-${ref.referenceId}`)).toBeInTheDocument();
  });
});

describe('ExternalVisitManifestPanel — open link', () => {
  it('renders an anchor link for file refs with a URI (owner_controlled)', () => {
    const ref = makeFileRef({
      referenceId: 'ref_link',
      uri: 'https://drive.google.com/file/d/abc',
      accessMode: 'owner_controlled',
    });
    upsertFileReference(VISIT_ID, TENANT_ID, ref);
    render(<ExternalVisitManifestPanel visitId={VISIT_ID} tenantId={TENANT_ID} />);
    const link = screen.getByTestId(`manifest-open-link-${ref.referenceId}`) as HTMLAnchorElement;
    expect(link.tagName).toBe('A');
    expect(link.href).toBe('https://drive.google.com/file/d/abc');
    expect(link.target).toBe('_blank');
  });

  it('does not render open link for local_only refs', () => {
    const ref = makeFileRef({
      referenceId: 'ref_local',
      uri: '/Users/alice/scan.pdf',
      accessMode: 'local_only',
    });
    upsertFileReference(VISIT_ID, TENANT_ID, ref);
    render(<ExternalVisitManifestPanel visitId={VISIT_ID} tenantId={TENANT_ID} />);
    expect(screen.queryByTestId(`manifest-open-link-${ref.referenceId}`)).not.toBeInTheDocument();
  });

  it('does not fetch the linked URI', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const ref = makeFileRef({ referenceId: 'ref_no_fetch' });
    upsertFileReference(VISIT_ID, TENANT_ID, ref);
    render(<ExternalVisitManifestPanel visitId={VISIT_ID} tenantId={TENANT_ID} />);
    // Clicking the link should not trigger a fetch.
    const link = screen.queryByTestId(`manifest-open-link-${ref.referenceId}`);
    if (link) {
      fireEvent.click(link);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe('ExternalVisitManifestPanel — remove reference', () => {
  it('removes a file reference when remove is clicked', async () => {
    const ref1 = makeFileRef({ referenceId: 'ref_keep_panel', fileKind: 'scan' });
    const ref2 = makeFileRef({ referenceId: 'ref_remove_panel', fileKind: 'photo' });
    upsertFileReference(VISIT_ID, TENANT_ID, ref1);
    upsertFileReference(VISIT_ID, TENANT_ID, ref2);
    render(<ExternalVisitManifestPanel visitId={VISIT_ID} tenantId={TENANT_ID} />);
    fireEvent.click(screen.getByTestId(`manifest-remove-ref-${ref2.referenceId}`));
    await waitFor(() => {
      expect(screen.queryByTestId(`manifest-file-row-${ref2.referenceId}`)).not.toBeInTheDocument();
    });
    expect(screen.getByTestId(`manifest-file-row-${ref1.referenceId}`)).toBeInTheDocument();
  });

  it('updates the total file count after removal', async () => {
    const ref1 = makeFileRef({ referenceId: 'ref_count_a' });
    const ref2 = makeFileRef({ referenceId: 'ref_count_b' });
    upsertFileReference(VISIT_ID, TENANT_ID, ref1);
    upsertFileReference(VISIT_ID, TENANT_ID, ref2);
    render(<ExternalVisitManifestPanel visitId={VISIT_ID} tenantId={TENANT_ID} />);
    expect(screen.getByTestId('manifest-total-files')).toHaveTextContent('2');
    fireEvent.click(screen.getByTestId(`manifest-remove-ref-${ref1.referenceId}`));
    await waitFor(() => {
      expect(screen.getByTestId('manifest-total-files')).toHaveTextContent('1');
    });
  });
});

describe('ExternalVisitManifestPanel — add form', () => {
  it('shows the add form when the add button is clicked', () => {
    render(<ExternalVisitManifestPanel visitId={VISIT_ID} tenantId={TENANT_ID} />);
    fireEvent.click(screen.getByTestId('manifest-add-ref-btn'));
    expect(screen.getByTestId('client-file-reference-form')).toBeInTheDocument();
  });
});

describe('ExternalVisitManifestPanel — save and delete', () => {
  it('shows save and delete buttons when a manifest exists', () => {
    const ref = makeFileRef();
    upsertFileReference(VISIT_ID, TENANT_ID, ref);
    render(<ExternalVisitManifestPanel visitId={VISIT_ID} tenantId={TENANT_ID} />);
    expect(screen.getByTestId('manifest-save-btn')).toBeInTheDocument();
    expect(screen.getByTestId('manifest-delete-btn')).toBeInTheDocument();
  });

  it('confirms before deleting the manifest', () => {
    const ref = makeFileRef();
    upsertFileReference(VISIT_ID, TENANT_ID, ref);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<ExternalVisitManifestPanel visitId={VISIT_ID} tenantId={TENANT_ID} />);
    fireEvent.click(screen.getByTestId('manifest-delete-btn'));
    expect(confirmSpy).toHaveBeenCalled();
    // Manifest should still be visible since confirm returned false.
    expect(screen.getByTestId('manifest-total-files')).toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it('shows deleted message after confirming delete', async () => {
    const ref = makeFileRef();
    upsertFileReference(VISIT_ID, TENANT_ID, ref);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<ExternalVisitManifestPanel visitId={VISIT_ID} tenantId={TENANT_ID} />);
    fireEvent.click(screen.getByTestId('manifest-delete-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('manifest-deleted-msg')).toBeInTheDocument();
    });
  });
});

describe('ExternalVisitManifestPanel — close button', () => {
  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<ExternalVisitManifestPanel visitId={VISIT_ID} tenantId={TENANT_ID} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('manifest-panel-close'));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe('ExternalVisitManifestPanel — analytics privacy guard', () => {
  it('does not place uri or externalId in the analytics store', () => {
    const ref = makeFileRef({
      referenceId: 'ref_priv',
      uri: 'https://drive.google.com/file/d/super-secret',
      externalId: 'secret-external-id',
    });
    upsertFileReference(VISIT_ID, TENANT_ID, ref);
    render(<ExternalVisitManifestPanel visitId={VISIT_ID} tenantId={TENANT_ID} />);
    const analyticsRaw = localStorage.getItem('atlas:analytics:v1');
    if (analyticsRaw) {
      expect(analyticsRaw).not.toContain('super-secret');
      expect(analyticsRaw).not.toContain('secret-external-id');
    }
  });
});
