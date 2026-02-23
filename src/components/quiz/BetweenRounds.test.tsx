import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BetweenRounds } from './BetweenRounds';
import type { RoundResult } from '../../models/types';

function makeRound(roundNumber: 1 | 2, directCorrect: number, totalWords: number): RoundResult {
  return {
    roundNumber,
    roundType: roundNumber === 1 ? 'source-to-dutch' : 'dutch-to-source',
    directCorrect,
    totalWords,
    answers: [],
  };
}

describe('BetweenRounds', () => {
  it('toont resultaten van ronde 1 en 2', () => {
    render(
      <BetweenRounds
        round1={makeRound(1, 8, 10)}
        round2={makeRound(2, 7, 10)}
        difficultWordCount={4}
        onStartRound3={vi.fn()}
      />
    );
    expect(screen.getByText('Ronde 1 & 2 voltooid')).toBeInTheDocument();
    expect(screen.getByText('8/10 (80%)')).toBeInTheDocument();
    expect(screen.getByText('7/10 (70%)')).toBeInTheDocument();
  });

  it('toont aantal moeilijke woorden', () => {
    render(
      <BetweenRounds
        round1={makeRound(1, 8, 10)}
        round2={makeRound(2, 7, 10)}
        difficultWordCount={4}
        onStartRound3={vi.fn()}
      />
    );
    expect(screen.getByText(/4/)).toBeInTheDocument();
    expect(screen.getByText('Ronde 3: Moeilijke woorden')).toBeInTheDocument();
  });

  it('start ronde 3 knop werkt', async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    render(
      <BetweenRounds
        round1={makeRound(1, 8, 10)}
        round2={makeRound(2, 7, 10)}
        difficultWordCount={4}
        onStartRound3={onStart}
      />
    );

    await user.click(screen.getByText('Start Ronde 3'));
    expect(onStart).toHaveBeenCalledOnce();
  });
});
