import { useState } from 'react';
import { Overlay } from './Overlay';
import { Icon } from '../Icon';
import { AccentChoice, DensityChoice, ThemeChoice } from '../Choosers';
import { useT } from '@/hooks/useT';
import { useStore } from '@/store/store';
import { markOnboarded } from '@/domain/onboarding';
import { WEEK_LAYOUTS, type WeekLayout } from '@/store/prefs';
import type { TranslationKey } from '@/i18n';

/**
 * The first run, once, per account.
 *
 * Four questions, all of which have a defensible answer already set, so this
 * is a tour that happens to be adjustable rather than a form standing between
 * somebody and their tasks. Every step can be left; nothing here has to be
 * answered for the app to work, and all four live in Settings afterwards.
 *
 * Each choice takes effect the moment it is made, on the app behind the
 * dialog as well as inside it. That is the whole argument for doing this at
 * all: a colour named in a list is a guess, and a colour applied to the page
 * you are about to use is an answer.
 *
 * Nothing is written until the end — or rather, the settings are written
 * immediately and the *record of having been asked* is written at the end, so
 * closing the window halfway through means being asked again rather than
 * silently never being asked.
 */

const STEPS = ['welcome', 'appearance', 'density', 'week'] as const;

export function Walkthrough({ open, onDone }: { open: boolean; onDone: () => void }) {
  const { t } = useT();
  const prefs = useStore((s) => s.prefs);
  const setPrefs = useStore((s) => s.setPrefs);
  const user = useStore((s) => s.snapshot.user);
  const [index, setIndex] = useState(0);

  const step = STEPS[index];
  const last = index === STEPS.length - 1;

  const finish = () => {
    markOnboarded(user?.id);
    onDone();
  };

  return (
    <Overlay
      open={open}
      /* The scrim and Escape both land here. Leaving early is leaving, not
         finishing: it is not recorded, so the next launch asks again. */
      onClose={onDone}
      label={t('walkthrough.title')}
      size="md"
    >
      <div className="walkthrough">
        <div className="wt-head">
          <span className="wt-steps" aria-hidden="true">
            {STEPS.map((id, at) => (
              <i key={id} className={at === index ? 'on' : at < index ? 'done' : undefined} />
            ))}
          </span>
          <button className="wt-skip" onClick={finish}>
            {t('walkthrough.skip')}
          </button>
        </div>

        <div className="wt-body">
          {step === 'welcome' && (
            <div className="wt-welcome">
              <span className="wt-mark" aria-hidden="true">
                <Icon name="week" />
              </span>
              <h2>{t('walkthrough.welcome')}</h2>
              <p>{t('walkthrough.welcomeBody')}</p>
            </div>
          )}

          {step === 'appearance' && (
            <>
              <h2>{t('walkthrough.appearance')}</h2>
              <p>{t('walkthrough.appearanceBody')}</p>
              <ThemeChoice
                value={prefs.theme}
                onChange={(value) => setPrefs({ theme: value })}
              />
              <AccentChoice
                value={prefs.accent}
                custom={prefs.accentCustom}
                onChange={(value) => setPrefs({ accent: value })}
                onCustom={(value) => setPrefs({ accent: 'custom', accentCustom: value })}
              />
            </>
          )}

          {step === 'density' && (
            <>
              <h2>{t('walkthrough.density')}</h2>
              <p>{t('walkthrough.densityBody')}</p>
              <DensityChoice
                value={prefs.density}
                onChange={(value) => setPrefs({ density: value })}
              />
            </>
          )}

          {step === 'week' && (
            <>
              <h2>{t('walkthrough.week')}</h2>
              <p>{t('walkthrough.weekBody')}</p>
              <WeekLayoutChoice
                value={prefs.weekLayout}
                onChange={(value) => setPrefs({ weekLayout: value })}
              />
            </>
          )}
        </div>

        <div className="wt-foot">
          <button
            className="btn outline"
            onClick={() => setIndex((at) => at - 1)}
            disabled={index === 0}
          >
            {t('walkthrough.back')}
          </button>
          <button
            className="btn primary"
            onClick={() => (last ? finish() : setIndex((at) => at + 1))}
          >
            {last ? t('walkthrough.done') : t('walkthrough.next')}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

/**
 * How the week is split, drawn as the sidebar it produces.
 *
 * The three options differ by which rows appear and what is inside them, which
 * is a sentence to explain and a glance to show: one page holding the week,
 * or two rows where the second either still contains today or does not.
 */
function WeekLayoutChoice({
  value, onChange,
}: { value: WeekLayout; onChange: (next: WeekLayout) => void }) {
  const { t } = useT();
  return (
    <div className="wkchoice" role="radiogroup" aria-label={t('settings.weekLayout')}>
      {WEEK_LAYOUTS.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          className={`wkcard${value === option ? ' selected' : ''}`}
          onClick={() => onChange(option)}
        >
          <span className="wkpreview" aria-hidden="true">
            {option !== 'unified' && (
              <span className="wkrow"><i className="wkdot" /><i className="wkbar short" /></span>
            )}
            <span className="wkrow on"><i className="wkdot" /><i className="wkbar" /></span>
            {/* The days the week row stands for. "splitWithToday" keeps today
                among them, which is the whole difference between the two
                split layouts and the only thing worth drawing. */}
            <span className="wkdays">
              {Array.from({ length: 7 }).map((_, day) => (
                <i
                  key={day}
                  className={day === 0 && option === 'split' ? 'out' : day === 0 ? 'today' : undefined}
                />
              ))}
            </span>
          </span>
          <span className="wklabel">
            {t(`settings.weekLayout.${option}` as TranslationKey)}
            {value === option && <Icon name="check" size="sm" />}
          </span>
        </button>
      ))}
    </div>
  );
}
