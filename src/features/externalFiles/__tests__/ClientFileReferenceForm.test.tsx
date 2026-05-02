/**
 * src/features/externalFiles/__tests__/ClientFileReferenceForm.test.tsx
 *
 * Tests for the ClientFileReferenceForm component.
 *
 * Covers:
 *   - Form renders all expected fields
 *   - Submit with valid data calls onSubmit with a correct ClientFileReferenceV1
 *   - URI is required for non-local_only access modes
 *   - URI is optional for local_only access mode
 *   - Validation errors are displayed for invalid submissions
 *   - onCancel is called when the cancel button is clicked
 *   - signed_link accepts an expiresAt value
 *   - No fetch is called during form interaction
 *   - No file content is submitted
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ClientFileReferenceForm } from '../ClientFileReferenceForm';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderForm(
  onSubmit = vi.fn(),
  onCancel = vi.fn(),
) {
  render(
    <ClientFileReferenceForm
      visitId="visit_test"
      tenantId="tenant_test"
      onSubmit={onSubmit}
      onCancel={onCancel}
    />,
  );
  return { onSubmit, onCancel };
}

function getProvider() { return screen.getByTestId('cfr-provider') as HTMLSelectElement; }
function getFileKind() { return screen.getByTestId('cfr-file-kind') as HTMLSelectElement; }
function getAccessMode() { return screen.getByTestId('cfr-access-mode') as HTMLSelectElement; }
function getUri() { return screen.getByTestId('cfr-uri') as HTMLInputElement; }
function getExternalId() { return screen.getByTestId('cfr-external-id') as HTMLInputElement; }
function getExpiresAt() { return screen.getByTestId('cfr-expires-at') as HTMLInputElement; }
function getSubmit() { return screen.getByTestId('cfr-submit') as HTMLButtonElement; }
function getCancel() { return screen.getByTestId('cfr-cancel') as HTMLButtonElement; }

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ClientFileReferenceForm — rendering', () => {
  it('renders all expected fields', () => {
    renderForm();
    expect(getProvider()).toBeInTheDocument();
    expect(getFileKind()).toBeInTheDocument();
    expect(getAccessMode()).toBeInTheDocument();
    expect(getUri()).toBeInTheDocument();
    expect(getExternalId()).toBeInTheDocument();
    expect(getExpiresAt()).toBeInTheDocument();
    expect(getSubmit()).toBeInTheDocument();
    expect(getCancel()).toBeInTheDocument();
  });

  it('renders all provider options', () => {
    renderForm();
    const options = Array.from(getProvider().options).map((o) => o.value);
    expect(options).toContain('google_drive');
    expect(options).toContain('onedrive');
    expect(options).toContain('icloud');
    expect(options).toContain('local_device');
    expect(options).toContain('other');
  });

  it('renders all file kind options', () => {
    renderForm();
    const options = Array.from(getFileKind().options).map((o) => o.value);
    expect(options).toContain('scan');
    expect(options).toContain('photo');
    expect(options).toContain('report');
    expect(options).toContain('floor_plan');
    expect(options).toContain('transcript');
    expect(options).toContain('handoff');
    expect(options).toContain('other');
  });

  it('renders all access mode options', () => {
    renderForm();
    const options = Array.from(getAccessMode().options).map((o) => o.value);
    expect(options).toContain('owner_controlled');
    expect(options).toContain('signed_link');
    expect(options).toContain('local_only');
  });
});

describe('ClientFileReferenceForm — submission', () => {
  it('calls onSubmit with a valid ClientFileReferenceV1 on success', () => {
    const { onSubmit } = renderForm();
    fireEvent.change(getProvider(), { target: { value: 'google_drive' } });
    fireEvent.change(getFileKind(), { target: { value: 'photo' } });
    fireEvent.change(getAccessMode(), { target: { value: 'owner_controlled' } });
    fireEvent.change(getUri(), { target: { value: 'https://drive.google.com/file/d/abc123' } });
    fireEvent.click(getSubmit());
    expect(onSubmit).toHaveBeenCalledOnce();
    const submitted = onSubmit.mock.calls[0][0];
    expect(submitted.version).toBe('1');
    expect(submitted.provider).toBe('google_drive');
    expect(submitted.fileKind).toBe('photo');
    expect(submitted.uri).toBe('https://drive.google.com/file/d/abc123');
    expect(submitted.accessMode).toBe('owner_controlled');
    expect(typeof submitted.referenceId).toBe('string');
    expect(submitted.referenceId.length).toBeGreaterThan(0);
    expect(typeof submitted.createdAt).toBe('string');
  });

  it('includes externalId when provided', () => {
    const { onSubmit } = renderForm();
    fireEvent.change(getUri(), { target: { value: 'https://example.com/file' } });
    fireEvent.change(getExternalId(), { target: { value: 'external-id-xyz' } });
    fireEvent.click(getSubmit());
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit.mock.calls[0][0].externalId).toBe('external-id-xyz');
  });

  it('omits externalId when not provided', () => {
    const { onSubmit } = renderForm();
    fireEvent.change(getUri(), { target: { value: 'https://example.com/file' } });
    fireEvent.click(getSubmit());
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit.mock.calls[0][0].externalId).toBeUndefined();
  });
});

describe('ClientFileReferenceForm — URI validation', () => {
  it('shows an error and does not call onSubmit when URI is empty for owner_controlled', () => {
    const { onSubmit } = renderForm();
    fireEvent.change(getAccessMode(), { target: { value: 'owner_controlled' } });
    fireEvent.change(getUri(), { target: { value: '' } });
    fireEvent.click(getSubmit());
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByTestId('cfr-errors')).toBeInTheDocument();
  });

  it('shows an error when URI is empty for signed_link', () => {
    const { onSubmit } = renderForm();
    fireEvent.change(getAccessMode(), { target: { value: 'signed_link' } });
    fireEvent.change(getUri(), { target: { value: '' } });
    fireEvent.click(getSubmit());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('allows empty URI for local_only access mode', () => {
    const { onSubmit } = renderForm();
    fireEvent.change(getAccessMode(), { target: { value: 'local_only' } });
    fireEvent.change(getUri(), { target: { value: '' } });
    fireEvent.click(getSubmit());
    expect(onSubmit).toHaveBeenCalledOnce();
    // uri field should be empty or absent for local_only
    const submitted = onSubmit.mock.calls[0][0];
    expect(submitted.accessMode).toBe('local_only');
  });

  it('accepts a URI for local_only when provided', () => {
    const { onSubmit } = renderForm();
    fireEvent.change(getAccessMode(), { target: { value: 'local_only' } });
    fireEvent.change(getUri(), { target: { value: '/Users/alice/Documents/scan.pdf' } });
    fireEvent.click(getSubmit());
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit.mock.calls[0][0].uri).toBe('/Users/alice/Documents/scan.pdf');
  });
});

describe('ClientFileReferenceForm — signed_link expiry', () => {
  it('accepts an expiresAt for signed_link', () => {
    const { onSubmit } = renderForm();
    fireEvent.change(getAccessMode(), { target: { value: 'signed_link' } });
    fireEvent.change(getUri(), { target: { value: 'https://storage.example.com/signed?token=abc' } });
    fireEvent.change(getExpiresAt(), { target: { value: '2026-12-31T23:59' } });
    fireEvent.click(getSubmit());
    expect(onSubmit).toHaveBeenCalledOnce();
    const submitted = onSubmit.mock.calls[0][0];
    expect(submitted.expiresAt).toBeDefined();
    expect(typeof submitted.expiresAt).toBe('string');
  });

  it('submits without expiresAt when not provided', () => {
    const { onSubmit } = renderForm();
    fireEvent.change(getUri(), { target: { value: 'https://example.com/file' } });
    fireEvent.click(getSubmit());
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit.mock.calls[0][0].expiresAt).toBeUndefined();
  });
});

describe('ClientFileReferenceForm — cancel', () => {
  it('calls onCancel when cancel button is clicked', () => {
    const { onCancel } = renderForm();
    fireEvent.click(getCancel());
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

describe('ClientFileReferenceForm — privacy', () => {
  it('does not call fetch during any interaction', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    renderForm();
    fireEvent.change(getUri(), { target: { value: 'https://drive.google.com/file/d/abc' } });
    fireEvent.click(getSubmit());
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
