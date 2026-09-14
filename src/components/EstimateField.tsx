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
  /** Moves focus onward when the user presses Enter, for filling a list. */
  onAdvance?: (field: HTMLInputElement) => void;
}

/**
 * The one way an estimate is entered anywhere in the product.
 *
 * A number, then the unit spelled out beside it, so there is never a bare box
 * whose meaning has to be guessed. Anything a person would reasonably type is
 * accepted and normalised: 25, 1h15, 90 min.
 */
export function EstimateField({
  minutes, onCommit, onCancel, autoFocus, placeholder, onAdvance,
}: EstimateFieldProps) {
  const { t } = useT();
  const [draft, setDraft] = useState(minutes === null ? '' : String(minutes));
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
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
        value={draft}
        placeholder={placeholder ?? t('task.estimatePlaceholder')}
        aria-label={t('task.setEstimate')}
        aria-invalid={invalid || undefined}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
            if (onAdvance) onAdvance(e.currentTarget);
          }
          if (e.key === 'Escape') {
            setDraft(minutes === null ? '' : String(minutes));
            onCancel?.();
          }
        }}
      />
      <span className="estunit" aria-hidden="true">{t('common.minutes')}</span>
    </span>
  );
}
