import { useEffect, useRef, useState } from 'react';

interface EditableTitleProps {
  value: string;
  onCommit: (next: string) => void;
  /** The accessible name of the field, since the heading itself is the label. */
  label: string;
}

/**
 * A page title that renames in place.
 *
 * It reads as a heading until it is clicked, and then it is the field it
 * always was — one element, not a heading that swaps itself for an input, so
 * nothing shifts under the pointer at the moment you aim at it. Enter and
 * clicking away save; Escape puts back what was there.
 */
export function EditableTitle({ value, onCommit, label }: EditableTitleProps) {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(value); }, [value]);

  function commit() {
    const next = draft.trim();
    if (!next) {
      // A project with no name cannot be found again. Refuse, quietly.
      setDraft(value);
      return;
    }
    if (next !== value) onCommit(next);
  }

  return (
    <input
      ref={ref}
      className="titlefield"
      value={draft}
      aria-label={label}
      title={label}
      size={Math.max(1, draft.length)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        e.stopPropagation();
        /* Blur through the ref rather than the event's target: Enter arrives
           here from a composed keypress as well as a plain one, and the
           synthetic event's target is not reliable across both. */
        if (e.key === 'Enter') { e.preventDefault(); ref.current?.blur(); }
        if (e.key === 'Escape') { setDraft(value); queueMicrotask(() => ref.current?.blur()); }
      }}
    />
  );
}
