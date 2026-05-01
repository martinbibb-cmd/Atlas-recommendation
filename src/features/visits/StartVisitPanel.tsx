/**
 * src/features/visits/StartVisitPanel.tsx
 *
 * Minimal start-visit UI for Atlas Mind.
 *
 * Allows the engineer to optionally select a brand before creating a new
 * visit.  On confirmation the panel calls the supplied `onStart` callback
 * with the newly-created AtlasVisit so the caller can push it into context.
 *
 * Design rules
 * ────────────
 * - Calls createVisit() from lib/visits/visitApi.ts to issue the POST.
 * - Calls createAtlasVisit() to assemble the AtlasVisit with the brandId.
 * - No direct sessionStorage writes here — caller owns persistence via
 *   VisitProvider / visitStore.
 * - Uses only BRAND_PROFILES registry for brand options — no hardcoded names.
 */

import { useState } from 'react';
import { createVisit } from '../../lib/visits/visitApi';
import { createAtlasVisit } from './createAtlasVisit';
import type { AtlasVisit } from './createAtlasVisit';
import { BRAND_PROFILES, DEFAULT_BRAND_ID } from '../branding';

// ─── Props ────────────────────────────────────────────────────────────────────

interface StartVisitPanelProps {
  /**
   * Called after a visit is successfully created.
   * Receives the constructed AtlasVisit (visitId + brandId + createdAt).
   */
  onStart: (visit: AtlasVisit) => void;
  /**
   * Called when the engineer cancels without creating a visit.
   */
  onCancel?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * StartVisitPanel
 *
 * Renders a minimal form with:
 *   - Optional visit reference input.
 *   - Brand selector (populated from BRAND_PROFILES registry).
 *   - Start / Cancel actions.
 *
 * On submit: POSTs to /api/visits, constructs an AtlasVisit, and calls onStart.
 */
export function StartVisitPanel({ onStart, onCancel }: StartVisitPanelProps) {
  const [reference, setReference] = useState('');
  const [brandId, setBrandId] = useState(DEFAULT_BRAND_ID);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const brandOptions = Object.values(BRAND_PROFILES);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    setError(null);
    try {
      const opts = reference.trim().length > 0 ? { visit_reference: reference.trim() } : {};
      const { id } = await createVisit(opts);
      const visit = createAtlasVisit(id, brandId);
      onStart(visit);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create visit');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: 480 }}>
      <h2 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.25rem' }}>
        Start New Visit
      </h2>
      <form onSubmit={handleSubmit}>
        {/* Visit reference */}
        <div style={{ marginBottom: '1rem' }}>
          <label
            htmlFor="start-visit-reference"
            style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}
          >
            Visit reference <span style={{ fontWeight: 400, color: '#64748b' }}>(optional)</span>
          </label>
          <input
            id="start-visit-reference"
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="e.g. JOB-2024-001"
            disabled={creating}
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              border: '1px solid #cbd5e1',
              borderRadius: 6,
              fontSize: '1rem',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Brand selector */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label
            htmlFor="start-visit-brand"
            style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}
          >
            Brand
          </label>
          <select
            id="start-visit-brand"
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
            disabled={creating}
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              border: '1px solid #cbd5e1',
              borderRadius: 6,
              fontSize: '1rem',
              background: '#fff',
              boxSizing: 'border-box',
            }}
          >
            {brandOptions.map((profile) => (
              <option key={profile.brandId} value={profile.brandId}>
                {profile.companyName}
              </option>
            ))}
          </select>
        </div>

        {/* Inline error */}
        {error !== null && (
          <p
            role="alert"
            style={{ color: '#dc2626', marginBottom: '1rem', fontSize: '0.875rem' }}
          >
            {error}
          </p>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="submit"
            disabled={creating}
            style={{
              flex: 1,
              padding: '0.625rem 1.25rem',
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: '1rem',
              cursor: creating ? 'not-allowed' : 'pointer',
              opacity: creating ? 0.6 : 1,
            }}
          >
            {creating ? 'Starting…' : 'Start Visit'}
          </button>
          {onCancel !== undefined && (
            <button
              type="button"
              onClick={onCancel}
              disabled={creating}
              style={{
                padding: '0.625rem 1.25rem',
                background: 'transparent',
                color: '#64748b',
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                fontSize: '1rem',
                cursor: creating ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
