/* Headless balance / correctness simulation for the Ludo engine + AI.
   Run:  npx tsc src/lib/ludo.ts src/lib/ai.ts src/lib/types.ts --outDir /tmp/ludotest --module commonjs --target es2019 --skipLibCheck --esModuleInterop --ignoreConfig && node scripts/sim.js */
const os = require('os');
const path = require('path');
const outDir = path.join(os.tmpdir(), 'ludotest') + path.sep;
const L = require(outDir + 'ludo.js');
const A = require(outDir + 'ai.js');

console.log('ring length', L.RING.length);
console.log('unique cells', new Set(L.RING.map(([r, c]) => `${r},${c}`)).size);
console.log('all in range', L.RING.every(([r, c]) => r >= 0 && r < 15 && c >= 0 && c < 15));
console.log('safe cells', L.SAFE_CELLS.join(' '));
for (const color of ['red', 'green', 'yellow', 'blue']) {
  console.log(color, 'last ring cell', L.ringCellOf(color, 50), '-> lane starts', L.LANE[color][0]);
}

function playGame(seats, maxTurns = 30000) {
  let tokens = L.createTokens(seats);
  let turn = 0;
  let sixStreak = 0;
  let turns = 0;
  let captures = 0;
  while (turns < maxTurns) {
    turns++;
    const seat = seats[turn];
    const dice = L.rollDice();
    sixStreak = dice === 6 ? sixStreak + 1 : 0;
    if (dice === 6 && sixStreak >= 3) {
      sixStreak = 0;
      turn = (turn + 1) % seats.length;
      continue;
    }
    const moves = L.legalMoves(tokens, seat.id, dice);
    if (!moves.length) {
      turn = (turn + 1) % seats.length;
      continue;
    }
    const pick = A.chooseMove({ tokens, seat, dice, difficulty: seat.difficulty, seats });
    if (!moves.includes(pick)) throw new Error('AI chose an illegal move ' + pick);
    const res = L.applyMove(tokens, pick, dice);
    tokens = res.tokens;
    captures += res.events.filter((e) => e.type === 'capture').length;
    if (tokens.some((t) => t.steps > 56 || t.steps < -1)) throw new Error('token out of bounds');
    if (L.hasWon(tokens, seat.id)) return { winner: seat.id, turns, captures };
    if (!(dice === 6 || res.events.some((e) => e.type === 'capture' || e.type === 'finish'))) {
      turn = (turn + 1) % seats.length;
    }
  }
  return { winner: null, turns, captures };
}

const mk = (diffs) => ['red', 'green', 'yellow', 'blue'].slice(0, diffs.length).map((c, i) => ({
  id: c + '-seat', color: c, name: 'P' + i, type: 'cpu', difficulty: diffs[i],
}));

const wins = { red: 0, green: 0, yellow: 0, blue: 0 };
let noWin = 0;
let totalTurns = 0;
let totalCaps = 0;
const N = 300;
const seatById = (diffs) => mk(diffs);
for (let i = 0; i < N; i++) {
  const seats = seatById(['expert', 'hard', 'medium', 'easy']);
  const r = playGame(seats);
  if (!r.winner) noWin++;
  else wins[seats.find((s) => s.id === r.winner).color]++;
  totalTurns += r.turns;
  totalCaps += r.captures;
}
console.log('4p wins', JSON.stringify(wins), 'unfinished', noWin);
console.log('avg turns', Math.round(totalTurns / N), 'avg captures', (totalCaps / N).toFixed(1));

let quickNoWin = 0;
for (let i = 0; i < 100; i++) if (!playGame(mk(['medium', 'easy'])).winner) quickNoWin++;
console.log('2p unfinished', quickNoWin);

let soloNoWin = 0;
for (let i = 0; i < 50; i++) if (!playGame(mk(['easy'])).winner) soloNoWin++;
console.log('solo unfinished', soloNoWin);

// expert vs easy win-rate (should be heavily expert)
let eWins = 0;
for (let i = 0; i < 200; i++) if (playGame(mk(['expert', 'easy'])).winner === 'red-seat') eWins++;
console.log('expert beats easy', eWins + '/200');
let hWins = 0;
for (let i = 0; i < 200; i++) if (playGame(mk(['hard', 'easy'])).winner === 'red-seat') hWins++;
console.log('hard beats easy', hWins + '/200');
let hmWins = 0;
for (let i = 0; i < 200; i++) if (playGame(mk(['hard', 'medium'])).winner === 'red-seat') hmWins++;
console.log('hard beats medium', hmWins + '/200');
let ehWins = 0;
for (let i = 0; i < 200; i++) if (playGame(mk(['expert', 'hard'])).winner === 'red-seat') ehWins++;
console.log('expert beats hard', ehWins + '/200');
let mWins = 0;
for (let i = 0; i < 200; i++) if (playGame(mk(['medium', 'easy'])).winner === 'red-seat') mWins++;
console.log('medium beats easy', mWins + '/200');
let aaWins = 0;
for (let i = 0; i < 400; i++) if (playGame(mk(['easy', 'easy'])).winner === 'red-seat') aaWins++;
console.log('easy vs easy (seat bias check, expect ~50%)', aaWins + '/400');

const seats = mk(['expert', 'hard', 'medium', 'easy']);
let tokens = L.createTokens(seats);
tokens = L.applyMove(tokens, 'red-1', 6).tokens;
tokens.find((t) => t.id === 'red-1').steps = 20;
const t0 = Date.now();
for (let i = 0; i < 200; i++) A.chooseMove({ tokens, seat: seats[0], dice: 4, difficulty: 'expert', seats });
console.log('expert decision avg ms', ((Date.now() - t0) / 200).toFixed(2));
