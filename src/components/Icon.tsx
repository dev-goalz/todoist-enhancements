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
}

export function Icon({ name, size = 'md', className }: IconProps) {
  const sizeClass = size === 'sm' ? ' ic-sm' : size === 'lg' ? ' ic-lg' : '';
  return (
    <svg className={`ic${sizeClass}${className ? ` ${className}` : ''}`} aria-hidden="true">
      <use href={`#i-${name}`} />
    </svg>
  );
}
