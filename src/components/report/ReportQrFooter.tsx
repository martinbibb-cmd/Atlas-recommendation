/**
 * ReportQrFooter.tsx
 *
 * Renders a QR code in the report footer linking to the customer portal.
 *
 * Placement: bottom of the final summary page in ReportView.
 * Copy: "Scan to open your interactive home heating plan"
 *
 * The QR encodes a signed portal URL: /portal/:reference?token=...
 * The token is HMAC-signed, scoped to the report reference, with a 30-day expiry.
 *
 * Rules:
 *   - Visually quiet but obvious.
 *   - Print-safe — renders as a static image.
 *   - No interactive UI.
 */

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { buildPortalUrl } from '../../lib/portal/portalUrl';
import { generatePortalToken } from '../../lib/portal/portalToken';
import './ReportQrFooter.css';

interface Props {
  /** Report reference (ID) used to build the signed portal URL. */
  reportReference: string;
}

export default function ReportQrFooter({ reportReference }: Props) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [portalUrl, setPortalUrl] = useState<string | null>(null);

  // Build a fallback portal URL immediately (unsigned) so the handover block
  // renders as soon as the component mounts rather than waiting for async token
  // generation.  The signed URL replaces it once the token is ready.
  // buildPortalUrl defaults to window.location.origin, which is safe in a
  // browser-only component.
  const fallbackPortalUrl = buildPortalUrl(reportReference);

  useEffect(() => {
    let cancelled = false;

    generatePortalToken(reportReference)
      .then((token) => {
        const url = buildPortalUrl(reportReference, window.location.origin, token);
        if (!cancelled) setPortalUrl(url);
        return url;
      })
      .then((url) =>
        QRCode.toDataURL(url, {
          width: 120,
          margin: 1,
          color: { dark: '#1a202c', light: '#ffffff' },
          errorCorrectionLevel: 'M',
        }),
      )
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        // Token or QR generation failure is non-critical — the fallback portal URL
        // is shown instead and the section remains visible.
      });

    return () => {
      cancelled = true;
    };
  }, [reportReference]);

  // Always render the handover block when a report reference is present.
  // The signed portalUrl replaces the fallback once the async token is ready.
  const displayUrl = portalUrl ?? fallbackPortalUrl;

  return (
    <div
      className="rv-qr-footer"
      data-testid="report-qr-footer"
      aria-label="QR code — open your interactive home heating plan"
    >
      <div className="rv-qr-footer__content">
        {qrDataUrl && (
          <img
            className="rv-qr-footer__img"
            src={qrDataUrl}
            alt="QR code linking to your interactive recommendation portal"
            width={120}
            height={120}
          />
        )}
        <div className="rv-qr-footer__text">
          <p className="rv-qr-footer__caption">
            Scan to open your interactive home heating plan
          </p>
          <p className="rv-qr-footer__sub">
            Explore your options and see why this system was recommended
          </p>
          <p className="rv-qr-footer__fallback">
            <a href={displayUrl} target="_blank" rel="noopener noreferrer">
              {displayUrl}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
