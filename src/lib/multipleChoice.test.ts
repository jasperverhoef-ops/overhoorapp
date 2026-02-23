import { describe, it, expect, beforeEach } from 'vitest';
import { generateChoices } from './multipleChoice';
import { createWords, resetWordCounter } from '../test/helpers';

beforeEach(() => {
  resetWordCounter();
});

describe('generateChoices', () => {
  it('returns exactly 4 options', () => {
    const words = createWords(5);
    const choices = generateChoices(words[0], words, 'source-to-dutch');
    expect(choices).toHaveLength(4);
  });

  it('includes exactly one correct answer (source-to-dutch)', () => {
    const words = createWords(5);
    const choices = generateChoices(words[0], words, 'source-to-dutch');
    const correct = choices.filter((c) => c.isCorrect);
    expect(correct).toHaveLength(1);
    expect(correct[0].text).toBe(words[0].dutchWord);
  });

  it('includes exactly one correct answer (dutch-to-source)', () => {
    const words = createWords(5);
    const choices = generateChoices(words[0], words, 'dutch-to-source');
    const correct = choices.filter((c) => c.isCorrect);
    expect(correct).toHaveLength(1);
    expect(correct[0].text).toBe(words[0].sourceWord);
  });

  it('includes 3 distractors from other words', () => {
    const words = createWords(5);
    const choices = generateChoices(words[0], words, 'source-to-dutch');
    const incorrect = choices.filter((c) => !c.isCorrect);
    expect(incorrect).toHaveLength(3);
    // All distractors should be dutch words of other items
    const otherDutch = words.slice(1).map((w) => w.dutchWord);
    incorrect.forEach((d) => {
      expect(otherDutch).toContain(d.text);
    });
  });

  it('handles word list with fewer than 4 words (pads distractors)', () => {
    const words = createWords(2);
    const choices = generateChoices(words[0], words, 'source-to-dutch');
    expect(choices).toHaveLength(4);
    const correct = choices.filter((c) => c.isCorrect);
    expect(correct).toHaveLength(1);
  });

  it('handles single word list', () => {
    const words = createWords(1);
    const choices = generateChoices(words[0], words, 'source-to-dutch');
    expect(choices).toHaveLength(4);
    expect(choices.filter((c) => c.isCorrect)).toHaveLength(1);
  });

  it('shuffles the options (not always correct first)', () => {
    const words = createWords(5);
    const positions = new Set<number>();
    for (let i = 0; i < 30; i++) {
      const choices = generateChoices(words[0], words, 'source-to-dutch');
      const correctIdx = choices.findIndex((c) => c.isCorrect);
      positions.add(correctIdx);
    }
    // The correct answer should appear at different positions
    expect(positions.size).toBeGreaterThan(1);
  });
});
