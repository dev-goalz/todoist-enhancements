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

  /* The trigger shows one line of plain text: a button cannot legally contain
     the links the description may carry, and a header is not the place to read
     three paragraphs. The full text is in the panel below, on hover. */
  const oneLine = useMemo(
    () => renderInlineMarkdown(value).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(),
    [value],
  );

  return (
    <div className={`descwrap${value ? '' : ' unset'}${className ? ` ${className}` : ''}`}>
      <button
        className={`descview${value ? '' : ' placeholder'}`}
        onClick={() => setEditing(true)}
        aria-label={placeholder}
      >
        <span className="descline">{value ? oneLine : placeholder}</span>
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
