import { useDroppable } from '@dnd-kit/core';

interface AddSectionLineProps {
  label: string;
  /** Identifies the position, so a dragged section can be dropped into it. */
  slotId: string;
  onAdd: () => void;
}

/**
 * The seam between two sections.
 *
 * It does two jobs, and both are about the same position: click it to make a
 * section there, or drop a section onto it to move one there. Invisible until
 * the pointer is on it, so a project at rest is a list of sections rather than
 * a list of sections interleaved with controls.
 */
export function AddSectionLine({ label, slotId, onAdd }: AddSectionLineProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot:${slotId}` });

  return (
    <div ref={setNodeRef} className={`addsection-slot${isOver ? ' over' : ''}`}>
      <button className="addsection" onClick={onAdd} aria-label={label}>
        <span className="addsection-rule" aria-hidden="true" />
        <span className="addsection-label">{label}</span>
        <span className="addsection-rule" aria-hidden="true" />
      </button>
    </div>
  );
}
