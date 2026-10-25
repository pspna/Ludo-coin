import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, FadeOut, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming, Easing } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../lib/nav';
import { Board } from '../components/Board';
import { Dice } from '../components/Dice';
import { Btn, Press } from '../components/ui';
import { useStore } from '../lib/store';
import type { MatchResult } from '../lib/store';
import { alpha, contrastText } from '../lib/theme';
import { MAX_STEPS, applyMove, createTokens, hasWon, legalMoves, rollDice, seatProgress, tokensHome, waypointsFor } from '../lib/ludo';
import { chooseMove } from '../lib/ai';
import { haptic, play, setFeedback } from '../lib/sound';
import { multiplayer, type ConnectionState } from '../lib/multiplayer';
import type { Banner, GameMode, MatchState, Seat, Token } from '../lib/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Game'>;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function createMatch(seats: Seat[], mode: GameMode): MatchState {
  return {
    seats,
    tokens: createTokens(seats),
    turn: 0,
    dice: null,
    rolling: false,
    phase: 'roll',
    sixStreak: 0,
    selectable: [],
    moving: null,
    banner: null,
    winnerSeat: null,
    rankings: [],
    startedAt: Date.now(),
    paused: false,
    stats: { rolls: 0, sixes: 0, captures: 0, tokensHome: 0 },
    finishOrder: [],
  };
}

