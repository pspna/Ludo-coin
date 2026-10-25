import { RING, SAFE_SET, applyMove, cellKey, legalMoves, progress, ringIndexOf } from './ludo';
import type { Difficulty, PlayerColor, Seat, Token } from './types';

interface Weights {
  finish: number;
  capture: number;
  enter: number;
  lane: number;
  safe: number;
  advance: number;
  risk: number;
  rescue: number;
  spread: number;
  random: number;
  look: number;
}

const WEIGHTS: Record<Difficulty, Weights> = {
  easy: { finish: 100, capture: 85, enter: 65, lane: 18, safe: 6, advance: 1.1, risk: 6, rescue: 8, spread: 0, random: 0.66, look: 0 },
  medium: { finish: 150, capture: 140, enter: 85, lane: 34, safe: 26, advance: 1.6, risk: 30, rescue: 22, spread: 6, random: 0.06, look: 0 },
  hard: { finish: 165, capture: 155, enter: 92, lane: 40, safe: 32, advance: 1.8, risk: 58, rescue: 34, spread: 10, random: 0, look: 0.25 },
  expert: { finish: 175, capture: 165, enter: 96, lane: 44, safe: 36, advance: 1.9, risk: 70, rescue: 40, spread: 12, random: 0, look: 0.85 },
};

interface Evaluation {
  score: number;
  capture: boolean;
  finish: boolean;
  entered: boolean;
  danger: number;
}

function ringIndexFor(t: Token, steps: number) {
  return ringIndexOf(t.color, steps);
}

/** How likely this freshly moved token is to be knocked out next turn. */
function captureRisk(tokensNow: Token[], mover: Token, steps: number): number {
  if (steps < 0 || steps > 50) return 0;
  const key = cellKey(...ringCell(steps, mover.color));
  if (SAFE_SET.has(key)) return 0;
  const myIdx = ringIndexFor(mover, steps);
  let risk = 0;
  for (const e of tokensNow) {
    if (e.color === mover.color) continue;
    if (e.steps < 0) {
      // sitting on base: a 6 lets it land on its own start square
      const startIdx = ringIndexFor(e, 0);
      if (startIdx === myIdx) risk += 1 / 6;
      continue;
    }
    if (e.steps > 50) continue;
    const d = (myIdx - ringIndexFor(e, e.steps) + 52) % 52;
    if (d >= 1 && d <= 6) {
      const p = 1 / 6;
      risk = risk + p - risk * p;
    }
  }
  return Math.min(1, risk);
}

function ringCell(steps: number, color: PlayerColor): [number, number] {
  return RING[ringIndexOf(color, steps)];
}

/** Value of knocking an opponent token home. */
function victimValue(tokensNow: Token[], capturedId: string) {
  const v = tokensNow.find((t) => t.id === capturedId);
  return v ? 6 + progress(v) * 1.1 : 6;
}

function evaluate(
  tokensNow: Token[],
  seat: Seat,
  tokenId: string,
  dice: number,
  w: Weights,
): Evaluation {
  const tok = tokensNow.find((t) => t.id === tokenId)!;
  const from = tok.steps;
  const { tokens: after, events } = applyMove(tokensNow, tokenId, dice);
  const moved = after.find((t) => t.id === tokenId)!;
  const to = moved.steps;

  let score = 0;
  const finish = events.some((e) => e.type === 'finish');
  const entered = from < 0;
  const captures = events.filter((e) => e.type === 'capture');

  if (finish) {
    score += w.finish;
  } else if (entered) {
    score += w.enter;
  }

  for (const c of captures) {
    score += w.capture + victimValue(tokensNow, c.capturedId!);
  }

  if (!finish) {
    if (to > 50) score += w.lane;
    const danger = captureRisk(after, moved, to);
    score -= w.risk * danger;
    score += w.advance * to;
  }

  // reward freeing a token that is currently under threat
  if (entered) {
    let threatened = 0;
    for (const t of tokensNow) {
      if (t.seatId !== seat.id || t.id === tokenId || t.steps < 0 || t.steps > 50) continue;
      if (captureRisk(tokensNow, t, t.steps) > 0.1) threatened++;
    }
    score += w.rescue * threatened;
  }

  // keep options open: don't stack every token on one square
  let stack = 0;
  for (const t of after) {
    if (t.seatId === seat.id && t.id !== tokenId && t.steps === to && to <= 50) stack++;
  }
  score -= w.spread * stack;

  return { score, capture: captures.length > 0, finish, entered, danger: 0 };
}

/** Best damage an opponent can do on their next roll (expected over 1..6). */
function opponentThreat(after: Token[], seat: Seat, w: Weights): number {
  let total = 0;
  for (const opp of after.filter((s) => s.id !== seat.id)) {
    let best = 0;
    for (let d = 1; d <= 6; d++) {
      const moves = legalMoves(after, opp.id, d);
      if (!moves.length) continue;
      let top = 0;
      for (const m of moves) {
        const { events } = applyMove(after, m, d);
        let v = 0;
        for (const e of events) {
          if (e.type === 'capture') v += w.capture * 0.75 + victimValue(after, e.capturedId!) * 0.8;
          if (e.type === 'finish') v += w.finish * 0.22;
        }
        if (v > top) top = v;
      }
      best += top / 6;
    }
    total += best;
  }
  return total;
}

export function chooseMove(params: {
  tokens: Token[];
  seat: Seat;
  dice: number;
  difficulty: Difficulty;
  seats: Seat[];
}): string | null {
  const { tokens: tokensNow, seat, dice, difficulty } = params;
  const w = WEIGHTS[difficulty];
  const moves = legalMoves(tokensNow, seat.id, dice);
  if (!moves.length) return null;
  if (moves.length === 1) return moves[0];

  if (Math.random() < w.random) {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  let best = moves[0];
  let bestScore = -Infinity;
  for (const id of moves) {
    const ev = evaluate(tokensNow, seat, id, dice, w);
    let score = ev.score;
    if (w.look > 0) {
      const { tokens: after } = applyMove(tokensNow, id, dice);
      score -= w.look * opponentThreat(after, seat, w) * 6;
    }
    score += Math.random() * 0.5;
    if (score > bestScore) {
      bestScore = score;
      best = id;
    }
  }
  return best;
}

export const DIFFICULTIES: { id: Difficulty; name: string; blurb: string; icon: string }[] = [
  { id: 'easy', name: 'Easy', blurb: 'Casual and forgiving', icon: 'happy-outline' },
  { id: 'medium', name: 'Medium', blurb: 'Balanced opponent', icon: 'happy' },
  { id: 'hard', name: 'Hard', blurb: 'Plays to win', icon: 'flame' },
  { id: 'expert', name: 'Expert', blurb: 'Sees everything', icon: 'skull' },
];
