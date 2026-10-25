import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { TokenView } from './TokenView';
import { BASE_SLOTS, GRID, LANE, MAX_STEPS, RING, SAFE_RING, START_INDEX, posOfToken } from '../lib/ludo';
import { RING_ORDER, alpha } from '../lib/theme';
import type { GameTheme, TokenStyleId } from '../lib/theme';
import type { MoveJob, PlayerColor, Token } from '../lib/types';

interface Props {
  size: number;
  theme: GameTheme;
  tokenStyle: TokenStyleId;
  tokens: Token[];
  activeColor: PlayerColor | null;
  selectable: string[];
  moving: MoveJob | null;
  hints: boolean;
  onTokenPress?: (tokenId: string) => void;
  compact?: boolean;
}

interface Cell {
  r: number;
  c: number;
  kind: 'track' | 'safe' | 'start' | 'lane';
  color?: PlayerColor;
}

const BASE_SIZE = 6;

function baseOrigin(color: PlayerColor) {
  switch (color) {
    case 'red':
      return { left: 0, top: 0 };
    case 'green':
      return { left: 0, top: BASE_SIZE };
    case 'yellow':
      return { left: BASE_SIZE, top: BASE_SIZE };
    default:
      return { left: BASE_SIZE, top: 0 };
  }
}

