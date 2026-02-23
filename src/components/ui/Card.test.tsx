import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Card } from './Card';

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<Card className="my-custom">Content</Card>);
    expect(screen.getByText('Content').parentElement?.className || screen.getByText('Content').className).toContain('my-custom');
  });

  it('handles click when onClick provided', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Card onClick={onClick}>Clickable</Card>);

    await user.click(screen.getByText('Clickable'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('has cursor-pointer class when clickable', () => {
    const onClick = vi.fn();
    render(<Card onClick={onClick}>Clickable</Card>);
    const card = screen.getByText('Clickable');
    expect(card.className).toContain('cursor-pointer');
  });

  it('does not have cursor-pointer when not clickable', () => {
    render(<Card>Static</Card>);
    const card = screen.getByText('Static');
    expect(card.className).not.toContain('cursor-pointer');
  });
});
