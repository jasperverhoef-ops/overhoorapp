import { describe, it, expect } from 'vitest';
import { playCorrectSound, playWrongSound, playPerfectSound } from './sounds';

describe('sound functions', () => {
  it('playCorrectSound does not throw', () => {
    expect(() => playCorrectSound()).not.toThrow();
  });

  it('playWrongSound does not throw', () => {
    expect(() => playWrongSound()).not.toThrow();
  });

  it('playPerfectSound does not throw', () => {
    expect(() => playPerfectSound()).not.toThrow();
  });
});
