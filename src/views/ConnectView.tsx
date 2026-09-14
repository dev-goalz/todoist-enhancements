import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { useT } from '@/hooks/useT';
import { useStore } from '@/store/store';
import { looksLikeToken } from '@/api/auth';

const GITHUB_URL = 'https://github.com/julesvbertolino/todoist-enhancements';
const TODOIST_DEVELOPER_URL = 'https://app.todoist.com/app/settings/integrations/developer';
const AUTHOR = 'julesbertolino';
const VERSION = '1.0';

/**
 * The first screen: connecting the account.
 *
 * The token is entered by the user and stays on the device. Nothing is sent
 * anywhere except to Todoist itself, which is why the privacy note sits
 * between the field and the button rather than in a footnote nobody reads.
 */
export function ConnectView() {
  const { t } = useT();
  const connect = useStore((s) => s.connect);
  const startDemo = useStore((s) => s.startDemo);
  const setLocale = useStore((s) => s.setLocale);
  const locale = useStore((s) => s.prefs.locale);

  const [token, setToken] = useState('');
  const [status, setStatus] = useState<'idle' | 'checking' | 'invalid' | 'malformed'>('idle');

  async function submit() {
    if (!looksLikeToken(token)) {
      setStatus('malformed');
      return;
    }
    setStatus('checking');
    const ok = await connect(token);
    if (!ok) setStatus('invalid');
  }

  const legal = t('connect.legal', { author: AUTHOR }).split(AUTHOR);

  return (
    <div className="connect">
      <div className="connect-card">
        <div className="connect-head">
          <h1>{t('connect.appName')}</h1>
          <span className="connect-version">{t('connect.version', { version: VERSION })}</span>
        </div>
        <p className="connect-intro">{t('connect.intro')}</p>

        <label className="sr" htmlFor="token">{t('connect.tokenLabel')}</label>
        <input
          id="token"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder={t('connect.tokenPlaceholder')}
          value={token}
          onChange={(e) => { setToken(e.target.value); setStatus('idle'); }}
          onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }}
        />

        {status === 'invalid' && <p className="connect-error">{t('connect.invalid')}</p>}
        {status === 'malformed' && <p className="connect-error">{t('connect.malformed')}</p>}

        <p className="connect-privacy">
          <strong>{t('connect.privacyLead')}</strong>{' '}
          {t('connect.privacyBody')}{' '}
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
            <Icon name="external" size="sm" />
            {t('connect.github')}
          </a>
        </p>

        <button
          className="btn primary lg connect-submit"
          disabled={status === 'checking'}
          onClick={() => void submit()}
        >
          {status === 'checking' ? t('connect.checking') : t('connect.submit')}
        </button>

        <button className="btn tint lg connect-demo" onClick={startDemo}>
          <Icon name="bars" size="sm" />
          {t('connect.demoInstead')}
        </button>

        <a
          className="connect-apikey"
          href={TODOIST_DEVELOPER_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('connect.apiKey')}
        </a>

        <div className="connect-langs">
          {(['en', 'fr'] as const).map((value) => (
            <button
              key={value}
              className={`btn sm${locale === value ? ' primary' : ''}`}
              onClick={() => setLocale(value)}
            >
              {value === 'en' ? 'English' : 'Français'}
            </button>
          ))}
        </div>
      </div>

      {/* Outside the card, on the gradient: this is about the project, not
          about signing in. */}
      <p className="connect-legal">
        {legal[0]}<strong>{AUTHOR}</strong>{legal[1]}
      </p>
    </div>
  );
}
