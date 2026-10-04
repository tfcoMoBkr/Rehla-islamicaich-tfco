"use client";

/*
 * The lesson board's sounds, made in the browser from filtered noise: chalk on slate, a sheet of
 * paper, running water. Only natural sounds: no music, no jingles, no melodic tones. Nothing is
 * downloaded, so there is no audio file to license or wait for.
 */

let context: AudioContext | null = null;
let noise: AudioBuffer | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined" || !("AudioContext" in window)) return null;
  context ??= new AudioContext();
  if (context.state === "suspended") void context.resume();
  return context;
}

function noiseSource(ctx: AudioContext): AudioBufferSourceNode {
  if (!noise) {
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const samples = noise.getChannelData(0);
    for (let index = 0; index < samples.length; index += 1) samples[index] = Math.random() * 2 - 1;
  }
  const source = ctx.createBufferSource();
  source.buffer = noise;
  source.loop = true;
  return source;
}

function filter(ctx: AudioContext, type: BiquadFilterType, frequency: number, q = 0.7): BiquadFilterNode {
  const node = ctx.createBiquadFilter();
  node.type = type;
  node.frequency.value = frequency;
  node.Q.value = q;
  return node;
}

/** Chalk on slate for about `durationMs`: short, rough strokes. Returns a function that stops it. */
export function playChalk(durationMs: number): () => void {
  const ctx = audio();
  if (!ctx) return () => {};
  const output = ctx.createGain();
  output.gain.value = 0.55;
  output.connect(ctx.destination);
  const sources: AudioBufferSourceNode[] = [];

  let at = ctx.currentTime + 0.02;
  const end = at + durationMs / 1000;
  while (at < end) {
    const stroke = 0.05 + Math.random() * 0.09;
    const source = noiseSource(ctx);
    const band = filter(ctx, "bandpass", 2600 + Math.random() * 1800, 1.4);
    const gain = ctx.createGain();
    const peak = 0.05 + Math.random() * 0.05;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(peak, at + 0.008);
    gain.gain.setValueAtTime(peak * (0.6 + Math.random() * 0.4), at + stroke * 0.5);
    gain.gain.linearRampToValueAtTime(0, at + stroke);
    source.connect(band).connect(filter(ctx, "highpass", 1400)).connect(gain).connect(output);
    source.start(at, Math.random());
    source.stop(at + stroke + 0.02);
    sources.push(source);
    at += stroke + 0.04 + Math.random() * 0.12;
  }

  return () => {
    output.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
    for (const source of sources) {
      try {
        source.stop(ctx.currentTime + 0.1);
      } catch {}
    }
  };
}

/** A sheet of paper turned over: a short rustle that brightens, then settles. */
export function playPaper(): void {
  const ctx = audio();
  if (!ctx) return;
  const now = ctx.currentTime;
  const source = noiseSource(ctx);
  const band = filter(ctx, "bandpass", 700, 0.8);
  band.frequency.setValueAtTime(700, now);
  band.frequency.exponentialRampToValueAtTime(2600, now + 0.18);
  band.frequency.exponentialRampToValueAtTime(1200, now + 0.34);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.11, now + 0.05);
  gain.gain.linearRampToValueAtTime(0.06, now + 0.2);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
  source.connect(band).connect(gain).connect(ctx.destination);
  source.start(now, Math.random());
  source.stop(now + 0.4);
}

/** Water running softly, until the returned function is called; it fades in and out. */
export function startWater(): () => void {
  const ctx = audio();
  if (!ctx) return () => {};
  const now = ctx.currentTime;
  const source = noiseSource(ctx);
  const low = filter(ctx, "lowpass", 1100);
  const band = filter(ctx, "bandpass", 520, 0.6);
  const swirl = ctx.createOscillator();
  const swirlDepth = ctx.createGain();
  swirl.frequency.value = 0.23;
  swirlDepth.gain.value = 180;
  swirl.connect(swirlDepth).connect(band.frequency);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.05, now + 1.5);
  source.connect(low).connect(band).connect(gain).connect(ctx.destination);
  source.start(now);
  swirl.start(now);

  return () => {
    const at = ctx.currentTime;
    gain.gain.cancelScheduledValues(at);
    gain.gain.setValueAtTime(gain.gain.value, at);
    gain.gain.linearRampToValueAtTime(0, at + 0.8);
    source.stop(at + 0.9);
    swirl.stop(at + 0.9);
  };
}
