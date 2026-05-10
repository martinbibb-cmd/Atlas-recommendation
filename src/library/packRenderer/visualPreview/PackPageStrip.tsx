import { PreviewIcon, type PreviewIconName } from './PreviewIcon';

export interface PackPageStripItem {
  id: string;
  label: string;
  meta: string;
  icon: PreviewIconName;
}

export interface PackPageStripProps {
  items: readonly PackPageStripItem[];
}

export function PackPageStrip({ items }: PackPageStripProps) {
  return (
    <section className="atlas-storyboard-panel" aria-labelledby="atlas-storyboard-pages-title">
      <div className="atlas-storyboard-panel__header">
        <p className="atlas-storyboard-panel__eyebrow">Pack rhythm</p>
        <h2 id="atlas-storyboard-pages-title" className="atlas-storyboard-panel__title">
          Page strip preview
        </h2>
      </div>
      <div className="atlas-storyboard-page-strip" data-testid="storyboard-page-strip">
        {items.map((item) => (
          <article key={item.id} className="atlas-storyboard-page-strip__item">
            <PreviewIcon name={item.icon} className="atlas-storyboard-page-strip__icon" />
            <div>
              <p className="atlas-storyboard-page-strip__label">{item.label}</p>
              <p className="atlas-storyboard-page-strip__meta">{item.meta}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
