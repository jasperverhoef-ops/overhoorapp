import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BadgeDisplay } from './BadgeDisplay';
import type { Badge } from '../../models/badges';

function makeBadge(id: string, earned: boolean): Badge {
  return {
    id,
    emoji: earned ? '\u2B50' : '\u{1F512}',
    name: `Badge ${id}`,
    description: `Description ${id}`,
    earned,
  };
}

describe('BadgeDisplay', () => {
  it('renders nothing for empty badges', () => {
    const { container } = render(<BadgeDisplay badges={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows badge count', () => {
    const badges = [makeBadge('a', true), makeBadge('b', false), makeBadge('c', true)];
    render(<BadgeDisplay badges={badges} />);
    expect(screen.getByText('Badges (2/3)')).toBeInTheDocument();
  });

  it('renders earned badges', () => {
    const badges = [makeBadge('earned-1', true)];
    render(<BadgeDisplay badges={badges} />);
    expect(screen.getByText('Badge earned-1')).toBeInTheDocument();
  });

  it('renders locked badges with reduced opacity', () => {
    const badges = [makeBadge('locked-1', false)];
    render(<BadgeDisplay badges={badges} />);
    const name = screen.getByText('Badge locked-1');
    // The parent container should have opacity-40
    const card = name.closest('[class*="opacity-40"]');
    expect(card).not.toBeNull();
  });

  it('renders both earned and locked badges', () => {
    const badges = [makeBadge('e1', true), makeBadge('l1', false)];
    render(<BadgeDisplay badges={badges} />);
    expect(screen.getByText('Badge e1')).toBeInTheDocument();
    expect(screen.getByText('Badge l1')).toBeInTheDocument();
  });
});
