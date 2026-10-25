import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { DICE_MAP, getTheme, TOKEN_MAP } from './theme';
import type { DiceStyle, GameTheme, TokenStyle } from './theme';
import {
  ACHIEVEMENTS,
  achievementValue,
  clearSave,
  coinsFor,
  defaultSave,
  loadSave,
  persistSave,
} from './storage';
import type { AchievementDef } from './storage';
import type { PlayerColor, SaveData, Settings, Token } from './types';
import { multiplayer } from './multiplayer';

export interface MatchResult {
  mode: 'classic' | 'quick' | 'practice' | 'room';
  mySeatId: string;
  myColor: PlayerColor;
  winnerSeatId: string | null;
  rank: number;
  players: number;
  tokens: Token[];
  seats: { id: string; color: PlayerColor; type: string; difficulty: string; name: string }[];
  durationMs: number;
  rolls: number;
  sixes: number;
  captures: number;
  tokensHome: number;
}

interface StoreValue {
  save: SaveData;
  ready: boolean;
  theme: GameTheme;
  diceStyle: DiceStyle;
  tokenStyle: TokenStyle;
  isDark: boolean;
  update: (fn: (d: SaveData) => void) => void;
  setSettings: (patch: Partial<Settings>) => void;
  setName: (name: string) => void;
  setAvatar: (c: PlayerColor) => void;
  buy: (kind: 'theme' | 'dice' | 'token', id: string, cost: number) => boolean;
  equip: (kind: 'theme' | 'dice' | 'token', id: string) => void;
  recordMatch: (result: MatchResult) => { coins: number; unlocked: AchievementDef[] };
  resetAll: () => void;
}

const StoreCtx = createContext<StoreValue | null>(null);

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const [save, setSave] = useState<SaveData>(() => defaultSave());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    loadSave().then((s) => {
      if (!alive) return;
      if (s?.settings?.serverUrl) {
        multiplayer.setServerUrl(s.settings.serverUrl);
      }
      setSave(s);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const update = useCallback((fn: (d: SaveData) => void) => {
    setSave((prev) => {
      const next = clone(prev);
      fn(next);
      persistSave(next);
      return next;
    });
  }, []);

  const setSettings = useCallback(
    (patch: Partial<Settings>) => {
      if (patch.serverUrl !== undefined) {
        multiplayer.setServerUrl(patch.serverUrl);
      }
      return update((d) => Object.assign(d.settings, patch));
    },
    [update],
  );

  const setName = useCallback((name: string) => update((d) => { d.profile.name = name.slice(0, 14) || 'Player'; }), [update]);
  const setAvatar = useCallback((c: PlayerColor) => update((d) => { d.profile.avatar = c; }), [update]);

  const buy = useCallback(
    (kind: 'theme' | 'dice' | 'token', id: string, cost: number) => {
      let ok = false;
      update((d) => {
        const list = kind === 'theme' ? d.custom.ownedThemes : kind === 'dice' ? d.custom.ownedDice : d.custom.ownedTokens;
        if (list.includes(id) || d.profile.coins < cost) return;
        list.push(id);
        d.profile.coins -= cost;
        if (kind === 'theme') d.custom.theme = id;
        if (kind === 'dice') d.custom.dice = id;
        if (kind === 'token') d.custom.token = id;
        ok = true;
      });
      return ok;
    },
    [update],
  );

  const equip = useCallback(
    (kind: 'theme' | 'dice' | 'token', id: string) =>
      update((d) => {
        const owned = kind === 'theme' ? d.custom.ownedThemes : kind === 'dice' ? d.custom.ownedDice : d.custom.ownedTokens;
        if (!owned.includes(id)) return;
        if (kind === 'theme') d.custom.theme = id;
        if (kind === 'dice') d.custom.dice = id;
        if (kind === 'token') d.custom.token = id;
      }),
    [update],
  );

  const recordMatch = useCallback(
    (result: MatchResult) => {
      const unlocked: AchievementDef[] = [];
      let coins = 0;
      update((d) => {
        const s = d.stats;
        s.games += 1;
        s.modes[result.mode] = (s.modes[result.mode] || 0) + 1;
        s.rolls += result.rolls;
        s.sixes += result.sixes;
        s.captures += result.captures;
        s.tokensHome += result.tokensHome;
        s.totalTimeMs += result.durationMs;
        if (result.rank === 1) {
          s.wins += 1;
          s.streak += 1;
          s.bestStreak = Math.max(s.bestStreak, s.streak);
          s.winsByColor[result.myColor] += 1;
          if (s.fastestWinMs === 0 || result.durationMs < s.fastestWinMs) s.fastestWinMs = result.durationMs;
          if (result.seats.some((x) => x.type === 'cpu' && x.difficulty === 'expert')) s.winsExpert += 1;
          if (result.players >= 4) s.winsFourPlayer += 1;
          if (result.captures === 0 && result.mode !== 'practice') s.winsNoCapture += 1;
          if (result.durationMs < 180000) s.blitzWins += 1;
        } else {
          s.streak = 0;
          if (result.rank === 2) s.seconds += 1;
          else if (result.rank === 3) s.thirds += 1;
          else s.fourths += 1;
        }
        coins = coinsFor({
          mode: result.mode,
          rank: result.rank,
          players: result.players,
          tokensHome: result.tokensHome,
          captures: result.captures,
        });
        d.profile.coins += coins;
        for (const def of ACHIEVEMENTS) {
          const val = achievementValue(def, s);
          const prev = d.achievements[def.id];
          if (val >= def.goal && (!prev || prev < def.goal)) {
            d.achievements[def.id] = Date.now();
            unlocked.push(def);
          } else if (!prev) {
            d.achievements[def.id] = val;
          } else {
            d.achievements[def.id] = Math.max(prev, val);
          }
        }
      });
      return { coins, unlocked };
    },
    [update],
  );

  const resetAll = useCallback(() => {
    const fresh = defaultSave();
    fresh.onboarded = save.onboarded;
    setSave(fresh);
    persistSave(fresh);
  }, [save.onboarded]);

  const clearEverything = useCallback(() => {
    clearSave().then(() => {
      const fresh = defaultSave();
      setSave(fresh);
      persistSave(fresh);
    });
  }, []);

  const theme = getTheme(save.custom.theme);
  const isDark = save.settings.appearance === 'auto' ? scheme === 'dark' : save.settings.appearance === 'dark';
  const ui = isDark ? theme.dark_ : theme.light;

  const value = useMemo<StoreValue>(
    () => ({
      save,
      ready,
      theme,
      diceStyle: DICE_MAP[save.custom.dice] || DICE_MAP.classic,
      tokenStyle: TOKEN_MAP[save.custom.token] || TOKEN_MAP.sphere,
      isDark,
      update,
      setSettings,
      setName,
      setAvatar,
      buy,
      equip,
      recordMatch,
      resetAll: clearEverything,
    }),
    [save, ready, theme, isDark, update, setSettings, setName, setAvatar, buy, equip, recordMatch, clearEverything],
  );

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}

/** Convenience: the UI palette for the current theme + appearance. */
export function useUi() {
  const { theme, isDark } = useStore();
  return isDark ? theme.dark_ : theme.light;
}
