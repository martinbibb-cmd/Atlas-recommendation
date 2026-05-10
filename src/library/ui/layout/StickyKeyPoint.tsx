import '../educationalUi.css';

export interface StickyKeyPointProps {
  label?: string;
  text: string;
  ariaLabel?: string;
}

export function StickyKeyPoint({
  label = 'Key point',
  text,
  ariaLabel,
}: StickyKeyPointProps) {
  return (
    <aside className="atlas-edu-key-point" aria-label={ariaLabel ?? label}>
      <p className="atlas-edu-key-point__label">{label}</p>
      <p className="atlas-edu-key-point__text">{text}</p>
    </aside>
  );
}
