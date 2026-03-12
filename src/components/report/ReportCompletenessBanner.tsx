/**
 * ReportCompletenessBanner.tsx
 *
 * Shown at the top of ReportView when non-critical data is missing.
 *
 * Rules:
 *   - Render only when isPartial is true
 *   - List the missing optional items
 *   - Never block print (that is handled by the ReportView caller)
 */

interface Props {
  missingOptional: string[];
}

export default function ReportCompletenessBanner({ missingOptional }: Props) {
  if (missingOptional.length === 0) return null;

  return (
    <div className="rcb-banner" role="status" aria-label="Partial report notice">
      <div className="rcb-banner__header">
        <span className="rcb-banner__icon" aria-hidden="true">⚠</span>
        <strong className="rcb-banner__title">Partial report</strong>
      </div>
      <p className="rcb-banner__body">
        Some inputs were not captured. Performance and recommendation sections
        may be less specific.
      </p>
      <ul className="rcb-banner__list" aria-label="Missing optional inputs">
        {missingOptional.map(item => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
