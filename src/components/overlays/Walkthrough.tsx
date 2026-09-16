import { Overlay } from './Overlay';
import { Icon } from '../Icon';
import { AccentChoice, DensityChoice, ThemeChoice } from '../Choosers';
import { useT } from '@/hooks/useT';
import { useStore } from '@/store/store';
import { markOnboarded } from '@/domain/onboarding';

/**
 * The first run, once, per account.
 *
 * One page, three choices, all of which already have a defensible answer set —
 * so this is a greeting that happens to be adjustable rather than a form
 * standing between somebody and their tasks. Nothing here has to be answered
 * for the app to work, and all three live in Settings afterwards.
 *
 * They are on one page rather than three because they are one decision: what
 * the thing should look like. Paging through them made a four-click ceremony
 * out of a question you can answer by glancing at it, and the shape of the
 * week — which is about how you work rather than how it looks — did not belong
 * in a first run at all. It is in Settings, where it is found when it is
 * wanted rather than asked before anyone knows what it means.
 *
 * Each choice takes effect the moment it is made, on the app behind the
 * dialog as well as inside it. That is the whole argument for doing this at
 * all: a colour named in a list is a guess, and a colour applied to the page
 * you are about to use is an answer.
 *
 * The settings are written immediately; the *record of having been asked* is
 * written by Start or by Skip. Closing the window means being asked again
 * rather than silently never being asked.
 */

export function Walkthrough({
  open, onDone, onTour,
}: { open: boolean; onDone: () => void; onTour: () => void }) {
  const { t } = useT();
  const prefs = useStore((s) => s.prefs);
  const setPrefs = useStore((s) => s.setPrefs);
  const user = useStore((s) => s.snapshot.user);

  /* Finishing records the account and hands over to the tour. Skipping records
     it too and stops there: somebody who skipped the setup did not ask to be
     shown round either. */
  const finish = (tour: boolean) => {
    markOnboarded(user?.id);
    if (tour) onTour();
    else onDone();
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
          <span className="wt-mark" aria-hidden="true">
            <Icon name="week" />
          </span>
          <div>
            <h2>{t('walkthrough.welcome')}</h2>
            <p>{t('walkthrough.welcomeBody')}</p>
          </div>
          <button className="wt-skip" onClick={() => finish(false)}>
            {t('walkthrough.skip')}
          </button>
        </div>

        <div className="wt-body">
          <section>
            <h3>{t('settings.theme')}</h3>
            <ThemeChoice
              value={prefs.theme}
              onChange={(value) => setPrefs({ theme: value })}
            />
          </section>

          <section>
            <h3>{t('settings.accent')}</h3>
            <AccentChoice
              value={prefs.accent}
              custom={prefs.accentCustom}
              onChange={(value) => setPrefs({ accent: value })}
              onCustom={(value) => setPrefs({ accent: 'custom', accentCustom: value })}
            />
          </section>

          <section>
            <h3>{t('settings.density')}</h3>
            <DensityChoice
              value={prefs.density}
              onChange={(value) => setPrefs({ density: value })}
            />
          </section>
        </div>

        <div className="wt-foot">
          <button className="btn primary" onClick={() => finish(true)}>
            {t('walkthrough.done')}
          </button>
        </div>
      </div>
    </Overlay>
  );
}
