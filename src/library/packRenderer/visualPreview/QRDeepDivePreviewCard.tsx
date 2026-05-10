import { EducationalCard } from '../../ui';
import { PreviewIcon } from './PreviewIcon';

export interface QRDeepDivePreviewCardProps {
  assetId: string;
  title: string;
  reason: string;
  destination: string;
}

export function QRDeepDivePreviewCard({ assetId, title, reason, destination }: QRDeepDivePreviewCardProps) {
  return (
    <div data-testid={`storyboard-qr-card-${assetId}`}>
      <EducationalCard
        title={title}
        summary={reason}
        eyebrow="Go deeper"
        ariaLabel={`QR deep dive: ${title}`}
        diagram={(
          <div className="atlas-storyboard-qr__diagram">
            <PreviewIcon name="qr" className="atlas-storyboard-qr__icon" />
            <code className="atlas-storyboard-qr__code">{destination}</code>
          </div>
        )}
        diagramLabel="QR deep dive destination"
        footer={<p className="atlas-storyboard-qr__note">Use this card only when more depth is helpful.</p>}
      />
    </div>
  );
}
