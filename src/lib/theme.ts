import type { PlayerColor } from './types';

/* ------------------------------------------------------------------ */
/* Colour helpers                                                      */
/* ------------------------------------------------------------------ */

function clamp(v: number) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('');
}

/** mix a -> b, t = 0 keeps a, t = 1 becomes b */
export function mix(a: string, b: string, t: number) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}

/** t < 0 darkens, t > 0 lightens */
export function shade(h: string, t: number) {
  return t < 0 ? mix(h, '#000000', -t) : mix(h, '#FFFFFF', t);
}

export function alpha(hex: string, a: number) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/* ------------------------------------------------------------------ */
/* Palettes                                                            */
/* ------------------------------------------------------------------ */

export const RING_ORDER: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];

export interface ColorSpec {
  main: string;
  light: string;
  dark: string;
  tint: string;
  glow: string;
  text: string;
}

export interface BoardPalette {
  bg: string;
  track: string;
  trackBorder: string;
  safe: string;
  star: string;
  base: string;
  baseInner: string;
  baseSlot: string;
  center: string;
  grid: string;
  shadow: string;
}

export interface UiPalette {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textDim: string;
  textFaint: string;
  primary: string;
  onPrimary: string;
  accent: string;
  gold: string;
  success: string;
  danger: string;
  overlay: string;
  shadow: string;
}

export interface GameTheme {
  id: string;
  name: string;
  cost: number;
  tagline: string;
  dark: boolean;
  board: BoardPalette;
  players: Record<PlayerColor, ColorSpec>;
  light: UiPalette;
  dark_: UiPalette;
}

interface Spec {
  id: string;
  name: string;
  cost: number;
  tagline: string;
  dark: boolean;
  boardBg: string;
  track: string;
  trackBorder: string;
  safe: string;
  star: string;
  base: string;
  baseInner: string;
  baseSlot: string;
  center: string;
  grid: string;
  boardShadow: string;
  primary: string;
  accent: string;
  bgLight: string;
  surfaceLight: string;
  bgDark: string;
  surfaceDark: string;
  players: Record<PlayerColor, [string, string]>;
}

function build(spec: Spec): GameTheme {
  const players = {} as Record<PlayerColor, ColorSpec>;
  (Object.keys(spec.players) as PlayerColor[]).forEach((c) => {
    const [main, text] = spec.players[c];
    players[c] = {
      main,
      light: shade(main, 0.3),
      dark: shade(main, -0.28),
      tint: alpha(main, spec.dark ? 0.26 : 0.16),
      glow: alpha(main, 0.75),
      text,
    };
  });

  const board: BoardPalette = {
    bg: spec.boardBg,
    track: spec.track,
    trackBorder: spec.trackBorder,
    safe: spec.safe,
    star: spec.star,
    base: spec.base,
    baseInner: spec.baseInner,
    baseSlot: spec.baseSlot,
    center: spec.center,
    grid: spec.grid,
    shadow: spec.boardShadow,
  };

  const light: UiPalette = {
    bg: spec.bgLight,
    surface: spec.surfaceLight,
    surfaceAlt: mix(spec.surfaceLight, spec.primary, spec.dark ? 0.1 : 0.05),
    border: mix(spec.surfaceLight, '#000000', spec.dark ? 0.08 : 0.09),
    text: '#17161C',
    textDim: '#5F5D6E',
    textFaint: '#8E8C9C',
    primary: spec.primary,
    onPrimary: '#FFFFFF',
    accent: spec.accent,
    gold: '#D99A16',
    success: '#22A45D',
    danger: '#DC3A3A',
    overlay: 'rgba(12, 10, 22, 0.55)',
    shadow: '#1B1030',
  };

  const dark: UiPalette = {
    bg: spec.bgDark,
    surface: spec.surfaceDark,
    surfaceAlt: mix(spec.surfaceDark, spec.primary, 0.16),
    border: mix(spec.surfaceDark, '#FFFFFF', 0.09),
    text: '#F3F2F8',
    textDim: '#A3A1B4',
    textFaint: '#75738A',
    primary: shade(spec.primary, 0.12),
    onPrimary: '#FFFFFF',
    accent: shade(spec.accent, 0.1),
    gold: '#F0BE4B',
    success: '#39C77C',
    danger: '#FF6161',
    overlay: 'rgba(4, 3, 10, 0.7)',
    shadow: '#000000',
  };

  return {
    id: spec.id,
    name: spec.name,
    cost: spec.cost,
    tagline: spec.tagline,
    dark: spec.dark,
    board,
    players,
    light,
    dark_: dark,
  };
}

const CLASSIC_RED: [string, string] = ['#E23B3B', '#FFFFFF'];
const CLASSIC_GREEN: [string, string] = ['#2FA84F', '#FFFFFF'];
const CLASSIC_YELLOW: [string, string] = ['#F2B01E', '#3A2A00'];
const CLASSIC_BLUE: [string, string] = ['#2E7DF6', '#FFFFFF'];

