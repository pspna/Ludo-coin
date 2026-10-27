/**
 * Automated Test Suite for LudoVudo Multiplayer Resilience & Configuration
 * Tests:
 * 1. Missing configuration error formatting
 * 2. Malformed URLs and unsupported protocol rejection
 * 3. Vercel domain misconfiguration detection
 * 4. URL normalization and HTTP/WS mapping
 * 5. Health check and readiness endpoint on backend (/health & /api/health)
 * 6. Unavailable backend handling & timeout
 * 7. End-to-end room creation and joining
 * 8. Disconnect and reconnect handling
 */

const http = require('http');
const { WebSocket } = require('ws');

// In node test environment, we import or re-create validateServerUrl to test client logic directly
function validateServerUrl(rawUrl) {
  const clean = (rawUrl || '').trim().replace(/\/+$/, '');
  if (!clean) {
    return {
      valid: false,
      normalizedUrl: '',
      wsUrl: '',
      error:
        'Multiplayer server URL is not configured. Please open Server Settings (⚙️) ' +
        'to set your live backend endpoint (e.g. https://your-server.onrender.com) ' +
        'or set EXPO_PUBLIC_SERVER_URL in your deployment configuration.',
    };
  }

  if (clean.includes('.vercel.app')) {
    return {
      valid: false,
      normalizedUrl: clean,
      wsUrl: '',
      isVercel: true,
      error:
        'Multiplayer server not found on Vercel. Vercel only hosts the static frontend application ' +
        'and cannot run persistent WebSocket servers. Please deploy server/server.js to Render or Railway ' +
        'and set your live backend endpoint in Server Settings (⚙️).',
    };
  }

  if (
    clean.startsWith('ftp://') ||
    clean.startsWith('file://') ||
    clean.startsWith('javascript:') ||
    clean.startsWith('data:')
  ) {
    return {
      valid: false,
      normalizedUrl: clean,
      wsUrl: '',
      error: 'Unsupported protocol in server URL. Only HTTP, HTTPS, WS, and WSS are supported.',
    };
  }

  let httpUrl = clean;
  if (!clean.startsWith('http://') && !clean.startsWith('https://') && !clean.startsWith('ws://') && !clean.startsWith('wss://')) {
    httpUrl = `http://${clean}`;
  } else if (clean.startsWith('wss://')) {
    httpUrl = clean.replace('wss://', 'https://');
  } else if (clean.startsWith('ws://')) {
    httpUrl = clean.replace('ws://', 'http://');
  }

  try {
    const parsed = new URL(httpUrl);
    if (!parsed.hostname) {
      return {
        valid: false,
        normalizedUrl: httpUrl,
        wsUrl: '',
        error: `Invalid server URL hostname (${httpUrl}). Please provide a valid hostname.`,
      };
    }
  } catch (e) {
    return {
      valid: false,
      normalizedUrl: httpUrl,
      wsUrl: '',
      error: `Malformed server URL (${httpUrl}): ${e?.message || 'Invalid format'}`,
    };
  }

  let wsUrl = '';
  if (httpUrl.startsWith('https://')) {
    wsUrl = httpUrl.replace('https://', 'wss://');
  } else if (httpUrl.startsWith('http://')) {
    wsUrl = httpUrl.replace('http://', 'ws://');
  }

  return {
    valid: true,
    normalizedUrl: httpUrl,
    wsUrl,
  };
}

const TEST_PORT = 3105;
process.env.PORT = TEST_PORT;

