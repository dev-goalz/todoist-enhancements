import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Overlay } from './Overlay';
import { useT } from '@/hooks/useT';

/**
 * Confirmation, asked inside the app.
 *
 * The browser's own dialog cannot be styled, steals the window, and reads as
 * something the page did to you rather than something the page is asking. This
 * puts the same question in the product's own language and layout.
 */

export interface ConfirmRequest {
  title: string;
  /** The consequence, spelled out. */
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Paints the confirming button as destructive. */
  destructive?: boolean;
}

type Ask = (request: ConfirmRequest) => Promise<boolean>;

const ConfirmContext = createContext<Ask | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useT();
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const ask = useCallback<Ask>((next) => {
    setRequest(next);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback((value: boolean) => {
    setRequest(null);
    resolver.current?.(value);
    resolver.current = null;
  }, []);

  const value = useMemo(() => ask, [ask]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}

      {request && (
        <Overlay open onClose={() => settle(false)} label={request.title} size="sm">
          <div className="confirmbox">
            <h2>{request.title}</h2>
            {request.body && <p className="confirmbody">{request.body}</p>}
            <div className="confirmactions">
              <button className="btn quiet" onClick={() => settle(false)}>
                {request.cancelLabel ?? t('common.cancel')}
              </button>
              <button
                className={`btn ${request.destructive ? 'danger' : 'primary'}`}
                autoFocus
                onClick={() => settle(true)}
              >
                {request.confirmLabel ?? t('common.confirm')}
              </button>
            </div>
          </div>
        </Overlay>
      )}
    </ConfirmContext.Provider>
  );
}

/** Asks the question and resolves to what the user chose. */
export function useConfirm(): Ask {
  const ask = useContext(ConfirmContext);
  if (!ask) throw new Error('useConfirm used outside ConfirmProvider');
  return ask;
}
