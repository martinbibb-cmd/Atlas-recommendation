const CONFIDENCE_VARIANT_BY_WORDING: Readonly<Record<string, string>> = {
  'Measured during the visit': 'measured',
  'Based on manufacturer information': 'manufacturer',
  'Estimated from the visible system layout': 'estimated',
  'Pipe route not fully confirmed': 'assumed',
  'Requires installer confirmation': 'unknown',
  'Entered by your installer': 'installer',
};

function getConfidenceVariant(wording: string): string {
  return CONFIDENCE_VARIANT_BY_WORDING[wording] ?? 'generic';
}

export interface CustomerConfidenceBadgeV1Props {
  readonly wording: string;
}

export function CustomerConfidenceBadgeV1({ wording }: CustomerConfidenceBadgeV1Props) {
  const variant = getConfidenceVariant(wording);

  return (
    <span
      className={`cprv1-confidence-badge cprv1-confidence-badge--${variant}`}
      data-testid="cprv1-confidence-badge"
      data-variant={variant}
    >
      {wording}
    </span>
  );
}
