import { useState } from 'react';
import { useT } from '@/hooks/useT';
import { useStore } from '@/store/store';
import { looksLikeToken } from '@/api/auth';

/**
 * The first screen: connecting the account.
 *
 * The token is entered by the user and stays on the device. Nothing is sent
 * anywhere except to Todoist itself.
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

  return (
    <div className="connect">
      <div className="connect-card">
        <h1>{t('connect.title')}</h1>
        <p>{t('connect.intro')}</p>

        <label htmlFor="token">{t('connect.tokenLabel')}</label>
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

        <div className="connect-actions">
          <button
            className="btn primary"
            disabled={status === 'checking'}
            onClick={() => void submit()}
          >
            {status === 'checking' ? t('connect.checking') : t('connect.submit')}
          </button>
          <button
            className="btn"
            onClick={() =>
              window.open('https://app.todoist.com/app/settings/integrations/developer', '_blank', 'noopener')
            }
          >
            {t('connect.openSettings')}
          </button>
        </div>

        <p className="connect-help">{t('connect.help')}</p>

        <div className="connect-demo">
          <button className="btn" onClick={startDemo}>
            {t('connect.demo')}
          </button>
          <p className="connect-help">{t('connect.demoHint')}</p>
        </div>

        <div style={{ marginTop: 'var(--s4)', display: 'flex', gap: 8 }}>
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
    </div>
  );
}
