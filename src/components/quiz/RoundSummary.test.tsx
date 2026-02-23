import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RoundSummary } from './RoundSummary';
import type { RoundResult } from '../../models/types';

function makeResult(directCorrect: number, totalWords: number, roundNumber: 1 | 2 = 1): RoundResult {
  return {
    roundNumber,
    roundType: 'source-to-dutch',
    directCorrect,
    totalWords,
    answers: [],
  };
}

describe('RoundSummary', () => {
  it('toont ronde nummer en score', () => {
    render(<RoundSummary result={makeResult(8, 10)} onNext={vi.fn()} />);
    expect(screen.getByText('Ronde 1 voltooid')).toBeInTheDocument();
    expect(screen.getByText('8/10')).toBeInTheDocument();
    expect(screen.getByText(/direct goed \(80%\)/)).toBeInTheDocument();
  });

  it('toont hoeveel woorden extra pogingen nodig hadden', () => {
    render(<RoundSummary result={makeResult(7, 10)} onNext={vi.fn()} />);
    expect(screen.getByText(/3 woorden hadden extra pogingen nodig/)).toBeInTheDocument();
  });

  it('toont niet "extra pogingen" bij perfecte score', () => {
    render(<RoundSummary result={makeResult(10, 10)} onNext={vi.fn()} />);
    expect(screen.queryByText(/extra pogingen/)).not.toBeInTheDocument();
  });

  it('next knop gaat naar volgende ronde', async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    render(<RoundSummary result={makeResult(8, 10)} onNext={onNext} />);

    await user.click(screen.getByText('Verder naar Ronde 2'));
    expect(onNext).toHaveBeenCalledOnce();
  });
});
