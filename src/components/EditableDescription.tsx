import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useT } from '@/hooks/useT';
import { renderMarkdown } from '@/domain/markdown';

interface EditableDescriptionProps {
  value: string;
  onCommit: (next: string) => void;
  placeholder?: string;
  /** How many lines are shown before the text is folded away. */
  clampLines?: number;
  className?: string;
}

/**
 * A description that reads as finished text and edits in place.
 *
 * The stored value is Markdown; what is shown is the rendered result, never
 * the syntax. Long text folds to a couple of lines with a way to open it, so
 * a description can be as long as it needs without pushing the page down.
 */
export function EditableDescription({
  value, onCommit, placeholder, clampLines = 2, className,
}: EditableDescriptionProps) {
  const { t } = useT();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const viewRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setDraft(value), [value]);
  useEffect(() => { if (editing) editorRef.current?.focus(); }, [editing]);

  const html = useMemo(() => renderMarkdown(value), [value]);

  // Whether the folded box actually hides anything decides if the control shows.
  useLayoutEffect(() => {
    const el = viewRef.current;
    if (!el || editing) return;
    setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [html, editing, expanded, clampLines]);

  function commit() {
    setEditing(false);
    if (draft !== value) onCommit(draft);
  }

  if (editing) {
    return (
      <textarea
        ref={editorRef}
        className={`descfield${className ? ` ${className}` : ''}`}
        value={draft}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            setDraft(value);
            setEditing(false);
          }
          // Enter saves. Shift+Enter is how you get a second line, which is
          // the convention every comment box in the product already uses.
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            commit();
          }
        }}
      />
    );
  }

  return (
    <div className={`descwrap${className ? ` ${className}` : ''}`}>
      <button
        className={`descview${value ? '' : ' placeholder'}`}
        onClick={() => setEditing(true)}
        aria-label={placeholder}
      >
        {value ? (
          <div
            ref={viewRef}
            className={`md${expanded ? '' : ' clamped'}`}
            style={expanded ? undefined : ({ '--clamp': clampLines } as React.CSSProperties)}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          placeholder
        )}

        {value && (overflows || expanded) && (
          <span
            className="seemore"
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              e.preventDefault();
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
          >
            {expanded ? t('project.seeLess') : t('project.seeMore')}
          </span>
        )}
      </button>
    </div>
  );
}
