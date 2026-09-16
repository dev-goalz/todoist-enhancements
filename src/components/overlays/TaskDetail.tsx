import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { Overlay } from './Overlay';
import { Icon } from '../Icon';
import { useT } from '@/hooks/useT';
import { useData } from '@/hooks/useData';
import { navigate } from '@/hooks/useRoute';
import { useStore } from '@/store/store';
import { useConfirm } from './Confirm';
import {
  effectiveEstimate, formatDuration, withEstimate,
} from '@/domain/estimates';
import { deadlineDate, dueDate, formatRelativeDay, toApiDate } from '@/domain/dates';
import { renderMarkdown } from '@/domain/markdown';
import { parseShorthand, type TextRange } from '@/domain/shorthand';
import { dueForDate, readRecurrence } from '@/domain/recurrence';
import { EstimateField } from '../EstimateField';
import { TaskNameField } from '../TaskNameField';
import { Select } from '../Select';
import { DateField } from '../DateField';
import { markerStyle } from '@/domain/colors';
import { toDisplayPriority, toTodoistPriority, type DisplayPriority, type Item } from '@/domain/types';

/**
 * The repeat rule, as a rule rather than as a reading of one.
 *
 * What is typed here is handed to Todoist whole: it resolves the rule, and it
 * is the only thing that can, since where the next occurrence falls depends on
 * when this one is completed. The field's whole job is to refuse a phrase the
 * app cannot vouch for rather than send it and find out — a rule read wrongly
 * does not fail, it moves every future occurrence and says nothing.
 *
 * Emptying it stops the repeat without losing the date: the occurrence the
 * task is sitting on becomes its due date, once.
 */
function RecurrenceField({ item }: { item: Item }) {
  const { t } = useT();
  const updateTask = useStore((s) => s.updateTask);
  const setRecurrence = useStore((s) => s.setRecurrence);
  const rule = item.due?.is_recurring ? item.due.string : '';
  const [draft, setDraft] = useState(rule);
  const [refused, setRefused] = useState(false);

  // A rule Todoist rewrote on save — "every mon" comes back "every monday" —
  // is the truth, so the field follows the task rather than the typing.
  useEffect(() => { setDraft(rule); setRefused(false); }, [rule, item.id]);

  function commit() {
    const typed = draft.trim();
    if (typed === rule.trim()) { setRefused(false); return; }

    if (!typed) {
      setRefused(false);
      if (!item.due?.is_recurring) return;
      // The occurrence it is on becomes the date it keeps.
      const date = item.due.date;
      void updateTask(item.id, {
        due: { date, timezone: item.due.timezone, string: date, lang: item.due.lang, is_recurring: false },
      });
      return;
    }

    const read = readRecurrence(typed);
    if (!read) { setRefused(true); return; }
    setRefused(false);
    void setRecurrence(item.id, read);
  }

  return (
    <div className="repeatfield">
      <span className="repeatinput">
        <Icon name="repeat" size="sm" />
        <input
          value={draft}
          onChange={(event) => { setDraft(event.target.value); setRefused(false); }}
          onBlur={commit}
          onKeyDown={(event) => {
            /* Enter commits outright rather than blurring and letting the blur
               commit: a refusal has to be able to keep the caret in the field
               that is being refused, and blurring gives it away first. */
            if (event.key === 'Enter') { event.preventDefault(); commit(); }
            if (event.key === 'Escape') { setDraft(rule); setRefused(false); }
          }}
          placeholder={t('detail.recurringPlaceholder')}
          aria-label={t('detail.recurring')}
          aria-invalid={refused}
        />
      </span>
      {refused && <small className="repeatrefused">{t('detail.recurringRefused')}</small>}
      {!refused && item.due?.is_recurring && item.due.string.includes('!') && (
        <small className="repeathint">{t('detail.recurringFromCompletion')}</small>
      )}
    </div>
  );
}

interface TaskDetailProps {
  taskId: string | null;
  onClose: () => void;
  onOpen: (id: string) => void;
}

/** The id a subtask row registers under, in both of its roles. */
export const subtaskRowId = (id: string): string => `subtask:${id}`;

/**
 * A subtask row that can be picked up and dropped onto another.
 *
 * It registers in the app's one drag context rather than opening a second, the
 * way the sidebar's project rows do, and it is both the handle and the landing
 * place — dropping one on another puts it in that one's position.
 */
