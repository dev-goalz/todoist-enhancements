import { useEffect, useState } from 'react';
import { Overlay } from './Overlay';
import { Icon } from '../Icon';
import { EstimateField } from '../EstimateField';
import { TaskNameField } from '../TaskNameField';
import { useT } from '@/hooks/useT';
import { useStore } from '@/store/store';
import { estimateLabel } from '@/domain/estimates';
import { markerStyle } from '@/domain/colors';
import { toTodoistPriority, type DisplayPriority, type Snapshot } from '@/domain/types';
import { readNaturalDate, stripReading } from '@/domain/nlp';

interface ComposerProps {
  open: boolean;
  onClose: () => void;
  /** Where a task lands when the current page implies a project. */
  defaultProjectId?: string;
  /** Pre-filled placement when the task is added from inside a section. */
  defaultSectionId?: string;
  /** Pre-filled date when the task is added from a dated section. */
  defaultDate?: string;
}

/**
 * Adding a task.
 *
 * Every field the product cares about is here, and each one is labelled: the
 * name and the description are separate boxes, and date, deadline, project,
 * priority, tags and the estimate all sit on the row below.
 */
export function Composer({
  open, onClose, defaultProjectId, defaultSectionId, defaultDate,
}: ComposerProps) {
  const { t } = useT();
  const snapshot = useStore((s) => s.snapshot);
  const createTask = useStore((s) => s.createTask);
  const naturalDates = useStore((s) => s.prefs.naturalDates);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [priority, setPriority] = useState<DisplayPriority>(4);
  const [date, setDate] = useState('');
  const [deadline, setDeadline] = useState('');
  const [labels, setLabels] = useState<string[]>([]);
  const [minutes, setMinutes] = useState<number | null>(null);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [subtasks, setSubtasks] = useState<string[]>([]);
  const [subtaskDraft, setSubtaskDraft] = useState('');

  useEffect(() => {
    if (!open) return;
    setName('');
    setDescription('');
    setPriority(4);
    setLabels([]);
    setMinutes(null);
    setTagsOpen(false);
    setSubtasks([]);
    setSubtaskDraft('');
    setProjectId(defaultProjectId ?? '');
    setSectionId(defaultSectionId ?? '');
    setDate(defaultDate ?? '');
    setDeadline('');
  }, [open, defaultProjectId, defaultSectionId, defaultDate]);

  const projects = Object.values(snapshot.projects)
    .filter((p) => !p.is_archived && !p.is_deleted && !p.is_folder)
    .sort((a, b) => a.child_order - b.child_order);

  const sections = Object.values(snapshot.sections)
    .filter((s) => s.project_id === projectId && !s.is_archived && !s.is_deleted)
    .sort((a, b) => a.section_order - b.section_order);

  const tags = Object.values(snapshot.labels)
    .filter((l) => !l.is_deleted && !l.name.startsWith('est-'))
    .sort((a, b) => a.item_order - b.item_order);

  const parsed = parseShorthand(name, snapshot, naturalDates);

  async function submit() {
    const content = parsed.content;
    if (!content) return;

    const allLabels = [...new Set([...labels, ...parsed.labels])];
    if (minutes !== null) allLabels.push(estimateLabel(minutes));

    const targetProject = parsed.projectId ?? projectId ?? snapshot.user?.inbox_project_id;
    // What was typed into the name wins over the picker only when the picker
    // was left alone, so an explicit choice is never quietly overwritten.
    const dueDate = date || parsed.date;
    const pending = subtaskDraft.trim();
    const allSubtasks = pending ? [...subtasks, pending] : subtasks;

    await createTask({
      content,
      description: description.trim() || undefined,
      project_id: targetProject,
      section_id: sectionId || undefined,
      priority: toTodoistPriority(parsed.priority ?? priority),
      labels: allLabels,
      due: dueDate
        ? { date: dueDate, timezone: null, string: dueDate, lang: 'en', is_recurring: false }
        : undefined,
      deadline: deadline ? { date: deadline, lang: 'en' } : undefined,
      subtasks: allSubtasks,
    });

    onClose();
  }

  return (
    <Overlay open={open} onClose={onClose} label={t('nav.addTask')} size="sm">
      <div className="composerbox">
        <TaskNameField
          value={name}
          onChange={setName}
          onSubmit={() => void submit()}
          placeholder={t('composer.namePlaceholder')}
          ariaLabel={t('composer.name')}
          snapshot={snapshot}
          naturalDates={naturalDates}
        />

        <textarea
          className="composer-desc"
          placeholder={t('composer.descriptionPlaceholder')}
          aria-label={t('detail.description')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div className="composer-fields">
          <label className="cfield">
            <span>{t('composer.date')}</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>

          <label className="cfield">
            <span>{t('detail.deadline')}</span>
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </label>

          <label className="cfield">
            <span>{t('composer.project')}</span>
            <select
              value={projectId}
              onChange={(e) => { setProjectId(e.target.value); setSectionId(''); }}
            >
              <option value="">{t('nav.inbox')}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>

          {sections.length > 0 && (
            <label className="cfield">
              <span>{t('detail.section')}</span>
              <select value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
                <option value="">{t('group.noSection')}</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
          )}

          <label className="cfield">
            <span>{t('composer.priority')}</span>
            <select
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value) as DisplayPriority)}
            >
              {([1, 2, 3, 4] as const).map((p) => (
                <option key={p} value={p}>P{p}</option>
              ))}
            </select>
          </label>

          <span className="cfield">
            <span>{t('composer.duration')}</span>
            <EstimateField minutes={minutes} onCommit={setMinutes} />
          </span>
        </div>

        <div className="composer-tags">
          <button
            className="btn sm"
            aria-expanded={tagsOpen}
            onClick={() => setTagsOpen((v) => !v)}
          >
            <Icon name="tag" size="sm" />
            {t('composer.labels')}
            {labels.length > 0 && <span className="displaycount">{labels.length}</span>}
          </button>

          {labels.map((label) => {
            const known = tags.find((l) => l.name === label);
            return (
              <button
                key={label}
                className="pill"
                onClick={() => setLabels((prev) => prev.filter((l) => l !== label))}
              >
                <Icon name="tag" size="sm" className="taglabel" style={markerStyle(known?.color, false)} />
                {label}
                <Icon name="close" size="sm" />
              </button>
            );
          })}

          {tagsOpen && (
            <div className="popover tagpicker" role="dialog" aria-label={t('composer.labels')}>
              {tags.length === 0 && <p className="menuhint">{t('labels.none')}</p>}
              {tags.map((label) => (
                <label className="checkrow" key={label.id}>
                  <input
                    type="checkbox"
                    checked={labels.includes(label.name)}
                    onChange={() =>
                      setLabels((prev) =>
                        prev.includes(label.name)
                          ? prev.filter((l) => l !== label.name)
                          : [...prev, label.name],
                      )
                    }
                  />
                  <Icon name="tag" size="sm" className="taglabel" style={markerStyle(label.color, false)} />
                  <span>{label.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="composer-subs">
          <span className="fieldlabel">{t('detail.subtasks')}</span>
          {subtasks.map((content, index) => (
            <div className="composer-sub" key={`${content}-${index}`}>
              <span className="check p4" aria-hidden="true" />
              <span>{content}</span>
              <button
                className="iconbtn"
                aria-label={t('common.cancel')}
                onClick={() => setSubtasks((prev) => prev.filter((_, i) => i !== index))}
              >
                <Icon name="close" size="sm" />
              </button>
            </div>
          ))}
          <div className="composer-sub adding">
            <span className="check p4" aria-hidden="true" />
            <input
              value={subtaskDraft}
              placeholder={t('composer.subtaskPlaceholder')}
              aria-label={t('detail.addSubtask')}
              onChange={(e) => setSubtaskDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                e.stopPropagation();
                const value = subtaskDraft.trim();
                if (!value) return;
                setSubtasks((prev) => [...prev, value]);
                setSubtaskDraft('');
              }}
            />
          </div>
        </div>

        <div className="composer-actions">
          <button className="btn quiet" onClick={onClose}>{t('composer.cancel')}</button>
          <button className="btn primary" disabled={!name.trim()} onClick={() => void submit()}>
            {t('composer.add')}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

interface ParsedInput {
  content: string;
  projectId: string | null;
  priority: DisplayPriority | null;
  labels: string[];
  /** A date read out of the prose, when that pass is switched on. */
  date: string | null;
  dateText: string | null;
}

/**
 * Reads what the name is carrying.
 *
 * `#project`, `p1`..`p4` and `@tag` are syntax: the user typed them on
 * purpose, so they are always honoured. The date is a guess made from prose,
 * so it is the only part `naturalDates` can switch off.
 */
function parseShorthand(raw: string, snapshot: Snapshot, naturalDates: boolean): ParsedInput {
  let content = raw.trim();
  let projectId: string | null = null;
  let priority: DisplayPriority | null = null;
  const labels: string[] = [];
  let date: string | null = null;
  let dateText: string | null = null;

  const projectMatch = content.match(/#([\p{L}\p{N}_-]+)/u);
  if (projectMatch) {
    const name = projectMatch[1].toLowerCase();
    const project = Object.values(snapshot.projects).find(
      (p) => p.name.toLowerCase().replace(/\s+/g, '') === name.replace(/\s+/g, ''),
    );
    if (project) {
      projectId = project.id;
      content = content.replace(projectMatch[0], '').trim();
    }
  }

  const priorityMatch = content.match(/\bp([1-4])\b/i);
  if (priorityMatch) {
    priority = Number(priorityMatch[1]) as DisplayPriority;
    content = content.replace(priorityMatch[0], '').trim();
  }

  for (const match of content.matchAll(/@([\p{L}\p{N}_-]+)/gu)) labels.push(match[1]);
  content = content.replace(/@([\p{L}\p{N}_-]+)/gu, '').trim();

  if (naturalDates) {
    const reading = readNaturalDate(content);
    if (reading) {
      date = reading.date;
      dateText = reading.matched.trim();
      content = stripReading(content, reading);
    }
  }

  return {
    content: content.replace(/\s{2,}/g, ' ').trim(),
    projectId, priority, labels, date, dateText,
  };
}
