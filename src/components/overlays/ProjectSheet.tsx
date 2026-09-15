import { useEffect, useMemo, useState } from 'react';
import { Overlay } from './Overlay';
import { Icon } from '../Icon';
import { Select } from '../Select';
import { useT } from '@/hooks/useT';
import { useStore } from '@/store/store';
import { colorValue, markerStyle } from '@/domain/colors';
import type { TranslationKey } from '@/i18n';

/** Todoist's own project palette, in Todoist's own order. */
const CHOICES = [
  'berry_red', 'red', 'orange', 'yellow', 'olive_green', 'lime_green',
  'green', 'mint_green', 'teal', 'sky_blue', 'light_blue', 'blue',
  'grape', 'violet', 'lavender', 'magenta', 'salmon', 'charcoal',
];

/** The value the destination select uses for the personal space. */
const PERSONAL = 'personal';

/**
 * What the sheet was opened to do.
 *
 * Creating and editing ask for the same three things, so they are one sheet
 * rather than two that drift. `anchor` is what "add project above" means once
 * it reaches the store: a position among the siblings.
 */
export type ProjectSheetTarget =
  | { mode: 'create'; workspaceId: string | null; anchor?: { siblingId: string; position: 'above' | 'below' } }
  | { mode: 'edit'; projectId: string }
  | null;

interface ProjectSheetProps {
  target: ProjectSheetTarget;
  onClose: () => void;
}

/**
 * Creating a project, and changing one: a name, a colour, a description, and
 * where it goes.
 *
 * The destination is a field like the others rather than a consequence of
 * which button opened the sheet, so it can be read before submitting and
 * changed without starting again.
 */
export function ProjectSheet({ target, onClose }: ProjectSheetProps) {
  const { t } = useT();
  const createProject = useStore((s) => s.createProject);
  const updateProjectFields = useStore((s) => s.updateProjectFields);
  const snapshot = useStore((s) => s.snapshot);

  const editing = target?.mode === 'edit' ? snapshot.projects[target.projectId] : undefined;

  const [name, setName] = useState('');
  const [color, setColor] = useState('charcoal');
  const [description, setDescription] = useState('');
  const [favourite, setFavourite] = useState(false);
  const [destination, setDestination] = useState(PERSONAL);
  const [saving, setSaving] = useState(false);

  const workspaces = useMemo(
    () => Object.values(snapshot.workspaces).sort((a, b) => a.name.localeCompare(b.name)),
    [snapshot.workspaces],
  );

  /* Each opening starts from the project it was opened on, or from nothing. */
  useEffect(() => {
    if (!target) return;
    setSaving(false);
    if (target.mode === 'edit') {
      const project = snapshot.projects[target.projectId];
      setName(project?.name ?? '');
      setColor(project?.color ?? 'charcoal');
      setDescription(project?.description ?? '');
      setFavourite(project?.is_favorite ?? false);
      setDestination(project?.workspace_id ?? PERSONAL);
      return;
    }
    setName('');
    setColor('charcoal');
    setDescription('');
    setFavourite(false);
    setDestination(target.workspaceId ?? PERSONAL);
    // Reading the project once, on opening, is the point: later edits are ours.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const destinations = useMemo(
    () => [
      { value: PERSONAL, label: t('nav.myProjects') },
      ...workspaces.map((workspace) => ({ value: workspace.id, label: workspace.name })),
    ],
    [workspaces, t],
  );

  async function submit() {
    if (!name.trim() || saving || !target) return;
    setSaving(true);

    if (target.mode === 'edit') {
      await updateProjectFields(target.projectId, {
        name: name.trim(),
        color,
        description,
        is_favorite: favourite,
      });
    } else {
      await createProject(
        name.trim(),
        color,
        destination === PERSONAL ? null : destination,
        target.anchor ?? null,
        { description, favourite },
      );
    }
    onClose();
  }

  const isEdit = target?.mode === 'edit';

  return (
    <Overlay
      open={target !== null}
      onClose={onClose}
      label={isEdit ? t('project.edit') : t('project.create')}
      size="sm"
    >
      <div className="sheet-head">
        <h2>{isEdit ? t('project.edit') : t('project.create')}</h2>
        <button className="iconbtn" aria-label={t('common.close')} onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>

      <div className="sheet-body projectform">
        {/* The marker the sidebar will show, updating as the fields do. */}
        <div className="projectpreview">
          <span className="hash" style={markerStyle(color)}>#</span>
          <span className="projectpreview-name">{name.trim() || t('project.name')}</span>
          {favourite && (
            <Icon name="star" size="sm" className="projectpreview-star" />
          )}
          <span className="projectpreview-where">
            {isEdit
              ? (editing?.workspace_id
                  ? snapshot.workspaces[editing.workspace_id]?.name
                  : t('nav.myProjects'))
              : destinations.find((d) => d.value === destination)?.label}
          </span>
        </div>

        <div className="formfield">
          <label className="fieldlabel" htmlFor="project-name">{t('project.name')}</label>
          <input
            id="project-name"
            className="textfield"
            data-autofocus
            value={name}
            placeholder={t('project.namePlaceholder')}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }}
          />
        </div>

        <div className="formfield">
          <label className="fieldlabel" htmlFor="project-description">
            {t('project.description')}
          </label>
          <textarea
            id="project-description"
            className="textfield textarea"
            rows={2}
            value={description}
            placeholder={t('project.descriptionPlaceholder')}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="formfield">
          <span className="fieldlabel" id="project-colour">{t('project.colour')}</span>
          <div className="swatches" role="radiogroup" aria-labelledby="project-colour">
            {CHOICES.map((choice) => (
              <button
                key={choice}
                type="button"
                role="radio"
                className={`swatch${color === choice ? ' selected' : ''}`}
                style={{ '--swatch': colorValue(choice) } as React.CSSProperties}
                aria-label={t(`colour.${choice}` as TranslationKey)}
                title={t(`colour.${choice}` as TranslationKey)}
                aria-checked={color === choice}
                onClick={() => setColor(choice)}
              >
                {color === choice && <Icon name="check" size="sm" />}
              </button>
            ))}
          </div>
        </div>

        {/* Only worth asking when there is somewhere else for it to go, and
            never when the project is already somewhere: moving between
            workspaces is a different act from editing one. */}
        {!isEdit && workspaces.length > 0 && (
          <div className="formfield">
            <Select
              label={t('project.destination')}
              value={destination}
              options={destinations}
              onChange={setDestination}
            />
          </div>
        )}

        {/* A new project can be a favourite from the start, the same as an
            existing one. There was no reason for the two to differ. */}
        <button
          type="button"
          className={`favtoggle${favourite ? ' on' : ''}`}
          aria-pressed={favourite}
          onClick={() => setFavourite((v) => !v)}
        >
          <Icon name="star" size="sm" />
          <span>{t('project.favourite')}</span>
        </button>
      </div>

      <div className="sheet-foot">
        <button className="btn quiet" onClick={onClose}>{t('common.cancel')}</button>
        <button
          className="btn primary"
          disabled={!name.trim() || saving}
          onClick={() => void submit()}
        >
          {isEdit ? t('project.save') : t('project.createSubmit')}
        </button>
      </div>
    </Overlay>
  );
}
