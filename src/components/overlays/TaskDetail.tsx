import { useEffect, useState } from 'react';
import { Overlay } from './Overlay';
import { Icon } from '../Icon';
import { useT } from '@/hooks/useT';
import { useData } from '@/hooks/useData';
import { useStore } from '@/store/store';
import {
  effectiveEstimate, formatDuration, parseDurationInput, withEstimate,
} from '@/domain/estimates';
import { deadlineDate, dueDate, formatRelativeDay, toApiDate } from '@/domain/dates';
import { toDisplayPriority, toTodoistPriority, type DisplayPriority } from '@/domain/types';

interface TaskDetailProps {
  taskId: string | null;
  onClose: () => void;
  onOpen: (id: string) => void;
}

/** The full task, close to Todoist's own panel but with the estimate first-class. */
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
  const [estimate, setEstimate] = useState('');
  const [subtaskDraft, setSubtaskDraft] = useState('');

  // Re-seed the editable fields whenever a different task is opened.
  useEffect(() => {
    if (!item) return;
    setTitle(item.content);
    setDescription(item.description);
    const own = effectiveEstimate(item, childrenOf);
    setEstimate(own.computed || own.minutes === null ? '' : String(own.minutes));
    setSubtaskDraft('');
  }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const commitTitle = () => {
    if (title.trim() && title !== item.content) void updateTask(item.id, { content: title.trim() });
  };
  const commitDescription = () => {
    if (description !== item.description) void updateTask(item.id, { description });
  };
  const commitEstimate = () => {
    const parsed = parseDurationInput(estimate);
    if (parsed === null && estimate.trim() !== '') return;
    void updateTask(item.id, { labels: withEstimate(item.labels, parsed) });
  };

  return (
    <Overlay open onClose={onClose} label={t('detail.title')}>
      <div className="detail-top">
        <div className="crumb">
          {project && <span className="proj">#{project.name}</span>}
          {section && <span className="proj">/ {section.name}</span>}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            className="iconbtn"
            aria-label={t('task.openInTodoist')}
            title={t('task.openInTodoist')}
            onClick={() => window.open(`https://app.todoist.com/app/task/${item.id}`, '_blank', 'noopener')}
          >
            <Icon name="external" />
          </button>
          <button
            className="iconbtn"
            aria-label={t('task.delete')}
            title={t('task.delete')}
            onClick={() => { void removeTask(item.id); onClose(); }}
          >
            <Icon name="close" />
          </button>
          <button className="iconbtn" aria-label={t('detail.close')} onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
      </div>

      <div className="detail-body">
        <div className="detail-main">
          <h2 className="detail-title">
            <span
              className={`check p${priority}`}
              role="checkbox"
              aria-checked={item.checked}
              aria-label={t('task.complete')}
              tabIndex={0}
              onClick={() => void toggleTask(item.id)}
            >
              <Icon name="check" />
            </span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
              style={{
                flex: 1, border: 0, background: 'transparent', font: 'inherit',
                color: 'inherit', padding: 0,
              }}
              aria-label={t('detail.title')}
            />
          </h2>

          <textarea
            className="composer"
            style={{ minHeight: 72 }}
            placeholder={t('detail.descriptionPlaceholder')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={commitDescription}
            aria-label={t('detail.description')}
          />

          <section style={{ marginTop: 'var(--s5)' }}>
            <h3 className="ikicker">{t('detail.subtasks')}</h3>
            {subtasks.map((child) => (
              <div className="task" key={child.id} role="button" tabIndex={0} onClick={() => onOpen(child.id)}>
                <span
                  className={`check p${toDisplayPriority(child.priority)}`}
                  role="checkbox"
                  aria-checked={child.checked}
                  aria-label={t('task.complete')}
                  onClick={(e) => { e.stopPropagation(); void toggleTask(child.id); }}
                >
                  <Icon name="check" />
                </span>
                <span className="tmain">
                  <span className="ttitle" style={child.checked ? { textDecoration: 'line-through', color: 'var(--faint)' } : undefined}>
                    {child.content}
                  </span>
                </span>
              </div>
            ))}
            <input
              className="estinput"
              style={{ width: '100%', marginTop: 'var(--s2)' }}
              placeholder={t('detail.addSubtask')}
              value={subtaskDraft}
              onChange={(e) => setSubtaskDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && subtaskDraft.trim()) {
                  void createTask({
                    content: subtaskDraft.trim(),
                    project_id: item.project_id,
                    parent_id: item.id,
                  });
                  setSubtaskDraft('');
                }
              }}
            />
          </section>

          <section style={{ marginTop: 'var(--s5)' }}>
            <h3 className="ikicker">{t('detail.comments')}</h3>
            {comments.length === 0 ? (
              <p className="psub">{t('detail.noComments')}</p>
            ) : (
              comments.map((note) => (
                <div key={note.id} style={{ marginBottom: 'var(--s3)' }}>
                  <p className="tdesc" style={{ whiteSpace: 'pre-wrap' }}>{note.content}</p>
                  <span className="psub">
                    {formatRelativeDay(new Date(note.posted_at), locale)}
                  </span>
                </div>
              ))
            )}
          </section>
        </div>

        <aside className="detail-side">
          <div className="prop">
            <span>{t('detail.estimate')}</span>
            <input
              className="estinput"
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
            <span>{t('detail.date')}</span>
            <input
              className="estinput"
              type="date"
              value={due ? toApiDate(due) : ''}
              onChange={(e) => {
                const value = e.target.value;
                void updateTask(item.id, {
                  due: value
                    ? { date: value, timezone: null, string: value, lang: locale, is_recurring: item.due?.is_recurring ?? false }
                    : null,
                });
              }}
            />
          </div>

          <div className="prop">
            <span>{t('detail.deadline')}</span>
            <input
              className="estinput"
              type="date"
              value={deadline ? toApiDate(deadline) : ''}
              onChange={(e) => {
                const value = e.target.value;
                void updateTask(item.id, {
                  deadline: value ? { date: value, lang: locale } : null,
                });
              }}
            />
          </div>

          <div className="prop">
            <span>{t('detail.priority')}</span>
            <select
              className="btn"
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
            <span>{t('detail.project')}</span>
            <select
              className="btn"
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
            <span>{t('detail.labels')}</span>
            <div className="meta" style={{ flexWrap: 'wrap' }}>
              {item.labels
                .filter((l) => !l.toLowerCase().startsWith('est-'))
                .map((label) => (
                  <button
                    key={label}
                    className="tag"
                    title={t('detail.labels')}
                    onClick={() =>
                      void updateTask(item.id, {
                        labels: item.labels.filter((l) => l !== label),
                      })
                    }
                  >
                    {label} ×
                  </button>
                ))}
            </div>
          </div>

          {item.due?.is_recurring && (
            <div className="prop">
              <span>{t('detail.recurring')}</span>
              <span className="meta"><Icon name="repeat" />{item.due.string}</span>
            </div>
          )}
        </aside>
      </div>
    </Overlay>
  );
}
