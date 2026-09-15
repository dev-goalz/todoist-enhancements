import { Icon } from './Icon';
import { markerStyle } from '@/domain/colors';

export interface SelectOption {
  value: string;
  label: string;
  /**
   * A Todoist colour name. The painted face shows the marker; the native list
   * underneath cannot, which is the one thing this control gives up.
   */
  marker?: string;
}

interface SelectProps {
  /** Printed above the control. Omit it when the row already names the setting. */
  label?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  /** Used as the accessible name when no visible label is printed. */
  ariaLabel?: string;
}

/**
 * A select that is drawn by us rather than by the operating system.
 *
 * The native control is kept underneath — it does the keyboard handling, the
 * type-ahead, and the picker every mobile platform insists on — and the face
 * is painted on top of it. The appearance is ours without any of the
 * behaviour being reimplemented, which is the only version of this control
 * worth shipping.
 */
export function Select({ label, value, options, onChange, ariaLabel }: SelectProps) {
  const current = options.find((option) => option.value === value);
  return (
    <label className="fselect">
      {label && <span className="fselect-label">{label}</span>}
      <span className="fselect-face">
        {current?.marker !== undefined && (
          <span className="hash" style={markerStyle(current.marker)}>#</span>
        )}
        <span className="fselect-value">{current?.label ?? ''}</span>
        <Icon name="caret" size="sm" />
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={ariaLabel ?? label}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}
