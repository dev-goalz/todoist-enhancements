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
        <div className="phead-text">
          <h1 className="ptitle">{t('nav.labels')}</h1>
        </div>
      </div>

      {labels.length === 0 ? (
        <p className="empty">{t('labels.none')}</p>
      ) : (
        <div className="mode taggrid">
          {labels.map((label) => {
            const count = roots.filter((i) => hasLabel(i, label.name)).length;
            return (
              <div className="tagcard" key={label.id}>
                <button
                  className="tagcard-open"
                  onClick={() => navigate('label', label.name)}
                >
                  <span className="tagcard-mark" style={markerStyle(label.color)}>
                    <Icon name="tag" />
                  </span>
                  <span className="tagcard-text">
                    <strong>{label.name}</strong>
                    <small>{t('metrics.tasks', { count })}</small>
                  </span>
                </button>

                <button
                  className={`tagcard-star${label.is_favorite ? ' on' : ''}`}
                  aria-pressed={label.is_favorite}
                  aria-label={label.is_favorite ? t('labels.unfavourite') : t('labels.favourite')}
                  title={label.is_favorite ? t('labels.unfavourite') : t('labels.favourite')}
                  onClick={() => void updateLabelFavourite(label.id, !label.is_favorite)}
                >
                  <Icon name="flag" size="sm" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
