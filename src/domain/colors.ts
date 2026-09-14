/**
 * Todoist stores colours by name, not by value. These are the hex values
 * Todoist renders them with, plus a soft tint used for marker backgrounds.
 */

const PALETTE: Record<string, string> = {
  berry_red: '#b8255f',
  red: '#db4035',
  orange: '#ff9933',
  yellow: '#fad000',
  olive_green: '#afb83b',
  lime_green: '#7ecc49',
  green: '#299438',
  mint_green: '#6accbc',
  teal: '#158fad',
  sky_blue: '#14aaf5',
  light_blue: '#96c3eb',
  blue: '#4073ff',
  grape: '#884dff',
  violet: '#af38eb',
  lavender: '#eb96eb',
  magenta: '#e05194',
  salmon: '#ff8d85',
  charcoal: '#808080',
  grey: '#b8b8b8',
  gray: '#b8b8b8',
  taupe: '#ccac93',
};

export const DEFAULT_COLOR = '#808080';

/** The hex value for a Todoist colour name, or a neutral grey if unknown. */
export const colorValue = (name: string | undefined | null): string =>
  (name && PALETTE[name]) || DEFAULT_COLOR;

/** The same colour at low opacity, for a marker's background chip. */
export function colorSoft(name: string | undefined | null): string {
  const hex = colorValue(name);
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, 0.12)`;
}

/** The CSS custom properties a coloured marker reads. */
export const markerStyle = (name: string | undefined | null, withBackground = true) =>
  ({
    '--marker': colorValue(name),
    ...(withBackground ? { '--marker-soft': colorSoft(name) } : {}),
  }) as React.CSSProperties;

/**
 * The avatar Todoist holds for a user.
 *
 * Todoist serves uploaded avatars from its image CDN keyed by `image_id`.
 * Accounts without a picture have no id, and the caller falls back to initials.
 */
export function avatarUrl(
  user: { image_id?: string | null; avatar_big?: string | null } | null,
  size: 'small' | 'medium' | 'big' = 'medium',
): string | null {
  if (!user) return null;
  if (user.avatar_big) return user.avatar_big;
  if (!user.image_id) return null;
  return `https://dcff1xvirvpfp.cloudfront.net/${user.image_id}_${size}.jpg`;
}
