import type { CSSProperties } from 'react';

/** Every glyph in the product, named exactly as the sprite defines it. */
export type IconName =
  | 'arrow-left' | 'arrow-right' | 'bars' | 'bell' | 'board' | 'calendar'
  | 'caret' | 'caret-up' | 'check' | 'clock' | 'close' | 'comment'
  | 'dashboard' | 'deadline' | 'drag' | 'edit' | 'export' | 'external'
  | 'filter' | 'flag' | 'group' | 'inbox' | 'list' | 'logout' | 'more'
  | 'plus' | 'project' | 'repeat' | 'search' | 'settings' | 'sidebar'
  | 'sliders' | 'someday' | 'sort' | 'stack' | 'subtask' | 'tasks'
  | 'trend' | 'upcoming' | 'warning' | 'week';

interface IconProps {
  name: IconName;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Lets a caller tint a glyph, for project and tag markers. */
  style?: CSSProperties;
  title?: string;
}

export function Icon({ name, size = 'md', className, style, title }: IconProps) {
  const sizeClass = size === 'sm' ? ' ic-sm' : size === 'lg' ? ' ic-lg' : '';
  return (
    <svg
      className={`ic${sizeClass}${className ? ` ${className}` : ''}`}
      style={style}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title && <title>{title}</title>}
      <use href={`#i-${name}`} />
    </svg>
  );
}
