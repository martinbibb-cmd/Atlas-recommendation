import type { ReactNode } from 'react';
import '../diagrams.css';

export interface BeforeAfterSplitProps {
  beforeLabel: string;
  afterLabel: string;
  before: ReactNode;
  after: ReactNode;
  screenReaderSummary: string;
}

export function BeforeAfterSplit({ beforeLabel, afterLabel, before, after, screenReaderSummary }: BeforeAfterSplitProps) {
  return (
    <div className="atlas-edu-diagram__wrapper">
      <p className="atlas-edu-diagram__screen-reader-summary">
        {screenReaderSummary}
      </p>
      <div className="atlas-edu-diagram__before-after">
        <div className="atlas-edu-diagram__before-after-panel">
          <p className="atlas-edu-diagram__before-after-panel-label">{beforeLabel}</p>
          {before}
        </div>
        <div className="atlas-edu-diagram__before-after-panel">
          <p className="atlas-edu-diagram__before-after-panel-label">{afterLabel}</p>
          {after}
        </div>
      </div>
    </div>
  );
}
