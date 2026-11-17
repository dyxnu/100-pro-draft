'use client';

// Sons sintetizados na hora (Web Audio): nada para baixar, funciona offline.
// O navegador só libera áudio depois de um clique/tecla, então o contexto é criado sob demanda.

type Sfx = 'tick' | 'tickLast' | 'bid' | 'myBid' | 'outbid' | 'pass' | 'lot' | 'sold' | 'win' | 'kill' | 'objective' | 'tower' | 'victory' | 'defeat' | 'click';

const KEY = 'nx-sound';
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
try { muted = typeof localStorage !== 'undefined' && localStorage.getItem(KEY) === 'off'; } catch { /* ignora */ }

const listeners = new Set<(m: boolean) => void>();
export const isMuted = () => muted;
export function setMuted(m: boolean) {
  muted = m;
  try { localStorage.setItem(KEY, m ? 'off' : 'on'); } catch { /* ignora */ }
  listeners.forEach(f => f(m));
}
export function onMutedChange(f: (m: boolean) => void) { listeners.add(f); return () => { listeners.delete(f); }; }

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

// Desbloqueia o áudio no primeiro gesto do usuário.
if (typeof window !== 'undefined') {
  const unlock = () => { audio(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

function tone(freq: number, start: number, dur: number, opts: { type?: OscillatorType; vol?: number; to?: number } = {}) {
  const a = ctx!, t = a.currentTime + start;
  const o = a.createOscillator(), g = a.createGain();
  o.type = opts.type ?? 'sine';
  o.frequency.setValueAtTime(freq, t);
  if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(opts.vol ?? 0.5, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master!);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(start: number, dur: number, opts: { vol?: number; from?: number; to?: number; type?: BiquadFilterType } = {}) {
  const a = ctx!, t = a.currentTime + start;
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = opts.type ?? 'bandpass';
  f.frequency.setValueAtTime(opts.from ?? 800, t);
  if (opts.to) f.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(opts.vol ?? 0.4, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master!);
  src.start(t);
}

export function play(sfx: Sfx) {
  if (muted) return;
  const a = audio();
  if (!a || a.state !== 'running') return;
  switch (sfx) {
    case 'click': tone(660, 0, 0.05, { type: 'triangle', vol: 0.2 }); break;
    case 'tick': tone(1150, 0, 0.05, { type: 'square', vol: 0.12 }); break;
    case 'tickLast': tone(1500, 0, 0.08, { type: 'square', vol: 0.18 }); break;
    case 'bid': tone(880, 0, 0.08, { type: 'triangle', vol: 0.25 }); tone(1320, 0.06, 0.1, { type: 'triangle', vol: 0.2 }); break;
    case 'myBid': // moeda
      tone(1046, 0, 0.07, { type: 'square', vol: 0.18 }); tone(1568, 0.06, 0.18, { type: 'square', vol: 0.16 }); break;
    case 'outbid': tone(620, 0, 0.12, { type: 'sawtooth', vol: 0.18, to: 380 }); break;
    case 'pass': tone(330, 0, 0.12, { type: 'sine', vol: 0.25, to: 260 }); break;
    case 'lot': noise(0, 0.35, { vol: 0.18, from: 400, to: 3000 }); tone(523, 0.18, 0.18, { type: 'triangle', vol: 0.2 }); break;
    case 'sold': // martelo
      noise(0, 0.08, { vol: 0.6, from: 1800, type: 'lowpass' }); tone(140, 0, 0.18, { type: 'sine', vol: 0.6, to: 70 });
      noise(0.16, 0.06, { vol: 0.35, from: 1800, type: 'lowpass' }); break;
    case 'win': [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.09, 0.22, { type: 'triangle', vol: 0.28 })); break;
    case 'kill': tone(740, 0, 0.09, { type: 'square', vol: 0.12 }); tone(988, 0.07, 0.12, { type: 'square', vol: 0.1 }); break;
    case 'tower': tone(110, 0, 0.35, { type: 'sine', vol: 0.5, to: 55 }); noise(0, 0.3, { vol: 0.25, from: 600, type: 'lowpass' }); break;
    case 'objective': tone(98, 0, 0.6, { type: 'sawtooth', vol: 0.22, to: 65 }); tone(196, 0.05, 0.5, { type: 'triangle', vol: 0.15, to: 130 }); break;
    case 'victory': [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.12, 0.35, { type: 'triangle', vol: 0.3 })); break;
    case 'defeat': [392, 349, 311, 262].forEach((f, i) => tone(f, i * 0.16, 0.4, { type: 'sine', vol: 0.28 })); break;
  }
}
