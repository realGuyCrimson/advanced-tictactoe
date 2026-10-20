/**
 * Procedural SVG art for the cylindrical pieces and wood textures.
 *
 * This module has no imports so it can be executed directly by Node
 * (`npm run assets -w client`) to regenerate the sprites in `public/assets/`,
 * and it doubles as the inline fallback when a sprite fails to load.
 */

export type ArtColor = 'red' | 'blue';
export type ArtSize = 1 | 2 | 3;

interface Palette {
  light: string;
  base: string;
  mid: string;
  dark: string;
  rim: string;
}

export const PALETTES: Record<ArtColor, Palette> = {
  red: { light: '#ff9a8b', base: '#ea3d43', mid: '#c01526', dark: '#5f0710', rim: '#ffe1dc' },
  blue: { light: '#a5ccff', base: '#3d84f7', mid: '#1c4fd6', dark: '#0a1d5a', rim: '#e0edff' },
};

/** Pip layout on the top face: one pip per tier so sizes stay readable at a glance. */
const PIPS: Record<ArtSize, [number, number][]> = {
  1: [[50, 36]],
  2: [
    [41, 36],
    [59, 36],
  ],
  3: [
    [50, 31.5],
    [39, 39],
    [61, 39],
  ],
};

export function pieceSvg(color: ArtColor, size: ArtSize, idSuffix = ''): string {
  const p = PALETTES[color];
  const id = (name: string) => `${name}-${color}-${size}${idSuffix}`;
  const pips = PIPS[size]
    .map(
      ([x, y]) =>
        `<ellipse cx="${x}" cy="${y + 0.8}" rx="4.4" ry="2.4" fill="${p.dark}" fill-opacity="0.55"/>` +
        `<ellipse cx="${x}" cy="${y}" rx="4" ry="2.1" fill="url(#${id('pip')})"/>`,
    )
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
<defs>
<linearGradient id="${id('body')}" x1="0" y1="0" x2="1" y2="0">
<stop offset="0" stop-color="${p.dark}"/>
<stop offset="0.16" stop-color="${p.mid}"/>
<stop offset="0.38" stop-color="${p.base}"/>
<stop offset="0.52" stop-color="${p.light}"/>
<stop offset="0.7" stop-color="${p.base}"/>
<stop offset="0.9" stop-color="${p.mid}"/>
<stop offset="1" stop-color="${p.dark}"/>
</linearGradient>
<radialGradient id="${id('top')}" cx="0.42" cy="0.32" r="0.75">
<stop offset="0" stop-color="${p.light}"/>
<stop offset="0.55" stop-color="${p.base}"/>
<stop offset="1" stop-color="${p.mid}"/>
</radialGradient>
<radialGradient id="${id('pip')}" cx="0.35" cy="0.3" r="0.8">
<stop offset="0" stop-color="#ffffff"/>
<stop offset="1" stop-color="${p.rim}"/>
</radialGradient>
<filter id="${id('blur')}" x="-20%" y="-50%" width="140%" height="200%">
<feGaussianBlur stdDeviation="2.6"/>
</filter>
</defs>
<ellipse cx="50" cy="83" rx="42" ry="10" fill="#000" fill-opacity="0.42" filter="url(#${id('blur')})"/>
<path d="M12 36 V70 A38 14 0 0 0 88 70 V36 Z" fill="url(#${id('body')})"/>
<path d="M12 70 A38 14 0 0 0 88 70" fill="none" stroke="${p.dark}" stroke-opacity="0.7" stroke-width="1.5"/>
<path d="M12.6 62 A37.4 13.6 0 0 0 87.4 62" fill="none" stroke="${p.dark}" stroke-opacity="0.25" stroke-width="1.2"/>
<path d="M24 44 V68" stroke="#fff" stroke-opacity="0.28" stroke-width="4.5" stroke-linecap="round"/>
<ellipse cx="50" cy="36" rx="38" ry="14" fill="url(#${id('top')})"/>
<ellipse cx="50" cy="36" rx="36.8" ry="13" fill="none" stroke="${p.rim}" stroke-opacity="0.8" stroke-width="1.6"/>
<ellipse cx="50" cy="37" rx="28" ry="9.4" fill="none" stroke="${p.dark}" stroke-opacity="0.32" stroke-width="2"/>
<path d="M28 30 A26 8 0 0 1 60 25.5" fill="none" stroke="#fff" stroke-opacity="0.55" stroke-width="2.2" stroke-linecap="round"/>
${pips}
</svg>`;
}

function woodSvg(base: string, tint: [number, number, number], seed: number, grain: string): string {
  const [r, g, b] = tint;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
<filter id="grain" x="0" y="0" width="100%" height="100%">
<feTurbulence type="fractalNoise" baseFrequency="${grain}" numOctaves="4" seed="${seed}" stitchTiles="stitch"/>
<feColorMatrix values="0 0 0 0 ${r}  0 0 0 0 ${g}  0 0 0 0 ${b}  0 0 0 -1.6 1.15"/>
</filter>
<rect width="256" height="256" fill="${base}"/>
<rect width="256" height="256" filter="url(#grain)"/>
</svg>`;
}

/** Dark walnut used for the board frame. */
export const boardWoodSvg = (): string => woodSvg('#4a2a17', [0.13, 0.06, 0.02], 7, '0.006 0.16');
/** Slightly lighter wood for the recessed cell tiles. */
export const tileWoodSvg = (): string => woodSvg('#6e4325', [0.2, 0.1, 0.04], 3, '0.009 0.22');
/** Reserve tray wood. */
export const trayWoodSvg = (): string => woodSvg('#3a2213', [0.1, 0.05, 0.02], 11, '0.005 0.12');
