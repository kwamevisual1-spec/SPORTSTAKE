import { useEffect, useState } from "react";

/** Tiny synthesized sound engine (no audio files needed). */

const KEY = "ss.sound.v1";
let enabled = (() => {
  try {
    return localStorage.getItem(KEY) !== "0";
  } catch {
    return true;
  }
})();
let ctx: AudioContext | null = null;
const listeners = new Set<() => void>();

function audio(): AudioContext | null {
  if (!enabled) return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.12, delay = 0, slideTo?: number) {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + delay;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(dur: number, vol = 0.25) {
  const a = audio();
  if (!a) return;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
  const src = a.createBufferSource();
  const filter = a.createBiquadFilter();
  const gain = a.createGain();
  filter.type = "lowpass";
  filter.frequency.value = 900;
  gain.gain.value = vol;
  src.buffer = buf;
  src.connect(filter).connect(gain).connect(a.destination);
  src.start();
}

export const sfx = {
  click: () => tone(520, 0.05, "square", 0.04),
  gem: () => {
    tone(880, 0.12, "sine", 0.14);
    tone(1320, 0.16, "sine", 0.1, 0.06);
  },
  boom: () => {
    noise(0.6, 0.35);
    tone(120, 0.5, "sawtooth", 0.08, 0, 40);
  },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, "triangle", 0.1, i * 0.07)),
  takeoff: () => tone(180, 0.6, "sawtooth", 0.03, 0, 420),
  crash: () => tone(420, 0.55, "sawtooth", 0.06, 0, 70),
};

export function setSound(v: boolean) {
  enabled = v;
  try {
    localStorage.setItem(KEY, v ? "1" : "0");
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function useSound(): [boolean, (v: boolean) => void] {
  const [on, setOn] = useState(enabled);
  useEffect(() => {
    const l = () => setOn(enabled);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return [on, setSound];
}
