interface ScenarioChipProps {
  label: string;
  onRemove: () => void;
}

export default function ScenarioChip({ label, onRemove }: ScenarioChipProps) {
  return (
    <button type="button" className="scenario-chip" onClick={onRemove}>
      <span>{label}</span>
      <span aria-hidden="true" className="scenario-chip__close">×</span>
    </button>
  );
}
