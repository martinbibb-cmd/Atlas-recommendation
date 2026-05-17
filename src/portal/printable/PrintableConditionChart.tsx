import './printable.css';
import { PrintablePhysicsSignal } from './PrintablePhysicsSignal';

export interface PrintableConditionChartProps {
  title: string;
  rows: Array<{ label: string; value: string }>;
}

export function PrintableConditionChart({ title, rows }: PrintableConditionChartProps) {
  return (
    <section className="printable-card" data-testid="printable-condition-chart" data-reading-region="true">
      <h3 className="printable-card__heading">{title}</h3>
      <div className="printable-card__grid">
        {rows.map((row) => (
          <PrintablePhysicsSignal key={`${row.label}-${row.value}`} label={row.label} value={row.value} />
        ))}
      </div>
    </section>
  );
}
