import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as Haptics from 'expo-haptics';

export type SfxId =
  | 'click'
  | 'roll'
  | 'dice'
  | 'move'
  | 'capture'
  | 'home'
  | 'six'
  | 'invalid'
  | 'win'
  | 'lose'
  | 'turn';

const SOURCES: Record<SfxId, number> = {
  click: require('../../assets/sounds/click.wav'),
  roll: require('../../assets/sounds/roll.wav'),
  dice: require('../../assets/sounds/dice.wav'),
  move: require('../../assets/sounds/move.wav'),
  capture: require('../../assets/sounds/capture.wav'),
  home: require('../../assets/sounds/home.wav'),
  six: require('../../assets/sounds/six.wav'),
  invalid: require('../../assets/sounds/invalid.wav'),
  win: require('../../assets/sounds/win.wav'),
  lose: require('../../assets/sounds/lose.wav'),
  turn: require('../../assets/sounds/turn.wav'),
};

const players: Partial<Record<SfxId, any>> = {};
let soundOn = true;
let hapticsOn = true;
let configured = false;

async function configureAudio() {
  if (configured) return;
  configured = true;
  try {
    await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false });
  } catch {
    // audio configuration is best effort
  }
}

export function setFeedback(opts: { sound: boolean; haptics: boolean }) {
  soundOn = opts.sound;
  hapticsOn = opts.haptics;
  if (opts.sound) configureAudio();
}

function playerFor(id: SfxId) {
  if (players[id]) return players[id]!;
  try {
    const p = createAudioPlayer(SOURCES[id]);
    try {
      p.volume = id === 'roll' ? 0.55 : 0.9;
    } catch {
      // volume is optional
    }
    players[id] = p;
    return p;
  } catch {
    players[id] = null;
    return null;
  }
}

export function play(id: SfxId) {
  if (!soundOn) return;
  try {
    const p = playerFor(id);
    if (!p) return;
    if (typeof p.seekTo === 'function') p.seekTo(0).catch(() => {});
    p.play();
  } catch {
    // never let audio break the game
  }
}

/** Warm the pool up so the first sound is instant. */
export function primeSounds() {
  if (!soundOn) return;
  configureAudio();
  (['click', 'dice', 'move'] as SfxId[]).forEach(playerFor);
}

export type HapticKind = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'select';

export function haptic(kind: HapticKind = 'light') {
  if (!hapticsOn) return;
  try {
    switch (kind) {
      case 'light':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'select':
        Haptics.selectionAsync();
        break;
      case 'medium':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'heavy':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        break;
      case 'success':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'warning':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      case 'error':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
    }
  } catch {
    // haptics unsupported on this device
  }
}
