import { useCallback } from 'react';
import { useStore } from '@/store/store';
import { translate, type TranslationKey, type TranslateValues } from '@/i18n';

/** The translator, bound to the language the user chose. */
export function useT() {
  const locale = useStore((s) => s.prefs.locale);
  const t = useCallback(
    (key: TranslationKey, values?: TranslateValues) => translate(locale, key, values),
    [locale],
  );
  return { t, locale };
}
