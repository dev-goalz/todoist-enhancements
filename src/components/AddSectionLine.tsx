interface AddSectionLineProps {
  label: string;
  onAdd: () => void;
}

/**
 * The seam between two sections, which is also where a new one goes.
 *
 * Invisible until the pointer is on it, so a project at rest is a list of
 * sections rather than a list of sections interleaved with buttons. The rule
 * that appears marks the exact position the new section will take.
 */
export function AddSectionLine({ label, onAdd }: AddSectionLineProps) {
  return (
    <button className="addsection" onClick={onAdd} aria-label={label}>
      <span className="addsection-rule" aria-hidden="true" />
      <span className="addsection-label">{label}</span>
      <span className="addsection-rule" aria-hidden="true" />
    </button>
  );
}
