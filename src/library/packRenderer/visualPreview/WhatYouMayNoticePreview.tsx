import { WhatToExpectCard } from '../../ui';

export interface WhatYouMayNoticeItem {
  id: string;
  title: string;
  notice: string;
  normalBecause: string;
}

export interface WhatYouMayNoticePreviewProps {
  items: readonly WhatYouMayNoticeItem[];
}

export function WhatYouMayNoticePreview({ items }: WhatYouMayNoticePreviewProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="atlas-storyboard-panel" aria-labelledby="atlas-storyboard-notice-title">
      <div className="atlas-storyboard-panel__header">
        <p className="atlas-storyboard-panel__eyebrow">What you may notice</p>
        <h2 id="atlas-storyboard-notice-title" className="atlas-storyboard-panel__title">
          Expectation-setting cards for the first handover pass
        </h2>
      </div>
      <div className="atlas-storyboard-card-grid" data-testid="storyboard-what-you-may-notice">
        {items.map((item) => (
          <WhatToExpectCard
            key={item.id}
            title={item.title}
            notice={item.notice}
            normalBecause={item.normalBecause}
            ariaLabel={`What you may notice: ${item.title}`}
          />
        ))}
      </div>
    </section>
  );
}
