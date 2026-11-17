'use client';

// Sons sintetizados na hora (Web Audio): nada para baixar, funciona offline.
// O navegador só libera áudio depois de um clique/tecla, então o contexto é criado sob demanda.
//
// Cadeia: vozes → (seco) mestre → compressor → saída
//                └→ (envio) reverb (ConvolverNode com resposta gerada) → mestre
// O compressor segura picos quando vários sons tocam juntos (lances em rajada).

export type Sfx =
  | 'tick' | 'tickLast' | 'bid' | 'myBid' | 'outbid' | 'pass' | 'lot' | 'legend' | 'sold' | 'unsold' | 'win'
  | 'kill' | 'objective' | 'tower' | 'victory' | 'defeat' | 'click';

const KEY = 'nx-sound';
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let reverbIn: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
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

/** Resposta ao impulso sintética: ruído estéreo com queda exponencial (sala pequena e brilhante). */
function makeImpulse(a: AudioContext, seconds = 1.1, decay = 3.2): AudioBuffer {
  const len = Math.floor(a.sampleRate * seconds);
  const buf = a.createBuffer(2, len, a.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC({ latencyHint: 'interactive' });
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.15;
    comp.connect(ctx.destination);
    master = ctx.createGain();
    master.gain.value = 0.42;
    master.connect(comp);
    try {
      const conv = ctx.createConvolver();
      conv.buffer = makeImpulse(ctx);
      const wet = ctx.createGain();
      wet.gain.value = 0.22;
      reverbIn = ctx.createGain();
      reverbIn.connect(conv).connect(wet).connect(master);
    } catch { reverbIn = null; }
    // Um só buffer de ruído (1 s) reaproveitado: nada de gerar ruído a cada som.
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
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

function out(node: AudioNode, wet: number, t: number) {
  node.connect(master!);
  if (wet > 0 && reverbIn) {
    const send = ctx!.createGain();
    send.gain.setValueAtTime(wet, t);
    node.connect(send).connect(reverbIn);
  }
}

interface ToneOpts {
  type?: OscillatorType; vol?: number; to?: number; attack?: number; wet?: number;
  detune?: number; lowpass?: number; vibrato?: number;
}

/** Nota com envelope (ataque curto + queda exponencial), filtro e envio de reverb opcionais. */
function tone(freq: number, start: number, dur: number, o: ToneOpts = {}) {
  const a = ctx!, t = a.currentTime + start;
  const osc = a.createOscillator(), g = a.createGain();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(freq, t);
  if (o.detune) osc.detune.setValueAtTime(o.detune, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
  if (o.vibrato) {
    const lfo = a.createOscillator(), lg = a.createGain();
    lfo.frequency.value = 6; lg.gain.value = o.vibrato;
    lfo.connect(lg).connect(osc.frequency);
    lfo.start(t); lfo.stop(t + dur + 0.05);
  }
  const atk = o.attack ?? 0.006;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.vol ?? 0.4, t + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node: AudioNode = osc.connect(g);
  if (o.lowpass) {
    const f = a.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.setValueAtTime(o.lowpass, t); f.Q.value = 0.8;
    node = g.connect(f);
  }
  out(node, o.wet ?? 0, t);
  osc.start(t);
  osc.stop(t + dur + 0.03);
}

/** Nota "rica": fundamental + harmônicos que somem antes (soa como sino/moeda). */
function bell(freq: number, start: number, dur: number, vol = 0.3, wet = 0.25) {
  tone(freq, start, dur, { type: 'sine', vol, wet });
  tone(freq * 2, start, dur * 0.6, { type: 'sine', vol: vol * 0.45, wet });
  tone(freq * 3.01, start, dur * 0.35, { type: 'sine', vol: vol * 0.22, wet });
  tone(freq * 4.2, start, dur * 0.18, { type: 'sine', vol: vol * 0.12, wet });
}

/** Nota de metal (fanfarra): serra filtrada + leve desafinação para encorpar. */
function brass(freq: number, start: number, dur: number, vol = 0.18, wet = 0.3) {
  tone(freq, start, dur, { type: 'sawtooth', vol, attack: 0.025, lowpass: 2400, wet });
  tone(freq, start, dur, { type: 'sawtooth', vol: vol * 0.7, attack: 0.03, lowpass: 2000, detune: 9, wet });
  tone(freq / 2, start, dur * 0.9, { type: 'triangle', vol: vol * 0.6, attack: 0.02, wet: wet * 0.5 });
}

function noise(start: number, dur: number, o: { vol?: number; from?: number; to?: number; type?: BiquadFilterType; q?: number; wet?: number } = {}) {
  const a = ctx!, t = a.currentTime + start;
  const src = a.createBufferSource();
  src.buffer = noiseBuf;
  const f = a.createBiquadFilter();
  f.type = o.type ?? 'bandpass';
  f.frequency.setValueAtTime(o.from ?? 800, t);
  if (o.q) f.Q.value = o.q;
  if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(o.vol ?? 0.4, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  out(src.connect(f).connect(g), o.wet ?? 0, t);
  src.start(t, Math.random() * 0.5, Math.min(0.5, dur + 0.02));
}

/** Martelo de leilão: estalo de madeira + baque grave. */
function gavel(start: number, vol = 1) {
  noise(start, 0.05, { vol: 0.7 * vol, from: 2600, type: 'bandpass', q: 1.2, wet: 0.2 });
  tone(190, start, 0.16, { type: 'sine', vol: 0.65 * vol, to: 62, wet: 0.15 });
  tone(420, start, 0.05, { type: 'triangle', vol: 0.25 * vol, to: 260 });
}

export function play(sfx: Sfx) {
  if (muted) return;
  const a = audio();
  if (!a || a.state !== 'running') return;
  switch (sfx) {
    case 'click': tone(880, 0, 0.05, { type: 'triangle', vol: 0.16 }); break;
    // contagem final: tique de madeira; o último é mais agudo e com brilho
    case 'tick':
      noise(0, 0.03, { vol: 0.35, from: 3200, type: 'bandpass', q: 3 });
      tone(1250, 0, 0.06, { type: 'sine', vol: 0.18 }); break;
    case 'tickLast':
      noise(0, 0.04, { vol: 0.45, from: 3600, type: 'bandpass', q: 3 });
      bell(1568, 0, 0.22, 0.2, 0.2); break;
    // lance de outra pessoa: clique suave, não cansa
    case 'bid':
      noise(0, 0.025, { vol: 0.22, from: 2200, type: 'bandpass', q: 2 });
      tone(1320, 0, 0.07, { type: 'sine', vol: 0.12 }); break;
    // meu lance: moeda (duas notas com harmônicos + brilho)
    case 'myBid':
      bell(988, 0, 0.09, 0.22, 0.15);
      bell(1319, 0.065, 0.32, 0.26, 0.3);
      noise(0.065, 0.12, { vol: 0.08, from: 7000, type: 'highpass' }); break;
    // fui coberto: alerta curto descendente
    case 'outbid':
      tone(784, 0, 0.11, { type: 'triangle', vol: 0.26, vibrato: 8 });
      tone(587, 0.1, 0.18, { type: 'triangle', vol: 0.26, to: 520, wet: 0.15 });
      tone(110, 0, 0.12, { type: 'sine', vol: 0.3, to: 70 }); break;
    case 'pass': tone(392, 0, 0.14, { type: 'sine', vol: 0.18, to: 300 }); break;
    // novo lote: sopro + sino
    case 'lot':
      noise(0, 0.3, { vol: 0.12, from: 500, to: 4200, type: 'bandpass', q: 0.7, wet: 0.3 });
      bell(784, 0.16, 0.4, 0.16, 0.35); break;
    // lote lendário: acorde brilhante subindo
    case 'legend':
      noise(0, 0.4, { vol: 0.14, from: 400, to: 6000, type: 'bandpass', q: 0.7, wet: 0.4 });
      [659, 831, 988, 1319].forEach((f, i) => bell(f, 0.12 + i * 0.06, 0.6, 0.12, 0.45)); break;
    // arremate: martelo + fanfarra curta
    case 'sold':
      gavel(0);
      brass(392, 0.12, 0.16, 0.13); brass(523, 0.24, 0.34, 0.15); break;
    case 'unsold':
      tone(330, 0, 0.18, { type: 'triangle', vol: 0.16, to: 262, wet: 0.2 });
      tone(247, 0.14, 0.3, { type: 'triangle', vol: 0.14, to: 196, wet: 0.25 }); break;
    // eu arrematei: martelo + fanfarra maior + brilho
    case 'win':
      gavel(0, 1.1);
      brass(392, 0.12, 0.12, 0.13); brass(523, 0.22, 0.12, 0.14); brass(659, 0.32, 0.12, 0.15);
      [523, 659, 784, 1046].forEach(f => brass(f, 0.44, 0.7, 0.085, 0.45));
      [2093, 2637, 3136, 4186].forEach((f, i) => bell(f, 0.46 + i * 0.05, 0.4, 0.05, 0.5)); break;
    case 'kill': tone(740, 0, 0.09, { type: 'square', vol: 0.1, lowpass: 3000 }); tone(988, 0.07, 0.12, { type: 'square', vol: 0.09, lowpass: 3000 }); break;
    case 'tower': tone(110, 0, 0.35, { type: 'sine', vol: 0.5, to: 55 }); noise(0, 0.3, { vol: 0.25, from: 600, type: 'lowpass', wet: 0.2 }); break;
    case 'objective': tone(98, 0, 0.6, { type: 'sawtooth', vol: 0.2, to: 65, lowpass: 900 }); tone(196, 0.05, 0.5, { type: 'triangle', vol: 0.15, to: 130, wet: 0.3 }); break;
    case 'victory': [392, 523, 659, 784, 1046].forEach((f, i) => brass(f, i * 0.12, 0.4, 0.11, 0.4)); break;
    case 'defeat': [392, 349, 311, 262].forEach((f, i) => tone(f, i * 0.16, 0.45, { type: 'sine', vol: 0.26, wet: 0.35 })); break;
  }
}
