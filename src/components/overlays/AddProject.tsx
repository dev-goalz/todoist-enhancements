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

interface AddProjectProps {
  open: boolean;
  onClose: () => void;
  /**
   * The space the project starts in. The sidebar passes whichever section's
   * add button was pressed, so the new project lands where it was asked for.
   */
  workspaceId?: string | null;
}

/**
 * Creating a project: a name, a colour, and where it goes.
 *
 * The destination is a field like the others rather than a consequence of
 * which button opened the sheet, so it can be read before submitting and
 * changed without starting again.
 */
export function AddProject({ open, onClose, workspaceId = null }: AddProjectProps) {
  const { t } = useT();
  const createProject = useStore((s) => s.createProject);
  const snapshot = useStore((s) => s.snapshot);
  const [name, setName] = useState('');
  const [color, setColor] = useState('charcoal');
  const [destination, setDestination] = useState(workspaceId ?? PERSONAL);
  const [saving, setSaving] = useState(false);

  const workspaces = useMemo(
    () => Object.values(snapshot.workspaces).sort((a, b) => a.name.localeCompare(b.name)),
    [snapshot.workspaces],
  );

  /* Each opening starts clean, and starts in the space the caller named. */
  useEffect(() => {
    if (!open) return;
    setName('');
    setColor('charcoal');
    setDestination(workspaceId ?? PERSONAL);
    setSaving(false);
  }, [open, workspaceId]);

  const destinations = useMemo(
    () => [
      { value: PERSONAL, label: t('nav.myProjects') },
      ...workspaces.map((workspace) => ({ value: workspace.id, label: workspace.name })),
    ],
    [workspaces, t],
  );

  async function submit() {
    if (!name.trim() || saving) return;
    setSaving(true);
    await createProject(name.trim(), color, destination === PERSONAL ? null : destination);
    onClose();
  }

  return (
    <Overlay open={open} onClose={onClose} label={t('project.create')} size="sm">
      <div className="sheet-head">
        <h2>{t('project.create')}</h2>
        <button className="iconbtn" aria-label={t('common.close')} onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>

      <div className="sheet-body projectform">
        {/* The marker the sidebar will show, updating as the fields do. */}
        <div className="projectpreview">
          <span className="hash" style={markerStyle(color)}>#</span>
          <span className="projectpreview-name">{name.trim() || t('project.name')}</span>
          <span className="projectpreview-where">
            {destinations.find((d) => d.value === destination)?.label}
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

        {/* Only worth asking when there is somewhere else for it to go. */}
        {workspaces.length > 0 && (
          <div className="formfield">
            <Select
              label={t('project.destination')}
              value={destination}
              options={destinations}
              onChange={setDestination}
            />
          </div>
        )}
      </div>

      <div className="sheet-foot">
        <button className="btn quiet" onClick={onClose}>{t('common.cancel')}</button>
        <button
          className="btn primary"
          disabled={!name.trim() || saving}
          onClick={() => void submit()}
        >
          {t('project.createSubmit')}
        </button>
      </div>
    </Overlay>
  );
}
