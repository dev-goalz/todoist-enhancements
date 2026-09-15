/**
 * The words of recurring due dates, per language.
 *
 * Each language maps its words onto one canonical English vocabulary, so the
 * grammar in parse.ts is written once. Phrases are replaced before the text is
 * split into words. Text is lower-cased and stripped of accents first, so the
 * entries below carry no accents.
 */

export interface Lexicon {
  phrases: Record<string, string>;
  words: Record<string, string>;
  /** Captures the number of an ordinal such as "15th". */
  ordinal: RegExp;
}

const WEEKDAYS_EN: Record<string, string> = {
  sunday: 'sunday', sun: 'sunday',
  monday: 'monday', mon: 'monday',
  tuesday: 'tuesday', tue: 'tuesday', tues: 'tuesday',
  wednesday: 'wednesday', wed: 'wednesday',
  thursday: 'thursday', thu: 'thursday', thur: 'thursday', thurs: 'thursday',
  friday: 'friday', fri: 'friday',
  saturday: 'saturday', sat: 'saturday',
};

const MONTHS_EN: Record<string, string> = {
  january: 'jan', jan: 'jan', february: 'feb', feb: 'feb', march: 'mar', mar: 'mar',
  april: 'apr', apr: 'apr', may: 'may', june: 'jun', jun: 'jun', july: 'jul', jul: 'jul',
  august: 'aug', aug: 'aug', september: 'sep', sep: 'sep', sept: 'sep',
  october: 'oct', oct: 'oct', november: 'nov', nov: 'nov', december: 'dec', dec: 'dec',
};

const en: Lexicon = {
  phrases: {},
  words: {
    every: 'every', each: 'every', everyday: 'every day',
    other: 'other', and: 'and', at: 'at', starting: 'starting', from: 'starting',
    until: 'until', ending: 'until', last: 'last', first: '1st', second: '2nd', third: '3rd',
    day: 'day', days: 'day', week: 'week', weeks: 'week', month: 'month', months: 'month',
    quarter: 'quarter', quarters: 'quarter', year: 'year', years: 'year',
    workday: 'workday', workdays: 'workday', weekday: 'workday', weekdays: 'workday',
    weekend: 'weekend', weekends: 'weekend',
    daily: 'daily', weekly: 'weekly', monthly: 'monthly', quarterly: 'quarterly',
    yearly: 'yearly', annually: 'yearly',
    noon: 'noon', morning: 'morning', afternoon: 'afternoon', evening: 'evening', night: 'night',
    the: '', of: '', on: '', in: '',
    ...WEEKDAYS_EN,
    ...MONTHS_EN,
  },
  ordinal: /^(\d{1,2})(?:st|nd|rd|th)$/,
};

const nl: Lexicon = {
  phrases: { 'om de': 'every other' },
  words: {
    elke: 'every', iedere: 'every',
    en: 'and', om: 'at', vanaf: 'starting', tot: 'until', laatste: 'last',
    eerste: '1st', tweede: '2nd', derde: '3rd',
    dag: 'day', dagen: 'day', week: 'week', weken: 'week', maand: 'month', maanden: 'month',
    kwartaal: 'quarter', jaar: 'year', jaren: 'year',
    werkdag: 'workday', werkdagen: 'workday', weekend: 'weekend',
    dagelijks: 'daily', wekelijks: 'weekly', maandelijks: 'monthly', jaarlijks: 'yearly',
    middag: 'noon', ochtend: 'morning', avond: 'evening', nacht: 'night',
    de: '', het: '', van: '', op: '',
    zondag: 'sunday', zo: 'sunday', maandag: 'monday', ma: 'monday', dinsdag: 'tuesday', di: 'tuesday',
    woensdag: 'wednesday', wo: 'wednesday', donderdag: 'thursday', do: 'thursday',
    vrijdag: 'friday', vr: 'friday', zaterdag: 'saturday', za: 'saturday',
    januari: 'jan', jan: 'jan', februari: 'feb', feb: 'feb', maart: 'mar', mrt: 'mar',
    april: 'apr', apr: 'apr', mei: 'may', juni: 'jun', jun: 'jun', juli: 'jul', jul: 'jul',
    augustus: 'aug', aug: 'aug', september: 'sep', sep: 'sep', oktober: 'oct', okt: 'oct',
    november: 'nov', nov: 'nov', december: 'dec', dec: 'dec',
  },
  ordinal: /^(\d{1,2})(?:e|de|ste)$/,
};

const fr: Lexicon = {
  phrases: {
    'tous les': 'every', 'toutes les': 'every', 'a partir du': 'starting', 'a partir de': 'starting',
    "jusqu'au": 'until', "jusqu'a": 'until', 'jours ouvres': 'workday', 'jour ouvre': 'workday',
  },
  words: {
    chaque: 'every',
    et: 'and', a: 'at', depuis: 'starting', dernier: 'last', derniere: 'last', premier: '1st',
    jour: 'day', jours: 'day', semaine: 'week', semaines: 'week', mois: 'month',
    trimestre: 'quarter', trimestres: 'quarter', an: 'year', ans: 'year', annee: 'year', annees: 'year',
    'week-end': 'weekend', weekend: 'weekend',
    quotidien: 'daily', hebdomadaire: 'weekly', mensuel: 'monthly', trimestriel: 'quarterly', annuel: 'yearly',
    midi: 'noon', matin: 'morning', soir: 'evening', nuit: 'night',
    le: '', la: '', les: '', du: '', de: '',
    dimanche: 'sunday', dimanches: 'sunday', dim: 'sunday', lundi: 'monday', lundis: 'monday', lun: 'monday',
    mardi: 'tuesday', mardis: 'tuesday', mercredi: 'wednesday', mercredis: 'wednesday', mer: 'wednesday',
    jeudi: 'thursday', jeudis: 'thursday', jeu: 'thursday', vendredi: 'friday', vendredis: 'friday',
    ven: 'friday', samedi: 'saturday', samedis: 'saturday', sam: 'saturday',
    janvier: 'jan', janv: 'jan', fevrier: 'feb', fevr: 'feb', mars: 'mar', avril: 'apr', avr: 'apr',
    mai: 'may', juin: 'jun', juillet: 'jul', juil: 'jul', aout: 'aug', septembre: 'sep', sept: 'sep',
    octobre: 'oct', oct: 'oct', novembre: 'nov', nov: 'nov', decembre: 'dec', dec: 'dec',
  },
  ordinal: /^(\d{1,2})(?:er|e|eme)$/,
};

export const LEXICONS: Record<string, Lexicon> = { en, nl, fr };