export const THEMES: GameTheme[] = [
  build({
    id: 'classic',
    name: 'Classic',
    cost: 0,
    tagline: 'The timeless table',
    dark: false,
    boardBg: '#EFEAE0',
    track: '#FFFFFF',
    trackBorder: '#DED7C8',
    safe: '#FFE7A3',
    star: '#E1A017',
    base: '#FFFFFF',
    baseInner: '#FAF7F0',
    baseSlot: '#EDE8DD',
    center: '#FFFFFF',
    grid: 'rgba(0,0,0,0.05)',
    boardShadow: 'rgba(60,40,10,0.18)',
    primary: '#6D28D9',
    accent: '#F59E0B',
    bgLight: '#F4F1EA',
    surfaceLight: '#FFFFFF',
    bgDark: '#15141B',
    surfaceDark: '#1F1E27',
    players: { red: CLASSIC_RED, green: CLASSIC_GREEN, yellow: CLASSIC_YELLOW, blue: CLASSIC_BLUE },
  }),
  build({
    id: 'midnight',
    name: 'Midnight',
    cost: 150,
    tagline: 'Neon nights',
    dark: true,
    boardBg: '#12142A',
    track: '#1D2145',
    trackBorder: '#2C3166',
    safe: '#2A3170',
    star: '#FFD166',
    base: '#191C3A',
    baseInner: '#232752',
    baseSlot: '#2C3166',
    center: '#161A38',
    grid: 'rgba(255,255,255,0.05)',
    boardShadow: 'rgba(0,0,0,0.55)',
    primary: '#7C5CFF',
    accent: '#22D3EE',
    bgDark: '#0A0B18',
    surfaceDark: '#141629',
    bgLight: '#EEF0FF',
    surfaceLight: '#FFFFFF',
    players: {
      red: ['#FF4D6D', '#FFFFFF'],
      green: ['#3DDC97', '#04231A'],
      yellow: ['#FFD166', '#3A2A00'],
      blue: ['#4CC9FF', '#04202B'],
    },
  }),
  build({
    id: 'ocean',
    name: 'Ocean',
    cost: 300,
    tagline: 'Deep blue depths',
    dark: false,
    boardBg: '#DCF0F4',
    track: '#FFFFFF',
    trackBorder: '#BFDDE6',
    safe: '#CDEBFF',
    star: '#0E9BB5',
    base: '#FFFFFF',
    baseInner: '#EAF7FA',
    baseSlot: '#D6ECF3',
    center: '#FFFFFF',
    grid: 'rgba(0,60,80,0.06)',
    boardShadow: 'rgba(0,60,90,0.2)',
    primary: '#0E7490',
    accent: '#F97316',
    bgLight: '#EAF6F9',
    surfaceLight: '#FFFFFF',
    bgDark: '#081A21',
    surfaceDark: '#0F2831',
    players: {
      red: ['#F2545B', '#FFFFFF'],
      green: ['#14B8A6', '#FFFFFF'],
      yellow: ['#FBBF24', '#3A2A00'],
      blue: ['#2563EB', '#FFFFFF'],
    },
  }),
  build({
    id: 'sakura',
    name: 'Sakura',
    cost: 450,
    tagline: 'Soft blossom calm',
    dark: false,
    boardBg: '#FCEEF2',
    track: '#FFFFFF',
    trackBorder: '#F2D3DD',
    safe: '#FFE3EC',
    star: '#E06A93',
    base: '#FFFFFF',
    baseInner: '#FDF3F6',
    baseSlot: '#F7E2E9',
    center: '#FFFFFF',
    grid: 'rgba(120,40,70,0.06)',
    boardShadow: 'rgba(150,60,95,0.18)',
    primary: '#D6437B',
    accent: '#7C5CFF',
    bgLight: '#FDF4F7',
    surfaceLight: '#FFFFFF',
    bgDark: '#211019',
    surfaceDark: '#2E1622',
    players: {
      red: ['#EF4444', '#FFFFFF'],
      green: ['#34D399', '#05392A'],
      yellow: ['#F5C542', '#3A2A00'],
      blue: ['#60A5FA', '#0B2440'],
    },
  }),
  build({
    id: 'candy',
    name: 'Candy Pop',
    cost: 600,
    tagline: 'Sugar rush energy',
    dark: false,
    boardBg: '#FFF3DE',
    track: '#FFFFFF',
    trackBorder: '#F6DFB4',
    safe: '#FFECB8',
    star: '#FF7A59',
    base: '#FFFFFF',
    baseInner: '#FFF8EA',
    baseSlot: '#FBEBCB',
    center: '#FFFFFF',
    grid: 'rgba(120,70,0,0.07)',
    boardShadow: 'rgba(150,80,10,0.18)',
    primary: '#FF6B6B',
    accent: '#12B886',
    bgLight: '#FFF7EC',
    surfaceLight: '#FFFFFF',
    bgDark: '#1E140C',
    surfaceDark: '#2B1D12',
    players: {
      red: ['#FF5D73', '#FFFFFF'],
      green: ['#31C48D', '#FFFFFF'],
      yellow: ['#FFB020', '#3A2A00'],
      blue: ['#4C6FFF', '#FFFFFF'],
    },
  }),
  build({
    id: 'royalgold',
    name: 'Royal Gold',
    cost: 900,
    tagline: 'Fit for a champion',
    dark: true,
    boardBg: '#1A1508',
    track: '#2A2210',
    trackBorder: '#4A3C1B',
    safe: '#3E3315',
    star: '#F0BE4B',
    base: '#241D0C',
    baseInner: '#302711',
    baseSlot: '#43371A',
    center: '#1F1909',
    grid: 'rgba(255,220,140,0.07)',
    boardShadow: 'rgba(0,0,0,0.6)',
    primary: '#C9962B',
    accent: '#8B5CF6',
    bgDark: '#0E0B04',
    surfaceDark: '#1C1708',
    bgLight: '#FBF4E2',
    surfaceLight: '#FFFFFF',
    players: {
      red: ['#E14B4B', '#FFFFFF'],
      green: ['#3FBF6F', '#FFFFFF'],
      yellow: ['#F0BE4B', '#3A2A00'],
      blue: ['#5B9BF5', '#FFFFFF'],
    },
  }),
];

