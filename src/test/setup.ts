import '@testing-library/jest-dom/vitest';

// Mock crypto.randomUUID
if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', {
    value: {
      randomUUID: () => 'test-uuid-' + Math.random().toString(36).slice(2),
    },
  });
} else if (!globalThis.crypto.randomUUID) {
  globalThis.crypto.randomUUID = () => 'test-uuid-' + Math.random().toString(36).slice(2) as `${string}-${string}-${string}-${string}-${string}`;
}

// Mock sessionStorage
const store: Record<string, string> = {};
const mockSessionStorage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); },
  get length() { return Object.keys(store).length; },
  key: (i: number) => Object.keys(store)[i] ?? null,
};
Object.defineProperty(globalThis, 'sessionStorage', { value: mockSessionStorage });

// Mock localStorage
const localStore: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => localStore[key] ?? null,
  setItem: (key: string, value: string) => { localStore[key] = value; },
  removeItem: (key: string) => { delete localStore[key]; },
  clear: () => { Object.keys(localStore).forEach(k => delete localStore[k]); },
  get length() { return Object.keys(localStore).length; },
  key: (i: number) => Object.keys(localStore)[i] ?? null,
};
Object.defineProperty(globalThis, 'localStorage', { value: mockLocalStorage });

// Mock AudioContext
class MockOscillator {
  type = 'sine';
  frequency = { value: 440, setValueAtTime: () => {} };
  connect() { return this; }
  start() {}
  stop() {}
}
class MockGainNode {
  gain = { value: 1, exponentialRampToValueAtTime: () => {} };
  connect() { return this; }
}
class MockAudioContext {
  currentTime = 0;
  destination = {};
  createOscillator() { return new MockOscillator(); }
  createGain() { return new MockGainNode(); }
}
Object.defineProperty(globalThis, 'AudioContext', { value: MockAudioContext });

// Mock navigator.vibrate
Object.defineProperty(navigator, 'vibrate', { value: () => true, writable: true });

// Mock requestAnimationFrame
globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 16) as unknown as number;
globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
