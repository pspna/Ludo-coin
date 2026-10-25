/* Generates short synthesized WAV sound effects for Ludo Royale.
   Run: node scripts/gensounds.js  */
const fs = require('fs');
const path = require('path');

const SR = 22050;
const OUT = path.join(__dirname, '..', 'assets', 'sounds');
fs.mkdirSync(OUT, { recursive: true });

function buf(seconds) {
  return new Float32Array(Math.ceil(seconds * SR));
}
function tone(dst, { at = 0, dur = 0.1, freq = 440, freqEnd = null, type = 'sine', gain = 0.5, attack = 0.005 }) {
  const start = Math.floor(at * SR);
  const n = Math.floor(dur * SR);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const p = i / n;
    const f = freqEnd == null ? freq : freq + (freqEnd - freq) * p;
    let phase = 2 * Math.PI * f * t;
    let s;
    if (type === 'sine') s = Math.sin(phase);
    else if (type === 'tri') s = (2 / Math.PI) * Math.asin(Math.sin(phase));
    else if (type === 'square') s = Math.sin(phase) > 0 ? 1 : -1;
    else if (type === 'saw') s = 2 * ((f * t) % 1) - 1;
    else s = Math.sin(phase);
    // simple lowpass smoothing for square/saw to avoid harshness
    const env = Math.min(1, t / attack) * Math.exp(-4.5 * p);
    const idx = start + i;
    if (idx < dst.length) dst[idx] += s * env * gain;
  }
}
function noise(dst, { at = 0, dur = 0.05, gain = 0.4, lp = 0.35 }) {
  const start = Math.floor(at * SR);
  const n = Math.floor(dur * SR);
  let last = 0;
  for (let i = 0; i < n; i++) {
    const p = i / n;
    const white = Math.random() * 2 - 1;
    last = last + lp * (white - last);
    const env = Math.min(1, i / (SR * 0.003)) * Math.exp(-6 * p);
    const idx = start + i;
    if (idx < dst.length) dst[idx] += last * env * gain;
  }
}
function writeWav(name, data, { normalize = true } = {}) {
  let peak = 0;
  for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
  const scale = normalize && peak > 0 ? Math.min(1, 0.92 / peak) : 1;
  const bytes = Buffer.alloc(44 + data.length * 2);
  bytes.write('RIFF', 0);
  bytes.writeUInt32LE(36 + data.length * 2, 4);
  bytes.write('WAVE', 8);
  bytes.write('fmt ', 12);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(SR, 24);
  bytes.writeUInt32LE(SR * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(data.length * 2, 40);
  for (let i = 0; i < data.length; i++) {
    let v = Math.max(-1, Math.min(1, data[i] * scale));
    bytes.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  fs.writeFileSync(path.join(OUT, name), bytes);
  console.log('wrote', name, (bytes.length / 1024).toFixed(1) + 'kb');
}

const N = (f) => 440 * Math.pow(2, (f - 69) / 12); // midi -> hz

// --- click: soft UI tap
{
  const d = buf(0.09);
  tone(d, { freq: 880, dur: 0.05, type: 'sine', gain: 0.5 });
  tone(d, { freq: 1760, dur: 0.03, type: 'sine', gain: 0.18 });
  writeWav('click.wav', d);
}
// --- roll: dice tumbling
{
  const d = buf(0.62);
  for (let i = 0; i < 9; i++) {
    const t = i * 0.062 + Math.random() * 0.02;
    noise(d, { at: t, dur: 0.05, gain: 0.35 + i * 0.02, lp: 0.4 });
    tone(d, { at: t, dur: 0.05, freq: 180 + Math.random() * 260, type: 'tri', gain: 0.16 });
  }
  writeWav('roll.wav', d);
}
// --- dice settle: satisfying clack
{
  const d = buf(0.26);
  noise(d, { dur: 0.06, gain: 0.5, lp: 0.5 });
  tone(d, { freq: 240, dur: 0.16, type: 'tri', gain: 0.5 });
  tone(d, { at: 0.02, freq: 120, dur: 0.2, type: 'sine', gain: 0.35 });
  writeWav('dice.wav', d);
}
// --- move: token step
{
  const d = buf(0.12);
  tone(d, { freq: N(76), dur: 0.07, type: 'sine', gain: 0.45 });
  tone(d, { freq: N(83), at: 0.03, dur: 0.06, type: 'sine', gain: 0.22 });
  writeWav('move.wav', d);
}
// --- capture: descending hit
{
  const d = buf(0.42);
  tone(d, { freq: 700, freqEnd: 160, dur: 0.28, type: 'square', gain: 0.32 });
  tone(d, { freq: 300, freqEnd: 90, dur: 0.34, type: 'tri', gain: 0.4 });
  noise(d, { dur: 0.09, gain: 0.35, lp: 0.6 });
  writeWav('capture.wav', d);
}
// --- home: rising arpeggio
{
  const d = buf(0.55);
  const notes = [72, 76, 79, 84];
  notes.forEach((n, i) => tone(d, { at: i * 0.075, freq: N(n), dur: 0.24, type: 'sine', gain: 0.42 }));
  tone(d, { at: 0.3, freq: N(88), dur: 0.3, type: 'sine', gain: 0.2 });
  writeWav('home.wav', d);
}
// --- six: bright sparkle
{
  const d = buf(0.3);
  tone(d, { freq: N(84), dur: 0.1, type: 'sine', gain: 0.4 });
  tone(d, { at: 0.06, freq: N(88), dur: 0.12, type: 'sine', gain: 0.38 });
  tone(d, { at: 0.12, freq: N(91), dur: 0.16, type: 'sine', gain: 0.3 });
  writeWav('six.wav', d);
}
// --- invalid: soft buzz
{
  const d = buf(0.24);
  tone(d, { freq: 150, dur: 0.16, type: 'square', gain: 0.16 });
  tone(d, { at: 0.09, freq: 130, dur: 0.14, type: 'square', gain: 0.14 });
  writeWav('invalid.wav', d);
}
// --- win: fanfare
{
  const d = buf(1.5);
  const seq = [[0, 72, 0.18], [0.14, 76, 0.18], [0.28, 79, 0.2], [0.44, 84, 0.5]];
  seq.forEach(([at, n, dur]) => {
    tone(d, { at, freq: N(n), dur, type: 'sine', gain: 0.45 });
    tone(d, { at, freq: N(n - 12), dur, type: 'tri', gain: 0.22 });
  });
  tone(d, { at: 0.44, freq: N(88), dur: 0.6, type: 'sine', gain: 0.22 });
  noise(d, { at: 0.44, dur: 0.5, gain: 0.08, lp: 0.2 });
  writeWav('win.wav', d);
}
// --- lose: gentle descending
{
  const d = buf(0.9);
  const seq = [[0, 67, 0.22], [0.2, 63, 0.22], [0.4, 58, 0.42]];
  seq.forEach(([at, n, dur]) => tone(d, { at, freq: N(n), dur, type: 'sine', gain: 0.38 }));
  writeWav('lose.wav', d);
}
// --- turn: soft whoosh
{
  const d = buf(0.34);
  noise(d, { dur: 0.3, gain: 0.22, lp: 0.12 });
  tone(d, { freq: 500, freqEnd: 900, dur: 0.22, type: 'sine', gain: 0.16 });
  writeWav('turn.wav', d);
}
console.log('done');
