import type { ReactNode } from 'react';
import '../diagrams.css';

export interface SystemTopologyPanelProps {
  label: string;
  children: ReactNode;
  screenReaderSummary: string;
}

export function SystemTopologyPanel({ label, children, screenReaderSummary }: SystemTopologyPanelProps) {
  return (
    <div
      className="atlas-edu-diagram__wrapper"
      aria-label={label}
    >
      <p className="atlas-edu-diagram__screen-reader-summary">
        {screenReaderSummary}
      </p>
      <p className="atlas-edu-diagram__label">{label}</p>
      {children}
    </div>
  );
}