export default function GameScreen({ navigation, route }: Props) {
  const { mode, seats, roomId, isOnline, initialMatch } = route.params;
  const { isDark, theme, save, recordMatch } = useStore();
  const ui = isDark ? theme.dark_ : theme.light;
  const diceStyle = useStore().diceStyle;
  const tokenStyle = useStore().tokenStyle;
  const settings = save.settings;
  const { width, height } = useWindowDimensions();

  const boardSize = Math.max(236, Math.min(width - 30, height - 322));

  const isOnlineMode = !!(isOnline && roomId);
  const myPlayerId = save.profile.id || '';
  const mySeat = isOnlineMode
    ? seats.find((s) => s.playerId === myPlayerId) || seats[0]
    : seats[0];

  const [m, setM] = useState<MatchState>(() => {
    const base = createMatch(seats, mode);
    if (initialMatch) {
      return {
        ...base,
        tokens: initialMatch.tokens ? initialMatch.tokens.map((t: any) => ({ ...t })) : base.tokens,
        turn: typeof initialMatch.turn === 'number' ? initialMatch.turn : 0,
        phase: initialMatch.phase || 'roll',
        dice: initialMatch.dice ?? null,
      };
    }
    return base;
  });

  const [connState, setConnState] = useState<ConnectionState>(multiplayer.getConnectionState());
  const ref = useRef(m);
  const pausedRef = useRef(false);
  const finishedRef = useRef(false);
  const aliveRef = useRef(true);
  const bannerId = useRef(0);
  const [, bump] = useState(0);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const commit = useCallback((mut: (s: MatchState) => void) => {
    if (!aliveRef.current) return;
    const cur = ref.current;
    const next: MatchState = {
      ...cur,
      tokens: cur.tokens.map((t) => ({ ...t })),
      selectable: [...cur.selectable],
      rankings: [...cur.rankings],
      finishOrder: [...cur.finishOrder],
      stats: { ...cur.stats },
    };
    mut(next);
    ref.current = next;
    setM(next);
  }, []);

  useEffect(() => {
    setFeedback({ sound: settings.sound, haptics: settings.haptics });
    play('turn');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toast = useCallback(
    (text: string, tone: Banner['tone'] = 'info', ms = 1500) => {
      bannerId.current += 1;
      const id = bannerId.current;
      commit((c) => {
        c.banner = { id, text, tone };
      });
      setTimeout(() => {
        if (ref.current.banner && ref.current.banner.id === id) {
          commit((c) => {
            c.banner = null;
          });
        }
      }, ms);
    },
    [commit],
  );

  const gate = useCallback(async () => {
    while (pausedRef.current) await sleep(120);
  }, []);

  const stepMs = settings.diceSpeed === 'fast' ? 95 : settings.diceSpeed === 'slow' ? 205 : 145;
  const rollMs = settings.animations ? (settings.diceSpeed === 'fast' ? 480 : settings.diceSpeed === 'slow' ? 1050 : 720) : 130;
  const animMs = settings.animations ? stepMs : 0;

  /* ---------------------- Real-Time Multiplayer Sync ---------------------- */

  useEffect(() => {
    if (!isOnlineMode || !roomId) return;

    // Connect / ensure WebSocket is ready
    multiplayer.connect(myPlayerId, roomId);

    const unsubConn = multiplayer.onConnectionChange((st) => setConnState(st));

    const unsubDice = multiplayer.onDiceRolled(async (payload) => {
      if (payload.roomId !== roomId) return;
      commit((c) => {
        c.phase = 'rolling';
        c.rolling = true;
        c.selectable = [];
      });
      play('roll');
      haptic('light');

      await sleep(rollMs);
      await gate();

      commit((c) => {
        c.dice = payload.dice;
        c.rolling = false;
        c.stats.rolls += 1;
        if (payload.dice === 6) c.stats.sixes += 1;
        if (payload.forfeit) {
          c.phase = 'roll';
          c.turn = (c.turn + 1) % c.seats.length;
          c.sixStreak = 0;
          c.selectable = [];
        } else if (payload.passTurn) {
          c.phase = 'roll';
          c.turn = (c.turn + 1) % c.seats.length;
          c.selectable = [];
        } else {
          c.phase = 'choose';
          c.selectable = payload.moves || [];
        }
      });

      play(payload.dice === 6 ? 'six' : 'dice');
      haptic(payload.dice === 6 ? 'medium' : 'light');

      if (payload.forfeit) {
        toast('Three sixes — turn forfeited!', 'bad', 1600);
      } else if (payload.passTurn) {
        toast('No move available — turn passes', 'info', 1400);
      }
    });

    const unsubMove = multiplayer.onTokenMoved(async (payload) => {
      if (payload.roomId !== roomId) return;
      const tok = ref.current.tokens.find((t) => t.id === payload.tokenId);
      const waypoints = payload.waypoints || (tok ? waypointsFor(tok, payload.dice) : []);

      commit((c) => {
        c.phase = 'moving';
        c.selectable = [];
      });

      if (animMs > 0 && waypoints.length > 0) {
        commit((c) => {
          c.moving = { tokenId: payload.tokenId, waypoints, stepMs: animMs };
        });
        await sleep(animMs * waypoints.length + 30);
        commit((c) => {
          c.moving = null;
        });
      }

      const captures = payload.events ? payload.events.filter((e) => e.type === 'capture').length : 0;
      const finished = payload.events ? payload.events.some((e) => e.type === 'finish') : false;
      const entered = payload.events ? payload.events.some((e) => e.type === 'enter') : false;

      commit((c) => {
        if (payload.room?.match?.tokens) {
          c.tokens = payload.room.match.tokens as Token[];
          if (typeof payload.room.match.turn === 'number') {
            c.turn = payload.room.match.turn;
          }
          c.phase = payload.room.match.phase as any;
          c.dice = payload.room.match.dice ?? null;
          c.sixStreak = payload.room.match.sixStreak || 0;
          c.selectable = payload.room.match.selectable || [];
        }
        c.stats.captures += captures;
        if (finished) c.stats.tokensHome += 1;
      });

      if (captures > 0) {
        play('capture');
        haptic('heavy');
        toast('Token captured and sent home!', 'good', 1500);
      } else if (finished) {
        play('home');
        haptic('success');
        toast('Token reached the center home!', 'gold', 1400);
      } else {
        play('move');
        if (entered) haptic('light');
      }

      await sleep(settings.animations ? (captures ? 800 : finished ? 700 : 200) : 80);
      await gate();

      if (payload.isWinner && payload.winnerSeatId) {
        endGame(payload.winnerSeatId);
      } else if (payload.extraTurn) {
        toast('Roll again!', 'gold', 1100);
      }
    });

    const unsubPlayerLeft = multiplayer.onPlayerLeft((payload) => {
      if (payload.room.id !== roomId) return;
      toast(`${payload.playerName} left the match`, 'bad', 2000);
      if (payload.room?.match) {
        commit((c) => {
          if (typeof payload.room.match?.turn === 'number') {
            c.turn = payload.room.match.turn;
          }
          if (payload.room.match?.tokens) {
            c.tokens = payload.room.match.tokens as Token[];
          }
        });
      }
    });

    const unsubClosed = multiplayer.onRoomClosed(({ reason }) => {
      Alert.alert('Match Ended', reason || 'The host has closed the room.', [
        { text: 'OK', onPress: () => navigation.navigate('Home') },
      ]);
    });

    const unsubSync = multiplayer.onSyncState((nextRoom) => {
      if (nextRoom.id === roomId && nextRoom.match) {
        commit((c) => {
          c.tokens = nextRoom.match!.tokens || c.tokens;
          c.turn = typeof nextRoom.match!.turn === 'number' ? nextRoom.match!.turn : c.turn;
          c.phase = (nextRoom.match!.phase as any) || c.phase;
          c.dice = nextRoom.match!.dice ?? null;
          c.selectable = nextRoom.match!.selectable || [];
          if (nextRoom.match!.winnerSeat) {
            c.winnerSeat = nextRoom.match!.winnerSeat;
          }
        });
      }
    });

    multiplayer.syncState(roomId, myPlayerId);

    return () => {
      unsubConn();
      unsubDice();
      unsubMove();
      unsubPlayerLeft();
      unsubClosed();
      unsubSync();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnlineMode, roomId, myPlayerId]);

  /* ------------------------------- turn flow ------------------------------ */

  const beginTurn = useCallback(async () => {
    if (isOnlineMode) return; // In online mode, turns are governed authoritatively by the server
    await gate();
    const s = ref.current;
    if (s.phase === 'over') return;
    const seat = s.seats[s.turn];
    commit((c) => {
      c.phase = 'roll';
      c.dice = null;
      c.selectable = [];
    });
    play('turn');
    if (seat.type === 'cpu') {
      await sleep(settings.animations ? 620 : 200);
      await gate();
      await doRoll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commit, gate, settings.animations, isOnlineMode]);

  const doRoll = useCallback(async () => {
    const s = ref.current;
    if (s.phase !== 'roll') return;

    if (isOnlineMode && roomId) {
      multiplayer.rollDice(roomId, myPlayerId);
      return;
    }

    const seat = s.seats[s.turn];
    commit((c) => {
      c.phase = 'rolling';
      c.rolling = true;
      c.selectable = [];
    });
    play('roll');
    haptic('light');
    await sleep(rollMs);
    await gate();
    const dice = rollDice();
    commit((c) => {
      c.dice = dice;
      c.rolling = false;
      c.phase = 'choose';
      c.stats.rolls += 1;
      if (dice === 6) c.stats.sixes += 1;
    });
    play(dice === 6 ? 'six' : 'dice');
    haptic(dice === 6 ? 'medium' : 'light');
    await sleep(settings.animations ? 420 : 130);
    await resolveRoll(dice, seat);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commit, gate, rollMs, settings.animations, isOnlineMode, roomId, myPlayerId]);

  const resolveRoll = useCallback(
    async (dice: number, seat: Seat) => {
      const s = ref.current;
      const moves = legalMoves(s.tokens, seat.id, dice);
      const streak = dice === 6 ? s.sixStreak + 1 : 0;

      if (dice === 6 && streak >= 3) {
        commit((c) => {
          c.sixStreak = 0;
        });
        toast('Three sixes — turn forfeited!', 'bad', 1600);
        haptic('warning');
        await sleep(1250);
        return endTurn(false);
      }
      commit((c) => {
        c.sixStreak = streak;
      });

      if (!moves.length) {
        toast(seat.type === 'human' ? 'No move available — turn passes' : `${seat.name} has no move`, 'info', 1400);
        haptic('warning');
        await sleep(1150);
        return endTurn(false);
      }

      commit((c) => {
        c.selectable = moves;
      });

      if (seat.type === 'human') {
        if (moves.length === 1 && settings.autoRoll && settings.animations) {
          await sleep(560);
          await gate();
          return moveToken(moves[0]);
        }
        return; // wait for player tap
      }

      await sleep(settings.animations ? 520 : 180);
      await gate();
      const pick = chooseMove({ tokens: ref.current.tokens, seat, dice, difficulty: seat.difficulty, seats: ref.current.seats });
      if (pick) await moveToken(pick);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [commit, gate, settings.animations, settings.autoRoll, toast],
  );

  const moveToken = useCallback(
    async (tokenId: string) => {
      const s = ref.current;
      const seat = s.seats[s.turn];
      if (s.phase !== 'choose') return;

      if (!s.selectable.includes(tokenId)) {
        play('invalid');
        haptic('warning');
        toast('That token cannot move here', 'bad');
        return;
      }

      if (isOnlineMode && roomId) {
        multiplayer.moveToken(roomId, myPlayerId, tokenId);
        return;
      }

      const dice = s.dice ?? 0;
      const tok = s.tokens.find((t) => t.id === tokenId)!;
      commit((c) => {
        c.phase = 'moving';
        c.selectable = [];
      });

      const waypoints = waypointsFor(tok, dice);
      if (animMs > 0) {
        commit((c) => {
          c.moving = { tokenId, waypoints, stepMs: animMs };
        });
        await sleep(animMs * waypoints.length + 30);
        commit((c) => {
          c.moving = null;
        });
      }

      const result = applyMove(ref.current.tokens, tokenId, dice);
      const captures = result.events.filter((e) => e.type === 'capture').length;
      const finished = result.events.some((e) => e.type === 'finish');
      const entered = result.events.some((e) => e.type === 'enter');

      commit((c) => {
        c.tokens = result.tokens;
        c.stats.captures += captures;
        if (finished) c.stats.tokensHome += 1;
      });

      if (captures > 0) {
        play('capture');
        haptic('heavy');
        toast(captures > 1 ? `${seat.name} sends ${captures} tokens home!` : `${seat.name} captures a token!`, 'good', 1500);
      } else if (finished) {
        play('home');
        haptic('success');
        toast(`${seat.name} brings a token home!`, 'gold', 1400);
      } else {
        play('move');
        if (entered) haptic('light');
      }

      await sleep(settings.animations ? (captures ? 950 : finished ? 800 : 240) : 90);
      await gate();

      const after = ref.current;
      if (hasWon(after.tokens, seat.id)) {
        return endGame(seat.id);
      }
      return endTurn(dice === 6 || captures > 0 || finished);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [commit, gate, animMs, settings.animations, toast, isOnlineMode, roomId, myPlayerId],
  );

  const endTurn = useCallback(
    async (extra: boolean) => {
      if (isOnlineMode) return;
      const s = ref.current;
      if (extra) {
        const seat = s.seats[s.turn];
        toast(seat.type === 'human' ? 'Six! Roll again' : `${seat.name} rolls again`, 'gold', 1100);
        commit((c) => {
          c.phase = 'roll';
          c.dice = null;
        });
        await sleep(520);
        await gate();
        if (seat.type === 'cpu') return doRoll();
        return;
      }
      commit((c) => {
        c.turn = (c.turn + 1) % c.seats.length;
        c.sixStreak = 0;
        c.phase = 'roll';
        c.dice = null;
        c.selectable = [];
      });
      return beginTurn();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [commit, gate, toast, isOnlineMode],
  );

  const endGame = useCallback(
    async (winnerId: string) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      const s = ref.current;
      const order = [winnerId, ...s.seats.filter((x) => x.id !== winnerId).sort((a, b) => seatProgress(s.tokens, b.id) - seatProgress(s.tokens, a.id)).map((x) => x.id)];
      commit((c) => {
        c.phase = 'over';
        c.winnerSeat = winnerId;
        c.rankings = order;
        c.selectable = [];
        c.dice = null;
      });
      const won = winnerId === mySeat.id;
      play(won ? 'win' : 'lose');
      haptic(won ? 'success' : 'warning');
      await sleep(700);

      const progressMine = seatProgress(s.tokens, mySeat.id);
      const rank = won ? 1 : 1 + s.seats.filter((x) => x.id !== mySeat.id && seatProgress(s.tokens, x.id) > progressMine).length;
      const winner = s.seats.find((x) => x.id === winnerId) || s.seats[0];
      const result: MatchResult = {
        mode,
        mySeatId: mySeat.id,
        myColor: mySeat.color,
        winnerSeatId: winnerId,
        rank,
        players: s.seats.length,
        tokens: s.tokens,
        seats: s.seats.map((x) => ({ id: x.id, color: x.color, type: x.type, difficulty: x.difficulty, name: x.name })),
        durationMs: Date.now() - s.startedAt,
        rolls: s.stats.rolls,
        sixes: s.stats.sixes,
        captures: s.stats.captures,
        tokensHome: s.stats.tokensHome,
      };
      const outcome = recordMatch(result);
      setResult({ ...result, won, coins: outcome.coins, unlocked: outcome.unlocked, winnerName: winner.name });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [commit, mySeat, mode, recordMatch],
  );

  /* ------------------------------ one-time start --------------------------- */

  useEffect(() => {
    if (!isOnlineMode) {
      const t = setTimeout(() => beginTurn(), 350);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnlineMode]);

  const restart = useCallback(() => {
    if (isOnlineMode) {
      navigation.navigate('Home');
      return;
    }
    finishedRef.current = false;
    pausedRef.current = false;
    setResult(null);
    setPaused(false);
    const fresh = createMatch(seats, mode);
    ref.current = fresh;
    setM(fresh);
    bump((v) => v + 1);
    setTimeout(() => beginTurn(), 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seats, mode, isOnlineMode, navigation]);

  /* --------------------------------- ui state ------------------------------ */

  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<null | (MatchResult & { won: boolean; coins: number; unlocked: any[]; winnerName: string })>(null);

  const togglePause = () => {
    pausedRef.current = !paused;
    setPaused(pausedRef.current);
    haptic('light');
    play('click');
  };

  const handleQuit = () => {
    if (isOnlineMode && roomId) {
      multiplayer.leaveRoom(roomId, myPlayerId);
    }
    navigation.navigate('Home');
  };

  const activeSeat = (m.seats && m.seats[m.turn]) || (m.seats && m.seats[0]) || { id: 'default', color: 'red', name: 'Player' };
  const activeSpec = (activeSeat?.color && theme.players[activeSeat.color]) || theme.players.red;

  const isMyTurn = isOnlineMode
    ? activeSeat.playerId === myPlayerId || (!activeSeat.playerId && activeSeat.id === mySeat.id)
    : activeSeat.type === 'human';

  const status = useMemo(() => {
    if (m.phase === 'over') return { title: 'Match complete', sub: '' };
    const who = isMyTurn ? 'Your' : `${activeSeat.name}'s`;
    const whoCap = isMyTurn ? 'You' : activeSeat.name;

    if (m.phase === 'roll') {
      return {
        title: `${who} turn`,
        sub: isMyTurn ? 'Tap the dice to roll' : `Waiting for ${activeSeat.name} to roll…`,
      };
    }
    if (m.phase === 'rolling') return { title: `${whoCap} is rolling…`, sub: '' };
    if (m.phase === 'choose') {
      return {
        title: m.dice === 6 ? `${whoCap} rolled a 6!` : `${whoCap} rolled ${m.dice}`,
        sub: isMyTurn
          ? m.selectable.length > 1 ? 'Tap a glowing token to move' : 'Moving a token…'
          : `Waiting for ${activeSeat.name} to move…`,
      };
    }
    return { title: 'Moving token…', sub: '' };
  }, [m.phase, m.dice, m.selectable.length, activeSeat, isMyTurn]);

  const bannerTone = (tone: Banner['tone']) =>
    tone === 'good' ? theme.players.green.main : tone === 'bad' ? ui.danger : tone === 'gold' ? '#E9A81C' : ui.primary;

  const canRoll = isMyTurn && m.phase === 'roll' && !paused;
  const ringPulse = useSharedValue(0);
  useEffect(() => {
    if (canRoll) {
      ringPulse.value = withRepeat(withSequence(withTiming(1, { duration: 720, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 720, easing: Easing.inOut(Easing.quad) })), -1, true);
    } else {
      ringPulse.value = withTiming(0, { duration: 220 });
    }
  }, [canRoll]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.12 + ringPulse.value * 0.55,
    transform: [{ scale: 1 + ringPulse.value * 0.14 }],
    shadowOpacity: 0.4 + ringPulse.value * 0.5,
  }));

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: '#251326' }]} edges={['top', 'bottom']}>
      <LinearGradient colors={['#251326', '#57233F', '#251326']} style={StyleSheet.absoluteFill} />
      <StatusBar style="light" />

      {/* ------------------------------ top bar ----------------------------- */}
      <View style={styles.topBar}>
        <Press onPress={togglePause} style={[styles.iconBtn, { backgroundColor: ui.surface, borderColor: ui.border }]}>
          <Ionicons name="pause" size={19} color={ui.text} />
        </Press>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[styles.modeTitle, { color: ui.text }]}>
            {isOnlineMode ? 'Online Room Match' : mode === 'room' ? 'Room Match' : mode === 'classic' ? 'Classic Match' : mode === 'quick' ? 'Quick Match' : 'Practice'}
          </Text>
          {roomId ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 }}>
              <Ionicons name="key" size={11} color={ui.primary} />
              <Text style={[styles.modeSub, { color: ui.primary, fontWeight: '800' }]}>
                CODE: {roomId.replace(/^room_/, '').toUpperCase()}
              </Text>
            </View>
          ) : (
            <Text style={[styles.modeSub, { color: ui.textDim }]}>
              {m.seats.length} player{m.seats.length > 1 ? 's' : ''} · first to centre wins
            </Text>
          )}
        </View>

        {isOnlineMode ? (
          <View style={[styles.onlineBadge, { backgroundColor: ui.surface, borderColor: ui.border }]}>
            <View
              style={[
                styles.connDot,
                {
                  backgroundColor:
                    connState === 'connected' ? '#22C55E' : connState === 'connecting' ? '#F59E0B' : '#EF4444',
                },
              ]}
            />
            <Text style={{ color: ui.text, fontWeight: '900', fontSize: 11 }}>
              {connState === 'connected' ? 'LIVE' : 'RECONNECT'}
            </Text>
          </View>
        ) : (
          <View style={[styles.iconBtn, { backgroundColor: ui.surface, borderColor: ui.border, flexDirection: 'row', gap: 5, paddingHorizontal: 11 }]}>
            <Ionicons name="star" size={13} color="#E9A81C" />
            <Text style={{ color: ui.text, fontWeight: '900', fontSize: 13 }}>{save.profile.coins}</Text>
          </View>
        )}
      </View>

      {/* ------------------------------- rail ------------------------------- */}
      <View style={styles.rail}>
        {(m.seats || []).map((seat, i) => {
          const spec = (seat?.color && theme.players[seat.color]) || theme.players.red;
          const active = i === m.turn && m.phase !== 'over';
          const home = tokensHome(m.tokens, seat.id);
          const winner = m.winnerSeat === seat.id;
          const isCurrentClient = isOnlineMode ? seat.playerId === myPlayerId : seat.id === mySeat.id;
          return (
            <View
              key={seat.id}
              style={[
                styles.seatCard,
                {
                  backgroundColor: active ? alpha(spec.main, theme.dark ? 0.22 : 0.13) : ui.surface,
                  borderColor: active ? spec.main : ui.border,
                },
              ]}
            >
              <View style={[styles.seatDot, { backgroundColor: spec.main, borderColor: spec.dark }]}>
                {winner ? <Ionicons name="trophy" size={11} color={spec.text} /> : <Text style={{ color: spec.text, fontWeight: '900', fontSize: 10.5 }}>{home}</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={[styles.seatName, { color: active ? spec.main : ui.text }]}>
                  {isCurrentClient ? `${seat.name} (You)` : seat.name}
                </Text>
                <View style={styles.homeRow}>
                  {[0, 1, 2, 3].map((k) => (
                    <View
                      key={k}
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: k < home ? spec.main : ui.border,
                        marginRight: 3,
                      }}
                    />
                  ))}
                </View>
              </View>
              {i === m.turn && m.dice ? (
                <View style={[styles.miniDice, { backgroundColor: ui.surfaceAlt, borderColor: spec.main }]}>
                  <Text style={{ color: ui.text, fontWeight: '900', fontSize: 13 }}>{m.dice}</Text>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      {/* ------------------------------- board ------------------------------ */}
      <View style={styles.boardArea}>
        <Board
          size={boardSize}
          theme={theme}
          tokenStyle={tokenStyle.id}
          tokens={m.tokens}
          activeColor={m.phase === 'over' ? null : activeSeat.color}
          selectable={isMyTurn ? m.selectable : []}
          moving={m.moving}
          hints={settings.hints}
          onTokenPress={(id) => {
            if (isMyTurn && !pausedRef.current) moveToken(id);
          }}
        />

        {m.banner ? (
          <Animated.View key={m.banner.id} entering={FadeInDown.duration(220)} exiting={FadeOut.duration(220)} style={[styles.toast, { backgroundColor: ui.surface, borderColor: bannerTone(m.banner.tone) }]}>
            <View style={[styles.toastDot, { backgroundColor: bannerTone(m.banner.tone) }]} />
            <Text style={{ color: ui.text, fontWeight: '800', fontSize: 13 }}>{m.banner.text}</Text>
          </Animated.View>
        ) : null}
      </View>

      {/* -------------------------------- dock ------------------------------ */}
      <View style={[styles.dock, { backgroundColor: ui.surface, borderTopColor: ui.border }]}>
        <View style={styles.diceWrap}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.diceRing,
              { width: 104, height: 104, borderRadius: 52, borderColor: activeSpec.main, shadowColor: activeSpec.main },
              ringStyle,
            ]}
          />
          <Dice
            value={m.dice}
            rolling={m.rolling}
            size={72}
            style={diceStyle}
            disabled={!isMyTurn}
            onPress={() => {
              if (isMyTurn && ref.current.phase === 'roll' && !pausedRef.current) doRoll();
            }}
          />
        </View>
        <View style={styles.statusWrap}>
          <View style={styles.statusTop}>
            <View style={[styles.turnDot, { backgroundColor: activeSpec.main }]} />
            <Text style={[styles.statusText, { color: ui.text }]} numberOfLines={1}>
              {status.title}
            </Text>
          </View>
          {status.sub ? (
            <Text style={[styles.statusSub, { color: ui.textDim }]} numberOfLines={1}>
              {status.sub}
            </Text>
          ) : null}
          <View style={[styles.progressTrack, { backgroundColor: ui.border }]}>
            <View style={[styles.progressFill, { width: `${Math.round(seatProgress(m.tokens, activeSeat.id) * 100)}%`, backgroundColor: activeSpec.main }]} />
          </View>
        </View>
      </View>

      {/* -------------------------------- pause ----------------------------- */}
      {paused ? (
        <Animated.View entering={FadeIn.duration(180)} style={[StyleSheet.absoluteFill, { backgroundColor: ui.overlay, alignItems: 'center', justifyContent: 'center', padding: 28 }]}>
          <Animated.View entering={FadeInDown.duration(260)} style={[styles.modal, { backgroundColor: ui.surface, borderColor: ui.border }]}>
            <View style={[styles.modalIcon, { backgroundColor: ui.surfaceAlt }]}>
              <Ionicons name="pause-circle" size={30} color={ui.primary} />
            </View>
            <Text style={[styles.modalTitle, { color: ui.text }]}>Paused</Text>
            <Text style={[styles.modalSub, { color: ui.textDim }]}>
              {isOnlineMode ? 'Online match is live on other devices.' : 'Take a breath. The board will wait.'}
            </Text>
            <View style={{ width: '100%', marginTop: 18, gap: 10 }}>
              <Btn ui={ui} full size="lg" label="Resume" icon="play" onPress={togglePause} />
              {!isOnlineMode ? (
                <Btn ui={ui} full variant="surface" label="Restart match" icon="refresh" onPress={restart} />
              ) : null}
              <Btn ui={ui} full variant="surface" label="Settings" icon="settings" onPress={() => navigation.navigate('Settings')} />
              <Btn ui={ui} full variant="ghost" label="Quit to home" icon="exit" onPress={handleQuit} />
            </View>
          </Animated.View>
        </Animated.View>
      ) : null}

      {/* ------------------------------- results ---------------------------- */}
      {result ? (
        <ResultsOverlay
          result={result}
          tokens={m.tokens}
          theme={theme}
          ui={ui}
          totalCoins={save.profile.coins}
          onAgain={restart}
          onHome={handleQuit}
          isOnline={isOnlineMode}
        />
      ) : null}
    </SafeAreaView>
  );
}

/* ----------------------------- results overlay ---------------------------- */

function ResultsOverlay({
  result,
  tokens,
  theme,
  ui,
  totalCoins,
  onAgain,
  onHome,
  isOnline,
}: {
  result: MatchResult & { won: boolean; coins: number; unlocked: any[]; winnerName: string };
  tokens: any[];
  theme: any;
  ui: any;
  totalCoins: number;
  onAgain: () => void;
  onHome: () => void;
  isOnline?: boolean;
}) {
  const confetti = useMemo(
    () =>
      Array.from({ length: 22 }).map((_, i) => ({
        id: i,
        x: (i / 22) * 100 + (i % 3) * 3,
        delay: (i % 7) * 0.22,
        duration: 2.4 + (i % 5) * 0.4,
        color: [theme.players.red.main, theme.players.green.main, theme.players.yellow.main, theme.players.blue.main][i % 4],
        size: 7 + (i % 4) * 3,
      })),
    [theme],
  );

  const ranking = result.seats
    .map((s) => {
      const mine = tokens.filter((t: any) => t.seatId === s.id);
      const home = mine.filter((t: any) => t.steps === MAX_STEPS).length;
      const prog = mine.length ? mine.reduce((a: number, t: any) => a + Math.max(0, t.steps), 0) / (mine.length * MAX_STEPS) : 0;
      return { ...s, home, prog };
    })
    .sort((a, b) => {
      if (a.id === result.winnerSeatId) return -1;
      if (b.id === result.winnerSeatId) return 1;
      return b.prog - a.prog;
    })
    .map((r, i) => ({ ...r, rank: i + 1 }));

  return (
    <Animated.View entering={FadeIn.duration(260)} style={[StyleSheet.absoluteFill, { backgroundColor: ui.overlay, justifyContent: 'center', padding: 22 }]}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {confetti.map((c) => (
          <Confetti key={c.id} piece={c} />
        ))}
      </View>

      <Animated.View entering={FadeInDown.duration(360)} style={[styles.results, { backgroundColor: ui.surface, borderColor: ui.border }]}>
        <LinearGradient
          colors={(result.won ? [theme.players.yellow.main, theme.players.red.main] : [ui.surfaceAlt, ui.surface]) as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.resultsHead, { borderColor: ui.border }]}
        >
          <View style={[styles.crest, { backgroundColor: result.won ? '#2A1B4A' : ui.surface, borderColor: result.won ? '#FFD76A' : ui.border }]}>
            <Ionicons name={result.won ? 'trophy' : 'medal'} size={30} color={result.won ? '#FFD76A' : ui.textDim} />
          </View>
          <Text style={[styles.resultTitle, { color: result.won ? '#fff' : ui.text }]}>
            {result.won ? 'VICTORY!' : result.rank === 2 ? 'So close!' : 'Match complete'}
          </Text>
          <Text style={[styles.resultSub, { color: result.won ? 'rgba(255,255,255,0.9)' : ui.textDim }]}>
            {result.won ? 'You took the crown' : `${result.winnerName} takes the crown`}
          </Text>
        </LinearGradient>

        <ScrollView contentContainerStyle={{ paddingBottom: 2 }} showsVerticalScrollIndicator={false}>
          <View style={styles.rankList}>
            {ranking.map((r) => {
              const spec = theme.players[r.color];
              const isMe = r.id === result.mySeatId;
              return (
                <View key={r.id} style={[styles.rankRow, { backgroundColor: isMe ? alpha(spec.main, theme.dark ? 0.2 : 0.1) : ui.surfaceAlt, borderColor: isMe ? spec.main : ui.border }]}>
                  <View style={[styles.rankMedal, { backgroundColor: r.rank === 1 ? '#F0BE4B' : r.rank === 2 ? '#C9C7D4' : ui.border }]}>
                    <Text style={{ color: r.rank === 1 ? '#3A2A00' : ui.text, fontWeight: '900', fontSize: 12 }}>{r.rank}</Text>
                  </View>
                  <View style={[styles.rankDot, { backgroundColor: spec.main, borderColor: spec.dark }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rankName, { color: ui.text }]} numberOfLines={1}>
                      {r.name}
                      {isMe ? ' (you)' : ''}
                    </Text>
                    <View style={[styles.rankTrack, { backgroundColor: ui.border }]}>
                      <View style={{ width: `${Math.round(r.prog * 100)}%`, height: '100%', backgroundColor: spec.main, borderRadius: 4 }} />
                    </View>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ color: ui.text, fontWeight: '900', fontSize: 14 }}>{r.home}/4</Text>
                    <Text style={{ color: ui.textFaint, fontWeight: '700', fontSize: 9.5 }}>HOME</Text>
                  </View>
                </View>
              );
            })}
          </View>

          <View style={styles.statRow}>
            <Stat icon="dice" label="Rolls" value={`${result.rolls}`} ui={ui} />
            <Stat icon="sparkles" label="Sixes" value={`${result.sixes}`} ui={ui} />
            <Stat icon="hand-left" label="Captures" value={`${result.captures}`} ui={ui} />
            <Stat icon="time" label="Time" value={formatTime(result.durationMs)} ui={ui} />
          </View>

          <View style={[styles.coinBar, { backgroundColor: ui.surfaceAlt, borderColor: ui.border }]}>
            <Ionicons name="star" size={17} color="#E9A81C" />
            <Text style={{ color: ui.text, fontWeight: '900', fontSize: 15 }}>+{result.coins} coins</Text>
            <Text style={{ color: ui.textDim, fontWeight: '700', fontSize: 12 }}>· total {totalCoins}</Text>
          </View>

          {result.unlocked.length ? (
            <View style={{ marginTop: 10, gap: 6 }}>
              {result.unlocked.map((a: any) => (
                <View key={a.id} style={[styles.achRow, { borderColor: '#E9A81C', backgroundColor: alpha('#E9A81C', 0.12) }]}>
                  <Ionicons name="trophy" size={15} color="#E9A81C" />
                  <Text style={{ color: ui.text, fontWeight: '800', fontSize: 12.5, flex: 1 }}>
                    Achievement unlocked · {a.title}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={{ marginTop: 16, gap: 9 }}>
            {!isOnline ? (
              <Btn ui={ui} full size="lg" label="PLAY AGAIN" icon="refresh" onPress={onAgain} />
            ) : null}
            <Btn ui={ui} full size={isOnline ? 'lg' : 'md'} variant={isOnline ? 'primary' : 'surface'} label="Back to home" icon="home" onPress={onHome} />
          </View>
        </ScrollView>
      </Animated.View>
    </Animated.View>
  );
}

function Stat({ icon, label, value, ui }: { icon: string; label: string; value: string; ui: any }) {
  return (
    <View style={[styles.stat, { backgroundColor: ui.surfaceAlt, borderColor: ui.border }]}>
      <Ionicons name={icon as any} size={14} color={ui.primary} />
      <Text style={{ color: ui.text, fontWeight: '900', fontSize: 14, marginTop: 3 }}>{value}</Text>
      <Text style={{ color: ui.textFaint, fontWeight: '700', fontSize: 10 }}>{label}</Text>
    </View>
  );
}

function Confetti({ piece }: { piece: { x: number; delay: number; duration: number; color: string; size: number } }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(withDelay(piece.delay * 1000, withTiming(1, { duration: piece.duration * 1000, easing: Easing.linear })), -1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const st = useAnimatedStyle(() => ({
    transform: [{ translateY: -40 + p.value * 640 }, { rotate: `${p.value * 720}deg` }],
    opacity: 1 - p.value * 0.5,
  }));
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: `${piece.x}%`,
          top: 0,
          width: piece.size,
          height: piece.size * 1.6,
          backgroundColor: piece.color,
          borderRadius: 2,
        },
        st,
      ]}
    />
  );
}

export function formatTime(ms: number) {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 10 },
  iconBtn: { width: 44, height: 40, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  onlineBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, borderWidth: 1.5 },
  connDot: { width: 7, height: 7, borderRadius: 3.5 },
  modeTitle: { fontSize: 15.5, fontWeight: '900' },
  modeSub: { fontSize: 11, fontWeight: '700', marginTop: 1 },
  rail: { flexDirection: 'row', gap: 7, paddingHorizontal: 14, marginTop: 4 },
  seatCard: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 16, borderWidth: 1.5, paddingVertical: 8, paddingHorizontal: 8 },
  seatDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  seatName: { fontSize: 12, fontWeight: '900' },
  homeRow: { flexDirection: 'row', marginTop: 3 },
  miniDice: { width: 24, height: 24, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  boardArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  toast: { position: 'absolute', top: 8, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1.5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 6 },
  toastDot: { width: 8, height: 8, borderRadius: 4 },
  dock: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12, borderTopWidth: 1 },
  diceWrap: { width: 104, height: 104, alignItems: 'center', justifyContent: 'center' },
  diceRing: { position: 'absolute', borderWidth: 3, shadowRadius: 18, shadowOffset: { width: 0, height: 0 }, elevation: 4 },
  statusWrap: { flex: 1 },
  statusTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  turnDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontSize: 16.5, fontWeight: '900' },
  statusSub: { fontSize: 12, fontWeight: '700', marginTop: 2, marginLeft: 18 },
  progressTrack: { height: 6, borderRadius: 4, marginTop: 9, marginLeft: 18, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  modal: { width: '100%', maxWidth: 380, borderRadius: 28, borderWidth: 1.5, padding: 22, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 24, shadowOffset: { width: 0, height: 14 }, elevation: 14 },
  modalIcon: { width: 60, height: 60, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 23, fontWeight: '900' },
  modalSub: { fontSize: 13, fontWeight: '600', marginTop: 5, textAlign: 'center' },
  results: { width: '100%', maxWidth: 420, alignSelf: 'center', borderRadius: 30, borderWidth: 1.5, paddingBottom: 20, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 30, shadowOffset: { width: 0, height: 18 }, elevation: 18, overflow: 'hidden', maxHeight: '96%' },
  resultsHead: { alignItems: 'center', paddingVertical: 22, borderBottomWidth: 1 },
  crest: { width: 66, height: 66, borderRadius: 24, borderWidth: 3, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  resultTitle: { fontSize: 26, fontWeight: '900', letterSpacing: 1.4 },
  resultSub: { fontSize: 13, fontWeight: '700', marginTop: 3 },
  rankList: { paddingHorizontal: 16, paddingTop: 14, gap: 8 },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, borderWidth: 1.5, padding: 10 },
  rankMedal: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  rankDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5 },
  rankName: { fontSize: 13, fontWeight: '900' },
  rankTrack: { height: 5, borderRadius: 4, marginTop: 5, overflow: 'hidden' },
  statRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 14 },
  stat: { flex: 1, alignItems: 'center', borderRadius: 14, borderWidth: 1, paddingVertical: 9 },
  coinBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14, marginHorizontal: 16, borderRadius: 16, borderWidth: 1, paddingVertical: 12 },
  achRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
});
