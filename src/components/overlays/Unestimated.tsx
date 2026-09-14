import { useEffect, useState } from 'react';
import { Overlay } from './Overlay';
import { Icon } from '../Icon';
import { useT } from '@/hooks/useT';
import { useStore } from '@/store/store';
import { parseDurationInput, withEstimate } from '@/domain/estimates';
import { toDisplayPriority, type Item } from '@/domain/types';
import { markerStyle } from '@/domain/colors';

interface UnestimatedProps {
  open: boolean;
  onClose: () => void;
  /** The tasks on the current page that carry no estimate. */
  items: Item[];
  onOpen: (id: string) => void;
}

/**
 * Filling in the estimates a page is missing.
 *
 * Opened from the count in the page header, it lists exactly those tasks with
 * one minute field each, so a page can be completed in a single pass without
 * opening every task.
 */
export function Unestimated({ open, onClose, items, onOpen }: UnestimatedProps) {
  const { t } = useT();
  const snapshot = useStore((s) => s.snapshot);
  const updateTask = useStore((s) => s.updateTask);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) setDrafts({});
  }, [open]);

  function commit(item: Item) {
    const raw = drafts[item.id] ?? '';
    if (!raw.trim()) return;
    const minutes = parseDurationInput(raw);
    if (minutes === null) return;
    void updateTask(item.id, { labels: withEstimate(item.labels, minutes) });
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });
  }

  const invalid = (id: string) => {
    const raw = drafts[id];
    return !!raw && raw.trim() !== '' && parseDurationInput(raw) === null;
  };

  return (
    <Overlay open={open} onClose={onClose} label={t('issues.toComplete')} size="sm">
      <div className="sheet-head">
        <div>
          <h2>{t('issues.toComplete')}</h2>
          <p className="psub">{t('issues.toCompleteIntro')}</p>
        </div>
        <button className="iconbtn" aria-label={t('common.close')} onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>

      <div className="sheet-body">
        {items.length === 0 ? (
          <p className="empty">{t('issues.none')}</p>
        ) : (
          <div className="estlist">
            {items.map((item) => {
              const project = snapshot.projects[item.project_id];
              return (
                <div className="estrow" key={item.id}>
                  <span className={`check p${toDisplayPriority(item.priority)}`} aria-hidden="true">
                    <Icon name="check" />
                  </span>

                  <button className="estname" onClick={() => { onOpen(item.id); onClose(); }}>
                    <span className="ttitle">{item.content}</span>
                    {project && !project.inbox_project && (
                      <span className="meta">
                        <span className="hash" style={markerStyle(project.color)}>#</span>
                        {project.name}
                      </span>
                    )}
                  </button>

                  <span className="estfield">
                    <input
                      className={`estinput${invalid(item.id) ? ' invalid' : ''}`}
                      inputMode="numeric"
                      placeholder={t('task.estimatePlaceholder')}
                      aria-label={t('task.setEstimate')}
                      value={drafts[item.id] ?? ''}
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                      }
                      onBlur={() => commit(item)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          commit(item);
                          // Move to the next field so the list can be filled in one pass.
                          const fields = Array.from(
                            e.currentTarget.closest('.estlist')?.querySelectorAll('input') ?? [],
                          );
                          const next = fields[fields.indexOf(e.currentTarget) + 1];
                          next?.focus();
                        }
                      }}
                    />
                    <span className="estunit">{t('common.minutes')}</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Overlay>
  );
}
