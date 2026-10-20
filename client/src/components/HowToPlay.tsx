import { ChevronDown } from 'lucide-react';

const RULES: [string, string][] = [
  ['Pieces', 'Each player has 6 pieces: 2 large, 2 medium and 2 small.'],
  ['Gobble', 'On your turn, place a reserve piece on an empty cell or over a strictly smaller piece — even your own.'],
  ['Move', 'Or move one of your visible pieces on the board. Lifting it uncovers whatever was underneath.'],
  ['Win', 'Line up three of your visible pieces in a row, column or diagonal. Sizes do not matter.'],
  ['Careful', 'Uncover an opponent’s line and they win — unless your moved piece lands on that line to break it.'],
  ['Draw', 'If a move completes a line for both players at once, the game is a draw.'],
];

export function HowToPlay() {
  return (
    <details className="group card w-full overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 font-display text-lg font-semibold [&::-webkit-details-marker]:hidden">
        How to play
        <ChevronDown className="h-5 w-5 text-muted transition-transform group-open:rotate-180" />
      </summary>
      <ul className="space-y-2.5 px-5 pb-5 text-sm leading-relaxed text-cream/85">
        {RULES.map(([title, body]) => (
          <li key={title} className="flex gap-3">
            <span className="mt-0.5 w-16 shrink-0 text-[11px] font-bold tracking-[0.14em] text-amber uppercase">{title}</span>
            <span>{body}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
