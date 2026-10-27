/**
 * Build & Deployment Environment Validation Script
 * Verifies EXPO_PUBLIC_SERVER_URL and related deployment configuration.
 */

const rawUrl = process.env.EXPO_PUBLIC_SERVER_URL || '';
const isStrict = process.env.CHECK_SERVER_URL === 'strict';

console.log('--- Ludo Royale Deployment Environment Check ---');

if (!rawUrl.trim()) {
  console.warn('\n⚠️  WARNING: EXPO_PUBLIC_SERVER_URL is not set.');
  console.warn('   The web client will build, but online multiplayer room creation');
  console.warn('   will require players to configure their backend endpoint in Server Settings (⚙️).');
  console.warn('\n   To configure for Vercel:');
  console.warn('   1. Deploy server/server.js to Render (using render.yaml) or Railway.');
  console.warn('   2. In Vercel Project Settings -> Environment Variables, add:');
  console.warn('      EXPO_PUBLIC_SERVER_URL=https://your-service.onrender.com');
  console.warn('      (Apply to Production and Preview environments)\n');

  if (isStrict) {
    console.error('❌ STRICT CHECK FAILED: EXPO_PUBLIC_SERVER_URL is required in strict mode.');
    process.exit(1);
  }
  process.exit(0);
}

const clean = rawUrl.trim().replace(/\/+$/, '');

// Check for Vercel domain misconfiguration
if (clean.includes('.vercel.app')) {
  console.error('\n❌ ERROR: EXPO_PUBLIC_SERVER_URL is pointing to a Vercel URL (' + clean + ').');
  console.error('   Vercel only hosts the static frontend web application and cannot run persistent WebSocket servers.');
  console.error('   Please point EXPO_PUBLIC_SERVER_URL to your Render or Railway service instead.\n');
  process.exit(1);
}

// Check protocol
if (!clean.startsWith('http://') && !clean.startsWith('https://') && !clean.startsWith('ws://') && !clean.startsWith('wss://')) {
  console.error('\n❌ ERROR: EXPO_PUBLIC_SERVER_URL (' + clean + ') must start with http://, https://, ws://, or wss://\n');
  process.exit(1);
}

// Check syntax
try {
  const parsed = new URL(clean.replace('wss://', 'https://').replace('ws://', 'http://'));
  if (!parsed.hostname) {
    throw new Error('Missing hostname');
  }
} catch (e) {
  console.error('\n❌ ERROR: EXPO_PUBLIC_SERVER_URL is malformed: ' + e.message + '\n');
  process.exit(1);
}

console.log('✅ EXPO_PUBLIC_SERVER_URL is valid: ' + clean);
console.log('--- Environment Check Passed ---\n');
process.exit(0);
