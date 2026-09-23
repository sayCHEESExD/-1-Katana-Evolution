import type { StageTheme } from '@katana/shared';

/**
 * How each stage's arena looks. COLOUR and set dressing only: every
 * coordinate comes from `@katana/shared`. Bright and readable even for the
 * "dark" themes - the shadow castle is violet stone, not black.
 */
export interface ThemeStyle {
  readonly floor: string;
  readonly path: string;
  readonly wall: number;
  readonly wallCap: number;
  /** What rises beyond the cliffs, so every stage has its own skyline. */
  readonly skyline: 'bamboo' | 'temples' | 'fortress' | 'sakura' | 'peaks' | 'volcano' | 'willows' | 'storm' | 'towers' | 'keep';
  /** Flat, walkable accents on the arena floor. */
  readonly accent: 'picnic' | 'none' | 'runes' | 'petals' | 'snow' | 'lava' | 'pools' | 'tiles' | 'violet' | 'gold';
}

export const THEME_STYLES: Readonly<Record<StageTheme, ThemeStyle>> = {
  bamboo: { floor: '#63d043', path: '#e9d3a2', wall: 0x8e929c, wallCap: 0x2b3448, skyline: 'bamboo', accent: 'picnic' },
  temple: { floor: '#c9ccd4', path: '#e9d3a2', wall: 0xb9bcc4, wallCap: 0x2b3448, skyline: 'temples', accent: 'none' },
  oni: { floor: '#c0674a', path: '#7a4232', wall: 0x5a3a30, wallCap: 0x2a1a14, skyline: 'fortress', accent: 'runes' },
  sakura: { floor: '#8fdc6a', path: '#ffd6e8', wall: 0xe8d8e0, wallCap: 0x6a2a4a, skyline: 'sakura', accent: 'petals' },
  frost: { floor: '#eef7ff', path: '#bfe3ff', wall: 0xdff0ff, wallCap: 0x5a7aa8, skyline: 'peaks', accent: 'snow' },
  ember: { floor: '#8a6356', path: '#4a3430', wall: 0x5a4440, wallCap: 0x2a1a14, skyline: 'volcano', accent: 'lava' },
  marsh: { floor: '#5fa86a', path: '#9a8a5a', wall: 0x6a7a5a, wallCap: 0x2f4a2a, skyline: 'willows', accent: 'pools' },
  thunder: { floor: '#9aa8c8', path: '#6a78a0', wall: 0x7a88a8, wallCap: 0x2b3448, skyline: 'storm', accent: 'tiles' },
  shadow: { floor: '#8a7aaa', path: '#5a4a7a', wall: 0x5a4a7a, wallCap: 0x2a1f3a, skyline: 'towers', accent: 'violet' },
  shogun: { floor: '#f3e3b0', path: '#c0392b', wall: 0xf4efe3, wallCap: 0x2b2f3d, skyline: 'keep', accent: 'gold' },
};