function SubtaskRow({ id, children }: { id: string; children: React.ReactNode }) {
  const rowId = subtaskRowId(id);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: rowId });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: rowId });
  const { t } = useT();

  return (
    <div
      ref={setDropRef}
      className={`subtaskrow${isDragging ? ' lifting' : ''}${isOver && !isDragging ? ' landing' : ''}`}
    >
      {/* Dragged by its handle, so the row's own controls keep working. */}
      <span className="drag subdrag" title={t('detail.reorderSubtask')} ref={setNodeRef} {...attributes} {...listeners}>
        <Icon name="drag" size="sm" />
      </span>
      {children}
    </div>
  );
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
  const moveTask = useStore((s) => s.moveTask);
  const setRecurrence = useStore((s) => s.setRecurrence);
  const naturalDates = useStore((s) => s.prefs.naturalDates);
  const toast = useStore((s) => s.toast);
  const confirm = useConfirm();

  const item = taskId ? snapshot.items[taskId] : null;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [editingDescription, setEditingDescription] = useState(false);
  const [subtaskDraft, setSubtaskDraft] = useState('');
  /** Readings of the title turned down while editing it. */
  const [refusals, setRefusals] = useState<TextRange[]>([]);
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  /**
   * Keeps the description box exactly as tall as its text, so leaving the
   * field does not change the height of the panel.
   *
   * The editor was a fixed 96px box that scrolled, and the rendered view below
   * it is as tall as the text — so clicking away from a long description made
   * the panel jump open under the pointer, which is what it looked like when
   * clicking "add subtask" right after pasting one in. Edited and rendered are
   * the same height now, and nothing moves on the way between them.
   */
  const fitDescription = useCallback(() => {
    const el = descriptionRef.current;
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
    setRefusals([]);
    setMenuOpen(false);
    setTagPickerOpen(false);
  }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (editingDescription) descriptionRef.current?.focus();
  }, [editingDescription]);

  // Measured after layout, and again once webfonts settle, because the text
  // height is not final on the first paint.
  useLayoutEffect(fitDescription, [fitDescription, description, editingDescription, taskId]);
  // Measured again once webfonts settle: the text height is not final on the
  // first paint.
  useEffect(() => {
    void document.fonts?.ready.then(fitDescription);
  }, [fitDescription]);

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
  /* The parents above this task, outermost first. Guarded against a cycle the
     server should never send but which would otherwise hang the panel. */
  const ancestors: Item[] = [];
  for (
    let parent = item.parent_id ? snapshot.items[item.parent_id] : null;
    parent && ancestors.length < 10;
    parent = parent.parent_id ? snapshot.items[parent.parent_id] : null
  ) {
    ancestors.unshift(parent);
  }

  const project = snapshot.projects[item.project_id];
  const section = item.section_id ? snapshot.sections[item.section_id] : null;
  const comments = Object.values(snapshot.notes)
    .filter((n) => n.item_id === item.id)
    .sort((a, b) => a.posted_at.localeCompare(b.posted_at));
  const visibleLabels = item.labels.filter((l) => !l.toLowerCase().startsWith('est-'));
  const allTags = Object.values(snapshot.labels)
    .filter((l) => !l.is_deleted && !l.name.startsWith('est-'))
    .sort((a, b) => a.item_order - b.item_order);

  /**
   * Saves the title, and everything the title turned out to be saying.
   *
   * Typing "call the plumber tomorrow p1 #Home" into a task's name should do
   * what typing it into the composer does. What the readers claim is taken out
   * of the name and written to the field it belongs to; what they do not claim
   * stays in the name exactly as it was typed.
   */
  /** Whether the title holds an edit that has not been saved yet. */
  const titleDirty = title !== item.content;

  const cancelTitle = () => {
    setTitle(item.content);
    setRefusals([]);
  };

  const commitTitle = () => {
    const read = parseShorthand(title, snapshot, naturalDates, refusals);
    const next = read.content.trim();
    if (!next) {
      // Nothing left to call it by: the edit is dropped rather than the name.
      setTitle(item.content);
      return;
    }

    const fields: Record<string, unknown> = {};
    if (next !== item.content) fields.content = next;
    if (read.date) fields.due = dueForDate(item.due, read.date);
    if (read.priority) fields.priority = toTodoistPriority(read.priority);

    let labels = item.labels;
    if (read.labels.length > 0) labels = [...new Set([...labels, ...read.labels])];
    if (read.minutes !== null) labels = withEstimate(labels, read.minutes);
    if (labels !== item.labels) fields.labels = labels;

    if (Object.keys(fields).length > 0) void updateTask(item.id, fields);

    /* A repeat is not an `item_update` field like the others: Todoist resolves
       the rule, so it is sent on its own and the date is left to it. */
    if (read.recurrence) void setRecurrence(item.id, read.recurrence);

    const movingProject = read.projectId && read.projectId !== item.project_id;
    const movingSection = read.sectionId && read.sectionId !== item.section_id;
    if (movingProject || movingSection) {
      void moveTask(
        item.id,
        read.sectionId ? { section_id: read.sectionId } : { project_id: read.projectId! },
      );
    }

    /*
     * What the title turned out to be saying, said back.
     *
     * The words are taken out of the name as they are saved, so a title typed
     * "… demain" and saved comes back one word shorter — which on its own is
     * indistinguishable from the edit having been thrown away. The line names
     * what was set instead, and the panel on the right shows it.
     */
    const applied = [
      read.date
        ? formatRelativeDay(new Date(`${read.date.slice(0, 10)}T00:00:00`), locale)
          + (read.date.includes('T') ? ` ${read.date.slice(11, 16)}` : '')
        : null,
      read.recurrence?.string ?? null,
      read.projectId ? snapshot.projects[read.projectId]?.name ?? null : null,
      read.priority ? `P${read.priority}` : null,
      ...read.labels.map((label) => `@${label}`),
      read.minutes !== null ? formatDuration(read.minutes, locale) : null,
    ].filter(Boolean);
    if (applied.length > 0) toast(applied.join(' · '));

    setRefusals([]);
    setTitle(next);
  };
  const commitDescription = () => {
    setEditingDescription(false);
    if (description !== item.description) void updateTask(item.id, { description });
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
        {/*
          * Where the task is, as the way back rather than as a caption.
          *
          * A subtask opened from its parent used to be a dead end: the panel
          * said which project it was in and nothing about the task it belongs
          * to, and closing was the only way back up. Each ancestor is a link
          * now, the project included. The section is not one, because there is
          * no page that is a section.
          */}
        <nav className="crumb" aria-label={t('detail.whereItIs')}>
          {project && (
            <button
              className="crumblink"
              onClick={() => { onClose(); navigate('project', project.id); }}
            >
              <span className="hash" style={markerStyle(project.color)}>#</span>
              {project.name}
            </button>
          )}
          {section && (
            <>
              <span className="crumb-sep">/</span>
              <span className="crumbhere">{section.name}</span>
            </>
          )}
          {ancestors.map((parent) => (
            <span className="crumbstep" key={parent.id}>
              <span className="crumb-sep">/</span>
              <button className="crumblink" onClick={() => onOpen(parent.id)}>
                {parent.content}
              </button>
            </span>
          ))}
          <span className="crumb-sep">/</span>
          <span className="crumbhere" aria-current="page">{item.content}</span>
        </nav>

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
                    void confirm({
                      title: t('task.deleteTitle'),
                      body: t('task.deleteConfirm', { name: item.content }),
                      confirmLabel: t('task.delete'),
                      destructive: true,
                    }).then((ok) => {
                      if (!ok) return;
                      void removeTask(item.id);
                      onClose();
                    });
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
              {/* The same field the composer uses, so a title edited here
                  reads what a title typed there reads: a date, a repeat, a
                  project, a tag, a priority — marked as you type and taken out
                  of the name when it is saved. */}
              <TaskNameField
                value={title}
                onChange={setTitle}
                onSubmit={commitTitle}
                onCancel={cancelTitle}
                placeholder={t('detail.title')}
                ariaLabel={t('detail.title')}
                snapshot={snapshot}
                naturalDates={naturalDates}
                refusals={refusals}
                onRefusals={setRefusals}
                multiline
                fieldClassName="titlefield"
              />

              {/*
                * An edit to the title is finished on purpose.
                *
                * It used to save itself when the field lost the caret, which
                * is fine for a name and wrong for a name that also carries a
                * date, a project and a priority: clicking anywhere rewrote
                * four things at once, and the panel on the right only caught
                * up afterwards. Enter saves, Escape puts it back, and the two
                * buttons say so for anyone who does neither.
                */}
              {titleDirty && (
                <div className="titleactions">
                  {/* Pressed before the field can lose the caret, or the blur
                      would land on the field and the click on nothing. */}
                  <button
                    className="btn sm"
                    onMouseDown={(e) => { e.preventDefault(); cancelTitle(); }}
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    className="btn sm accent"
                    onMouseDown={(e) => { e.preventDefault(); commitTitle(); }}
                  >
                    {t('common.save')}
                  </button>
                </div>
              )}

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

          <section className="detail-section boxed">
            <h3 className="sectionlabel">
              {t('detail.subtasks')}
              {subtasks.length > 0 && (
                <span className="count">
                  {t('task.subtaskProgress', {
                    done: subtasks.filter((c) => c.checked).length,
                    total: subtasks.length,
                  })}
                </span>
              )}
            </h3>

            {subtasks.map((child) => (
              <SubtaskRow id={child.id} key={child.id}>
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
              </SubtaskRow>
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

          <section className="detail-section boxed">
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
            <Select
              value={item.project_id}
              ariaLabel={t('detail.project')}
              onChange={(next) => void updateTask(item.id, { project_id: next })}
              options={Object.values(snapshot.projects)
                .filter((p) => !p.is_archived && !p.is_deleted && !p.is_folder)
                .map((p) => ({
                  value: p.id,
                  label: p.inbox_project ? t('nav.inbox') : p.name,
                  marker: p.color,
                }))}
            />
          </div>

          <div className="prop">
            <span>{t('detail.startDate')}</span>
            <DateField
              value={due ? toApiDate(due) : ''}
              label={t('detail.startDate')}
              placeholder={t('date.pick')}
              onChange={(value) => {
                /* Keeps the rule. Writing the date into `due.string` is what
                   ends a series, and picking a day in a calendar is never a
                   request to stop something repeating — the field below is. */
                void updateTask(item.id, {
                  due: value ? dueForDate(item.due, value) : null,
                });
              }}
            />
          </div>

          <div className="prop">
            <span>{t('detail.deadline')}</span>
            <DateField
              value={deadline ? toApiDate(deadline) : ''}
              label={t('detail.deadline')}
              placeholder={t('date.pick')}
              onChange={(value) =>
                void updateTask(item.id, { deadline: value ? { date: value, lang: locale } : null })}
            />
          </div>

          <div className="prop">
            <span>{t('detail.estimate')}</span>
            {/* The same field as everywhere else, so the unit is always beside
                the number instead of being left to the reader to infer. */}
            <EstimateField
              minutes={computed ? null : minutes}
              placeholder={
                computed && minutes !== null
                  ? `${formatDuration(minutes, locale)} · ${t('task.computedEstimate')}`
                  : t('task.estimatePlaceholder')
              }
              onCommit={(value) =>
                void updateTask(item.id, { labels: withEstimate(item.labels, value) })}
            />
          </div>

          <div className="prop">
            <span>{t('detail.priority')}</span>
            <Select
              value={String(priority)}
              ariaLabel={t('detail.priority')}
              onChange={(next) =>
                void updateTask(item.id, {
                  priority: toTodoistPriority(Number(next) as DisplayPriority),
                })}
              options={([1, 2, 3, 4] as const).map((p) => ({
                value: String(p), label: `P${p}`,
              }))}
            />
          </div>

          <div className="prop">
            <span className="prophead">
              {t('detail.labels')}
              <button
                className="propadd"
                aria-label={t('composer.labels')}
                title={t('composer.labels')}
                aria-expanded={tagPickerOpen}
                onClick={() => setTagPickerOpen((v) => !v)}
              >
                <Icon name="plus" size="sm" />
              </button>
            </span>

            <div className="pills">
              {visibleLabels.length === 0 && <span className="psub">{t('common.none')}</span>}
              {visibleLabels.map((label) => {
                const known = Object.values(snapshot.labels).find((l) => l.name === label);
                return (
                  <button
                    key={label}
                    className="pill"
                    title={t('detail.labels')}
                    onClick={() =>
                      void updateTask(item.id, { labels: item.labels.filter((l) => l !== label) })
                    }
                  >
                    <Icon name="tag" size="sm" className="taglabel" style={markerStyle(known?.color, false)} />
                    <span>{label}</span>
                    <Icon name="close" size="sm" />
                  </button>
                );
              })}
            </div>

            {tagPickerOpen && (
              <div
                className="popover tagpicker"
                role="dialog"
                aria-label={t('composer.labels')}
                /* The tags property sits at the foot of a scrolling panel, so
                   the list it opens can land below the fold. Bring it up. */
                ref={(node) => node?.scrollIntoView({ block: 'nearest' })}
              >
                {allTags.length === 0 && <p className="menuhint">{t('labels.none')}</p>}
                {allTags.map((label) => (
                  <label className="checkrow" key={label.id}>
                    <input
                      type="checkbox"
                      checked={item.labels.includes(label.name)}
                      onChange={() =>
                        void updateTask(item.id, {
                          labels: item.labels.includes(label.name)
                            ? item.labels.filter((l) => l !== label.name)
                            : [...item.labels, label.name],
                        })
                      }
                    />
                    <Icon name="tag" size="sm" className="taglabel" style={markerStyle(label.color, false)} />
                    <span>{label.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="prop">
            <span>{t('detail.recurring')}</span>
            <RecurrenceField item={item} />
          </div>
        </aside>
      </div>
    </Overlay>
  );
}
