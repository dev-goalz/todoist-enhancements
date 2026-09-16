import { useMemo, useState } from 'react';
import { Overlay } from './Overlay';
import { Icon } from '../Icon';
import { EstimateBulk } from './Unestimated';
import { useT } from '@/hooks/useT';
import { useData } from '@/hooks/useData';
import { useStore } from '@/store/store';
import { detectConflicts, detectIncomplete, type Conflict } from '@/domain/conflicts';
import { rootItems } from '@/store/selectors';
import { toDisplayPriority, SYSTEM_LABELS, weekLabel } from '@/domain/types';
import { readEstimate, withEstimate } from '@/domain/estimates';
import type { TranslationKey } from '@/i18n';

interface IssuesProps {
  open: boolean;
  onClose: () => void;
  onOpen: (id: string) => void;
}

/**
 * The centre for things to settle.
 *
 * Conflicts are contradictions the app will not resolve on its own: each one
 * is shown with the choices that match the possible intents, and nothing
 * changes until the user picks one.
 */
export function Issues({ open, onClose, onOpen }: IssuesProps) {
  const { t } = useT();
  const { snapshot, items, childrenOf } = useData();
  const conflictSettings = useStore((s) => s.prefs.conflicts);
  const updateTask = useStore((s) => s.updateTask);
  const [tab, setTab] = useState<'conflicts' | 'complete'>('conflicts');
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const conflicts = useMemo(
    () => detectConflicts(items, childrenOf, conflictSettings).filter((c) => !dismissed.has(c.id)),
    [items, childrenOf, conflictSettings, dismissed],
  );

  const incomplete = useMemo(() => detectIncomplete(rootItems(items)), [items]);

  async function resolve(conflict: Conflict, optionId: string) {
    const item = snapshot.items[conflict.itemId];
    if (!item) return;

    if (optionId === 'dismiss') {
      // Keeping both is a deliberate choice, so the entry simply stops nagging.
      setDismissed((prev) => new Set(prev).add(conflict.id));
      return;
    }

    if (optionId.startsWith('keep:')) {
      const keep = optionId.slice(5);
      const others = item.labels.filter(
        (l) => !l.toLowerCase().startsWith('est-') || l === keep,
      );
      await updateTask(item.id, { labels: others });
      return;
    }

    switch (optionId) {
      case 'remove-estimate':
        await updateTask(item.id, { labels: withEstimate(item.labels, null) });
        break;
      case 'edit-estimate':
        onOpen(item.id);
        onClose();
        break;
      case 'remove-week-label':
        await updateTask(item.id, {
          labels: item.labels.filter((l) => l.toLowerCase() !== weekLabel().toLowerCase()),
        });
        break;
      case 'remove-date':
        await updateTask(item.id, { due: null });
        break;
      case 'remove-quick-label':
        await updateTask(item.id, {
          labels: item.labels.filter((l) => l.toLowerCase() !== SYSTEM_LABELS.quick),
        });
        break;
      case 'keep-parent':
        setDismissed((prev) => new Set(prev).add(conflict.id));
        break;
      case 'clear-parent':
        await updateTask(item.id, { labels: withEstimate(item.labels, null) });
        break;
      default:
        break;
    }
  }

  return (
    <Overlay open={open} onClose={onClose} label={t('issues.title')} size="sm">
      <div className="sheet-head">
        <div>
          <h2>{t('issues.title')}</h2>
          <p className="psub">
            {tab === 'conflicts' ? t('issues.conflictsIntro') : t('issues.toCompleteIntro')}
          </p>
        </div>
        <button className="iconbtn" aria-label={t('common.close')} onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>

      <div className="tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'conflicts'}
          onClick={() => setTab('conflicts')}
        >
          {t('issues.tabConflicts')} {conflicts.length > 0 && `(${conflicts.length})`}
        </button>
        <button
          role="tab"
          aria-selected={tab === 'complete'}
          onClick={() => setTab('complete')}
        >
          {t('issues.tabToComplete')} {incomplete.length > 0 && `(${incomplete.length})`}
        </button>
      </div>

      {/* The estimates tab brings its own body and its own foot: it is the
          same batch editor the page header opens, not a second, weaker copy of
          it that could only be read. */}
      {tab === 'complete' ? (
        <EstimateBulk
          items={incomplete.slice(0, 100)}
          resetKey={open}
          onOpen={(id) => { onOpen(id); onClose(); }}
          onDone={onClose}
        />
      ) : (
      <div className="sheet-body">
        {conflicts.length === 0 ? (
            <p className="empty">{t('issues.none')}</p>
          ) : (
            <div className="conflicts">
              {conflicts.map((conflict) => {
                const item = snapshot.items[conflict.itemId];
                if (!item) return null;
                const reading = readEstimate(item.labels);
                return (
                  <div className="conflict" key={conflict.id}>
                    <span
                      className={`check p${toDisplayPriority(item.priority)}`}
                      role="checkbox"
                      aria-checked="false"
                      aria-label={t('task.complete')}
                    >
                      <Icon name="check" />
                    </span>
                    <div>
                      <strong>{item.content}</strong>
                      <p>{t(conflict.messageKey as TranslationKey, conflict.messageValues)}</p>
                      <div className="opts">
                        {conflict.options.map((option) => (
                          <button
                            key={option.id}
                            className={`btn${option.recommended ? ' primary' : ''}`}
                            onClick={() => void resolve(conflict, option.id)}
                          >
                            {t(option.labelKey as TranslationKey, {
                              value: String(option.payload?.label ?? reading.raw[0] ?? ''),
                            })}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
        )}
      </div>
      )}
    </Overlay>
  );
}
