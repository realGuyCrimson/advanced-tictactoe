import type { Ref } from 'react';

export interface CellProps {
  index: number;
  legal: boolean;
  win: boolean;
  last: boolean;
  selected: boolean;
  label: string;
  clickable: boolean;
  onClick: (index: number) => void;
  ref?: Ref<HTMLButtonElement>;
}

/** A recessed wooden slot on the tilted board. Pieces are drawn in a flat layer above. */
export function Cell({ index, legal, win, last, selected, label, clickable, onClick, ref }: CellProps) {
  return (
    <button
      ref={ref}
      type="button"
      className="tile aspect-square w-full"
      data-legal={legal}
      data-win={win}
      data-last={last && !win}
      aria-label={label}
      aria-pressed={selected}
      aria-disabled={!clickable}
      onClick={() => onClick(index)}
      style={{ cursor: clickable ? 'pointer' : 'default' }}
    >
      {legal && <span className="legal-ring" aria-hidden />}
      {selected && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-[10%] rounded-full border-2 border-dashed border-amber-200/50"
        />
      )}
    </button>
  );
}
