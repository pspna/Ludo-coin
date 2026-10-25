/**
 * LudoVudo Real-Time Authoritative Multiplayer Server
 * Supports WebSocket & REST for room management, lobby sync, and live gameplay.
 */

const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = process.env.PORT || 3001;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const COLOR_ORDER = ['red', 'green', 'yellow', 'blue'];
const MAX_STEPS = 56;
const TOKENS_PER_PLAYER = 4;
const START_INDEX = { red: 0, green: 13, yellow: 26, blue: 39 };
const SAFE_RING = [0, 8, 13, 21, 26, 34, 39, 47];

const RING = [
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

const LANE = {
  red: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
  green: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  yellow: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
  blue: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
};

const BASE_SLOTS = {
  red: [[1.5, 1.5], [1.5, 3.5], [3.5, 1.5], [3.5, 3.5]],
  green: [[1.5, 10.5], [1.5, 12.5], [3.5, 10.5], [3.5, 12.5]],
  yellow: [[10.5, 10.5], [10.5, 12.5], [12.5, 10.5], [12.5, 12.5]],
  blue: [[10.5, 1.5], [10.5, 3.5], [12.5, 1.5], [12.5, 3.5]],
};

const HOME_SLOTS = {
  red: [[6.45, 6.62], [6.45, 7.38], [7.02, 6.62], [7.02, 7.38]],
  green: [[6.62, 6.45], [7.38, 6.45], [6.62, 7.02], [7.38, 7.02]],
  yellow: [[7.98, 6.62], [7.98, 7.38], [8.55, 6.62], [8.55, 7.38]],
  blue: [[6.62, 7.98], [7.38, 7.98], [6.62, 8.55], [7.38, 8.55]],
};

function cellKey(r, c) {
  return `${r},${c}`;
}

const SAFE_CELLS = SAFE_RING.map((i) => cellKey(RING[i][0], RING[i][1]));
const SAFE_SET = new Set(SAFE_CELLS);

// In-memory rooms repository
const rooms = new Map(); // roomId -> Room
const roomsByCode = new Map(); // code -> roomId
const playerSockets = new Map(); // playerId -> WebSocket
const socketPlayerMap = new WeakMap(); // ws -> { playerId, roomId }

function generateCode() {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  if (roomsByCode.has(code)) return generateCode();
  return code;
}

function generateId(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}

function createTokens(seats) {
  const tokens = [];
  seats.forEach((seat) => {
    for (let i = 0; i < TOKENS_PER_PLAYER; i++) {
      tokens.push({
        id: `${seat.color}-${i}`,
        seatId: seat.id,
        color: seat.color,
        index: i,
        steps: -1,
      });
    }
  });
  return tokens;
}

function ringIndexOf(color, steps) {
  return (START_INDEX[color] + steps) % 52;
}

function ringCellOf(color, steps) {
  return RING[ringIndexOf(color, steps)];
}

function cellOfToken(t, steps = t.steps) {
  if (steps < 0) {
    const [y, x] = BASE_SLOTS[t.color][t.index];
    return [y, x];
  }
  if (steps <= 50) return ringCellOf(t.color, steps);
  if (steps < MAX_STEPS) return LANE[t.color][steps - 51];
  const [x, y] = HOME_SLOTS[t.color][t.index];
  return [y, x];
}

function posOfToken(t, steps = t.steps) {
  const [row, col] = cellOfToken(t, steps);
  return { x: col, y: row };
}

function legalMoves(tokens, seatId, dice) {
  const mine = tokens.filter((t) => t.seatId === seatId);
  const out = [];
  for (const t of mine) {
    if (t.steps < 0) {
      if (dice === 6) out.push(t.id);
    } else if (t.steps < MAX_STEPS && t.steps + dice <= MAX_STEPS) {
      out.push(t.id);
    }
  }
  return out;
}

function waypointsFor(t, dice) {
  const pts = [];
  if (t.steps < 0) {
    pts.push(posOfToken(t, 0));
    return pts;
  }
  for (let i = 1; i <= dice; i++) {
    pts.push(posOfToken(t, t.steps + i));
  }
  return pts;
}

function applyMove(tokens, tokenId, dice) {
  const next = tokens.map((t) => ({ ...t }));
  const tok = next.find((t) => t.id === tokenId);
  const events = [];
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

function tokensHome(tokens, seatId) {
  return tokens.filter((t) => t.seatId === seatId && t.steps === MAX_STEPS).length;
}

function seatProgress(tokens, seatId) {
  const mine = tokens.filter((t) => t.seatId === seatId);
  const total = mine.reduce((sum, t) => sum + (t.steps < 0 ? 0 : t.steps), 0);
  return total / (TOKENS_PER_PLAYER * MAX_STEPS);
}

function hasWon(tokens, seatId) {
  return tokensHome(tokens, seatId) === TOKENS_PER_PLAYER;
}

function sanitizeName(name, fallback = 'Player') {
  if (!name || typeof name !== 'string') return fallback;
  const clean = name.trim().replace(/[\r\n\t]/g, '').slice(0, 14);
  return clean.length > 0 ? clean : fallback;
}

function getAvailableColor(players) {
  const taken = new Set(players.map((p) => p.color));
  return COLOR_ORDER.find((c) => !taken.has(c)) || 'red';
}

function publicRoomData(room) {
  return {
    id: room.id,
    code: room.code,
    hostPlayerId: room.hostPlayerId,
    maxPlayers: room.maxPlayers,
    status: room.status,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      color: p.color,
      seatIndex: p.seatIndex,
      seatId: p.seatId,
      isHost: p.isHost,
      isReady: p.isReady,
      connected: p.connected,
    })),
    match: room.match ? {
      seats: room.match.seats,
      tokens: room.match.tokens,
      turn: room.match.turn,
      dice: room.match.dice,
      rolling: room.match.rolling,
      phase: room.match.phase,
      sixStreak: room.match.sixStreak,
      selectable: room.match.selectable,
      winnerSeat: room.match.winnerSeat,
      rankings: room.match.rankings,
      finishOrder: room.match.finishOrder,
      startedAt: room.match.startedAt,
      version: room.match.version,
    } : null,
  };
}