export const THEME_MAP: Record<string, GameTheme> = THEMES.reduce((acc, t) => {
  acc[t.id] = t;
  return acc;
}, {} as Record<string, GameTheme>);

export function getTheme(id?: string | null) {
  return (id && THEME_MAP[id]) || THEMES[0];
}

/* ------------------------------------------------------------------ */
/* Dice styles                                                         */
/* ------------------------------------------------------------------ */

export interface DiceStyle {
  id: string;
  name: string;
  cost: number;
  face: string;
  face2: string;
  pip: string;
  border: string;
  glow: string;
}

export const DICE_STYLES: DiceStyle[] = [
  { id: 'classic', name: 'Classic', cost: 0, face: '#FFFFFF', face2: '#EFECE4', pip: '#1D1B24', border: '#DAD5C8', glow: 'rgba(255,255,255,0.55)' },
  { id: 'obsidian', name: 'Obsidian', cost: 120, face: '#26242E', face2: '#15141A', pip: '#FFFFFF', border: '#3B3848', glow: 'rgba(120,120,160,0.5)' },
  { id: 'neon', name: 'Neon', cost: 250, face: '#101328', face2: '#080A18', pip: '#3DF5D0', border: '#2B3370', glow: 'rgba(61,245,208,0.65)' },
  { id: 'gold', name: 'Gold', cost: 500, face: '#F7D779', face2: '#D9A62B', pip: '#4A3208', border: '#B98A18', glow: 'rgba(247,215,121,0.7)' },
];

export const DICE_MAP: Record<string, DiceStyle> = DICE_STYLES.reduce((a, d) => {
  a[d.id] = d;
  return a;
}, {} as Record<string, DiceStyle>);

/* ------------------------------------------------------------------ */
/* Token styles                                                        */
/* ------------------------------------------------------------------ */

export type TokenStyleId = 'sphere' | 'flat' | 'crown' | 'gem';

export interface TokenStyle {
  id: TokenStyleId;
  name: string;
  cost: number;
}

export const TOKEN_STYLES: TokenStyle[] = [
  { id: 'sphere', name: 'Royal Orb', cost: 0 },
  { id: 'flat', name: 'Classic Disc', cost: 100 },
  { id: 'crown', name: 'Crown', cost: 350 },
  { id: 'gem', name: 'Gemstone', cost: 700 },
];

export const TOKEN_MAP: Record<string, TokenStyle> = TOKEN_STYLES.reduce((a, t) => {
  a[t.id] = t;
  return a;
}, {} as Record<string, TokenStyle>);

/* ------------------------------------------------------------------ */
/* Misc helpers                                                        */
/* ------------------------------------------------------------------ */

export function shadow(elevation: number, color = '#000000') {
  return {
    shadowColor: color,
    shadowOpacity: 0.12 + elevation * 0.045,
    shadowRadius: elevation * 1.4,
    shadowOffset: { width: 0, height: elevation * 0.7 },
    elevation,
  };
}

export function contrastText(hex: string) {
  const [r, g, b] = hexToRgb(hex);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#241F0B' : '#FFFFFF';
}
