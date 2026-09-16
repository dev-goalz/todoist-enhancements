import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { useT } from '@/hooks/useT';
import {
  ACCENTS, DENSITIES, THEMES, isHexColour,
  type Accent, type Density, type Theme,
} from '@/store/prefs';
import { accentFamily, hexToHsl } from '@/domain/accent';
import type { TranslationKey } from '@/i18n';

/**
 * The settings you can be shown rather than told.
 *
 * Appearance, colour and density are choices about how the product looks, and
 * a word for each explains less than one picture does. They live here rather
 * than inside SettingsView because the first run asks the same questions, and
 * asking them with a second set of components is how two answers to the same
 * question drift into disagreeing.
 */

/**
 * Light, dark, or the device's, shown rather than named.
 *
 * The same argument as density: three words describing something you can
 * simply be shown. Each card is a page in that scheme — a title, a rule, two
 * rows — and the one that follows the device is drawn as both at once, split
 * down the middle, because that is exactly what it does.
 */
export function ThemeChoice({
  value, onChange,
}: { value: Theme; onChange: (next: Theme) => void }) {
  const { t } = useT();
  return (
    <div className="themechoice" role="radiogroup" aria-label={t('settings.theme')}>
      {THEMES.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          className={`themecard${value === option ? ' selected' : ''}`}
          onClick={() => onChange(option)}
        >
          <span className={`themepreview ${option}`} aria-hidden="true">
            {/* Two halves for "system"; the other two draw the same half
                twice, so all three cards are built the same way. */}
            <span className="themehalf light">
              <i className="themebar" />
              <i className="themeline" />
              <i className="themeline short" />
            </span>
            <span className="themehalf dark">
              <i className="themebar" />
              <i className="themeline" />
              <i className="themeline short" />
            </span>
          </span>
          <span className="themelabel">
            {t(`settings.theme.${option}` as TranslationKey)}
            {value === option && <Icon name="check" size="sm" />}
          </span>
        </button>
      ))}
    </div>
  );
}

/**
 * The accent, shown rather than named.
 *
 * A row of colour names asks you to imagine the app; each card here is the
 * app, in miniature — a task line with its checkbox, its count chip and the
 * one solid button the colour actually lands on. The card carries its own
 * `data-accent`, so what it draws is literally what choosing it would draw,
 * in whichever scheme the page is currently wearing.
 *
 * The last card is the same picture driven by a colour you pick. It shows the
 * family the app derives rather than the colour you handed it, which is the
 * honest thing to show: the derived ink is what you will be reading.
 */
export function AccentChoice({
  value, custom, onChange, onCustom,
}: {
  value: Accent;
  custom: string;
  onChange: (next: Accent) => void;
  onCustom: (next: string) => void;
}) {
  const { t } = useT();
  const [typed, setTyped] = useState(custom);

  // The stored colour wins whenever it changes under us — another device, or
  // the native picker, which fires continuously while it is open.
  useEffect(() => { setTyped(custom); }, [custom]);

  const commitTyped = (raw: string) => {
    const withHash = raw.startsWith('#') ? raw : `#${raw}`;
    if (isHexColour(withHash)) onCustom(withHash.toLowerCase());
    else setTyped(custom);
  };

  return (
    <div className="accentchoice" role="radiogroup" aria-label={t('settings.accent')}>
      {ACCENTS.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          aria-label={t(`settings.accent.${option}` as TranslationKey)}
          className={`accentcard${value === option ? ' selected' : ''}`}
          data-accent={option}
          onClick={() => onChange(option)}
        >
          <AccentPreview />
          <span className="accentlabel">
            {t(`settings.accent.${option}` as TranslationKey)}
            {value === option && <Icon name="check" size="sm" />}
          </span>
        </button>
      ))}

      {/* Not a radio: it holds two controls of its own, and a radio wrapping
          a text field is a keyboard trap. Selecting it is what the swatch and
          the field already do. */}
      <div
        className={`accentcard custom${value === 'custom' ? ' selected' : ''}`}
        data-accent={value === 'custom' ? undefined : 'custom-preview'}
        style={value === 'custom' ? undefined : customPreviewStyle(custom)}
      >
        <AccentPreview />
        <span className="accentlabel">
          {t('settings.accent.custom')}
          {value === 'custom' && <Icon name="check" size="sm" />}
        </span>
        <span className="accentpicker">
          <input
            type="color"
            value={isHexColour(custom) ? custom : '#d1453b'}
            aria-label={t('settings.accent.customPick')}
            onChange={(event) => onCustom(event.target.value.toLowerCase())}
          />
          <input
            className="accenthex"
            value={typed}
            spellCheck={false}
            aria-label={t('settings.accent.customHex')}
            onChange={(event) => setTyped(event.target.value)}
            onBlur={(event) => commitTyped(event.target.value.trim())}
            onKeyDown={(event) => {
              if (event.key === 'Enter') { event.preventDefault(); commitTyped(typed.trim()); }
              if (event.key === 'Escape') setTyped(custom);
            }}
          />
        </span>
      </div>
    </div>
  );
}

/** One miniature of the product, drawn entirely from the accent tokens. */
function AccentPreview() {
  return (
    <span className="accentpreview" aria-hidden="true">
      <span className="accentrow">
        <i className="accentcheck" />
        <i className="accentbar" />
        <i className="accentflag" />
      </span>
      <span className="accentrow">
        <i className="accentcheck quiet" />
        <i className="accentbar short" />
      </span>
      <i className="accentbtn" />
    </span>
  );
}

/**
 * The custom card while some other accent is selected.
 *
 * It still has to show its own colour, and it cannot get it from a
 * `data-accent` block the way the presets do, because it is not in the
 * stylesheet. So the family is computed and written onto the card itself —
 * the same values, by the same recipe, reaching only this one element.
 */
function customPreviewStyle(custom: string): React.CSSProperties | undefined {
  if (!hexToHsl(custom)) return undefined;
  const scheme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  return Object.fromEntries(
    Object.entries(accentFamily(custom, scheme)).map(([k, v]) => [`--${k}`, v]),
  ) as React.CSSProperties;
}

/**
 * Choosing a density by looking at it.
 *
 * "Comfortable" and "compact" are words about a thing you can simply be shown:
 * two boxes of the same height, one holding three rows and the other holding
 * five. The picture is the explanation, and the label underneath is only there
 * to name what you already understood.
 */
export function DensityChoice({
  value, onChange,
}: { value: Density; onChange: (next: Density) => void }) {
  const { t } = useT();
  return (
    <div className="denschoice" role="radiogroup" aria-label={t('settings.density')}>
      {DENSITIES.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          className={`denscard${value === option ? ' selected' : ''}`}
          onClick={() => onChange(option)}
        >
          <span className={`denspreview ${option}`} aria-hidden="true">
            {/* Comfortable fits three of these rows in the box; compact fits
                five. Nothing about a row is smaller — there is just less air. */}
            {Array.from({ length: option === 'compact' ? 5 : 3 }).map((_, index) => (
              <span className="densrow" key={index}>
                <i className="densdot" />
                <i className="densbar" />
              </span>
            ))}
          </span>
          <span className="denslabel">
            {t(`settings.density.${option}` as TranslationKey)}
            {value === option && <Icon name="check" size="sm" />}
          </span>
        </button>
      ))}
    </div>
  );
}
