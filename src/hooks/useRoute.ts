import { useEffect, useState } from 'react';
import type { ViewId } from '@/domain/types';

export interface Route {
  view: ViewId;
  /** Project or label id, when the view needs one. */
  id?: string;
}

function parse(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '');
  if (!raw) return { view: 'week' };
  const [view, id] = raw.split('/');
  // The dashboard is a tab of the insights page; an old link still lands there.
  if (view === 'dashboard') return { view: 'insights' };
  const known: ViewId[] = [
    'inbox', 'week', 'upcoming', 'someday', 'review',
    'settings', 'project', 'label', 'labels', 'insights',
  ];
  if (!known.includes(view as ViewId)) return { view: 'week' };
  return id ? { view: view as ViewId, id } : { view: view as ViewId };
}

export const routeKey = (route: Route): string =>
  route.id ? `${route.view}:${route.id}` : route.view;

export function navigate(view: ViewId, id?: string): void {
  window.location.hash = id ? `#/${view}/${id}` : `#/${view}`;
}

/** The current destination, kept in the address bar so Back works in the PWA. */
export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash));

  useEffect(() => {
    const onChange = () => setRoute(parse(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return route;
}
