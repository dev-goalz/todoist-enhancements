import { useState } from 'react';
import { Overlay } from './Overlay';
import { useT } from '@/hooks/useT';
import { useStore } from '@/store/store';
import { colorValue } from '@/domain/colors';

const CHOICES = [
  'berry_red', 'red', 'orange', 'yellow', 'olive_green', 'lime_green',
  'green', 'mint_green', 'teal', 'sky_blue', 'light_blue', 'blue',
  'grape', 'violet', 'lavender', 'magenta', 'salmon', 'charcoal',
];

export function AddProject({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useT();
  const createProject = useStore((s) => s.createProject);
  const [name, setName] = useState('');
  const [color, setColor] = useState('charcoal');

  async function submit() {
    if (!name.trim()) return;
    await createProject(name.trim(), color);
    setName('');
    onClose();
  }

  return (
    <Overlay open={open} onClose={onClose} label={t('project.create')} size="sm">
      <div className="sheet-head">
        <h2>{t('project.create')}</h2>
      </div>
      <div className="sheet-body">
        <label className="fieldlabel" htmlFor="project-name">{t('project.name')}</label>
        <input
          id="project-name"
          className="textfield"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }}
        />

        <span className="fieldlabel" style={{ marginTop: 'var(--s4)' }}>{t('project.colour')}</span>
        <div className="swatches">
          {CHOICES.map((choice) => (
            <button
              key={choice}
              className={`swatch${color === choice ? ' selected' : ''}`}
              style={{ background: colorValue(choice) }}
              aria-label={choice}
              aria-pressed={color === choice}
              onClick={() => setColor(choice)}
            />
          ))}
        </div>

        <div className="connect-actions" style={{ justifyContent: 'flex-end' }}>
          <button className="btn quiet" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn primary" disabled={!name.trim()} onClick={() => void submit()}>
            {t('project.createSubmit')}
          </button>
        </div>
      </div>
    </Overlay>
  );
}
