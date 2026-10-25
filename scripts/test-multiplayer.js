/**
 * Automated End-to-End Test Suite for LudoVudo Real-Time Multiplayer Room System
 */

const http = require('http');
const { WebSocket } = require('ws');

const PORT = 3099;
process.env.PORT = PORT;

// Start server in-process
require('../server/server.js');

const SERVER_URL = `http://localhost:${PORT}`;
const WS_URL = `ws://localhost:${PORT}`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function postJson(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      `${SERVER_URL}${path}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(raw) });
          } catch (e) {
            resolve({ status: res.statusCode, raw });
          }
        });
      },
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function getJson(path) {
  return new Promise((resolve, reject) => {
    const req = http.get(`${SERVER_URL}${path}`, (res) => {
      let raw = '';
      res.on('data', (chunk) => {
        raw += chunk;
      });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(raw) });
        } catch (e) {
          resolve({ status: res.statusCode, raw });
        }
      });
    });
    req.on('error', reject);
  });
}

function createWsClient(playerId) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    const messages = [];

    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'register', playerId }));
      resolve({
        ws,
        messages,
        send(msg) {
          ws.send(JSON.stringify(msg));
        },
        waitFor(type, timeout = 3000) {
          return new Promise((res, rej) => {
            const timer = setTimeout(() => {
              rej(new Error(`Timed out waiting for message type: ${type}`));
            }, timeout);

            const check = () => {
              const idx = messages.findIndex((m) => m.type === type);
              if (idx >= 0) {
                clearTimeout(timer);
                const found = messages.splice(idx, 1)[0];
                res(found);
              }
            };

            ws.on('message', (raw) => {
              try {
                const parsed = JSON.parse(raw.toString());
                messages.push(parsed);
                check();
              } catch {}
            });

            check();
          });
        },
        close() {
          ws.close();
        },
      });
    });

    ws.on('error', reject);
  });
}

async function runTests() {
  console.log('--- Starting LudoVudo Multiplayer E2E Tests ---');

  // Test 1: Health check
  console.log('[Test 1] Health check endpoint...');
  await sleep(400);
  const health = await getJson('/health');
  if (health.status !== 200 || health.data.status !== 'ok') {
    throw new Error(`Health check failed: ${JSON.stringify(health)}`);
  }
  console.log('✓ Health check passed');

  // Test 2: Create Room
  console.log('[Test 2] Host creates room...');
  const hostId = 'player_host_1';
  const createRes = await postJson('/api/rooms', {
    hostId,
    hostName: 'Alice (Host)',
    hostAvatar: 'red',
    hostColor: 'red',
    maxPlayers: 4,
  });

  if (createRes.status !== 201 || !createRes.data.success) {
    throw new Error(`Room creation failed: ${JSON.stringify(createRes)}`);
  }

  const room = createRes.data.room;
  const roomCode = room.code;
  const roomId = room.id;

  if (roomCode.length !== 6 || roomCode !== roomCode.toUpperCase()) {
    throw new Error(`Invalid room code format: ${roomCode}`);
  }
  if (room.players.length !== 1 || room.players[0].id !== hostId || !room.players[0].isHost) {
    throw new Error(`Invalid host player record: ${JSON.stringify(room.players)}`);
  }
  console.log(`✓ Room created successfully! Code: ${roomCode}, ID: ${roomId}`);

  // Test 3: Connect Host WebSocket
  console.log('[Test 3] Connecting Host WebSocket...');
  const hostWs = await createWsClient(hostId);
  console.log('✓ Host connected to WebSocket');

  // Test 4: Player 2 joins via code
  console.log('[Test 4] Player 2 (Bob) joins room via 6-character code...');
  const p2Id = 'player_bob_2';
  const joinRes2 = await postJson(`/api/rooms/${roomCode}/join`, {
    playerId: p2Id,
    playerName: 'Bob',
    playerAvatar: 'green',
  });

  if (joinRes2.status !== 200 || !joinRes2.data.success) {
    throw new Error(`Player 2 join failed: ${JSON.stringify(joinRes2)}`);
  }
  if (joinRes2.data.room.players.length !== 2) {
    throw new Error(`Expected 2 players, got: ${joinRes2.data.room.players.length}`);
  }
  const p2Ws = await createWsClient(p2Id);
  p2Ws.send({ type: 'join_room', code: roomCode, playerId: p2Id, data: { playerName: 'Bob' } });
  console.log('✓ Player 2 joined successfully');

  // Test 5: Verify Host receives real-time lobby update
  console.log('[Test 5] Checking real-time lobby synchronization on Host...');
  const lobbyUpdate = await hostWs.waitFor('lobby_updated');
  if (lobbyUpdate.room.players.length !== 2) {
    throw new Error(`Host did not receive 2 players in lobby: ${JSON.stringify(lobbyUpdate)}`);
  }
  console.log('✓ Real-time lobby synchronization verified');

  // Test 6: Non-host attempts to start game (should fail)
  console.log('[Test 6] Verifying non-host cannot start game...');
  p2Ws.send({ type: 'start_game', roomId, playerId: p2Id });
  const errorMsg = await p2Ws.waitFor('error');
  if (!errorMsg.message.includes('Only the host')) {
    throw new Error(`Expected host permission error, got: ${JSON.stringify(errorMsg)}`);
  }
  console.log('✓ Non-host start game properly rejected');

  // Test 7: Host starts the game
  console.log('[Test 7] Host starts the match...');
  hostWs.send({ type: 'start_game', roomId, playerId: hostId });
  const gameStartedEvent = await hostWs.waitFor('game_started');
  const p2GameStarted = await p2Ws.waitFor('game_started');

  if (gameStartedEvent.room.status !== 'IN_GAME' || p2GameStarted.room.status !== 'IN_GAME') {
    throw new Error('Game status not IN_GAME');
  }
  if (!gameStartedEvent.room.match || gameStartedEvent.room.match.seats.length !== 2) {
    throw new Error('Match seats not initialized');
  }
  console.log('✓ Match synchronized and started on all connected devices');

  // Test 8: Player 2 rolls out of turn (should fail)
  console.log('[Test 8] Out-of-turn dice roll validation...');
  p2Ws.send({ type: 'roll_dice', roomId, playerId: p2Id });
  const turnError = await p2Ws.waitFor('error');
  if (!turnError.message.includes('not your turn')) {
    throw new Error(`Expected out-of-turn error, got: ${JSON.stringify(turnError)}`);
  }
  console.log('✓ Out-of-turn dice roll properly rejected');

  // Test 9: Active player (Host) rolls dice
  console.log('[Test 9] Active player (Host) rolls dice...');
  hostWs.send({ type: 'roll_dice', roomId, playerId: hostId });
  const diceEvent = await hostWs.waitFor('dice_rolled');
  const p2DiceEvent = await p2Ws.waitFor('dice_rolled');

  if (typeof diceEvent.dice !== 'number' || diceEvent.dice < 1 || diceEvent.dice > 6) {
    throw new Error(`Invalid dice result: ${diceEvent.dice}`);
  }
  if (diceEvent.dice !== p2DiceEvent.dice) {
    throw new Error(`Dice mismatch between devices: Host=${diceEvent.dice}, P2=${p2DiceEvent.dice}`);
  }
  console.log(`✓ Dice roll synchronized! Rolled: ${diceEvent.dice}`);

  // Test 10: Invalid room code rejection
  console.log('[Test 10] Testing invalid room code rejection...');
  const invalidJoin = await postJson('/api/rooms/ZZZZZZ/join', {
    playerId: 'random_id',
    playerName: 'Tester',
  });
  if (invalidJoin.status === 200 || invalidJoin.data.success) {
    throw new Error('Invalid room code was unexpectedly accepted');
  }
  console.log('✓ Invalid room code properly rejected with friendly error message');

  // Cleanup
  hostWs.close();
  p2Ws.close();

  console.log('\n========================================');
  console.log('🎉 ALL MULTIPLAYER E2E TESTS PASSED! 🎉');
  console.log('========================================\n');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
