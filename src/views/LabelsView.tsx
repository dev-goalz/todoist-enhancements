import { useMemo } from 'react';
import { Icon } from '@/components/Icon';
import { useT } from '@/hooks/useT';
import { useData } from '@/hooks/useData';
import { useStore } from '@/store/store';
import { navigate } from '@/hooks/useRoute';
import { rootItems } from '@/store/selectors';
import { hasLabel } from '@/domain/views';
import { markerStyle } from '@/domain/colors';

/**
 * Every tag on the account.
 *
 * Favourites are Todoist's own star, not a separate list this app keeps, so
 * starring here pins the tag in both products at once.
 */
export function LabelsView() {
  const { t } = useT();
  const { snapshot, items } = useData();
  const updateLabelFavourite = useStore((s) => s.setLabelFavourite);

  const roots = useMemo(() => rootItems(items), [items]);

  const labels = useMemo(
    () =>
      Object.values(snapshot.labels)
        .filter((l) => !l.is_deleted && !l.name.startsWith('est-'))
        .sort((a, b) => a.item_order - b.item_order),
    [snapshot.labels],
  );

  return (
    <div className="page">
      <div className="phead">
        <div>
          <h1 className="ptitle">{t('nav.labels')}</h1>
        </div>
      </div>

      {labels.length === 0 ? (
        <p className="empty">{t('labels.none')}</p>
      ) : (
        <div className="mode">
          <section className="group">
            {labels.map((label) => {
              const count = roots.filter((i) => hasLabel(i, label.name)).length;
              return (
                <div className="task" key={label.id}>
                  <span />
                  <button
                    className="tmain"
                    style={{ textAlign: 'left' }}
                    onClick={() => navigate('label', label.name)}
                  >
                    <span className="ttitle" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Icon name="tag" className="taglabel" />
                      <span style={markerStyle(label.color, false)}>{label.name}</span>
                    </span>
                    <span className="meta">
                      {t('metrics.tasks', { count })}
                    </span>
                  </button>
                  <span />
                  <span className="trow-actions" style={{ visibility: 'visible' }}>
                    <button
                      aria-label={label.is_favorite ? t('labels.unfavourite') : t('labels.favourite')}
                      title={label.is_favorite ? t('labels.unfavourite') : t('labels.favourite')}
                      onClick={() => void updateLabelFavourite(label.id, !label.is_favorite)}
                      style={label.is_favorite ? { color: 'var(--p2)' } : undefined}
                    >
                      <Icon name="tag" size="sm" />
                    </button>
                  </span>
                </div>
              );
            })}
          </section>
        </div>
      )}
    </div>
  );
}
