import '../diagrams.css';

export interface OutletNodeProps {
  label: string;
  active?: boolean;
  activeLabel?: string;
}

export function OutletNode({ label, active = false, activeLabel = 'In use' }: OutletNodeProps) {
  const ariaLabel = active ? `${label}: ${activeLabel}` : label;

  return (
    <div className="atlas-edu-diagram__wrapper" aria-label={ariaLabel}>
      <svg
        width={40}
        height={40}
        viewBox="0 0 40 40"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx={20} cy={20} r={16} fill={active ? '#234a7d' : '#eaf2fb'} stroke="#234a7d" strokeWidth={2} />
        <circle cx={20} cy={20} r={6} fill={active ? '#ffffff' : '#234a7d'} />
      </svg>
      <p className="atlas-edu-diagram__label">{label}</p>
      {active ? <p className="atlas-edu-diagram__label">{activeLabel}</p> : null}
    </div>
  );
}
