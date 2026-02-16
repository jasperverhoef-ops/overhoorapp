let audioContext: AudioContext | null = null;

function getContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

function playTone(frequency: number, duration: number, type: OscillatorType = 'sine', gain = 0.3) {
  const ctx = getContext();
  const osc = ctx.createOscillator();
  const vol = ctx.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  vol.gain.value = gain;
  vol.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
  osc.connect(vol);
  vol.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

export function playCorrectSound() {
  const ctx = getContext();
  const osc = ctx.createOscillator();
  const vol = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(523, ctx.currentTime);
  osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1);
  vol.gain.value = 0.25;
  vol.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
  osc.connect(vol);
  vol.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.3);
}

export function playWrongSound() {
  playTone(200, 0.3, 'triangle', 0.2);
}

export function playPerfectSound() {
  const ctx = getContext();
  const notes = [523, 659, 784, 1047];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    vol.gain.value = 0.2;
    vol.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.15 + 0.3);
    osc.connect(vol);
    vol.connect(ctx.destination);
    osc.start(ctx.currentTime + i * 0.15);
    osc.stop(ctx.currentTime + i * 0.15 + 0.3);
  });
}
