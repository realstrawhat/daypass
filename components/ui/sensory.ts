// How the app feels under a finger: haptics and small synthesized sounds, with no audio files to download.
export type Feel = 'tap' | 'select' | 'save' | 'unsave' | 'success' | 'error' | 'stamp' | 'notify';

const PATTERNS: Record<Feel, number | number[]> = {
  tap: 16,
  select: 24,
  save: [18, 40, 30],
  unsave: 16,
  success: [26, 60, 44],
  error: [50, 50, 50],
  stamp: [60, 30, 24],
  notify: [14, 50, 14],
};

const SOUND_KEY = 'daypass-sound';
let audio: AudioContext | null = null;
let output: AudioNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
let iosSwitch: HTMLLabelElement | null = null;
let lastTap = 0;
let lastFelt = 0;

// True just after a tap or event has already buzzed.
export const justFelt = () => performance.now() - lastFelt < 120;

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

// Every sound passes through a touch of room and a limiter, so they sit together and never get harsh.
function ctx() {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!audio) {
    audio = new AC();
    const limiter = audio.createDynamicsCompressor();
    limiter.threshold.value = -16;
    limiter.ratio.value = 6;
    limiter.connect(audio.destination);

    const length = Math.floor(audio.sampleRate * 0.32);
    const impulse = audio.createBuffer(2, length, audio.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
    }
    const room = audio.createConvolver();
    room.buffer = impulse;
    const wet = audio.createGain();
    wet.gain.value = 0.14;
    room.connect(wet).connect(limiter);

    const bus = audio.createGain();
    bus.connect(limiter);
    bus.connect(room);
    output = bus;

    noiseBuffer = audio.createBuffer(1, Math.floor(audio.sampleRate * 0.2), audio.sampleRate);
    const noise = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noise.length; i++) noise[i] = Math.random() * 2 - 1;
  }
  if (audio.state === 'suspended') audio.resume().catch(() => {});
  return audio;
}

function envelope(a: AudioContext, at: number, length: number, volume: number) {
  const gain = a.createGain();
  const t = a.currentTime + at;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
  gain.connect(output!);
  return gain;
}

function sine(a: AudioContext, freq: number, at: number, length: number, volume: number, endFreq = freq) {
  const osc = a.createOscillator();
  const t = a.currentTime + at;
  osc.frequency.setValueAtTime(freq, t);
  if (endFreq !== freq) osc.frequency.exponentialRampToValueAtTime(endFreq, t + length);
  osc.connect(envelope(a, at, length, volume));
  osc.start(t);
  osc.stop(t + length + 0.02);
}

// A wooden, marimba-like note: a warm body and a short bright strike on top.
function note(a: AudioContext, freq: number, at: number, length: number, volume: number) {
  sine(a, freq, at, length, volume);
  sine(a, freq * 4, at, length * 0.16, volume * 0.28);
}

// A tiny puff of filtered noise, the "contact" part of a real click.
function contact(a: AudioContext, at: number, length: number, volume: number, centre: number) {
  if (!noiseBuffer) return;
  const src = a.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = a.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = centre;
  filter.Q.value = 0.9;
  src.connect(filter).connect(envelope(a, at, length, volume));
  src.start(a.currentTime + at);
  src.stop(a.currentTime + at + length + 0.02);
}

function sound(kind: Feel) {
  if (!soundOn()) return;
  const a = ctx();
  if (!a) return;
  if (kind === 'tap') {
    contact(a, 0, 0.014, 0.05, 2600);
    sine(a, 340, 0, 0.04, 0.055, 230);
  }
  if (kind === 'select') {
    contact(a, 0, 0.012, 0.04, 3200);
    sine(a, 580, 0, 0.07, 0.08, 430);
  }
  if (kind === 'save') {
    note(a, 659, 0, 0.22, 0.09);
    note(a, 988, 0.075, 0.34, 0.1);
  }
  if (kind === 'unsave') note(a, 494, 0, 0.18, 0.065);
  if (kind === 'success') {
    [523, 659, 784, 1047].forEach((f, i) => note(a, f, i * 0.075, 0.5, 0.075));
  }
  if (kind === 'error') {
    note(a, 233, 0, 0.22, 0.1);
    note(a, 185, 0.13, 0.3, 0.1);
  }
  if (kind === 'stamp') {
    sine(a, 130, 0, 0.22, 0.26, 50);
    contact(a, 0, 0.035, 0.12, 900);
    note(a, 1319, 0.15, 0.42, 0.04);
  }
  if (kind === 'notify') {
    note(a, 880, 0, 0.2, 0.05);
    note(a, 1175, 0.09, 0.3, 0.06);
  }
}

export function feel(kind: Feel) {
  if (typeof window === 'undefined') return;
  try {
    sound(kind);
    lastFelt = performance.now();
    if (reduced()) return;
    if (typeof navigator.vibrate === 'function') navigator.vibrate(PATTERNS[kind]);
    else iosTick();
  } catch {}
}

// One place for tap feedback, so every control responds the same way. It listens for finished taps, so
// starting to scroll over a card stays silent. A control can opt out with data-feel="none" when it has
// its own sound. The touch listener also switches on :active press states in iOS Safari.
export function installTapFeedback() {
  const onClick = (e: MouseEvent) => {
    const el = (e.target as Element | null)?.closest?.('button, a, [role="switch"], [role="radio"]') as HTMLElement | null;
    if (!el || (el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true' || el.dataset.feel === 'none') return;
    const now = performance.now();
    if (now - lastTap < 40) return;
    lastTap = now;
    feel(el.matches('[role="radio"], [role="switch"], [aria-pressed]') ? 'select' : 'tap');
  };
  const noop = () => {};
  document.addEventListener('click', onClick, { passive: true, capture: true });
  document.addEventListener('touchstart', noop, { passive: true });
  return () => {
    document.removeEventListener('click', onClick, { capture: true });
    document.removeEventListener('touchstart', noop);
  };
}
