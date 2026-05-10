import type { ReactNode } from 'react';
import '../educationalUi.css';

export interface TwoColumnExplainLayoutProps {
  leading: ReactNode;
  trailing: ReactNode;
}

export function TwoColumnExplainLayout({
  leading,
  trailing,
}: TwoColumnExplainLayoutProps) {
  return (
    <div className="atlas-edu-two-column">
      <div className="atlas-edu-two-column__lead">{leading}</div>
      <div className="atlas-edu-two-column__side">{trailing}</div>
    </div>
  );
}
