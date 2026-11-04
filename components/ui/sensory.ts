// How the app feels under a finger: haptics and small synthesized sounds, with no audio files to download.
type Feel = 'tap' | 'select' | 'success' | 'error' | 'stamp';

const PATTERNS: Record<Feel, number | number[]> = {
  tap: 10,
  select: 16,
  success: [18, 60, 34],
  error: [40, 50, 40],
  stamp: [50, 30, 18],
};

const SOUND_KEY = 'daypass-sound';
let audio: AudioContext | null = null;
let iosSwitch: HTMLLabelElement | null = null;

const reduced = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

export function soundOn() {
  try {
    return localStorage.getItem(SOUND_KEY) !== '0';
  } catch {
    return true;
  }
}

export function setSound(on: boolean) {
  try {
    localStorage.setItem(SOUND_KEY, on ? '1' : '0');
  } catch {}
}

// iPhones ignore the vibration API. Toggling a native switch control is the one web route to the
// Taptic Engine, and it only fires during a real tap, on iOS 18 and later.
function iosTick() {
  if (!iosSwitch) {
    const label = document.createElement('label');
    label.setAttribute('aria-hidden', 'true');
    label.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden;';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    label.appendChild(input);
    document.body.appendChild(label);
    iosSwitch = label;
  }
  iosSwitch.click();
}

function ctx() {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!audio) audio = new AC();
  if (audio.state === 'suspended') audio.resume().catch(() => {});
  return audio;
}

function tone(a: AudioContext, freq: number, at: number, length: number, volume: number, type: OscillatorType = 'sine') {
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, a.currentTime + at);
  gain.gain.setValueAtTime(0, a.currentTime + at);
  gain.gain.linearRampToValueAtTime(volume, a.currentTime + at + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + at + length);
  osc.connect(gain).connect(a.destination);
  osc.start(a.currentTime + at);
  osc.stop(a.currentTime + at + length + 0.02);
}

function sound(kind: Feel) {
  if (!soundOn()) return;
  const a = ctx();
  if (!a) return;
  if (kind === 'tap') tone(a, 1500, 0, 0.022, 0.018);
  if (kind === 'select') tone(a, 1050, 0, 0.05, 0.035);
  if (kind === 'success') {
    tone(a, 660, 0, 0.13, 0.06, 'triangle');
    tone(a, 880, 0.09, 0.14, 0.06, 'triangle');
    tone(a, 1320, 0.18, 0.26, 0.055, 'triangle');
  }
  if (kind === 'error') {
    tone(a, 220, 0, 0.12, 0.06, 'triangle');
    tone(a, 165, 0.12, 0.16, 0.06, 'triangle');
  }
  if (kind === 'stamp') {
    tone(a, 90, 0, 0.14, 0.14);
    tone(a, 2100, 0, 0.03, 0.03, 'square');
  }
}

export function feel(kind: Feel) {
  if (typeof window === 'undefined') return;
  try {
    sound(kind);
    if (reduced()) return;
    if (typeof navigator.vibrate === 'function') navigator.vibrate(PATTERNS[kind]);
    else iosTick();
  } catch {}
}

// One place for tap feedback, so every control responds the same way. This also switches on
// :active press states in iOS Safari, which ignores them until a touch listener exists.
export function installTapFeedback() {
  const onDown = (e: PointerEvent) => {
    const el = (e.target as Element | null)?.closest?.('button, a, [role="switch"], [role="radio"]');
    if (!el || (el as HTMLButtonElement).disabled) return;
    feel(el.matches('[role="radio"], [role="switch"], [aria-pressed]') ? 'select' : 'tap');
  };
  const noop = () => {};
  document.addEventListener('pointerdown', onDown, { passive: true });
  document.addEventListener('touchstart', noop, { passive: true });
  return () => {
    document.removeEventListener('pointerdown', onDown);
    document.removeEventListener('touchstart', noop);
  };
}
