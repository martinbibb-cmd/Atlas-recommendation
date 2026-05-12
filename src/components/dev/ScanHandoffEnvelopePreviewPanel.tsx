import { useState } from 'react';
import type { ScanHandoffEnvelopePreviewV1 } from '../../specification/followUps';

interface Props {
  envelope: ScanHandoffEnvelopePreviewV1;
}

export default function ScanHandoffEnvelopePreviewPanel({ envelope }: Props) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  function handleCopyPayload() {
    if (!navigator.clipboard?.writeText) {
      setCopyStatus('failed');
      return;
    }
    void navigator.clipboard.writeText(envelope.encodedPayloadPreview).then(
      () => setCopyStatus('copied'),
      () => setCopyStatus('failed'),
    );
  }

  return (
    <section
      style={{ border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '0.75rem', background: '#fff' }}
      data-testid="scan-handoff-envelope-preview-panel"
    >
      <h3 style={{ margin: '0 0 0.55rem', fontSize: '0.95rem' }}>Scan Handoff Envelope Preview</h3>
      <p style={{ margin: '0 0 0.6rem', fontSize: 12, color: '#475569' }}>
        Dev-only envelope preview for Atlas Scan follow-up capture. No persistence and no live delivery.
      </p>
      <p style={{ margin: '0 0 0.35rem', fontSize: 12, color: '#475569' }}>
        <strong>Envelope ID:</strong> {envelope.envelopeId}
      </p>
      <p style={{ margin: '0 0 0.35rem', fontSize: 12, color: '#475569' }}>
        <strong>Schema:</strong> {envelope.schemaVersion} · <strong>Source:</strong> {envelope.source}
      </p>
      <p style={{ margin: '0 0 0.35rem', fontSize: 12, color: '#475569' }}>
        <strong>Created:</strong> {envelope.createdAt}
      </p>
      <p style={{ margin: '0 0 0.35rem', fontSize: 12, color: '#475569' }}>
        <strong>Handoff reason:</strong> {envelope.handoffReason}
      </p>
      <p style={{ margin: '0 0 0.6rem', fontSize: 12, color: '#475569' }}>
        <strong>Encoded payload length:</strong>{' '}
        <span data-testid="scan-handoff-envelope-payload-length">{envelope.encodedPayloadPreview.length}</span>
      </p>

      <div style={{ marginBottom: '0.6rem' }}>
        <strong style={{ display: 'block', marginBottom: '0.25rem', fontSize: 12 }}>Safety flags</strong>
        <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: 12, color: '#475569' }}>
          <li>devOnly: {String(envelope.safety.devOnly)}</li>
          <li>containsCustomerData: {String(envelope.safety.containsCustomerData)}</li>
          <li>persistenceEnabled: {String(envelope.safety.persistenceEnabled)}</li>
          <li>deliveryEnabled: {String(envelope.safety.deliveryEnabled)}</li>
        </ul>
      </div>

      <div style={{ marginBottom: '0.6rem' }}>
        <strong style={{ display: 'block', marginBottom: '0.25rem', fontSize: 12 }}>Preview deep link</strong>
        <code
          style={{
            display: 'block',
            padding: '0.5rem',
            borderRadius: 8,
            border: '1px solid #e2e8f0',
            fontSize: 11,
            overflowX: 'auto',
            background: '#f8fafc',
          }}
          data-testid="scan-handoff-envelope-deep-link"
        >
          {envelope.deepLinkPreview}
        </code>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <button
          type="button"
          onClick={handleCopyPayload}
          className="dev-portal-fixture__btn"
          data-testid="scan-handoff-envelope-copy-payload"
        >
          Copy payload
        </button>
        {copyStatus === 'copied' ? <span style={{ fontSize: 12, color: '#166534' }}>Copied</span> : null}
        {copyStatus === 'failed' ? <span style={{ fontSize: 12, color: '#b91c1c' }}>Copy failed</span> : null}
      </div>
    </section>
  );
}

