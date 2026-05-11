export interface CustomerConcernPanelProps {
  concern: string;
  atlasResponse: string;
  shownFirst: string;
  deferred: string;
}

export function CustomerConcernPanel({
  concern,
  atlasResponse,
  shownFirst,
  deferred,
}: CustomerConcernPanelProps) {
  return (
    <section className="atlas-concern-panel" data-testid="storyboard-customer-concern-panel" aria-label="Customer concern panel">
      <h2 className="atlas-concern-panel__title">Customer concern</h2>
      <dl className="atlas-concern-panel__list">
        <div>
          <dt>Likely concern</dt>
          <dd>{concern}</dd>
        </div>
        <div>
          <dt>How Atlas responds</dt>
          <dd>{atlasResponse}</dd>
        </div>
        <div>
          <dt>What is shown first</dt>
          <dd>{shownFirst}</dd>
        </div>
        <div>
          <dt>What is deferred</dt>
          <dd>{deferred}</dd>
        </div>
      </dl>
    </section>
  );
}