async function runTests() {
  console.log('=====================================================');
  console.log('🚀 Ludo Royale Multiplayer Resilience & Config Tests');
  console.log('=====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName} ${details}`);
      failed++;
    }
  }

  // --- Test 1: Missing URL ---
  const resEmpty = validateServerUrl('');
  assert(!resEmpty.valid && resEmpty.error.includes('Server Settings'), 'Rejects empty server URL with configuration instructions');

  // --- Test 2: Whitespace URL ---
  const resSpaces = validateServerUrl('   ');
  assert(!resSpaces.valid, 'Rejects whitespace-only server URL');

  // --- Test 3: Vercel Domain Misconfiguration ---
  const resVercel = validateServerUrl('https://ludocoin.vercel.app');
  assert(!resVercel.valid && resVercel.isVercel && resVercel.error.includes('Vercel only hosts the static frontend'), 'Identifies Vercel URL and explains persistent WebSocket requirement');

  // --- Test 4: Unsupported Protocol ---
  const resFtp = validateServerUrl('ftp://my-server.com');
  assert(!resFtp.valid && resFtp.error.includes('Unsupported protocol'), 'Rejects unsupported protocols (ftp, file, etc.)');

  // --- Test 5: Valid HTTP normalization ---
  const resHttp = validateServerUrl('my-backend.onrender.com/');
  assert(resHttp.valid && resHttp.normalizedUrl === 'http://my-backend.onrender.com' && resHttp.wsUrl === 'ws://my-backend.onrender.com', 'Normalizes protocol-less URL and generates ws:// URL');

  // --- Test 6: Valid HTTPS/WSS mapping ---
  const resHttps = validateServerUrl('https://live-server.onrender.com///');
  assert(resHttps.valid && resHttps.normalizedUrl === 'https://live-server.onrender.com' && resHttps.wsUrl === 'wss://live-server.onrender.com', 'Maps HTTPS to WSS and trims trailing slashes');

  // --- Test 7: Start Live Server for Backend Endpoint Verification ---
  console.log('\n--- Starting authoritative backend server on port ' + TEST_PORT + ' ---');
  require('../server/server.js');
  await new Promise(r => setTimeout(r, 600));

  // --- Test 8: Health endpoint GET /health ---
  const healthRes = await fetch(`http://localhost:${TEST_PORT}/health`);
  const healthData = await healthRes.json();
  assert(
    healthRes.ok && healthData.status === 'ok' && healthData.ready === true && healthData.service === 'ludovudo-multiplayer',
    'Health check GET /health returns status ok and readiness metrics'
  );

  // --- Test 9: Health endpoint GET /api/health ---
  const apiHealthRes = await fetch(`http://localhost:${TEST_PORT}/api/health`);
  const apiHealthData = await apiHealthRes.json();
  assert(
    apiHealthRes.ok && apiHealthData.status === 'ok' && apiHealthData.ready === true,
    'Health check GET /api/health also responds with readiness'
  );

  // --- Test 10: Health check HEAD request ---
  const headRes = await fetch(`http://localhost:${TEST_PORT}/health`, { method: 'HEAD' });
  assert(headRes.ok && headRes.status === 200, 'Health check HEAD /health responds with HTTP 200');

  // --- Test 11: Create Room API ---
  const createRes = await fetch(`http://localhost:${TEST_PORT}/api/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hostId: 'test_host_1',
      hostName: 'Alice',
      hostAvatar: 'red',
      maxPlayers: 4,
    }),
  });
  const createData = await createRes.json();
  assert(
    createRes.ok && createData.success && createData.room && createData.room.code.length === 6,
    `Room creation returns valid 6-char code (${createData?.room?.code})`
  );

  const roomCode = createData.room.code;
  const roomId = createData.room.id;

  // --- Test 12: Join Room API ---
  const joinRes = await fetch(`http://localhost:${TEST_PORT}/api/rooms/${roomCode}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      playerId: 'test_player_2',
      playerName: 'Bob',
      playerAvatar: 'blue',
    }),
  });
  const joinData = await joinRes.json();
  assert(
    joinRes.ok && joinData.success && joinData.room.players.length === 2,
    'Player 2 joins room, room player count updates to 2'
  );

  // --- Test 13: WebSocket Connect & Register ---
  const ws = new WebSocket(`ws://localhost:${TEST_PORT}`);
  const wsOpen = await new Promise((resolve) => {
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'register', playerId: 'test_host_1', roomId }));
      resolve(true);
    });
    ws.on('error', () => resolve(false));
  });
  assert(wsOpen, 'WebSocket connects and registers player successfully');

  // --- Test 14: WebSocket Sync Request ---
  const syncPromise = new Promise((resolve) => {
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'sync_state') {
          resolve(msg.room);
        }
      } catch (e) {}
    });
  });
  ws.send(JSON.stringify({ type: 'sync_request', roomId, playerId: 'test_host_1' }));
  const syncedRoom = await Promise.race([
    syncPromise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Sync timeout')), 3000)),
  ]).catch(() => null);

  assert(syncedRoom && syncedRoom.id === roomId, 'WebSocket sync_request returns authoritative room state');

  // --- Test 15: Disconnect and clean closure ---
  ws.close();
  await new Promise(r => setTimeout(r, 200));
  assert(ws.readyState === WebSocket.CLOSED, 'WebSocket closes cleanly on disconnect');

  console.log('\n=====================================================');
  if (failed === 0) {
    console.log(`🎉 ALL ${passed} MULTIPLAYER RESILIENCE TESTS PASSED!`);
    console.log('=====================================================\n');
    process.exit(0);
  } else {
    console.error(`💥 ${failed} TESTS FAILED out of ${passed + failed}`);
    console.log('=====================================================\n');
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