function broadcastToRoom(room, message, excludePlayerId = null) {
  const json = JSON.stringify(message);
  for (const player of room.players) {
    if (excludePlayerId && player.id === excludePlayerId) continue;
    const ws = playerSockets.get(player.id);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(json);
    }
  }
}

function sendToPlayer(playerId, message) {
  const ws = playerSockets.get(playerId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

// ------------------- Room Operations -------------------

function createRoom({ hostId, hostName, hostAvatar, hostColor, maxPlayers }) {
  const roomId = generateId('room');
  const code = generateCode();
  const capacity = Math.min(4, Math.max(2, parseInt(maxPlayers, 10) || 4));
  const color = hostColor && COLOR_ORDER.includes(hostColor) ? hostColor : 'red';

  const hostPlayer = {
    id: hostId || generateId('usr'),
    name: sanitizeName(hostName, 'Host'),
    avatar: hostAvatar || color,
    color,
    seatIndex: 0,
    seatId: `${color}-seat`,
    isHost: true,
    isReady: true,
    connected: true,
  };

  const room = {
    id: roomId,
    code,
    hostPlayerId: hostPlayer.id,
    maxPlayers: capacity,
    status: 'WAITING',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    players: [hostPlayer],
    match: null,
  };

  rooms.set(roomId, room);
  roomsByCode.set(code, roomId);

  return room;
}

function joinRoom({ code, playerId, playerName, playerAvatar, playerColor }) {
  const cleanCode = (code || '').toUpperCase().trim();
  const roomId = roomsByCode.get(cleanCode);
  if (!roomId) {
    return { error: 'Room not found. Check the code and try again.' };
  }

  const room = rooms.get(roomId);
  if (!room) {
    return { error: 'Room not found.' };
  }

  if (room.status === 'CLOSED') {
    return { error: 'This room is closed.' };
  }

  if (room.status === 'FINISHED') {
    return { error: 'This game has already finished.' };
  }

  // Check if player is rejoining an active room
  const existingIndex = room.players.findIndex((p) => p.id === playerId);
  if (existingIndex >= 0) {
    const p = room.players[existingIndex];
    p.connected = true;
    p.name = sanitizeName(playerName, p.name);
    room.updatedAt = Date.now();
    return { room, player: p, isRejoin: true };
  }

  if (room.status === 'IN_GAME') {
    return { error: 'Game has already started in this room.' };
  }

  if (room.players.length >= room.maxPlayers) {
    return { error: 'This room is full.' };
  }

  const assignedColor = playerColor && !room.players.some((p) => p.color === playerColor)
    ? playerColor
    : getAvailableColor(room.players);

  const seatIndex = room.players.length;
  const newPlayer = {
    id: playerId || generateId('usr'),
    name: sanitizeName(playerName, `Player ${seatIndex + 1}`),
    avatar: playerAvatar || assignedColor,
    color: assignedColor,
    seatIndex,
    seatId: `${assignedColor}-seat`,
    isHost: false,
    isReady: false,
    connected: true,
  };

  room.players.push(newPlayer);
  room.updatedAt = Date.now();

  return { room, player: newPlayer, isRejoin: false };
}

function leaveRoom(roomId, playerId) {
  const room = rooms.get(roomId);
  if (!room) return null;

  const playerIdx = room.players.findIndex((p) => p.id === playerId);
  if (playerIdx === -1) return null;

  const leavingPlayer = room.players[playerIdx];

  // If host leaves in lobby, close room
  if (leavingPlayer.isHost && room.status === 'WAITING') {
    room.status = 'CLOSED';
    room.updatedAt = Date.now();
    broadcastToRoom(room, {
      type: 'room_closed',
      roomId,
      reason: 'Host has closed the room.',
    });
    rooms.delete(roomId);
    roomsByCode.delete(room.code);
    return { closed: true, room };
  }

  // If guest leaves lobby
  if (room.status === 'WAITING') {
    room.players.splice(playerIdx, 1);
    // Re-index seats
    room.players.forEach((p, idx) => {
      p.seatIndex = idx;
    });
    room.updatedAt = Date.now();
    broadcastToRoom(room, {
      type: 'lobby_updated',
      room: publicRoomData(room),
      event: { type: 'player_left', playerId, playerName: leavingPlayer.name },
    });
    return { closed: false, room };
  }

  // If game is in progress
  leavingPlayer.connected = false;
  room.updatedAt = Date.now();

  // If host left during match, migrate host to next active connected player
  if (leavingPlayer.isHost && room.status === 'IN_GAME') {
    const nextHost = room.players.find((p) => p.id !== leavingPlayer.id && p.connected);
    if (nextHost) {
      leavingPlayer.isHost = false;
      nextHost.isHost = true;
      room.hostPlayerId = nextHost.id;
    }
  }

  // If active turn was this player, advance turn
  if (room.match && room.match.phase !== 'over') {
    const activeSeat = room.match.seats[room.match.turn];
    if (activeSeat && activeSeat.id === leavingPlayer.seatId) {
      room.match.turn = (room.match.turn + 1) % room.match.seats.length;
      room.match.phase = 'roll';
      room.match.dice = null;
      room.match.sixStreak = 0;
      room.match.selectable = [];
      room.match.version += 1;
      room.match.turnStartedAt = Date.now();
    }
  }

  broadcastToRoom(room, {
    type: 'player_left',
    playerId,
    playerName: leavingPlayer.name,
    room: publicRoomData(room),
  });

  return { closed: false, room };
}

function startGame(roomId, requestingPlayerId) {
  const room = rooms.get(roomId);
  if (!room) return { error: 'Room not found.' };

  if (room.hostPlayerId !== requestingPlayerId) {
    return { error: 'Only the host can start the game.' };
  }

  if (room.status !== 'WAITING') {
    return { error: 'Game has already started or room is closed.' };
  }

  if (room.players.length < 2) {
    return { error: 'Need at least 2 players to start.' };
  }

  const seats = room.players.map((p) => ({
    id: p.seatId,
    color: p.color,
    name: p.name,
    type: 'human',
    difficulty: 'medium',
    playerId: p.id,
  }));

  const match = {
    seats,
    tokens: createTokens(seats),
    turn: 0,
    dice: null,
    rolling: false,
    phase: 'roll',
    sixStreak: 0,
    selectable: [],
    winnerSeat: null,
    rankings: [],
    finishOrder: [],
    startedAt: Date.now(),
    version: 1,
    stats: { rolls: 0, sixes: 0, captures: 0, tokensHome: 0 },
  };

  room.status = 'IN_GAME';
  room.match = match;
  room.updatedAt = Date.now();

  broadcastToRoom(room, {
    type: 'game_started',
    roomId: room.id,
    room: publicRoomData(room),
  });

  return { room };
}

function rollDiceAction(roomId, playerId) {
  const room = rooms.get(roomId);
  if (!room || !room.match) return { error: 'Match not found.' };

  const match = room.match;
  if (match.phase !== 'roll') return { error: 'Cannot roll in current phase.' };

  const currentSeat = match.seats[match.turn];
  if (!currentSeat || currentSeat.playerId !== playerId) {
    return { error: 'It is not your turn to roll.' };
  }

  const dice = 1 + Math.floor(Math.random() * 6);
  match.dice = dice;
  match.stats.rolls += 1;
  if (dice === 6) match.stats.sixes += 1;

  const streak = dice === 6 ? match.sixStreak + 1 : 0;
  match.sixStreak = streak;

  // 3 sixes penalty
  if (dice === 6 && streak >= 3) {
    match.sixStreak = 0;
    match.turn = (match.turn + 1) % match.seats.length;
    match.phase = 'roll';
    match.dice = null;
    match.selectable = [];
    match.version += 1;

    broadcastToRoom(room, {
      type: 'dice_rolled',
      roomId: room.id,
      dice,
      forfeit: true,
      reason: 'Three sixes — turn forfeited!',
      room: publicRoomData(room),
    });
    return { dice, forfeit: true };
  }

  const moves = legalMoves(match.tokens, currentSeat.id, dice);

  if (moves.length === 0) {
    // No legal moves: pass turn
    match.turn = (match.turn + 1) % match.seats.length;
    match.phase = 'roll';
    match.dice = dice;
    match.selectable = [];
    match.sixStreak = 0;
    match.version += 1;

    broadcastToRoom(room, {
      type: 'dice_rolled',
      roomId: room.id,
      dice,
      moves: [],
      passTurn: true,
      room: publicRoomData(room),
    });
    return { dice, moves: [], passTurn: true };
  }

  match.phase = 'choose';
  match.selectable = moves;
  match.version += 1;

  broadcastToRoom(room, {
    type: 'dice_rolled',
    roomId: room.id,
    dice,
    moves,
    passTurn: false,
    room: publicRoomData(room),
  });

  return { dice, moves, passTurn: false };
}

function moveTokenAction(roomId, playerId, tokenId) {
  const room = rooms.get(roomId);
  if (!room || !room.match) return { error: 'Match not found.' };

  const match = room.match;
  if (match.phase !== 'choose') return { error: 'Not in move phase.' };

  const currentSeat = match.seats[match.turn];
  if (!currentSeat || currentSeat.playerId !== playerId) {
    return { error: 'It is not your turn.' };
  }

  if (!match.selectable.includes(tokenId)) {
    return { error: 'Invalid token selection.' };
  }

  const tok = match.tokens.find((t) => t.id === tokenId);
  if (!tok) return { error: 'Token not found.' };

  const dice = match.dice || 0;
  const waypoints = waypointsFor(tok, dice);
  const result = applyMove(match.tokens, tokenId, dice);

  match.tokens = result.tokens;
  const captures = result.events.filter((e) => e.type === 'capture').length;
  const finished = result.events.some((e) => e.type === 'finish');

  match.stats.captures += captures;
  if (finished) match.stats.tokensHome += 1;

  let extraTurn = dice === 6 || captures > 0 || finished;
  let isWinner = hasWon(match.tokens, currentSeat.id);

  if (isWinner) {
    match.phase = 'over';
    match.winnerSeat = currentSeat.id;
    match.rankings = [
      currentSeat.id,
      ...match.seats
        .filter((x) => x.id !== currentSeat.id)
        .sort((a, b) => seatProgress(match.tokens, b.id) - seatProgress(match.tokens, a.id))
        .map((x) => x.id),
    ];
    match.selectable = [];
    match.dice = null;
    room.status = 'FINISHED';
  } else if (extraTurn) {
    match.phase = 'roll';
    match.dice = null;
    match.selectable = [];
  } else {
    match.turn = (match.turn + 1) % match.seats.length;
    match.sixStreak = 0;
    match.phase = 'roll';
    match.dice = null;
    match.selectable = [];
  }

  match.version += 1;
  room.updatedAt = Date.now();

  broadcastToRoom(room, {
    type: 'token_moved',
    roomId: room.id,
    tokenId,
    dice,
    waypoints,
    events: result.events,
    extraTurn,
    isWinner,
    winnerSeatId: isWinner ? currentSeat.id : null,
    room: publicRoomData(room),
  });

  return { success: true, isWinner, extraTurn };
}

// ------------------- HTTP Server -------------------

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  if (pathname === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', time: Date.now(), activeRooms: rooms.size }));
    return;
  }

  if (pathname === '/api/rooms' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const room = createRoom(data);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, room: publicRoomData(room) }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  const roomCodeMatch = pathname.match(/^\/api\/rooms\/([A-Za-z0-9]{6})$/);
  if (roomCodeMatch && req.method === 'GET') {
    const code = roomCodeMatch[1].toUpperCase();
    const roomId = roomsByCode.get(code);
    const room = roomId ? rooms.get(roomId) : null;
    if (!room) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Room not found' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, room: publicRoomData(room) }));
    return;
  }

  const joinMatch = pathname.match(/^\/api\/rooms\/([A-Za-z0-9]{6})\/join$/);
  if (joinMatch && req.method === 'POST') {
    const code = joinMatch[1].toUpperCase();
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const result = joinRoom({ code, ...data });
        if (result.error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: result.error }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, room: publicRoomData(result.room), player: result.player, isRejoin: result.isRejoin }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// ------------------- WebSocket Server -------------------

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      handleWsMessage(ws, msg);
    } catch (e) {
      ws.send(JSON.stringify({ type: 'error', message: 'Malformed JSON payload' }));
    }
  });

  ws.on('close', () => {
    const session = socketPlayerMap.get(ws);
    if (session) {
      const { playerId, roomId } = session;
      playerSockets.delete(playerId);
      if (roomId && rooms.has(roomId)) {
        const room = rooms.get(roomId);
        const player = room.players.find((p) => p.id === playerId);
        if (player) {
          player.connected = false;
          broadcastToRoom(room, {
            type: 'player_status_changed',
            playerId,
            connected: false,
            room: publicRoomData(room),
          });
        }
      }
    }
  });
});

