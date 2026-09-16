import { useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';
import { Select } from '@/components/Select';
import { useT } from '@/hooks/useT';
import { useStore } from '@/store/store';
import { avatarUrl } from '@/domain/colors';
import { formatDuration, parseDurationInput } from '@/domain/estimates';
import { defaultCapacity, weeklyCapacity, type DailyCapacity } from '@/domain/load';
import {
  DENSITIES, HOME_VIEWS, WEEK_LAYOUTS,
  type Density, type HomeView, type WeekLayout,
} from '@/store/prefs';
import { DEFAULT_WEEK_LABEL } from '@/domain/types';
import type { Locale, TranslationKey } from '@/i18n';
import { APP_NAME, AUTHOR, COFFEE_URL, GITHUB_URL, SITE_URL, VERSION } from '@/app-info';

const SECTIONS = ['account', 'general', 'week', 'conflicts', 'about'] as const;
type Section = (typeof SECTIONS)[number];

/**
 * Settings.
 *
 * One page that scrolls, rather than four that swap: every setting is
 * reachable by reading downwards, and the menu marks where you are instead of
 * deciding what you may see.
 */
export function SettingsView() {
  const { t, locale } = useT();
  const prefs = useStore((s) => s.prefs);
  const setPrefs = useStore((s) => s.setPrefs);
  const setLocale = useStore((s) => s.setLocale);
  const disconnect = useStore((s) => s.disconnect);
  const user = useStore((s) => s.snapshot.user);

  const current = useCurrentSection();
  const avatar = avatarUrl(user);
  const intl = locale === 'fr' ? 'fr-FR' : 'en-GB';

  /* Monday-first labels. 8 January 2024 was a Monday; the capacity array is
     indexed Sunday-first, so the two are mapped rather than assumed equal. */
  const dayNames = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(intl, { weekday: 'short' }).format(new Date(2024, 0, 8 + i)),
  );

  const setDayCapacity = (index: number, raw: string) => {
    const minutes = parseDurationInput(raw);
    if (minutes === null) return;
    const next = [...prefs.dailyCapacity] as DailyCapacity;
    next[index] = minutes;
    setPrefs({ dailyCapacity: next });
  };

  const toggle = (key: keyof typeof prefs.conflicts) =>
    setPrefs({ conflicts: { ...prefs.conflicts, [key]: !prefs.conflicts[key] } });

  const weekly = weeklyCapacity(prefs.dailyCapacity, prefs.weeklyCapacityOverride);

  return (
    <div className="page wide">
      <div className="phead">
        <div>
          <h1 className="ptitle">{t('settings.title')}</h1>
        </div>
      </div>

      <div className="settings">
        {/* The menu navigates the page rather than replacing it, so these are
            links to anchors — Back works, and a section can be shared. */}
        <nav className="setnav" aria-label={t('settings.sections')}>
          {SECTIONS.map((section) => (
            <a
              key={section}
              href={`#/settings#${section}`}
              aria-current={current === section}
              onClick={(event) => {
                event.preventDefault();
                document.getElementById(section)?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              {t(`settings.${section}` as TranslationKey)}
            </a>
          ))}
        </nav>

        <div className="setbody">
          {/* ---------------------------------------------------- Account */}
          <section className="setsection" id="account">
            <h2>{t('settings.account')}</h2>

            <div className="setrow account">
              <span className="setavatar">
                {avatar
                  ? <img src={avatar} alt="" width={56} height={56} referrerPolicy="no-referrer" />
                  : <span>{(user?.full_name ?? '?').slice(0, 1).toUpperCase()}</span>}
              </span>
              <div>
                <strong>{user?.full_name ?? '—'}</strong>
                <span>{user?.email ?? t('settings.connected')}</span>
              </div>
              <button className="btn outline" onClick={() => void disconnect()}>
                <Icon name="logout" size="sm" />
                {t('settings.disconnect')}
              </button>
            </div>
            <p className="sethint">{t('settings.disconnectHint')}</p>
          </section>

          {/* ---------------------------------------------------- General */}
          <section className="setsection" id="general">
            <h2>{t('settings.general')}</h2>

            <Row title={t('settings.language')} hint={t('settings.languageHint')}>
              <Select
                value={prefs.locale}
                onChange={(value) => setLocale(value as Locale)}
                ariaLabel={t('settings.language')}
                options={[
                  { value: 'en', label: 'English' },
                  { value: 'fr', label: 'Français' },
                ]}
              />
            </Row>

            <Row title={t('settings.homepage')} hint={t('settings.homepageHint')}>
              <Select
                value={prefs.homepage}
                onChange={(value) => setPrefs({ homepage: value as HomeView })}
                ariaLabel={t('settings.homepage')}
                options={HOME_VIEWS.map((view) => ({
                  value: view,
                  label: t(`nav.${view}` as TranslationKey),
                }))}
              />
            </Row>

            <Row title={t('settings.timeFormat')} hint={t('settings.timeFormatHint')}>
              <Select
                value={prefs.hour12 ? '12' : '24'}
                onChange={(value) => setPrefs({ hour12: value === '12' })}
                ariaLabel={t('settings.timeFormat')}
                options={[
                  { value: '24', label: t('settings.time24') },
                  { value: '12', label: t('settings.time12') },
                ]}
              />
            </Row>

            <Row title={t('settings.density')} hint={t('settings.densityHint')} wide>
              <DensityChoice
                value={prefs.density}
                onChange={(value) => setPrefs({ density: value })}
              />
            </Row>

            <Row title={t('settings.naturalDates')} hint={t('settings.naturalDatesHint')}>
              <Switch
                checked={prefs.naturalDates}
                onChange={() => setPrefs({ naturalDates: !prefs.naturalDates })}
                label={t('settings.naturalDates')}
              />
            </Row>

            {/* Read from the account, so it is stated rather than offered. */}
            <Row title={t('settings.weekStart')} hint={t('settings.weekStartHint')}>
              <span className="setvalue">{dayNames[((user?.start_day ?? 1) + 6) % 7]}</span>
            </Row>
          </section>

          {/* --------------------------------------------------- My week */}
          <section className="setsection" id="week">
            <h2>{t('settings.week')}</h2>

            <Row title={t('settings.perDayCapacity')} hint={t('settings.dailyCapacityHint')} />
            <div className="capgrid">
              {dayNames.map((name, index) => {
                // The array is indexed Sunday-first; the labels start on Monday.
                const dayIndex = (index + 1) % 7;
                return (
                  <label className="capday" key={name}>
                    <span>{name}</span>
                    <input
                      defaultValue={String(prefs.dailyCapacity[dayIndex])}
                      onBlur={(event) => setDayCapacity(dayIndex, event.target.value)}
                      aria-label={name}
                    />
                  </label>
                );
              })}
            </div>

            <Row title={t('settings.weeklySource')} hint={formatDuration(weekly, locale)}>
              <Select
                value={prefs.weeklyCapacityOverride === null ? 'days' : 'custom'}
                onChange={(value) =>
                  setPrefs({ weeklyCapacityOverride: value === 'days' ? null : weekly })}
                ariaLabel={t('settings.weeklySource')}
                options={[
                  { value: 'days', label: t('settings.weeklyFromDays') },
                  { value: 'custom', label: t('settings.weeklyCustom') },
                ]}
              />
            </Row>

            {prefs.weeklyCapacityOverride !== null && (
              <Row title={t('settings.weeklyValue')} hint={t('settings.weeklyOverride')}>
                <input
                  className="estinput"
                  defaultValue={String(prefs.weeklyCapacityOverride)}
                  onBlur={(event) => {
                    const minutes = parseDurationInput(event.target.value);
                    if (minutes !== null) setPrefs({ weeklyCapacityOverride: minutes });
                  }}
                  aria-label={t('settings.weeklyValue')}
                />
              </Row>
            )}

            <Row title={t('settings.weekLayout')} hint={t('settings.weekLayoutHint')}>
              <Select
                value={prefs.weekLayout}
                onChange={(value) => setPrefs({ weekLayout: value as WeekLayout })}
                ariaLabel={t('settings.weekLayout')}
                options={WEEK_LAYOUTS.map((layout) => ({
                  value: layout,
                  label: t(`settings.weekLayout.${layout}` as TranslationKey),
                }))}
              />
            </Row>

            {/* The tag is a name on the user's own board, not a setting this
                app invented, so it is typed rather than chosen from a list:
                the tag it should read may not exist here yet. */}
            <Row title={t('settings.weekLabel')} hint={t('settings.weekLabelHint')}>
              <input
                className="estinput"
                defaultValue={prefs.weekLabel}
                aria-label={t('settings.weekLabel')}
                onBlur={(event) => {
                  const next = event.target.value.trim().replace(/^@/, '');
                  setPrefs({ weekLabel: next || DEFAULT_WEEK_LABEL });
                  event.target.value = next || DEFAULT_WEEK_LABEL;
                }}
              />
            </Row>

            <Row title={t('settings.showQuick')} hint={t('settings.showQuickHint')}>
              <Switch
                checked={prefs.showQuickGroup}
                onChange={() => setPrefs({ showQuickGroup: !prefs.showQuickGroup })}
                label={t('settings.showQuick')}
              />
            </Row>

            <Row title={t('settings.capacityDefaults')} hint={t('settings.capacityDefaultsHint')}>
              <button
                className="btn"
                onClick={() =>
                  setPrefs({ dailyCapacity: defaultCapacity(), weeklyCapacityOverride: null })}
              >
                {t('settings.restore')}
              </button>
            </Row>
          </section>

          {/* ------------------------------------------------- Conflicts */}
          <section className="setsection" id="conflicts">
            <h2>{t('settings.conflicts')}</h2>
            {(
              [
                ['dateAndWeek', 'settings.conflictDateWeek', 'settings.conflictDateWeekHint'],
                ['multipleEstimates', 'settings.conflictMultiple', 'settings.conflictMultipleHint'],
                ['quickTooLong', 'settings.conflictQuick', 'settings.conflictQuickHint'],
                ['parentAndChildren', 'settings.conflictParent', 'settings.conflictParentHint'],
                ['invalidEstimate', 'settings.conflictInvalid', 'settings.conflictInvalidHint'],
              ] as const
            ).map(([key, title, hint]) => (
              <Row key={key} title={t(title)} hint={t(hint)}>
                <Switch
                  checked={prefs.conflicts[key]}
                  onChange={() => toggle(key)}
                  label={t(title)}
                />
              </Row>
            ))}
          </section>

          {/* Todoist asks a third-party app to say, in its description, that
              it is not one of theirs. The sign-in screen carries that line
              for anyone who has not connected yet; this carries it for
              everyone who has. */}
          <section className="setsection last" id="about">
            <h2>{t('settings.about')}</h2>
            <div className="setrow">
              <div>
                <strong>{APP_NAME}</strong>
                <span>{t('connect.version', { version: VERSION })}</span>
              </div>
            </div>
            <p className="setlegal">
              {t('connect.legal', { author: AUTHOR })}
            </p>
            <div className="setlinks">
              <a href={SITE_URL} target="_blank" rel="noreferrer noopener">
                <Icon name="external" size="sm" />
                {t('settings.aboutSite')}
              </a>
              <a href={GITHUB_URL} target="_blank" rel="noreferrer noopener">
                <Icon name="external" size="sm" />
                {t('settings.aboutCode')}
              </a>
              <a href={`${GITHUB_URL}/blob/main/CHANGELOG.md`} target="_blank" rel="noreferrer noopener">
                <Icon name="external" size="sm" />
                {t('settings.aboutChangelog')}
              </a>
              <a href={COFFEE_URL} target="_blank" rel="noreferrer noopener">
                <Icon name="external" size="sm" />
                {t('settings.aboutCoffee')}
              </a>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Row({
  title, hint, children, wide,
}: { title: string; hint?: string; children?: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`setrow${wide ? ' setrow-wide' : ''}`}>
      <div>
        <strong>{title}</strong>
        {hint && <span>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

/**
 * Choosing a density by looking at it.
 *
 * "Comfortable" and "compact" are words about a thing you can simply be shown:
 * two boxes of the same height, one holding three rows and the other holding
 * five. The picture is the explanation, and the label underneath is only there
 * to name what you already understood.
 */
function DensityChoice({
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

function Switch({
  checked, onChange, label,
}: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      className="switch"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
    />
  );
}

/**
 * Which section the reader is currently in.
 *
 * The last heading to have passed the top of the page wins. An observer band
 * was the first attempt and it has a hole in it: a section taller than the
 * band leaves no heading inside it, and the menu stops moving.
 */
function useCurrentSection(): Section {
  const [current, setCurrent] = useState<Section>(SECTIONS[0]);

  useEffect(() => {
    const scroller = document.querySelector('.screen.active') ?? window;

    const read = () => {
      let found: Section = SECTIONS[0];
      for (const section of SECTIONS) {
        const node = document.getElementById(section);
        if (node && node.getBoundingClientRect().top <= 140) found = section;
      }
      setCurrent(found);
    };

    read();
    scroller.addEventListener('scroll', read, { passive: true });
    window.addEventListener('resize', read);
    return () => {
      scroller.removeEventListener('scroll', read);
      window.removeEventListener('resize', read);
    };
  }, []);

  return current;
}
