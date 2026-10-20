/**
 * Regenerates the sprite sheet in client/public/assets from src/lib/pieceArt.ts.
 * Run with: npm run assets -w client   (Node >= 22.18 strips the TypeScript types)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardWoodSvg, pieceSvg, tileWoodSvg, trayWoodSvg } from '../src/lib/pieceArt.ts';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets');
mkdirSync(outDir, { recursive: true });

const write = (name: string, svg: string) => {
  writeFileSync(join(outDir, name), svg.trim() + '\n');
  console.log(`wrote public/assets/${name}`);
};

for (const color of ['red', 'blue'] as const) {
  for (const size of [1, 2, 3] as const) {
    write(`piece-${color}-${size}.svg`, pieceSvg(color, size));
  }
}
write('board-wood.svg', boardWoodSvg());
write('tile-wood.svg', tileWoodSvg());
write('tray-wood.svg', trayWoodSvg());
