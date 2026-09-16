import { useEffect, useState } from 'react';
import { Overlay } from './Overlay';
import { Icon } from '../Icon';
import { EstimateField } from '../EstimateField';
import { Select } from '../Select';
import { DateField } from '../DateField';
import { TaskNameField } from '../TaskNameField';
import { useT } from '@/hooks/useT';
import { useStore } from '@/store/store';
import { estimateLabel } from '@/domain/estimates';
import { markerStyle } from '@/domain/colors';
import { toTodoistPriority, type DisplayPriority } from '@/domain/types';
import {
  parseShorthand, type HighlightKind, type Shorthand, type TextRange,
} from '@/domain/shorthand';

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
  const [recurrence, setRecurrence] = useState<Shorthand['recurrence']>(null);
  const [deadline, setDeadline] = useState('');
  const [labels, setLabels] = useState<string[]>([]);
  const [minutes, setMinutes] = useState<number | null>(null);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [subtasks, setSubtasks] = useState<string[]>([]);
  const [subtaskDraft, setSubtaskDraft] = useState('');
  /** The readings of the name that have been turned down, by position in it. */
  const [refusals, setRefusals] = useState<TextRange[]>([]);

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
    setRefusals([]);
    setProjectId(defaultProjectId ?? snapshot.user?.inbox_project_id ?? '');
    setSectionId(defaultSectionId ?? '');
    setDate(defaultDate ?? '');
    setRecurrence(null);
    setDeadline('');
  }, [open, defaultProjectId, defaultSectionId, defaultDate, snapshot.user?.inbox_project_id]);

  const projects = Object.values(snapshot.projects)
    .filter((p) => !p.is_archived && !p.is_deleted && !p.is_folder)
    .sort((a, b) => a.child_order - b.child_order);

  const sections = Object.values(snapshot.sections)
    .filter((s) => s.project_id === projectId && !s.is_archived && !s.is_deleted)
    .sort((a, b) => a.section_order - b.section_order);

  const tags = Object.values(snapshot.labels)
    .filter((l) => !l.is_deleted && !l.name.startsWith('est-'))
    .sort((a, b) => a.item_order - b.item_order);

  const parsed = parseShorthand(name, snapshot, naturalDates, refusals);

  /* The default the project field falls back to, which is where a refused
     `#project` leaves it: the composer was opened on somewhere, and "nowhere"
     is not a project a task can be created in. */
  const fallbackProject = defaultProjectId ?? snapshot.user?.inbox_project_id ?? '';

  /**
   * A reading turned down takes its value back out of the field it filled.
   *
   * Without this the mark disappears from the name and the date, the project
   * or the repeat it had pushed down stays sitting in the form — the task
   * would still be created with the very thing that was just refused.
   */
  const unfill = (reading: HighlightKind, range: TextRange) => {
    if (reading === 'date') setDate(defaultDate ?? '');
    if (reading === 'recurrence') setRecurrence(null);
    if (reading === 'priority') setPriority(4);
    if (reading === 'duration') setMinutes(null);
    if (reading === 'project') { setProjectId(fallbackProject); setSectionId(''); }
    if (reading === 'label') {
      const tag = name.slice(range.start, range.end).replace(/^@/, '');
      setLabels((prev) => prev.filter((l) => l.toLowerCase() !== tag.toLowerCase()));
    }
  };

  /*
   * The fields below follow the name.
   *
   * They used to be two independent readings of the same task: typing
   * "Friday #Work p1" marked those words in the name and left the date, the
   * project and the priority pickers showing something else entirely, so the
   * dialog could be displaying two different tasks at once and only one of
   * them was going to be created. Now anything the name yields is pushed down
   * into the field that owns it, and the field is the single thing that is
   * saved. Each effect watches its own value, so a picker changed by hand
   * afterwards stays changed until the name says something new.
   */
  const { date: readDate, projectId: readProject, priority: readPriority,
    minutes: readMinutes, recurrence: readRepeat } = parsed;
  const readLabels = parsed.labels.join('\u0000');

  /*
   * Each of these also watches `refusals`, whose identity changes only when a
   * reading is turned down or taken back. Refusing one of two identical
   * readings is why: in "Weekly review weekly" the first is refused, the
   * second is then read, and the rule it yields is the same string as before —
   * so an effect watching the value alone would never fire, and the field
   * that the refusal had just emptied would stay empty while the name showed
   * the second word marked. The refusal empties the field; the effect fills it
   * again from whatever is still being read, and runs after it.
   */
  useEffect(() => { if (readDate) setDate(readDate); }, [readDate, refusals]);
  /* Depends on the rule's text, not on the object: the parser builds a new one
     on every keystroke and the effect would never stop firing. */
  useEffect(() => {
    if (readRepeat) setRecurrence(readRepeat);
  }, [readRepeat?.string, refusals]);
  useEffect(() => { if (readProject) setProjectId(readProject); }, [readProject, refusals]);
  useEffect(() => { if (readPriority) setPriority(readPriority); }, [readPriority, refusals]);
  useEffect(() => {
    if (readMinutes !== null) setMinutes(readMinutes);
  }, [readMinutes, refusals]);
  useEffect(() => {
    if (!readLabels) return;
    setLabels((prev) => [...new Set([...prev, ...readLabels.split('\u0000')])]);
  }, [readLabels, refusals]);

  async function submit() {
    const content = parsed.content;
    if (!content) return;

    const allLabels = [...labels];
    if (minutes !== null) allLabels.push(estimateLabel(minutes));

    /* `||`, not `??`: an unset picker is an empty string, not null, and an
       empty string sent as project_id is what Todoist answers "invalid
       argument value" to — which is a task that never gets created. */
    const targetProject = projectId || snapshot.user?.inbox_project_id;
    const dueDate = date;
    const repeat = recurrence;
    const pending = subtaskDraft.trim();
    const allSubtasks = pending ? [...subtasks, pending] : subtasks;

    await createTask({
      content,
      description: description.trim() || undefined,
      project_id: targetProject,
      section_id: sectionId || undefined,
      priority: toTodoistPriority(priority),
      labels: allLabels,
      /* A recurrence is sent as the rule and nothing else. Todoist resolves
         it, and a date sent alongside would pin the first occurrence to
         whatever this device worked out — which is the one number the app has
         no business computing. */
      due: repeat
        ? { string: repeat.string, lang: repeat.lang, is_recurring: true }
        : dueDate
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
          refusals={refusals}
          onRefusals={(next, change) => {
            setRefusals(next);
            if (change?.kind === 'refused') unfill(change.reading, change.range);
          }}
        />

        <textarea
          className="composer-desc"
          placeholder={t('composer.descriptionPlaceholder')}
          aria-label={t('detail.description')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div className="composer-fields">
          {/* A repeat answers the same question a date does, so it stands in
              the date's own slot rather than beside it — a task cannot be both
              on Tuesday and every Monday, and two fields offering to make it
              both is the contradiction, not the fix. */}
          <span className="cfield">
            <span className="fselect-label">
              {recurrence ? t('detail.recurring') : t('composer.date')}
            </span>
            {recurrence ? (
              <button
                type="button"
                className="crepeat"
                onClick={() => setRecurrence(null)}
                title={t('composer.clearRepeat')}
              >
                <Icon name="repeat" size="sm" />
                <span>{recurrence.string}</span>
                <Icon name="close" size="sm" />
              </button>
            ) : (
              <DateField value={date} onChange={setDate} label={t('composer.date')} />
            )}
          </span>

          <span className="cfield">
            <span className="fselect-label">{t('detail.deadline')}</span>
            <DateField value={deadline} onChange={setDeadline} label={t('detail.deadline')} />
          </span>

          {/* The Inbox is a project like any other and is already in this list.
              It used to be offered a second time above it, as an empty value,
              and that first one could not create anything. */}
          <span className="cfield">
            <Select
              label={t('composer.project')}
              value={projectId}
              ariaLabel={t('composer.project')}
              onChange={(next) => { setProjectId(next); setSectionId(''); }}
              options={projects.map((p) => ({
                value: p.id,
                label: p.inbox_project ? t('nav.inbox') : p.name,
                marker: p.color,
              }))}
            />
          </span>

          {sections.length > 0 && (
            <span className="cfield">
              <Select
                label={t('detail.section')}
                value={sectionId}
                ariaLabel={t('detail.section')}
                onChange={setSectionId}
                options={[
                  { value: '', label: t('group.noSection') },
                  ...sections.map((s) => ({ value: s.id, label: s.name })),
                ]}
              />
            </span>
          )}

          <span className="cfield">
            <Select
              label={t('composer.priority')}
              value={String(priority)}
              ariaLabel={t('composer.priority')}
              onChange={(next) => setPriority(Number(next) as DisplayPriority)}
              options={([1, 2, 3, 4] as const).map((p) => ({
                value: String(p),
                label: `P${p}`,
              }))}
            />
          </span>

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
            <div
              className="popover tagpicker"
              role="dialog"
              aria-label={t('composer.labels')}
              ref={(node) => node?.scrollIntoView({ block: 'nearest' })}
            >
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
