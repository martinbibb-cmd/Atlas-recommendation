import type { GraphWarning } from './graphValidate'
import './builder.css'

export default function WarningPanel({
  warnings,
  onSelectWarning,
  onClose,
}: {
  warnings: GraphWarning[]
  onSelectWarning: (warning: GraphWarning) => void
  onClose: () => void
}) {
  return (
    <div className="warnpanel">
      <div className="warnpanel-head">
        <div className="warnpanel-title">Warnings</div>
        <button className="builder-btn" onClick={onClose}>✕</button>
      </div>

      {warnings.length === 0 ? (
        <div className="warnpanel-empty">No warnings 🎉</div>
      ) : (
        <div className="warnpanel-list">
          {warnings.map(warning => (
            <button
              key={warning.id}
              className={`warnpanel-item ${warning.level}`}
              onClick={() => onSelectWarning(warning)}
            >
              <div className="warnpanel-item-title">
                {warning.level === 'error' ? '⛔' : '⚠️'} {warning.title}
              </div>
              <div className="warnpanel-item-message">{warning.message}</div>
              {warning.hint ? <div className="warnpanel-item-hint">💡 {warning.hint}</div> : null}
              {warning.nodeId ? <div className="warnpanel-item-meta">Node: {warning.nodeId}</div> : null}
              {warning.edgeId ? <div className="warnpanel-item-meta">Edge: {warning.edgeId}</div> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
