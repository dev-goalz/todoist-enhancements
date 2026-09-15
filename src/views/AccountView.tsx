import { useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';
import { useT } from '@/hooks/useT';
import { useStore } from '@/store/store';
import { AccountError, fetchAccountConfig, signIn, signUp, type AccountErrorCode } from '@/api/account';
import { AUTHOR, VERSION } from '@/app-info';
import type { TranslationKey } from '@/i18n';

/**
 * The first screen when the app runs against a self-hosted server: sign in
 * with an email and password, or create an account. The token the server
 * returns is handed to the same connect step the Todoist screen uses.
 */
export function AccountView() {
  const { t } = useT();
  const connect = useStore((s) => s.connect);
  const startDemo = useStore((s) => s.startDemo);
  const setLocale = useStore((s) => s.setLocale);
  const locale = useStore((s) => s.prefs.locale);

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [signupOpen, setSignupOpen] = useState(true);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AccountErrorCode | null>(null);

  useEffect(() => {
    // If the server has closed sign-up, the option is not offered at all.
    fetchAccountConfig()
      .then((config) => setSignupOpen(config.signup))
      .catch(() => { /* keep offering it; the server will say no if it must */ });
  }, []);

  const creating = mode === 'signup' && signupOpen;

  function switchMode(next: 'signin' | 'signup') {
    setMode(next);
    setError(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const token = creating
        ? await signUp({ fullName, email, password, lang: locale })
        : await signIn(email, password);
      if (!(await connect(token))) setError('offline');
    } catch (err) {
      setError(err instanceof AccountError ? err.code : 'offline');
    } finally {
      setBusy(false);
    }
  }

  const legal = t('connect.legal', { author: AUTHOR }).split(AUTHOR);

  return (
    <div className="connect">
      <form className="connect-card" onSubmit={(e) => void submit(e)}>
        <div className="connect-head">
          <h1>{t('connect.appName')}</h1>
          <span className="connect-version">{t('connect.version', { version: VERSION })}</span>
        </div>
        <p className="connect-intro">{t(creating ? 'account.introSignup' : 'account.introSignin')}</p>

        {signupOpen && (
          <div className="connect-modes" role="tablist">
            {(['signin', 'signup'] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={mode === value}
                className={`btn sm${mode === value ? ' primary' : ''}`}
                onClick={() => switchMode(value)}
              >
                {t(value === 'signin' ? 'account.signin' : 'account.signup')}
              </button>
            ))}
          </div>
        )}

        {creating && (
          <>
            <label className="sr" htmlFor="account-name">{t('account.name')}</label>
            <input
              id="account-name"
              autoComplete="name"
              placeholder={t('account.name')}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </>
        )}
        <label className="sr" htmlFor="account-email">{t('account.email')}</label>
        <input
          id="account-email"
          type="email"
          autoComplete="email"
          placeholder={t('account.email')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <label className="sr" htmlFor="account-password">{t('account.password')}</label>
        <input
          id="account-password"
          type="password"
          autoComplete={creating ? 'new-password' : 'current-password'}
          placeholder={t(creating ? 'account.passwordNew' : 'account.password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <p className="connect-error" role="alert">{t(`account.error.${error}` as TranslationKey)}</p>}

        <button className="btn primary lg connect-submit" type="submit" disabled={busy}>
          {busy
            ? t('connect.checking')
            : t(creating ? 'account.submitSignup' : 'account.submitSignin')}
        </button>

        <button type="button" className="btn tint lg connect-demo" onClick={startDemo}>
          <Icon name="bars" size="sm" />
          {t('connect.demoInstead')}
        </button>

        {!creating && <p className="connect-hint">{t('account.forgot')}</p>}

        <div className="connect-langs">
          {(['en', 'fr'] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={`btn sm${locale === value ? ' primary' : ''}`}
              onClick={() => setLocale(value)}
            >
              {value === 'en' ? 'English' : 'Français'}
            </button>
          ))}
        </div>
      </form>

      <p className="connect-legal">
        {legal[0]}<strong>{AUTHOR}</strong>{legal[1]}
      </p>
    </div>
  );
}
