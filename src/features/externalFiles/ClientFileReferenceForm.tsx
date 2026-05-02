/**
 * src/features/externalFiles/ClientFileReferenceForm.tsx
 *
 * Form for adding a new ClientFileReferenceV1 to an external visit manifest.
 *
 * Design rules
 * ────────────
 * - URI is required unless accessMode === 'local_only'.
 * - Never fetches or previews file contents.
 * - Never stores file blobs.
 * - Validation uses validateClientFileReferenceV1Fields (from the contract).
 * - Calls onSubmit with a fully-formed ClientFileReferenceV1 on success.
 * - Calls onCancel when the user discards the form.
 */

import { useState } from 'react';
import {
  validateClientFileReferenceV1Fields,
  type ClientFileProvider,
  type ClientFileKind,
  type ClientFileAccessMode,
  type ClientFileReferenceV1,
} from '../../contracts/ClientFileReferenceV1';

// ─── Option lists ─────────────────────────────────────────────────────────────

const PROVIDER_OPTIONS: { value: ClientFileProvider; label: string }[] = [
  { value: 'google_drive', label: 'Google Drive' },
  { value: 'onedrive', label: 'OneDrive' },
  { value: 'icloud', label: 'iCloud' },
  { value: 'local_device', label: 'Local device' },
  { value: 'other', label: 'Other' },
];

const FILE_KIND_OPTIONS: { value: ClientFileKind; label: string }[] = [
  { value: 'scan', label: 'Scan' },
  { value: 'photo', label: 'Photo' },
  { value: 'report', label: 'Report' },
  { value: 'floor_plan', label: 'Floor plan' },
  { value: 'transcript', label: 'Transcript' },
  { value: 'handoff', label: 'Handoff' },
  { value: 'other', label: 'Other' },
];

