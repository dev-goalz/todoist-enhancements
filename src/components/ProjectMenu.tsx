import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import { useT } from '@/hooks/useT';
import { useStore } from '@/store/store';
import { useConfirm } from './overlays/Confirm';
import { navigate } from '@/hooks/useRoute';
import type { Project } from '@/domain/types';

export interface ProjectMenuProps {
  project: Project;
  onClose: () => void;
  /** Opens the project sheet to edit this one. */
  onEdit: () => void;
  /**
   * Adds a project beside this one. Only the sidebar offers these: "above" and
   * "below" are positions in a list, and a project's own page is not in one.
   */
  onAddAbove?: () => void;
  onAddBelow?: () => void;
  /** Where the popover hangs from, so a sidebar row and a header can differ. */
  align?: 'left' | 'right';
  /** The control it belongs to. The menu is placed against this. */
  anchor: HTMLElement | null;
}

/**
 * Everything you can do to a project, in one list.
 *
 * The same menu answers the three-dot button on a sidebar row and the one on
 * the project's own page, because they are the same question asked from two
 * places, and a second copy would be a second thing to keep in step.
 */
export function ProjectMenu({
  project, onClose, onEdit, onAddAbove, onAddBelow, align = 'left', anchor,
}: ProjectMenuProps) {
  const { t } = useT();
  const confirm = useConfirm();
  const items = useStore((s) => s.snapshot.items);
  const updateProjectFields = useStore((s) => s.updateProjectFields);
  const archiveProject = useStore((s) => s.archiveProject);
  const deleteProject = useStore((s) => s.deleteProject);
  const duplicateProject = useStore((s) => s.duplicateProject);
  const nestProject = useStore((s) => s.nestProject);
  const ref = useRef<HTMLDivElement>(null);

  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  /* The sidebar is a scrolling box, and a menu drawn inside it is cut off at
     its edges — which is where this one lost half its items. It is drawn into
     the document instead and placed against the button it belongs to, flipping
     above it when there is no room below. */
  useLayoutEffect(() => {
    if (!anchor) return;
    const menu = ref.current;
    const button = anchor.getBoundingClientRect();
    const height = menu?.offsetHeight ?? 320;
    const width = menu?.offsetWidth ?? 226;
    const margin = 8;

    const below = button.bottom + 4;
    const top = below + height > window.innerHeight - margin
      ? Math.max(margin, button.top - height - 4)
      : below;

    const wanted = align === 'right' ? button.right - width : button.left - 4;
    const left = Math.min(
      Math.max(margin, wanted),
      Math.max(margin, window.innerWidth - width - margin),
    );

    setPosition({ top, left });
  }, [anchor, align]);

  /* Anywhere else, Escape, and any scroll underneath it, put it away: a menu
     placed against a button has to go when that button moves. */
  useEffect(() => {
    const dismiss = (event: MouseEvent) => {
      if (ref.current?.contains(event.target as Node)) return;
      if (anchor?.contains(event.target as Node)) return;
      onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
    };
    document.addEventListener('mousedown', dismiss);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onClose);
    // Capture: the sidebar scrolls, not the window.
    window.addEventListener('scroll', onClose, true);
    return () => {
      document.removeEventListener('mousedown', dismiss);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onClose);
      window.removeEventListener('scroll', onClose, true);
    };
  }, [onClose, anchor]);

  const openTaskCount = Object.values(items).filter(
    (item) => item.project_id === project.id && !item.checked && !item.is_deleted,
  ).length;

  async function archive() {
    onClose();
    const ok = await confirm({
      title: t('project.archiveTitle'),
      body: t('project.archiveBody', { name: project.name }),
      confirmLabel: t('project.archive'),
    });
    if (ok) await archiveProject(project.id);
  }

  async function remove() {
    onClose();
    const ok = await confirm({
      title: t('project.deleteTitle'),
      body: t('project.deleteBody', { name: project.name, count: openTaskCount }),
      confirmLabel: t('project.delete'),
      destructive: true,
    });
    if (!ok) return;
    /* A page cannot stand on a project that no longer exists, so leaving it is
       part of the deletion rather than something to discover afterwards. */
    if (window.location.hash.includes(project.id)) navigate('week');
    await deleteProject(project.id);
  }

  const menu = (
    <div
      className="popover projectmenu"
      role="menu"
      aria-label={t('project.actions')}
      ref={ref}
      style={{
        top: position?.top ?? -9999,
        left: position?.left ?? -9999,
        visibility: position ? undefined : 'hidden',
      }}
    >
      {onAddAbove && onAddBelow && (
        <>
          <button className="opt" role="menuitem" onClick={() => { onClose(); onAddAbove(); }}>
            <Icon name="plus" size="sm" /><span>{t('project.addAbove')}</span>
          </button>
          <button className="opt" role="menuitem" onClick={() => { onClose(); onAddBelow(); }}>
            <Icon name="plus" size="sm" /><span>{t('project.addBelow')}</span>
          </button>
          <hr />
        </>
      )}
      <button className="opt" role="menuitem" onClick={() => { onClose(); onEdit(); }}>
        <Icon name="edit" size="sm" /><span>{t('project.edit')}</span>
      </button>
      <button
        className="opt"
        role="menuitem"
        onClick={() => {
          onClose();
          void updateProjectFields(project.id, { is_favorite: !project.is_favorite });
        }}
      >
        <Icon name="star" size="sm" />
        <span>{project.is_favorite ? t('project.unfavourite') : t('project.favourite')}</span>
      </button>
      <button
        className="opt"
        role="menuitem"
        title={t('project.duplicateHint')}
        onClick={() => {
          onClose();
          void duplicateProject(project.id, t('project.copyOf', { name: project.name }));
        }}
      >
        <Icon name="stack" size="sm" /><span>{t('project.duplicate')}</span>
      </button>
      {/* The gesture that nests a project is a drag to the right; getting one
          back out is the thing a gesture is bad at, so it is also a command. */}
      {project.parent_id && (
        <button
          className="opt"
          role="menuitem"
          onClick={() => { onClose(); void nestProject(project.id, null); }}
        >
          <Icon name="arrow-left" size="sm" /><span>{t('project.moveToTop')}</span>
        </button>
      )}
      <hr />
      <button className="opt" role="menuitem" onClick={() => void archive()}>
        <Icon name="export" size="sm" /><span>{t('project.archive')}</span>
      </button>
      <button className="opt danger" role="menuitem" onClick={() => void remove()}>
        <Icon name="close" size="sm" /><span>{t('project.delete')}</span>
      </button>
    </div>
  );

  return createPortal(menu, document.body);
}
