import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GameMode, PlayerColor, SaveData, Settings, Stats } from './types';

const KEY = 'ludoRoyale.save.v1';

export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  haptics: true,
  animations: true,
  hints: true,
  autoRoll: true,
  diceSpeed: 'normal',
  appearance: 'auto',
};

export const DEFAULT_STATS: Stats = {
  games: 0,
  wins: 0,
  seconds: 0,
  thirds: 0,
  fourths: 0,
  rolls: 0,
  sixes: 0,
  captures: 0,
  tokensHome: 0,
  streak: 0,
  bestStreak: 0,
  fastestWinMs: 0,
  totalTimeMs: 0,
  winsExpert: 0,
  winsFourPlayer: 0,
  winsNoCapture: 0,
  blitzWins: 0,
  winsByColor: { red: 0, green: 0, yellow: 0, blue: 0 } as Record<PlayerColor, number>,
  modes: { classic: 0, quick: 0, practice: 0, room: 0 } as Record<GameMode, number>,
};

function generatePlayerId() {
  return 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

export function defaultSave(): SaveData {
  return {
    version: 1,
    profile: { id: generatePlayerId(), name: 'Player', coins: 120, created: Date.now(), avatar: 'red' },
    stats: JSON.parse(JSON.stringify(DEFAULT_STATS)),
    settings: { ...DEFAULT_SETTINGS },
    custom: {
      theme: 'classic',
      dice: 'classic',
      token: 'sphere',
      ownedThemes: ['classic'],
      ownedDice: ['classic'],
      ownedTokens: ['sphere'],
    },
    achievements: {},
    onboarded: false,
  };
}

export interface AchievementDef {
  id: string;
  title: string;
  desc: string;
  icon: string;
  goal: number;
  tier: 'bronze' | 'silver' | 'gold';
  value: (s: Stats) => number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_win', title: 'Royale Debut', desc: 'Win your very first match', icon: 'trophy', goal: 1, tier: 'bronze', value: (s) => s.wins },
  { id: 'play_5', title: 'Getting Started', desc: 'Play 5 matches', icon: 'game-controller', goal: 5, tier: 'bronze', value: (s) => s.games },
  { id: 'play_25', title: 'Table Regular', desc: 'Play 25 matches', icon: 'planet', goal: 25, tier: 'silver', value: (s) => s.games },
  { id: 'win_5', title: 'Champion', desc: 'Win 5 matches', icon: 'ribbon', goal: 5, tier: 'silver', value: (s) => s.wins },
  { id: 'win_20', title: 'Living Legend', desc: 'Win 20 matches', icon: 'diamond', goal: 20, tier: 'gold', value: (s) => s.wins },
  { id: 'roll_100', title: 'Dice Master', desc: 'Roll the dice 100 times', icon: 'dice', goal: 100, tier: 'bronze', value: (s) => s.rolls },
  { id: 'six_25', title: 'Lucky Six', desc: 'Roll 25 sixes', icon: 'sparkles', goal: 25, tier: 'silver', value: (s) => s.sixes },
  { id: 'capture_20', title: 'Token Slayer', desc: 'Send 20 tokens back to base', icon: 'hand-left', goal: 20, tier: 'bronze', value: (s) => s.captures },
  { id: 'capture_100', title: 'The Reaper', desc: 'Send 100 tokens back to base', icon: 'skull', goal: 100, tier: 'gold', value: (s) => s.captures },
  { id: 'home_50', title: 'Homecoming', desc: 'Guide 50 tokens to the centre', icon: 'home', goal: 50, tier: 'silver', value: (s) => s.tokensHome },
  { id: 'streak_5', title: 'On Fire', desc: 'Win 5 matches in a row', icon: 'flame', goal: 5, tier: 'gold', value: (s) => s.bestStreak },
  { id: 'expert_win', title: 'Grandmaster', desc: 'Beat an Expert computer', icon: 'moon', goal: 1, tier: 'gold', value: (s) => s.winsExpert },
  { id: 'four_player_win', title: 'Royal Table', desc: 'Win a 4 player match', icon: 'people', goal: 1, tier: 'silver', value: (s) => s.winsFourPlayer },
  { id: 'no_capture_win', title: 'Untouchable', desc: 'Win a match without capturing', icon: 'shield-checkmark', goal: 1, tier: 'silver', value: (s) => s.winsNoCapture },
  { id: 'blitz_win', title: 'Blitzkrieg', desc: 'Win a match in under 3 minutes', icon: 'flash', goal: 1, tier: 'silver', value: (s) => s.blitzWins },
  { id: 'rainbow', title: 'Rainbow Crown', desc: 'Win with all four colours', icon: 'color-palette', goal: 4, tier: 'gold', value: (s) => Object.values(s.winsByColor).filter((v) => v > 0).length },
];

export const ACHIEVEMENT_MAP: Record<string, AchievementDef> = ACHIEVEMENTS.reduce((a, d) => {
  a[d.id] = d;
  return a;
}, {} as Record<string, AchievementDef>);

export function achievementValue(def: AchievementDef, stats: Stats) {
  try {
    return Math.max(0, Math.min(def.goal, def.value(stats)));
  } catch {
    return 0;
  }
}

export async function loadSave(): Promise<SaveData> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw) as SaveData;
    const base = defaultSave();
    const profile = { ...base.profile, ...(parsed.profile || {}) };
    if (!profile.id) {
      profile.id = generatePlayerId();
    }
    return {
      ...base,
      ...parsed,
      profile,
      stats: { ...base.stats, ...(parsed.stats || {}), winsByColor: { ...base.stats.winsByColor, ...(parsed.stats?.winsByColor || {}) }, modes: { ...base.stats.modes, ...(parsed.stats?.modes || {}) } },
      settings: { ...base.settings, ...(parsed.settings || {}) },
      custom: { ...base.custom, ...(parsed.custom || {}) },
      achievements: { ...(parsed.achievements || {}) },
    };
  } catch {
    return defaultSave();
  }
}

export async function persistSave(save: SaveData) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // storage failure should never crash the game
  }
}

export async function clearSave() {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

export function coinsFor(params: { mode: GameMode; rank: number; players: number; tokensHome: number; captures: number }) {
  const { mode, rank, players, tokensHome, captures } = params;
  if (mode === 'practice') return 8;
  const base = rank === 1 ? (mode === 'quick' ? 45 : 80) : rank === 2 ? 25 : rank === 3 ? 14 : 8;
  const table = players >= 4 ? 20 : players === 3 ? 10 : 0;
  return base + table + tokensHome * 5 + captures * 6;
}
