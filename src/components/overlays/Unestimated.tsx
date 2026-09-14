import { Overlay } from './Overlay';
import { Icon } from '../Icon';
import { useT } from '@/hooks/useT';
import { useStore } from '@/store/store';
import { withEstimate } from '@/domain/estimates';
import { EstimateField } from '../EstimateField';
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

                  <EstimateField
                    minutes={null}
                    onCommit={(value) => {
                      if (value === null) return;
                      void updateTask(item.id, { labels: withEstimate(item.labels, value) });
                    }}
                    onAdvance={(field) => {
                      const fields = Array.from(
                        field.closest('.estlist')?.querySelectorAll('input') ?? [],
                      );
                      fields[fields.indexOf(field) + 1]?.focus();
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Overlay>
  );
}
