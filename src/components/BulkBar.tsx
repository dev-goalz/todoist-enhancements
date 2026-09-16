import { useState } from 'react';
import { Icon } from './Icon';
import { DateField } from './DateField';
import { useT } from '@/hooks/useT';
import { useStore } from '@/store/store';
import { useConfirm } from './overlays/Confirm';
import type { DropTarget } from '@/domain/dnd';

/**
 * What to do with the tasks you picked out.
 *
 * It exists only while something is selected, and it stays in one place at the
 * foot of the window rather than following the rows around: a bar that moves
 * is a bar you have to find again after every change. Each button is the same
 * change the drop table already defines, applied to the whole set as one
 * request with one undo — the selection was one decision, so taking it back
 * should be one too.
 */
export function BulkBar() {
  const { t } = useT();
  const confirm = useConfirm();
  const selection = useStore((s) => s.selection);
  const clearSelection = useStore((s) => s.clearSelection);
  const sendManyTo = useStore((s) => s.sendManyTo);
  const removeTasks = useStore((s) => s.removeTasks);
  const [date, setDate] = useState('');

  if (selection.length === 0) return null;

  const send = async (target: DropTarget, destination: string) => {
    const ids = selection;
    clearSelection();
    await sendManyTo(ids, target, destination);
  };

  const remove = async () => {
    const ids = selection;
    const ok = await confirm({
      title: t('task.deleteTitle'),
      body: t('bulk.deleteConfirm', { count: ids.length }),
      confirmLabel: t('task.delete'),
      destructive: true,
    });
    if (!ok) return;
    clearSelection();
    await removeTasks(ids);
  };

  return (
    <div className="bulkbar" role="toolbar" aria-label={t('bulk.title')}>
      <strong>{t('bulk.count', { count: selection.length })}</strong>
      <span className="sep" aria-hidden="true" />

      <button className="btn sm" onClick={() => void send({ kind: 'today' }, t('common.today'))}>
        {t('review.to.today')}
      </button>
      <button className="btn sm" onClick={() => void send({ kind: 'anytime' }, t('nav.week'))}>
        {t('review.to.anytime')}
      </button>
      <button className="btn sm" onClick={() => void send({ kind: 'someday' }, t('nav.someday'))}>
        {t('review.to.someday')}
      </button>

      {/* A date, rather than the three shortcuts, for the times the answer is
          neither today nor this week. */}
      <DateField
        value={date}
        label={t('task.schedule')}
        placeholder={t('bulk.pickDate')}
        onChange={(next) => {
          setDate('');
          if (!next) return;
          void send({ kind: 'day', date: new Date(`${next}T00:00:00`) }, next);
        }}
      />

      <span className="sep" aria-hidden="true" />
      <button className="btn sm danger" onClick={() => void remove()}>
        <Icon name="close" size="sm" />
        {t('task.delete')}
      </button>
      <button className="btn sm quiet" onClick={clearSelection}>
        {t('bulk.clear')}
      </button>
    </div>
  );
}
