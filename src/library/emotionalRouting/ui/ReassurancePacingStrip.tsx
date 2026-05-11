export interface ReassurancePacingStripProps {
  percent: number;
  summary: string;
}

export function ReassurancePacingStrip({ percent, summary }: ReassurancePacingStripProps) {
  return (
    <section className="atlas-anxiety-strip" aria-label="Reassurance pacing" data-testid="storyboard-reassurance-strip">
      <p className="atlas-anxiety-strip__summary">{summary}</p>
      <div className="atlas-anxiety-strip__track" aria-hidden="true">
        <div className="atlas-anxiety-strip__fill" style={{ width: `${percent}%` }} />
      </div>
    </section>
  );
}
