import { useState } from 'react';

type ReviewAnswer = 'yes' | 'no' | 'needs_work' | 'not_applicable';
type ReviewQuestionId =
  | 'name_without_labels'
  | 'follow_flow_and_return'
  | 'print_safe_keeps_meaning'
  | 'reduced_motion_keeps_meaning'
  | 'overlay_stays_clear'
  | 'installer_plausibility'
  | 'homeowner_clarity';

interface ReviewQuestion {
  id: ReviewQuestionId;
  prompt: string;
}

const REVIEW_QUESTIONS: ReviewQuestion[] = [
  { id: 'name_without_labels', prompt: 'Can I name the object with labels hidden?' },
  { id: 'follow_flow_and_return', prompt: 'Can I follow flow and return without reading text?' },
  { id: 'print_safe_keeps_meaning', prompt: 'Does print-safe mode still explain the same thing?' },
  { id: 'reduced_motion_keeps_meaning', prompt: 'Does reduced-motion mode lose any meaning?' },
  { id: 'overlay_stays_clear', prompt: 'Does the overlay explain behaviour without covering equipment?' },
  { id: 'installer_plausibility', prompt: 'Would a UK installer say “that looks plausible enough”?' },
  { id: 'homeowner_clarity', prompt: 'Would a homeowner say “I get what that part does”?' },
];

const ANSWER_OPTIONS: Array<{ id: ReviewAnswer; label: string }> = [
  { id: 'yes', label: 'Yes' },
  { id: 'no', label: 'No' },
  { id: 'needs_work', label: 'Needs work' },
  { id: 'not_applicable', label: 'N/A' },
];

const ANSWER_STYLES: Record<ReviewAnswer, { background: string; border: string; color: string }> = {
  yes: { background: '#dcfce7', border: '#86efac', color: '#166534' },
  no: { background: '#fee2e2', border: '#fca5a5', color: '#7f1d1d' },
  needs_work: { background: '#fef3c7', border: '#fcd34d', color: '#92400e' },
  not_applicable: { background: '#e2e8f0', border: '#cbd5e1', color: '#334155' },
};

export interface HumanVisualReviewChecklistProps {
  checklistId: string;
  title: string;
  intro: string;
  reviewerPrompts: string[];
  questionNotes?: Partial<Record<ReviewQuestionId, string>>;
}

export function HumanVisualReviewChecklist({
  checklistId,
  title,
  intro,
  reviewerPrompts,
  questionNotes,
}: HumanVisualReviewChecklistProps) {
  const [answers, setAnswers] = useState<Partial<Record<ReviewQuestionId, ReviewAnswer>>>({});
  const answeredCount = REVIEW_QUESTIONS.filter((question) => answers[question.id] != null).length;

  return (
    <section
      data-testid={checklistId}
      style={{
        background: '#f8fafc',
        border: '1px solid #cbd5e1',
        borderRadius: 12,
        padding: '0.85rem',
        display: 'grid',
        gap: '0.75rem',
        marginBottom: '1rem',
      }}
    >
      <div style={{ display: 'grid', gap: 6 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>{title}</h2>
          <span
            data-testid={`${checklistId}-status`}
            style={{
              fontSize: 11,
              color: '#0f766e',
              background: '#ccfbf1',
              border: '1px solid #5eead4',
              borderRadius: 999,
              padding: '2px 8px',
              fontWeight: 600,
            }}
          >
            {answeredCount} of {REVIEW_QUESTIONS.length} answered
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: '#475569' }}>{intro}</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {reviewerPrompts.map((prompt) => (
            <span
              key={prompt}
              style={{
                fontSize: 11,
                color: '#1d4ed8',
                background: '#dbeafe',
                border: '1px solid #93c5fd',
                borderRadius: 999,
                padding: '2px 8px',
              }}
            >
              {prompt}
            </span>
          ))}
        </div>
      </div>

      <ol style={{ margin: 0, paddingLeft: '1.15rem', display: 'grid', gap: '0.9rem' }}>
        {REVIEW_QUESTIONS.map((question, index) => {
          const selectedAnswer = answers[question.id];
          const helperText = questionNotes?.[question.id];

          return (
            <li key={question.id} style={{ display: 'grid', gap: 8 }}>
              <div style={{ display: 'grid', gap: 4 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
                  {index + 1}. {question.prompt}
                </p>
                {helperText && (
                  <p style={{ margin: 0, fontSize: 12, color: '#475569' }}>{helperText}</p>
                )}
              </div>
              <div
                role="group"
                aria-label={`Review answer for ${question.prompt}`}
                style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}
              >
                {ANSWER_OPTIONS.map((option) => {
                  const isSelected = selectedAnswer === option.id;
                  const style = ANSWER_STYLES[option.id];
                  return (
                    <button
                      key={option.id}
                      type="button"
                      data-testid={`${checklistId}-${question.id}-${option.id}`}
                      aria-pressed={isSelected}
                      onClick={() => setAnswers((current) => ({ ...current, [question.id]: option.id }))}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 999,
                        border: `1px solid ${isSelected ? style.border : '#cbd5e1'}`,
                        background: isSelected ? style.background : '#fff',
                        color: isSelected ? style.color : '#334155',
                        fontSize: 11,
                        fontWeight: isSelected ? 600 : 500,
                        cursor: 'pointer',
                      }}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default HumanVisualReviewChecklist;