export function Board({ size, theme, tokenStyle, tokens, activeColor, selectable, moving, hints, onTokenPress, compact }: Props) {
  const cell = size / GRID;
  const board = theme.board;

  const cells = useMemo<Cell[]>(() => {
    const list: Cell[] = [];
    RING.forEach(([r, c], i) => {
      const startColor = RING_ORDER.find((col) => START_INDEX[col] === i);
      const isSafe = SAFE_RING.includes(i);
      list.push({ r, c, kind: startColor ? 'start' : isSafe ? 'safe' : 'track', color: startColor });
    });
    (Object.keys(LANE) as PlayerColor[]).forEach((color) => {
      LANE[color].forEach(([r, c]) => list.push({ r, c, kind: 'lane', color }));
    });
    return list;
  }, []);

  return (
    <View style={[styles.board, { width: size, height: size, borderRadius: size * 0.055, backgroundColor: board.bg, borderColor: board.trackBorder, shadowColor: board.shadow }]}>
      {RING_ORDER.map((color) => (
        <Base key={color} color={color} theme={theme} cell={cell} active={activeColor === color} />
      ))}

      {cells.map((def) => {
        const key = `${def.r}-${def.c}`;
        const isStart = def.kind === 'start';
        const isSafe = def.kind === 'safe';
        const isLane = def.kind === 'lane';
        const spec = def.color ? theme.players[def.color] : null;
        const bg = isStart ? spec!.main : isLane ? alpha(spec!.main, theme.dark ? 0.9 : 0.82) : isSafe ? board.safe : board.track;
        const border = isStart ? spec!.dark : isLane ? spec!.dark : board.trackBorder;
        return (
          <View
            key={key}
            style={{
              position: 'absolute',
              left: def.c * cell,
              top: def.r * cell,
              width: cell,
              height: cell,
              backgroundColor: bg,
              borderRadius: cell * 0.2,
              borderWidth: 1,
              borderColor: border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isSafe && !isStart ? <Ionicons name="star" size={cell * 0.5} color={board.star} /> : null}
            {isStart ? <Ionicons name="play" size={cell * 0.42} color={spec!.text} style={{ marginLeft: cell * 0.05 }} /> : null}
          </View>
        );
      })}

      <View style={{ position: 'absolute', left: 6 * cell, top: 6 * cell, width: 3 * cell, height: 3 * cell }}>
        <Triangle size={cell * 1.5} side="top" color={theme.players.green.main} />
        <Triangle size={cell * 1.5} side="bottom" color={theme.players.blue.main} />
        <Triangle size={cell * 1.5} side="left" color={theme.players.red.main} />
        <Triangle size={cell * 1.5} side="right" color={theme.players.yellow.main} />
        <View
          style={{
            position: 'absolute',
            left: cell * 1.08,
            top: cell * 1.08,
            width: cell * 0.84,
            height: cell * 0.84,
            borderRadius: cell,
            backgroundColor: board.center,
            borderWidth: 1,
            borderColor: board.trackBorder,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.85,
          }}
        >
          {!compact ? <Ionicons name="trophy" size={cell * 0.46} color={board.star} /> : null}
        </View>
      </View>

      {tokens.map((t) => {
        const pos = posOfToken(t);
        const spec = theme.players[t.color];
        const isHome = t.steps === MAX_STEPS;
        const isMoving = !!moving && moving.tokenId === t.id;
        return (
          <TokenView
            key={t.id}
            tokenId={t.id}
            spec={spec}
            styleId={tokenStyle}
            cell={cell}
            pos={pos}
            sizeFactor={isHome ? 0.6 : t.steps < 0 ? 0.78 : 0.86}
            selectable={hints && selectable.includes(t.id)}
            dim={selectable.length > 0 && !selectable.includes(t.id)}
            moving={isMoving ? moving : null}
            zIndex={2 + Math.round(pos.y * 2) + (isMoving ? 60 : 0)}
            onPress={onTokenPress}
          />
        );
      })}
    </View>
  );
}

function Triangle({ size, side, color }: { size: number; side: 'top' | 'bottom' | 'left' | 'right'; color: string }) {
  const common = { width: 0, height: 0, position: 'absolute' as const, borderStyle: 'solid' as const, borderColor: 'transparent' };
  switch (side) {
    case 'top':
      return <View style={[common, { left: 0, top: 0, borderTopWidth: size, borderTopColor: color }]} />;
    case 'bottom':
      return <View style={[common, { left: 0, bottom: 0, borderBottomWidth: size, borderBottomColor: color }]} />;
    case 'left':
      return <View style={[common, { left: 0, top: 0, borderLeftWidth: size, borderLeftColor: color }]} />;
    default:
      return <View style={[common, { right: 0, top: 0, borderRightWidth: size, borderRightColor: color }]} />;
  }
}

function Base({ color, theme, cell, active }: { color: PlayerColor; theme: GameTheme; cell: number; active: boolean }) {
  const spec = theme.players[color];
  const origin = baseOrigin(color);
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (active) {
      pulse.value = withRepeat(withSequence(withTiming(1, { duration: 850, easing: Easing.inOut(Easing.quad) }), withTiming(0.1, { duration: 850, easing: Easing.inOut(Easing.quad) })), -1, true);
    } else {
      pulse.value = withTiming(0, { duration: 250 });
    }
  }, [active]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.3 + pulse.value * 0.6,
    shadowOpacity: 0.4 + pulse.value * 0.4,
  }));

  const size = BASE_SIZE * cell;
  const inset = cell * 0.65;

  return (
    <View style={{ position: 'absolute', left: origin.left * cell, top: origin.top * cell, width: size, height: size }}>
      <View style={{ flex: 1, backgroundColor: theme.board.base, borderRadius: cell * 0.7, borderWidth: 1.5, borderColor: alpha(spec.main, 0.35), padding: inset }}>
        <View style={{ flex: 1, backgroundColor: theme.board.baseInner, borderRadius: cell * 0.5, borderWidth: 1, borderColor: alpha(spec.main, 0.22), alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ position: 'absolute', width: cell * 2.1, height: cell * 2.1, borderRadius: cell, borderWidth: 2, borderColor: alpha(spec.main, 0.22) }} />
        </View>
      </View>

      {[0, 1, 2, 3].map((i) => {
        const [row, col] = BASE_SLOTS[color][i];
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: (col - origin.left) * cell - cell * 0.44,
              top: (row - origin.top) * cell - cell * 0.44,
              width: cell * 0.88,
              height: cell * 0.88,
              borderRadius: cell,
              backgroundColor: theme.board.baseSlot,
              borderWidth: 1,
              borderColor: alpha(spec.main, 0.3),
            }}
          />
        );
      })}

      {active ? (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: cell * 0.7,
              borderWidth: 3,
              borderColor: spec.main,
              shadowColor: spec.main,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 0 },
            },
            glowStyle,
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    borderWidth: 2,
    overflow: 'hidden',
    shadowOpacity: 0.35,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
});
