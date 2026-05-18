interface AtlasStoryPanelProps {
  label?: string;
  summary: string;
  bullets?: string[];
}

export function AtlasStoryPanel({
  label = 'What this feels like in your house',
  summary,
  bullets = [],
}: AtlasStoryPanelProps) {
  return (
    <section className="atlas-story-panel">
      <p className="atlas-story-panel__label">{label}</p>
      <p className="atlas-story-panel__summary">{summary}</p>
      {bullets.length > 0 ? (
        <ul className="atlas-story-panel__bullets">
          {bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
