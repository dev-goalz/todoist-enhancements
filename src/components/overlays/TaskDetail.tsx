import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Overlay } from './Overlay';
import { Icon } from '../Icon';
import { useT } from '@/hooks/useT';
import { useData } from '@/hooks/useData';
import { useStore } from '@/store/store';
import {
  effectiveEstimate, formatDuration, parseDurationInput, withEstimate,
} from '@/domain/estimates';
import { deadlineDate, dueDate, formatRelativeDay, toApiDate } from '@/domain/dates';
import { renderMarkdown } from '@/domain/markdown';
import { markerStyle } from '@/domain/colors';
import { toDisplayPriority, toTodoistPriority, type DisplayPriority } from '@/domain/types';

interface TaskDetailProps {
  taskId: string | null;
  onClose: () => void;
  onOpen: (id: string) => void;
}

/**
 * The full task.
 *
 * Laid out as in the design: the checkbox and title share a line, the
 * description sits on the title's own left edge, and every property lives in
 * the right-hand column. Destructive actions are behind the overflow menu,
 * never next to Close.
 */
export function TaskDetail({ taskId, onClose, onOpen }: TaskDetailProps) {
  const { t, locale } = useT();
  const { snapshot, childrenOf } = useData();
  const updateTask = useStore((s) => s.updateTask);
  const toggleTask = useStore((s) => s.toggleTask);
  const removeTask = useStore((s) => s.removeTask);
  const createTask = useStore((s) => s.createTask);

  const item = taskId ? snapshot.items[taskId] : null;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [editingDescription, setEditingDescription] = useState(false);
  const [estimate, setEstimate] = useState('');
  const [subtaskDraft, setSubtaskDraft] = useState('');
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  /**
   * Keeps the title box exactly as tall as its text, so nothing is clipped.
   *
   * The field is sized border-box, and scrollHeight excludes the border, so
   * the border has to be added back or the last line is cropped.
   */
  const fitTitle = useCallback(() => {
    const el = titleRef.current;
    if (!el) return;
    const style = getComputedStyle(el);
    const border =
      Number.parseFloat(style.borderTopWidth) + Number.parseFloat(style.borderBottomWidth);
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + border}px`;
  }, []);

  // Re-seed the editable fields whenever a different task is opened.
  useEffect(() => {
    if (!item) return;
    setTitle(item.content);
    setDescription(item.description);
    setEditingDescription(false);
    setAddingSubtask(false);
    setSubtaskDraft('');
    setMenuOpen(false);
    const own = effectiveEstimate(item, childrenOf);
    setEstimate(own.computed || own.minutes === null ? '' : String(own.minutes));
  }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (editingDescription) descriptionRef.current?.focus();
  }, [editingDescription]);

  // Measured after layout, and again once webfonts settle, because the text
  // height is not final on the first paint.
  useLayoutEffect(fitTitle, [fitTitle, title, taskId]);
  useEffect(() => {
    void document.fonts?.ready.then(fitTitle);
  }, [fitTitle]);

  const descriptionHtml = useMemo(
    () => renderMarkdown(item?.description ?? ''),
    [item?.description],
  );

  if (!item) return null;

  const priority = toDisplayPriority(item.priority);
  const due = dueDate(item);
  const deadline = deadlineDate(item);
  const subtasks = childrenOf(item.id);
  const { minutes, computed } = effectiveEstimate(item, childrenOf);
  const project = snapshot.projects[item.project_id];
  const section = item.section_id ? snapshot.sections[item.section_id] : null;
  const comments = Object.values(snapshot.notes)
    .filter((n) => n.item_id === item.id)
    .sort((a, b) => a.posted_at.localeCompare(b.posted_at));
  const visibleLabels = item.labels.filter((l) => !l.toLowerCase().startsWith('est-'));

  const commitTitle = () => {
    const next = title.trim();
    if (next && next !== item.content) void updateTask(item.id, { content: next });
  };
  const commitDescription = () => {
    setEditingDescription(false);
    if (description !== item.description) void updateTask(item.id, { description });
  };
  const commitEstimate = () => {
    const parsed = parseDurationInput(estimate);
    if (parsed === null && estimate.trim() !== '') return;
    void updateTask(item.id, { labels: withEstimate(item.labels, parsed) });
  };

  function addSubtask() {
    const content = subtaskDraft.trim();
    if (!content) {
      setAddingSubtask(false);
      return;
    }
    void createTask({ content, project_id: item!.project_id, parent_id: item!.id });
    setSubtaskDraft('');
  }

  return (
    <Overlay open onClose={onClose} label={t('detail.title')}>
      <header className="detail-top">
        <div className="crumb">
          {project && (
            <>
              <span className="hash" style={markerStyle(project.color)}>#</span>
              {project.name}
            </>
          )}
          {section && <span className="crumb-sep">/ {section.name}</span>}
        </div>

        <div className="detail-tools">
          <div className="menuwrap">
            <button
              className="iconbtn"
              aria-label={t('task.moreActions')}
              title={t('task.moreActions')}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <Icon name="more" />
            </button>
            {menuOpen && (
              <div className="popover rowmenu" role="menu">
                <button
                  className="opt"
                  onClick={() => {
                    setMenuOpen(false);
                    window.open(`https://app.todoist.com/app/task/${item.id}`, '_blank', 'noopener');
                  }}
                >
                  <span><Icon name="external" size="sm" /> {t('task.openInTodoist')}</span>
                </button>
                <hr />
                <button
                  className="opt danger"
                  onClick={() => {
                    setMenuOpen(false);
                    if (window.confirm(t('task.deleteConfirm', { name: item.content }))) {
                      void removeTask(item.id);
                      onClose();
                    }
                  }}
                >
                  <span><Icon name="close" size="sm" /> {t('task.delete')}</span>
                </button>
              </div>
            )}
          </div>

          <button className="iconbtn" aria-label={t('detail.close')} title={t('detail.close')} onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
      </header>

      <div className="detail-body">
        <div className="detail-main">
          <div className="detail-headline">
            <span
              className={`check p${priority}`}
              role="checkbox"
              aria-checked={item.checked}
              aria-label={t('task.complete')}
              tabIndex={0}
              onClick={() => void toggleTask(item.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  void toggleTask(item.id);
                }
              }}
            >
              <Icon name="check" />
            </span>

            <div className="detail-content">
              <textarea
                className="titlefield"
                value={title}
                rows={1}
                aria-label={t('detail.title')}
                ref={titleRef}
                onChange={(e) => { setTitle(e.target.value); fitTitle(); }}
                onBlur={commitTitle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.currentTarget.blur();
                  }
                }}
              />

              {editingDescription ? (
                <textarea
                  ref={descriptionRef}
                  className="descfield"
                  value={description}
                  placeholder={t('detail.descriptionPlaceholder')}
                  aria-label={t('detail.description')}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={commitDescription}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setDescription(item.description);
                      setEditingDescription(false);
                    }
                  }}
                />
              ) : (
                <button
                  className={`descview${item.description ? '' : ' placeholder'}`}
                  onClick={() => setEditingDescription(true)}
                  aria-label={t('detail.description')}
                >
                  {item.description ? (
                    <div className="md" dangerouslySetInnerHTML={{ __html: descriptionHtml }} />
                  ) : (
                    t('detail.descriptionPlaceholder')
                  )}
                </button>
              )}
            </div>
          </div>

          <section className="detail-section">
            {subtasks.length > 0 && (
              <h3 className="sectionlabel">
                {t('detail.subtasks')}
                <span className="count">
                  {t('task.subtaskProgress', {
                    done: subtasks.filter((c) => c.checked).length,
                    total: subtasks.length,
                  })}
                </span>
              </h3>
            )}

            {subtasks.map((child) => (
              <div className="subtaskrow" key={child.id}>
                <span
                  className={`check p${toDisplayPriority(child.priority)}`}
                  role="checkbox"
                  aria-checked={child.checked}
                  aria-label={t('task.complete')}
                  tabIndex={0}
                  onClick={() => void toggleTask(child.id)}
                >
                  <Icon name="check" />
                </span>
                <button className="subtasktitle" onClick={() => onOpen(child.id)}>
                  <span style={child.checked ? { textDecoration: 'line-through', color: 'var(--faint)' } : undefined}>
                    {child.content}
                  </span>
                </button>
              </div>
            ))}

            {addingSubtask ? (
              <input
                className="textfield"
                autoFocus
                placeholder={t('detail.addSubtask')}
                value={subtaskDraft}
                onChange={(e) => setSubtaskDraft(e.target.value)}
                onBlur={() => { addSubtask(); setAddingSubtask(false); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addSubtask();
                  }
                  if (e.key === 'Escape') {
                    setSubtaskDraft('');
                    setAddingSubtask(false);
                  }
                }}
              />
            ) : (
              <button className="addline" onClick={() => setAddingSubtask(true)}>
                <Icon name="plus" size="sm" />
                {t('detail.addSubtask')}
              </button>
            )}
          </section>

          <section className="detail-section">
            <h3 className="sectionlabel">{t('detail.comments')}</h3>
            {comments.length === 0 ? (
              <p className="psub">{t('detail.noComments')}</p>
            ) : (
              comments.map((note) => (
                <article className="comment" key={note.id}>
                  <div className="md" dangerouslySetInnerHTML={{ __html: renderMarkdown(note.content) }} />
                  <time className="psub">{formatRelativeDay(new Date(note.posted_at), locale)}</time>
                </article>
              ))
            )}
          </section>
        </div>

        <aside className="detail-side">
          <div className="prop">
            <span>{t('detail.project')}</span>
            <select
              className="propselect"
              value={item.project_id}
              onChange={(e) => void updateTask(item.id, { project_id: e.target.value })}
            >
              {Object.values(snapshot.projects)
                .filter((p) => !p.is_archived && !p.is_deleted)
                .map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
            </select>
          </div>

          <div className="prop">
            <span>{t('detail.date')}</span>
            <input
              className="propinput"
              type="date"
              value={due ? toApiDate(due) : ''}
              onChange={(e) => {
                const value = e.target.value;
                void updateTask(item.id, {
                  due: value
                    ? {
                        date: value,
                        timezone: null,
                        string: value,
                        lang: locale,
                        is_recurring: item.due?.is_recurring ?? false,
                      }
                    : null,
                });
              }}
            />
          </div>

          <div className="prop">
            <span>{t('detail.deadline')}</span>
            <input
              className="propinput"
              type="date"
              value={deadline ? toApiDate(deadline) : ''}
              onChange={(e) => {
                const value = e.target.value;
                void updateTask(item.id, { deadline: value ? { date: value, lang: locale } : null });
              }}
            />
          </div>

          <div className="prop">
            <span>{t('detail.estimate')}</span>
            <input
              className="propinput"
              value={estimate}
              placeholder={
                computed && minutes !== null
                  ? `${formatDuration(minutes, locale)} · ${t('task.computedEstimate')}`
                  : t('task.estimatePlaceholder')
              }
              onChange={(e) => setEstimate(e.target.value)}
              onBlur={commitEstimate}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            />
          </div>

          <div className="prop">
            <span>{t('detail.priority')}</span>
            <select
              className="propselect"
              value={priority}
              onChange={(e) =>
                void updateTask(item.id, {
                  priority: toTodoistPriority(Number(e.target.value) as DisplayPriority),
                })
              }
            >
              {([1, 2, 3, 4] as const).map((p) => (
                <option key={p} value={p}>P{p}</option>
              ))}
            </select>
          </div>

          <div className="prop">
            <span>{t('detail.labels')}</span>
            <div className="pills">
              {visibleLabels.length === 0 && <span className="psub">{t('common.none')}</span>}
              {visibleLabels.map((label) => {
                const known = Object.values(snapshot.labels).find((l) => l.name === label);
                return (
                  <button
                    key={label}
                    className="pill"
                    title={t('labels.unfavourite')}
                    onClick={() =>
                      void updateTask(item.id, { labels: item.labels.filter((l) => l !== label) })
                    }
                  >
                    <Icon name="flag" size="sm" className="taglabel" />
                    <span style={markerStyle(known?.color, false)}>{label}</span>
                    <Icon name="close" size="sm" />
                  </button>
                );
              })}
            </div>
          </div>

          {item.due?.is_recurring && (
            <div className="prop">
              <span>{t('detail.recurring')}</span>
              <strong><Icon name="repeat" size="sm" />{item.due.string}</strong>
            </div>
          )}
        </aside>
      </div>
    </Overlay>
  );
}
