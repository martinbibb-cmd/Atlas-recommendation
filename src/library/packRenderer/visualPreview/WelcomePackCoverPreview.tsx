import { EducationalCard } from '../../ui';
import { PreviewIcon, type PreviewIconName } from './PreviewIcon';

export interface WelcomePackCoverPreviewProps {
  title: string;
  summary: string;
  systemLabel: string;
  pageCountLabel: string;
  iconName: PreviewIconName;
}

export function WelcomePackCoverPreview({
  title,
  summary,
  systemLabel,
  pageCountLabel,
  iconName,
}: WelcomePackCoverPreviewProps) {
  return (
    <EducationalCard
      title={title}
      summary={summary}
      eyebrow="Pack cover"
      headingLevel={2}
      tone="fact"
      ariaLabel="Welcome pack cover preview"
      diagram={(
        <div className="atlas-storyboard-cover__diagram">
          <PreviewIcon name={iconName} className="atlas-storyboard-cover__icon" />
          <div>
            <p className="atlas-storyboard-cover__label">Recommended system</p>
            <p className="atlas-storyboard-cover__value">{systemLabel}</p>
          </div>
        </div>
      )}
      diagramLabel="Recommended system icon"
      footer={(
        <div className="atlas-storyboard-cover__footer" aria-label="Pack cover details">
          <div className="atlas-storyboard-cover__pill">{pageCountLabel}</div>
          <div className="atlas-storyboard-cover__pill">Visual-first welcome pack</div>
        </div>
      )}
    />
  );
}
