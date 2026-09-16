/**
 * Building an accent family from one colour.
 *
 * The nine presets are generated ahead of time and live in app.css as plain
 * CSS. This is the same recipe, in the browser, for the colour somebody picks
 * themselves — because a theme is not a hue, it is a family of tokens that
 * have to hold their contrast against each other:
 *
 *   `--accent`       a solid fill carrying white glyphs
 *   `--accent-dark`  ink, read as text on the page, on the wash and in a badge
 *   `--accent-soft`  the selected navigation pill
 *   `--accent-tint`  a quiet button
 *   `--accent-line`  the border of an outlined control
 *   `--accent-wash`  a section that belongs to the brand
 *   `--accent-badge` a count sitting on that wash
 *
 * Pick one colour and use it for all of them and the washes swallow their own
 * text. So the profile below — every token's saturation and lightness, read
 * off the red family the product shipped with — is moved to the new hue, and
 * then the two that are read as text are taken down (or up, on a dark page)
 * until they clear what red already clears. A custom colour cannot be
 * illegible; the worst it can be is not to your taste.
 *
 * The picker takes a hue and a saturation. Lightness is the recipe's, not the
 * picked colour's: a pastel and a near-black of the same hue have to end up
 * with the same readable ink, or picking a dark colour would produce a page
 * you cannot read. The swatch shows the result rather than the input, so what
 * you approve is what you get.
 */

export const ACCENT_TOKENS = [
  'accent', 'accent-dark', 'accent-soft', 'accent-tint', 'accent-line',
  'accent-wash', 'accent-wash-deep', 'accent-badge',
  'sidebar', 'tb-on-line', 'today-line', 'today-wash',
] as const;

export type AccentToken = (typeof ACCENT_TOKENS)[number];

/** [hue offset from the accent, saturation, lightness], per scheme. */
type Profile = Record<AccentToken, [number, number, number]>;

const LIGHT: Profile = {
  accent: [0, 62, 52.5],
  'accent-dark': [-0.2, 57.1, 43.9],
  'accent-soft': [0, 92.6, 94.7],
  'accent-tint': [-4, 100, 97.3],
  'accent-line': [-4, 29.4, 90],
  'accent-wash': [-4, 100, 98],
  'accent-wash-deep': [5.5, 100, 96.3],
  'accent-badge': [2, 69.4, 85.9],
  sidebar: [-4, 100, 98.8],
  'tb-on-line': [3.5, 64.9, 85.5],
  'today-line': [6, 58.3, 85.9],
  'today-wash': [0, 66.7, 97.6],
};

const DARK: Profile = {
  accent: [0, 62, 52.5],
  'accent-dark': [0.9, 100, 76.1],
  'accent-soft': [1, 25.5, 18.4],
  'accent-tint': [-0.7, 22, 16.1],
  'accent-line': [0.4, 22, 24.1],
  'accent-wash': [1, 16.7, 14.1],
  'accent-wash-deep': [1.7, 25.3, 16.3],
  'accent-badge': [1, 35.3, 26.7],
  sidebar: [-4, 6, 13.9],
  'tb-on-line': [1.5, 31.4, 27.5],
  'today-line': [1.7, 30.4, 27.1],
  'today-wash': [2.7, 13.4, 13.1],
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function hslToHex(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) % 360;
  const sat = clamp(s, 0, 100) / 100;
  const lum = clamp(l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * lum - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lum - c / 2;
  const [r, g, b] =
    hue < 60 ? [c, x, 0] : hue < 120 ? [x, c, 0] : hue < 180 ? [0, c, x]
      : hue < 240 ? [0, x, c] : hue < 300 ? [x, 0, c] : [c, 0, x];
  const hex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

export function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const clean = hex.trim().replace(/^#/, '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;

  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };

  const d = max - min;
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0))
    : max === g ? (b - r) / d + 2
      : (r - g) / d + 4;
  return { h: h * 60, s: s * 100, l: l * 100 };
}

/** WCAG relative luminance. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/**
 * The floor every preset already clears.
 *
 * 4.5 is AA for body text. The badge is held to 4.0 because that is what the
 * red family achieves on its own, and holding a custom colour to a standard
 * the default does not meet would be an odd place to draw the line.
 */
const TEXT_MIN = 4.5;
const BADGE_MIN = 4.0;

/** Walks lightness until the colour clears `target` against `on`. */
function solve(h: number, s: number, l: number, on: string, target: number, step: number): number {
  let out = l;
  for (let i = 0; i < 200 && contrast(hslToHex(h, s, out), on) < target; i += 1) {
    const next = out + step;
    if (next < 2 || next > 98) break;
    out = next;
  }
  return out;
}

/**
 * The whole family for one hue, in one scheme.
 *
 * `saturation` is a multiplier on the recipe's own, taken from the picked
 * colour so that choosing something muted gives something muted. It is
 * clamped: a fully grey pick still needs an accent you can see, and a fully
 * saturated one must not turn the washes into surfaces of their own.
 */
export function accentFamily(
  hue: number, saturation: number, scheme: 'light' | 'dark',
): Record<AccentToken, string> {
  const profile = scheme === 'light' ? LIGHT : DARK;
  const page = scheme === 'light' ? '#ffffff' : '#1e1e1e';
  const scale = clamp(saturation / 62, 0.3, 1.25);

  const out = {} as Record<AccentToken, string>;

  // The grounds the ink has to sit on are solved first: the ink is fitted
  // to them, not the other way round.
  const ground = (token: AccentToken) => {
    const [dh, s, l] = profile[token];
    return hslToHex(hue + dh, s * scale, l);
  };
  const grounds = ['accent-wash', 'accent-badge', 'accent-soft'].map((t) => ground(t as AccentToken));
  const hardest = grounds.reduce((worst, g) =>
    (scheme === 'light' ? luminance(g) < luminance(worst) : luminance(g) > luminance(worst)) ? g : worst);

  for (const token of ACCENT_TOKENS) {
    const [dh, baseS, baseL] = profile[token];
    const h = hue + dh;
    let s = baseS * scale;
    let l = baseL;

    if (token === 'accent') {
      // Darkening alone turns a bright hue muddy — orange at 4.5:1 with white
      // is a brown — so the fill is saturated first and only then taken down.
      s = clamp(72 * scale, 18, 88);
      l = solve(h, s, l, '#ffffff', TEXT_MIN, -0.5);
    } else if (token === 'accent-dark') {
      if (scheme === 'dark') s = Math.min(s, 80);
      const step = scheme === 'light' ? -0.5 : 0.5;
      l = solve(h, s, l, page, TEXT_MIN, step);
      l = solve(h, s, l, hardest, BADGE_MIN, step);
    }

    out[token] = hslToHex(h, s, l);
  }

  return out;
}
