import { useState } from 'react';
import { Overlay } from './Overlay';
import { useT } from '@/hooks/useT';
import { useStore } from '@/store/store';
import { parseDurationInput, estimateLabel } from '@/domain/estimates';
import { toTodoistPriority, type DisplayPriority } from '@/domain/types';

interface ComposerProps {
  open: boolean;
  onClose: () => void;
  /** Where a task lands when the current page implies a project. */
  defaultProjectId?: string;
}

/**
 * Adding a task.
 *
 * The text is read for a project, a priority and tags, exactly as the spec
 * asks. Dates are deliberately left to Todoist's own parsing on the server
 * side, so nothing here competes with it.
 */
export function Composer({ open, onClose, defaultProjectId }: ComposerProps) {
  const { t } = useT();
  const snapshot = useStore((s) => s.snapshot);
  const createTask = useStore((s) => s.createTask);

  const [text, setText] = useState('');
  const [estimate, setEstimate] = useState('');
  const [projectId, setProjectId] = useState(defaultProjectId ?? '');
  const [priority, setPriority] = useState<DisplayPriority>(4);

  function reset() {
    setText('');
    setEstimate('');
    setPriority(4);
  }

  async function submit() {
    const parsed = parse(text, snapshot);
    if (!parsed.content) return;

    const labels = [...parsed.labels];
    const minutes = parseDurationInput(estimate);
    if (minutes !== null) labels.push(estimateLabel(minutes));

    await createTask({
      content: parsed.content,
      project_id: parsed.projectId ?? projectId ?? snapshot.user?.inbox_project_id,
      priority: toTodoistPriority(parsed.priority ?? priority),
      labels,
      auto_parse_labels: true,
    });

    reset();
    onClose();
  }

  const projects = Object.values(snapshot.projects)
    .filter((p) => !p.is_archived && !p.is_deleted)
    .sort((a, b) => a.child_order - b.child_order);

  return (
    <Overlay open={open} onClose={onClose} label={t('nav.addTask')} size="sm">
      <textarea
        className="composer"
        placeholder={t('composer.placeholder')}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void submit();
          }
        }}
      />
      <div className="composer-tools">
        <div className="tool-chips">
          <select
            className="btn"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            aria-label={t('composer.project')}
          >
            <option value="">{t('nav.inbox')}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <select
            className="btn"
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value) as DisplayPriority)}
            aria-label={t('composer.priority')}
          >
            {([1, 2, 3, 4] as const).map((p) => (
              <option key={p} value={p}>P{p}</option>
            ))}
          </select>

          <input
            className="estinput"
            placeholder={t('task.estimatePlaceholder')}
            value={estimate}
            onChange={(e) => setEstimate(e.target.value)}
            aria-label={t('composer.duration')}
          />
        </div>

        <div className="composer-actions">
          <button className="btn quiet" onClick={onClose}>{t('composer.cancel')}</button>
          <button className="btn primary" onClick={() => void submit()}>{t('composer.add')}</button>
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
}

/** Reads `#project`, `p1`..`p4` and `@tag` out of what the user typed. */
function parse(
  raw: string,
  snapshot: ReturnType<typeof useStore.getState>['snapshot'],
): ParsedInput {
  let content = raw.trim();
  let projectId: string | null = null;
  let priority: DisplayPriority | null = null;
  const labels: string[] = [];

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

  for (const match of content.matchAll(/@([\p{L}\p{N}_-]+)/gu)) {
    labels.push(match[1]);
  }
  content = content.replace(/@([\p{L}\p{N}_-]+)/gu, '').trim();

  return { content: content.replace(/\s{2,}/g, ' ').trim(), projectId, priority, labels };
}
