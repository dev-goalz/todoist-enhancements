import { useEffect, useRef, type ReactNode } from 'react';

interface OverlayProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  label: string;
  /** A side sheet slides in from the right; a sheet sits in the middle. */
  variant?: 'sheet' | 'side';
  /** 'full' fills the window, for a sheet that stands in for a whole page. */
  size?: 'sm' | 'md' | 'search' | 'full';
}

/**
 * The shell every dialog shares: a scrim that closes on click, Escape to
 * dismiss, focus moved inside on open and returned to where it came from on
 * close, and the page behind held still while it is up.
 */
export function Overlay({
  open, onClose, children, label, variant = 'sheet', size = 'md',
}: OverlayProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  /* Escape has to reach whichever `onClose` is current, but the effect below
     must not be torn down and set up again merely because the caller passed a
     fresh arrow — and every caller passes a fresh arrow, on every render of
     the page behind the dialog. Setting it up again moved the focus back to
     the top of the sheet, which for someone typing a description or filling a
     column of estimates meant the caret left mid-word and the rest of the
     sentence landed in the first field. Hence the ref: the handler stays put,
     the callback it reads does not. */
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    restoreTo.current = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
      }
    };
    document.addEventListener('keydown', onKey);

    /* Move focus into the dialog so the keyboard follows the eye. A dialog
       that names its own starting point gets it: otherwise the first focusable
       thing wins, which in a sheet is the close button in its header. */
    const target =
      sheetRef.current?.querySelector<HTMLElement>('[data-autofocus]') ??
      sheetRef.current?.querySelector<HTMLElement>(
        'input, textarea, button, [tabindex]:not([tabindex="-1"])',
      );
    target?.focus();

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      restoreTo.current?.focus?.();
    };
    /* `open` and nothing else. See closeRef above. */
  }, [open]);

  if (!open) return null;

  const sheetClass =
    variant === 'side'
      ? 'side-sheet'
      : `sheet${
          size === 'sm' ? ' sheet-sm'
            : size === 'search' ? ' sheet-search'
              : size === 'full' ? ' sheet-full'
                : ''
        }`;

  return (
    <div className="overlay open" role="dialog" aria-modal="true" aria-label={label}>
      <div className="scrim" onClick={onClose} />
      <div className={sheetClass} ref={sheetRef}>
        {children}
      </div>
    </div>
  );
}
