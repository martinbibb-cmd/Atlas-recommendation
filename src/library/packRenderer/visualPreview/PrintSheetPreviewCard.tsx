import type { PrintEquivalentV1 } from '../../printEquivalents/PrintEquivalentV1';
import { PrintActionCard } from '../../ui';

export interface PrintSheetPreviewCardProps {
  printEquivalent: PrintEquivalentV1;
}

export function PrintSheetPreviewCard({ printEquivalent }: PrintSheetPreviewCardProps) {
  return (
    <div data-testid={`storyboard-print-card-${printEquivalent.assetId}`}>
      <PrintActionCard
        title={printEquivalent.printTitle}
        steps={printEquivalent.steps}
        note={printEquivalent.summary}
        ariaLabel={`Print preview: ${printEquivalent.printTitle}`}
      />
    </div>
  );
}
