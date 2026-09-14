import { useState } from 'react';
import { useT } from '@/hooks/useT';
import { useStore } from '@/store/store';
import { formatDuration, parseDurationInput } from '@/domain/estimates';
import { weeklyCapacity, type DailyCapacity } from '@/domain/load';
import type { Locale } from '@/i18n';

type Panel = 'account' | 'general' | 'week' | 'conflicts';

export function SettingsView() {
  const { t, locale } = useT();
  const prefs = useStore((s) => s.prefs);
  const setPrefs = useStore((s) => s.setPrefs);
  const setLocale = useStore((s) => s.setLocale);
  const disconnect = useStore((s) => s.disconnect);
  const user = useStore((s) => s.snapshot.user);
  const [panel, setPanel] = useState<Panel>('account');

  const dayNames = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', { weekday: 'short' })
      .format(new Date(2024, 0, 7 + i)),
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

  return (
    <div className="page wide">
      <div className="phead">
        <div>
          <h1 className="ptitle">{t('settings.title')}</h1>
          <p className="psub">{t('settings.subtitle')}</p>
        </div>
      </div>

      <div className="settings">
        <nav className="setnav">
          {(['account', 'general', 'week', 'conflicts'] as const).map((value) => (
            <button
              key={value}
              aria-current={panel === value}
              onClick={() => setPanel(value)}
            >
              {t(`settings.${value}`)}
            </button>
          ))}
        </nav>

        <div>
          {panel === 'account' && (
            <section className="setsection">
              <h2>{t('settings.account')}</h2>
              <div className="setrow">
                <div>
                  <strong>{user?.full_name ?? '—'}</strong>
                  <span>{user?.email ?? ''} · {t('settings.connected')}</span>
                </div>
                <button className="btn" onClick={() => void disconnect()}>
                  {t('settings.disconnect')}
                </button>
              </div>
              <p className="psub">{t('settings.disconnectHint')}</p>
            </section>
          )}

          {panel === 'general' && (
            <section className="setsection">
              <h2>{t('settings.general')}</h2>
              <div className="setrow">
                <div>
                  <strong>{t('settings.language')}</strong>
                  <span>{t('settings.languageHint')}</span>
                </div>
                <select
                  className="btn"
                  value={prefs.locale}
                  onChange={(e) => setLocale(e.target.value as Locale)}
                >
                  <option value="en">English</option>
                  <option value="fr">Français</option>
                </select>
              </div>

              <div className="setrow">
                <div>
                  <strong>{t('settings.timeFormat')}</strong>
                  <span>{t('settings.timeFormatHint')}</span>
                </div>
                <select
                  className="btn"
                  value={prefs.hour12 ? '12' : '24'}
                  onChange={(e) => setPrefs({ hour12: e.target.value === '12' })}
                >
                  <option value="24">{t('settings.time24')}</option>
                  <option value="12">{t('settings.time12')}</option>
                </select>
              </div>

              <div className="setrow">
                <div>
                  <strong>{t('settings.weekStart')}</strong>
                  <span>{t('settings.weekStartHint')}</span>
                </div>
                <span className="psub">
                  {dayNames[((user?.start_day ?? 1) % 7)]}
                </span>
              </div>
            </section>
          )}

          {panel === 'week' && (
            <section className="setsection">
              <h2>{t('settings.week')}</h2>

              <div className="setrow">
                <div>
                  <strong>{t('settings.perDayCapacity')}</strong>
                  <span>{t('settings.dailyCapacityHint')}</span>
                </div>
              </div>
              <div className="capgrid">
                {dayNames.map((name, index) => {
                  // The array is indexed Sunday-first; the labels start on Monday.
                  const dayIndex = (index + 1) % 7;
                  return (
                    <label className="capday" key={name}>
                      <span>{name}</span>
                      <input
                        defaultValue={String(prefs.dailyCapacity[dayIndex])}
                        onBlur={(e) => setDayCapacity(dayIndex, e.target.value)}
                        aria-label={name}
                      />
                    </label>
                  );
                })}
              </div>

              <div className="setrow" style={{ marginTop: 'var(--s4)' }}>
                <div>
                  <strong>{t('settings.weeklyCapacity')}</strong>
                  <span>
                    {prefs.weeklyCapacityOverride === null
                      ? t('settings.weeklyCapacityAuto')
                      : t('settings.weeklyOverride')}
                  </span>
                </div>
                <span className="psub">
                  {formatDuration(
                    weeklyCapacity(prefs.dailyCapacity, prefs.weeklyCapacityOverride),
                    locale,
                  )}
                </span>
              </div>

              <div className="setrow">
                <div>
                  <strong>{t('settings.showQuick')}</strong>
                  <span>{t('settings.showQuickHint')}</span>
                </div>
                <span
                  className="switch"
                  role="switch"
                  tabIndex={0}
                  aria-checked={prefs.showQuickGroup}
                  onClick={() => setPrefs({ showQuickGroup: !prefs.showQuickGroup })}
                />
              </div>
            </section>
          )}

          {panel === 'conflicts' && (
            <section className="setsection" style={{ borderBottom: 0 }}>
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
                <div className="setrow" key={key}>
                  <div>
                    <strong>{t(title)}</strong>
                    <span>{t(hint)}</span>
                  </div>
                  <span
                    className="switch"
                    role="switch"
                    tabIndex={0}
                    aria-checked={prefs.conflicts[key]}
                    onClick={() => toggle(key)}
                  />
                </div>
              ))}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
