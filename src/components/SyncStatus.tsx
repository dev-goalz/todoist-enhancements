import { useT } from '@/hooks/useT';
import { useStore } from '@/store/store';
import { formatTime } from '@/domain/dates';

/** A quiet line telling the user whether what they see matches Todoist. */
export function SyncStatus() {
  const { t, locale } = useT();
  const syncState = useStore((s) => s.syncState);
  const syncedAt = useStore((s) => s.snapshot.syncedAt);
  const pending = useStore((s) => s.pendingCount);
  const hour12 = useStore((s) => s.prefs.hour12);
  const refresh = useStore((s) => s.refresh);

  let className = 'syncstatus';
  let message: string;

  if (syncState === 'syncing' || syncState === 'loading') {
    className += ' busy';
    message = t('sync.syncing');
  } else if (syncState === 'offline') {
    className += ' warn';
    message = t('sync.offline');
  } else if (syncState === 'error') {
    className += ' err';
    message = t('sync.error');
  } else if (pending > 0) {
    className += ' warn';
    message = t('sync.pending', { count: pending });
  } else if (syncedAt && Date.now() - syncedAt < 60_000) {
    message = t('sync.syncedJustNow');
  } else if (syncedAt) {
    message = t('sync.syncedAt', { time: formatTime(new Date(syncedAt), locale, hour12) });
  } else {
    message = t('common.loading');
  }

  return (
    <button
      className={className}
      onClick={() => void refresh()}
      title={t('sync.now')}
    >
      <span className="syncdot" />
      {message}
    </button>
  );
}
