import type { Color, Size } from '../types';

export const pieceSrc = (color: Color, size: Size): string => `/assets/piece-${color}-${size}.svg`;

export const BOARD_WOOD = '/assets/board-wood.svg';
export const TILE_WOOD = '/assets/tile-wood.svg';
export const TRAY_WOOD = '/assets/tray-wood.svg';

export const ALL_ASSETS: string[] = [
  ...(['red', 'blue'] as const).flatMap((color) => ([1, 2, 3] as const).map((size) => pieceSrc(color, size))),
  BOARD_WOOD,
  TILE_WOOD,
  TRAY_WOOD,
];

/** Nominal piece footprint in px at full board scale (Small / Medium / Large). */
export const PIECE_PX: Record<Size, number> = { 1: 48, 2: 72, 3: 96 };

