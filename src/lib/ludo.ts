import type { GameEvent, PlayerColor, Pt, Seat, Token } from './types';

export const GRID = 15;
export const MAX_STEPS = 56; // 0 = start square, 50 = last ring cell, 51-55 = lane, 56 = home
export const TOKENS_PER_PLAYER = 4;

/** The 52 square ring, clockwise, as [row, col] on a 15x15 grid. */
export const RING: [number, number][] = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
  [0, 7],
  [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
  [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
  [7, 14],
  [8, 14], [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
  [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
  [14, 7],
  [14, 6], [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
  [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
  [7, 0],
  [6, 0],
];

export const START_INDEX: Record<PlayerColor, number> = { red: 0, green: 13, yellow: 26, blue: 39 };

export const LANE: Record<PlayerColor, [number, number][]> = {
  red: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
  green: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  yellow: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
  blue: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
};

/** Star squares (8 steps after every start) + the four start squares are safe. */
export const SAFE_RING: number[] = [0, 8, 13, 21, 26, 34, 39, 47];
export const SAFE_CELLS: string[] = SAFE_RING.map((i) => cellKey(RING[i][0], RING[i][1]));
export const SAFE_SET = new Set(SAFE_CELLS);

export const BASE_SLOTS: Record<PlayerColor, [number, number][]> = {
  red: [[1.5, 1.5], [1.5, 3.5], [3.5, 1.5], [3.5, 3.5]],
  green: [[1.5, 10.5], [1.5, 12.5], [3.5, 10.5], [3.5, 12.5]],
  yellow: [[10.5, 10.5], [10.5, 12.5], [12.5, 10.5], [12.5, 12.5]],
  blue: [[10.5, 1.5], [10.5, 3.5], [12.5, 1.5], [12.5, 3.5]],
};

/** Resting spots inside the centre triangle, as [x, y] in grid units. */
export const HOME_SLOTS: Record<PlayerColor, [number, number][]> = {
  red: [[6.45, 6.62], [6.45, 7.38], [7.02, 6.62], [7.02, 7.38]],
  green: [[6.62, 6.45], [7.38, 6.45], [6.62, 7.02], [7.38, 7.02]],
  yellow: [[7.98, 6.62], [7.98, 7.38], [8.55, 6.62], [8.55, 7.38]],
  blue: [[6.62, 7.98], [7.38, 7.98], [6.62, 8.55], [7.38, 8.55]],
};

export function cellKey(r: number, c: number) {
  return `${r},${c}`;
}

export function createTokens(seats: Seat[]): Token[] {
  const tokens: Token[] = [];
  seats.forEach((seat) => {
    for (let i = 0; i < TOKENS_PER_PLAYER; i++) {
      tokens.push({ id: `${seat.color}-${i}`, seatId: seat.id, color: seat.color, index: i, steps: -1 });
    }
  });
  return tokens;
}

export function ringIndexOf(color: PlayerColor, steps: number) {
  return (START_INDEX[color] + steps) % 52;
}

export function ringCellOf(color: PlayerColor, steps: number): [number, number] {
  return RING[ringIndexOf(color, steps)];
}

export function cellOfToken(t: Token, steps = t.steps): [number, number] {
  if (steps < 0) {
    const [y, x] = BASE_SLOTS[t.color][t.index];
    return [y, x] as [number, number];
  }
  if (steps <= 50) return ringCellOf(t.color, steps);
  if (steps < MAX_STEPS) return LANE[t.color][steps - 51];
  const [x, y] = HOME_SLOTS[t.color][t.index];
  return [y, x] as [number, number];
}

/** Position in grid units {x: col, y: row} - fractional for base / centre. */
export function posOfToken(t: Token, steps = t.steps): Pt {
  const [row, col] = cellOfToken(t, steps);
  return { x: col, y: row };
}

export function isSafeToken(t: Token) {
  if (t.steps < 0) return true;
  if (t.steps > 50) return true; // own lane or home
  return SAFE_SET.has(cellKey(...ringCellOf(t.color, t.steps)));
}

export function legalMoves(tokens: Token[], seatId: string, dice: number): string[] {
  const mine = tokens.filter((t) => t.seatId === seatId);
  const out: string[] = [];
  for (const t of mine) {
    if (t.steps < 0) {
      if (dice === 6) out.push(t.id);
    } else if (t.steps < MAX_STEPS && t.steps + dice <= MAX_STEPS) {
      out.push(t.id);
    }
  }
  return out;
}

export function applyMove(tokens: Token[], tokenId: string, dice: number): { tokens: Token[]; events: GameEvent[] } {
  const next = tokens.map((t) => ({ ...t }));
  const tok = next.find((t) => t.id === tokenId);
  const events: GameEvent[] = [];
  if (!tok) return { tokens: next, events };

  if (tok.steps < 0) {
    tok.steps = 0;
    events.push({ type: 'enter', tokenId });
  } else {
    tok.steps = Math.min(MAX_STEPS, tok.steps + dice);
  }

  if (tok.steps === MAX_STEPS) {
    events.push({ type: 'finish', tokenId });
    return { tokens: next, events };
  }

  if (tok.steps <= 50) {
    const key = cellKey(...ringCellOf(tok.color, tok.steps));
    if (SAFE_SET.has(key)) {
      events.push({ type: 'safe', tokenId });
    } else {
      for (const opp of next) {
        if (opp.color === tok.color || opp.steps < 0 || opp.steps > 50) continue;
        if (cellKey(...ringCellOf(opp.color, opp.steps)) === key) {
          opp.steps = -1;
          events.push({ type: 'capture', tokenId, capturedId: opp.id });
        }
      }
    }
  }
  return { tokens: next, events };
}

/** Every cell a token rolls through, so the piece can glide step by step. */
export function waypointsFor(t: Token, dice: number): Pt[] {
  const pts: Pt[] = [];
  if (t.steps < 0) {
    pts.push(posOfToken(t, 0));
    return pts;
  }
  for (let i = 1; i <= dice; i++) {
    pts.push(posOfToken(t, t.steps + i));
  }
  return pts;
}

export function tokensHome(tokens: Token[], seatId: string) {
  return tokens.filter((t) => t.seatId === seatId && t.steps === MAX_STEPS).length;
}

export function tokensOut(tokens: Token[], seatId: string) {
  return tokens.filter((t) => t.seatId === seatId && t.steps >= 0 && t.steps < MAX_STEPS).length;
}

/** 0 - 56 progress metric used by the AI and the results screen. */
export function progress(t: Token) {
  return t.steps < 0 ? 0 : t.steps;
}

export function seatProgress(tokens: Token[], seatId: string) {
  const mine = tokens.filter((t) => t.seatId === seatId);
  const total = mine.reduce((sum, t) => sum + progress(t), 0);
  return total / (TOKENS_PER_PLAYER * MAX_STEPS);
}

export function hasWon(tokens: Token[], seatId: string) {
  return tokensHome(tokens, seatId) === TOKENS_PER_PLAYER;
}

/** Distance (1..6 friendly) from an enemy token to a given ring index. */
export function enemyDistance(fromRingIndex: number, toRingIndex: number) {
  return (toRingIndex - fromRingIndex + 52) % 52;
}

export function rollDice() {
  return 1 + Math.floor(Math.random() * 6);
}