function handleWsMessage(ws, msg) {
  const { type, roomId, code, playerId, data } = msg;

  switch (type) {
    case 'register': {
      if (playerId) {
        playerSockets.set(playerId, ws);
        socketPlayerMap.set(ws, { playerId, roomId });
        ws.send(JSON.stringify({ type: 'registered', playerId }));
      }
      break;
    }

    case 'create_room': {
      const room = createRoom({ hostId: playerId, ...(data || {}) });
      playerSockets.set(room.hostPlayerId, ws);
      socketPlayerMap.set(ws, { playerId: room.hostPlayerId, roomId: room.id });
      ws.send(JSON.stringify({ type: 'room_created', room: publicRoomData(room) }));
      break;
    }

    case 'join_room': {
      const result = joinRoom({ code, playerId, ...(data || {}) });
      if (result.error) {
        ws.send(JSON.stringify({ type: 'error', message: result.error }));
        return;
      }
      const pId = result.player.id;
      playerSockets.set(pId, ws);
      socketPlayerMap.set(ws, { playerId: pId, roomId: result.room.id });

      ws.send(JSON.stringify({
        type: 'room_joined',
        room: publicRoomData(result.room),
        player: result.player,
        isRejoin: result.isRejoin,
      }));

      // Broadcast to other players in room
      broadcastToRoom(result.room, {
        type: 'lobby_updated',
        room: publicRoomData(result.room),
        event: {
          type: result.isRejoin ? 'player_reconnected' : 'player_joined',
          player: result.player,
        },
      }, pId);
      break;
    }

    case 'set_ready': {
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room) return;
      const player = room.players.find((p) => p.id === playerId);
      if (player) {
        player.isReady = !!data?.isReady;
        room.updatedAt = Date.now();
        broadcastToRoom(room, {
          type: 'lobby_updated',
          room: publicRoomData(room),
        });
      }
      break;
    }

    case 'start_game': {
      if (!roomId) return;
      const res = startGame(roomId, playerId);
      if (res.error) {
        ws.send(JSON.stringify({ type: 'error', message: res.error }));
      }
      break;
    }

    case 'roll_dice': {
      if (!roomId) return;
      const res = rollDiceAction(roomId, playerId);
      if (res.error) {
        ws.send(JSON.stringify({ type: 'error', message: res.error }));
      }
      break;
    }

    case 'move_token': {
      if (!roomId || !data?.tokenId) return;
      const res = moveTokenAction(roomId, playerId, data.tokenId);
      if (res.error) {
        ws.send(JSON.stringify({ type: 'error', message: res.error }));
      }
      break;
    }

    case 'sync_request': {
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (room) {
        ws.send(JSON.stringify({
          type: 'sync_state',
          room: publicRoomData(room),
        }));
      }
      break;
    }

    case 'leave_room': {
      if (!roomId) return;
      leaveRoom(roomId, playerId);
      ws.send(JSON.stringify({ type: 'room_left', roomId }));
      break;
    }

    case 'ping': {
      ws.send(JSON.stringify({ type: 'pong', time: Date.now() }));
      break;
    }

    default:
      break;
  }
}

// Keep-alive heartbeat interval
const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 15000);

// Periodic cleanup of stale/abandoned rooms (rooms older than 2 hours)
const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [roomId, room] of rooms.entries()) {
    const isExpired = now - room.updatedAt > 2 * 60 * 60 * 1000;
    const allDisconnected = room.players.every((p) => !p.connected) && now - room.updatedAt > 5 * 60 * 1000;
    if (isExpired || allDisconnected) {
      rooms.delete(roomId);
      roomsByCode.delete(room.code);
    }
  }
}, 60000);

wss.on('close', () => {
  clearInterval(heartbeat);
  clearInterval(cleanup);
});

server.listen(PORT, () => {
  console.log(`[LudoVudo Server] Live authoritative server running on port ${PORT}`);
});
