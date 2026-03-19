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

interface Props {
  /** Report reference (ID) used to build the signed portal URL. */
  reportReference: string;
}

export default function ReportQrFooter({ reportReference }: Props) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    generatePortalToken(reportReference)
      .then((token) => buildPortalUrl(reportReference, undefined, token))
      .then((portalUrl) =>
        QRCode.toDataURL(portalUrl, {
          width: 120,
          margin: 1,
          color: { dark: '#1a202c', light: '#ffffff' },
          errorCorrectionLevel: 'M',
        }),
      )
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        // QR generation failure is non-critical — silently omit.
      });

    return () => {
      cancelled = true;
    };
  }, [reportReference]);

  if (!qrDataUrl) return null;

  return (
    <div
      className="rv-qr-footer"
      data-testid="report-qr-footer"
      aria-label="QR code — open your interactive home heating plan"
    >
      <div className="rv-qr-footer__content">
        <img
          className="rv-qr-footer__img"
          src={qrDataUrl}
          alt="QR code linking to your interactive recommendation portal"
          width={120}
          height={120}
        />
        <div className="rv-qr-footer__text">
          <p className="rv-qr-footer__caption">
            Scan to open your interactive home heating plan
          </p>
          <p className="rv-qr-footer__sub">
            Explore your options and see why this system was recommended
          </p>
        </div>
      </div>
    </div>
  );
}
