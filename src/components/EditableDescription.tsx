import { useEffect, useMemo, useRef, useState } from 'react';
import { renderInlineMarkdown, renderMarkdown } from '@/domain/markdown';

interface EditableDescriptionProps {
  value: string;
  onCommit: (next: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * A description that reads as finished text and edits in place.
 *
 * The stored value is Markdown; what is shown is the rendered result, never
 * the syntax. A header shows one line of it and reveals the rest on hover, so
 * a long description never pushes the page down but is still readable, with
 * its links intact.
 */
export function EditableDescription({
  value, onCommit, placeholder, className,
}: EditableDescriptionProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setDraft(value), [value]);
  useEffect(() => { if (editing) editorRef.current?.focus(); }, [editing]);

  const html = useMemo(() => renderMarkdown(value), [value]);

  /* The trigger shows one line, formatted rather than stripped: bold reads as
     bold and a link reads as a link, because what the header should never show
     is the Markdown someone typed. The links are spans, not anchors — a button
     cannot legally contain one — and the real, clickable text is in the panel
     below, on hover, which is also where three paragraphs belong.
     Declared before the editor's early return: a hook after it runs on one
     render and not the next, which React answers by unmounting the page. */
  const oneLine = useMemo(() => renderInlineMarkdown(value, { anchors: false }), [value]);

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
    <div className={`descwrap${value ? '' : ' unset'}${className ? ` ${className}` : ''}`}>
      <button
        className={`descview${value ? '' : ' placeholder'}`}
        onClick={() => setEditing(true)}
        aria-label={placeholder}
      >
        {value
          ? <span className="descline" dangerouslySetInnerHTML={{ __html: oneLine }} />
          : <span className="descline">{placeholder}</span>}
      </button>

      {value && (
        /* Stays open while the pointer travels into it, so the links inside
           can actually be clicked. */
        <div className="deschint" role="note">
          <div className="md" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      )}
    </div>
  );
}
