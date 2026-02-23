import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RoundIntro } from './RoundIntro';

describe('RoundIntro', () => {
  it('toont ronde 1 info', () => {
    const onStart = vi.fn();
    render(
      <RoundIntro round={1} sourceLanguage="en" totalWords={10} onStart={onStart} />
    );
    expect(screen.getByText('Ronde 1')).toBeInTheDocument();
    expect(screen.getByText(/Engels → Nederlands/)).toBeInTheDocument();
    expect(screen.getByText('10 woorden')).toBeInTheDocument();
  });

  it('toont ronde 2 info', () => {
    render(
      <RoundIntro round={2} sourceLanguage="fr" totalWords={8} onStart={vi.fn()} />
    );
    expect(screen.getByText('Ronde 2')).toBeInTheDocument();
    expect(screen.getByText(/Nederlands → Frans/)).toBeInTheDocument();
  });

  it('toont ronde 3 info met moeilijke woorden', () => {
    render(
      <RoundIntro round={3} sourceLanguage="de" totalWords={10} difficultWordCount={3} onStart={vi.fn()} />
    );
    expect(screen.getByText('Ronde 3')).toBeInTheDocument();
    expect(screen.getByText('3 woorden')).toBeInTheDocument();
    expect(screen.getByText(/3 moeilijke woorden/)).toBeInTheDocument();
  });

  it('start knop werkt', async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    render(
      <RoundIntro round={1} sourceLanguage="en" totalWords={5} onStart={onStart} />
    );

    await user.click(screen.getByText('Start Ronde 1'));
    expect(onStart).toHaveBeenCalledOnce();
  });

  it('toont self-mode beschrijving', () => {
    render(
      <RoundIntro round={1} sourceLanguage="en" totalWords={5} mode="self" onStart={vi.fn()} />
    );
    expect(screen.getByText(/Kies de juiste Nederlandse vertaling/)).toBeInTheDocument();
  });

  it('toont parent-mode beschrijving', () => {
    render(
      <RoundIntro round={1} sourceLanguage="en" totalWords={5} mode="parent" onStart={vi.fn()} />
    );
    expect(screen.getByText(/Lees het woord in de vreemde taal voor/)).toBeInTheDocument();
  });
});
