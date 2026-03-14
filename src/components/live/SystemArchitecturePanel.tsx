/**
 * SystemArchitecturePanel
 *
 * Hub Section 3 — System Architecture Diagram.
 *
 * Shows how the recommended system connects as a vertical flow diagram:
 * heat source → distribution → terminal units.
 *
 * Customers immediately understand the scope and scale of the installation.
 * Engineers can confirm the topology before surveying further.
 */

import type { OutputHubSection } from '../../live/printSections.model';

interface Props {
  section: OutputHubSection;
}

export default function SystemArchitecturePanel({ section }: Props) {
  const c = section.content as {
    optionId:        string;
    optionLabel:     string;
    connectionChain: string[];
    mustHave:        string[];
  };

  return (
    <div className="hub-graphic hub-graphic--architecture" aria-label="System architecture diagram">
      <h3 className="hub-graphic__title">🔧 System Architecture</h3>

      <div className="hub-arch__option-label" aria-label={`Recommended: ${c.optionLabel}`}>
        {c.optionLabel}
      </div>

      {/* Vertical connection chain */}
      <div className="hub-arch__chain" role="list" aria-label="System connection diagram">
        {c.connectionChain.map((node, i) => (
          <div key={i} className="hub-arch__chain-item" role="listitem">
            <div className="hub-arch__node">{node}</div>
            {i < c.connectionChain.length - 1 && (
              <div className="hub-arch__connector" aria-hidden="true">↓</div>
            )}
          </div>
        ))}
      </div>

      {/* Installation requirements */}
      {c.mustHave.length > 0 && (
        <div className="hub-arch__requirements">
          <div className="hub-arch__req-label">Installation requirements</div>
          <ul className="hub-graphic__notes" aria-label="Installation requirements">
            {c.mustHave.map((req, i) => <li key={i}>{req}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
