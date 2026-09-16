import { useEffect, useRef, useState } from 'react';
import { useT } from '@/hooks/useT';
import { parseDurationInput } from '@/domain/estimates';

interface EstimateFieldProps {
  /** Current value in minutes, or null when the task has no estimate. */
  minutes: number | null;
  onCommit: (minutes: number | null) => void;
  onCancel?: () => void;
  autoFocus?: boolean;
  placeholder?: string;
  /**
   * Reports every keystroke, for a list that holds its answers and saves them
   * in one go rather than writing each field as it is left.
   */
  onChange?: (minutes: number | null) => void;
  /**
   * Moves focus along the list the field belongs to. Enter and Tab both ask
   * for the next one, Shift+Tab for the one before.
   */
  onAdvance?: (field: HTMLInputElement, direction: 1 | -1) => void;
}

/**
 * The one way an estimate is entered anywhere in the product.
 *
 * A number, then the unit spelled out beside it, so there is never a bare box
 * whose meaning has to be guessed. Anything a person would reasonably type is
 * accepted and normalised: 25, 1h15, 90 min.
 */
export function EstimateField({
  minutes, onCommit, onCancel, autoFocus, placeholder, onChange, onAdvance,
}: EstimateFieldProps) {
  const { t } = useT();
  const [draft, setDraft] = useState(minutes === null ? '' : String(minutes));
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Not while it is being filled in — see EditableTitle for the same guard.
    if (document.activeElement === ref.current) return;
    setDraft(minutes === null ? '' : String(minutes));
  }, [minutes]);

  const parsed = parseDurationInput(draft);
  const invalid = draft.trim() !== '' && parsed === null;

  function commit() {
    if (draft.trim() === '') {
      onCommit(null);
      return;
    }
    if (parsed === null) return;
    onCommit(parsed);
  }

  return (
    <span className={`estfield${invalid ? ' invalid' : ''}`}>
      <input
        ref={ref}
        className="estinput"
        inputMode="numeric"
        autoFocus={autoFocus}
        /* Also claims the focus a dialog hands out on opening, which lands on
           the close button otherwise. */
        data-autofocus={autoFocus || undefined}
        value={draft}
        placeholder={placeholder ?? t('task.estimatePlaceholder')}
        aria-label={t('task.setEstimate')}
        aria-invalid={invalid || undefined}
        onChange={(e) => {
          setDraft(e.target.value);
          if (onChange) {
            const next = e.target.value.trim();
            onChange(next === '' ? null : parseDurationInput(next));
          }
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            // Validate, and nothing else: no dialog closing behind it, no row
            // re-opening, no form submitting.
            e.preventDefault();
            e.stopPropagation();
            commit();
            if (onAdvance) onAdvance(e.currentTarget, 1);
          }
          /* Tab is what a hand filling a column reaches for, and left alone it
             lands on whatever sits between the rows. Keep it on the fields. */
          if (e.key === 'Tab' && onAdvance) {
            e.preventDefault();
            commit();
            onAdvance(e.currentTarget, e.shiftKey ? -1 : 1);
          }
          if (e.key === 'Escape') {
            e.stopPropagation();
            setDraft(minutes === null ? '' : String(minutes));
            onCancel?.();
          }
        }}
      />
      <span className="estunit" aria-hidden="true">{t('common.minutes')}</span>
    </span>
  );
}