const ACCESS_MODE_OPTIONS: { value: ClientFileAccessMode; label: string }[] = [
  { value: 'owner_controlled', label: 'Owner controlled' },
  { value: 'signed_link', label: 'Signed link' },
  { value: 'local_only', label: 'Local only' },
];

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ClientFileReferenceFormProps {
  visitId: string;
  tenantId: string;
  onSubmit: (fileRef: ClientFileReferenceV1) => void;
  onCancel: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ClientFileReferenceForm({
  onSubmit,
  onCancel,
}: ClientFileReferenceFormProps) {
  const [provider, setProvider] = useState<ClientFileProvider>('other');
  const [fileKind, setFileKind] = useState<ClientFileKind>('other');
  const [uri, setUri] = useState('');
  const [externalId, setExternalId] = useState('');
  const [accessMode, setAccessMode] = useState<ClientFileAccessMode>('owner_controlled');
  const [expiresAt, setExpiresAt] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const now = new Date().toISOString();
    const referenceId = `ref_${crypto.randomUUID()}`;

    // Build the raw candidate object for validation.
    // URI is required unless accessMode is local_only; we pass '' when local_only
    // so that the base validator sees an empty uri and we handle the exception below.
    const candidate: Record<string, unknown> = {
      version: '1',
      referenceId,
      provider,
      fileKind,
      uri: accessMode === 'local_only' ? (uri.trim() || '_local_') : uri.trim(),
      accessMode,
      createdAt: now,
    };
    if (externalId.trim()) candidate['externalId'] = externalId.trim();
    if (expiresAt.trim()) candidate['expiresAt'] = new Date(expiresAt).toISOString();

    // Run the contract validator.
    const contractErrors = validateClientFileReferenceV1Fields(candidate);

    // Apply the local_only URI exception: URI is not required for local_only.
    const validationErrors = contractErrors.filter((err) => {
      if (accessMode === 'local_only' && err.startsWith('uri:')) return false;
      return true;
    });

    // Additional UI-level check: URI is required for non-local_only modes.
    if (accessMode !== 'local_only' && uri.trim().length === 0) {
      validationErrors.push('uri: required for this access mode');
    }

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors([]);

    const fileRef: ClientFileReferenceV1 = {
      version: '1',
      referenceId,
      provider,
      fileKind,
      uri: accessMode === 'local_only' ? uri.trim() : uri.trim(),
      accessMode,
      createdAt: now,
      ...(externalId.trim() ? { externalId: externalId.trim() } : {}),
      ...(expiresAt.trim() ? { expiresAt: new Date(expiresAt).toISOString() } : {}),
    };

    onSubmit(fileRef);
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '0.25rem',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#374151',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.4rem 0.6rem',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    fontSize: '0.85rem',
    boxSizing: 'border-box' as const,
  };

  const fieldStyle: React.CSSProperties = { marginBottom: '0.75rem' };

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="client-file-reference-form"
      style={{
        background: '#f9fafb',
        border: '1px solid #e5e7eb',
        borderRadius: '6px',
        padding: '1rem',
        marginTop: '0.75rem',
      }}
    >
      <p style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.75rem', color: '#111827' }}>
        Add file reference
      </p>

      <div style={fieldStyle}>
        <label style={labelStyle} htmlFor="cfr-provider">Provider</label>
        <select
          id="cfr-provider"
          style={inputStyle}
          value={provider}
          onChange={(e) => setProvider(e.target.value as ClientFileProvider)}
          data-testid="cfr-provider"
        >
          {PROVIDER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle} htmlFor="cfr-file-kind">File kind</label>
        <select
          id="cfr-file-kind"
          style={inputStyle}
          value={fileKind}
          onChange={(e) => setFileKind(e.target.value as ClientFileKind)}
          data-testid="cfr-file-kind"
        >
          {FILE_KIND_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle} htmlFor="cfr-access-mode">Access mode</label>
        <select
          id="cfr-access-mode"
          style={inputStyle}
          value={accessMode}
          onChange={(e) => setAccessMode(e.target.value as ClientFileAccessMode)}
          data-testid="cfr-access-mode"
        >
          {ACCESS_MODE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle} htmlFor="cfr-uri">
          URI{accessMode !== 'local_only' ? ' *' : ' (optional for local-only)'}
        </label>
        <input
          id="cfr-uri"
          type="text"
          style={inputStyle}
          value={uri}
          onChange={(e) => setUri(e.target.value)}
          placeholder={
            accessMode === 'local_only'
              ? 'Optional path or identifier'
              : 'https://…'
          }
          data-testid="cfr-uri"
          autoComplete="off"
        />
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle} htmlFor="cfr-external-id">External ID (optional)</label>
        <input
          id="cfr-external-id"
          type="text"
          style={inputStyle}
          value={externalId}
          onChange={(e) => setExternalId(e.target.value)}
          placeholder="Provider-native file ID"
          data-testid="cfr-external-id"
          autoComplete="off"
        />
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle} htmlFor="cfr-expires-at">
          Expires at (optional
          {accessMode === 'signed_link' ? ' — recommended for signed links' : ''})
        </label>
        <input
          id="cfr-expires-at"
          type="datetime-local"
          style={inputStyle}
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          data-testid="cfr-expires-at"
        />
      </div>

      {errors.length > 0 && (
        <ul
          role="alert"
          data-testid="cfr-errors"
          style={{
            margin: '0 0 0.75rem',
            padding: '0.5rem 0.75rem',
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            borderRadius: '4px',
            listStyle: 'disc inside',
            fontSize: '0.8rem',
            color: '#991b1b',
          }}
        >
          {errors.map((err, i) => <li key={i}>{err}</li>)}
        </ul>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onCancel}
          data-testid="cfr-cancel"
          style={{
            padding: '0.4rem 0.9rem',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            background: '#fff',
            fontSize: '0.85rem',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          data-testid="cfr-submit"
          style={{
            padding: '0.4rem 0.9rem',
            border: 'none',
            borderRadius: '4px',
            background: '#1d4ed8',
            color: '#fff',
            fontSize: '0.85rem',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Add reference
        </button>
      </div>
    </form>
  );
}
