/**
 * SurveyorContextPanel.tsx — Presentation Layer v1.
 *
 * Selectable context chips the surveyor can tap to flag key household priorities.
 * These flags do not feed back into the engine — they are display-only hints
 * that help steer the in-room conversation.
 *
 * Maximum 5 options, large tap targets, suitable for tablet use.
 */

import type { SurveyorContext } from './presentationTypes';
import './SurveyorContextPanel.css';

// ─── Chip definitions ─────────────────────────────────────────────────────────

interface ContextChip {
  key: keyof SurveyorContext;
  label: string;
  icon: string;
}

const CONTEXT_CHIPS: ContextChip[] = [
  { key: 'highHotWaterUse',         label: 'High hot water use',        icon: '🚿' },
  { key: 'futureProofingImportant', label: 'Future-proofing important',  icon: '🔮' },
  { key: 'spaceIsLimited',          label: 'Space is limited',           icon: '📦' },
  { key: 'wantsReliability',        label: 'Wants reliability',          icon: '🔒' },
  { key: 'costSensitive',           label: 'Cost-sensitive',             icon: '💷' },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  context: SurveyorContext;
  onChange: (context: SurveyorContext) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SurveyorContextPanel({ context, onChange }: Props) {
  function toggle(key: keyof SurveyorContext) {
    onChange({ ...context, [key]: !context[key] });
  }

  return (
    <section className="surveyor-context" aria-label="What matters in your home">
      <p className="surveyor-context__heading">What matters in your home</p>
      <div className="surveyor-context__chips" role="group" aria-label="Household priorities">
        {CONTEXT_CHIPS.map(({ key, label, icon }) => (
          <button
            key={key}
            className={`surveyor-context__chip ${context[key] ? 'surveyor-context__chip--active' : ''}`}
            onClick={() => toggle(key)}
            aria-pressed={context[key]}
          >
            <span className="surveyor-context__chip-icon" aria-hidden="true">{icon}</span>
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}
