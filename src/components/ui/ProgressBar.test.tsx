import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressBar } from './ProgressBar';

describe('ProgressBar', () => {
  it('renders with label showing current/total', () => {
    render(<ProgressBar current={3} total={10} />);
    expect(screen.getByText('3/10 (30%)')).toBeInTheDocument();
  });

  it('calculates percentage correctly', () => {
    render(<ProgressBar current={1} total={3} />);
    expect(screen.getByText('1/3 (33%)')).toBeInTheDocument();
  });

  it('shows 0% for 0 total', () => {
    render(<ProgressBar current={0} total={0} />);
    expect(screen.getByText('0/0 (0%)')).toBeInTheDocument();
  });

  it('shows 100%', () => {
    render(<ProgressBar current={10} total={10} />);
    expect(screen.getByText('10/10 (100%)')).toBeInTheDocument();
  });

  it('hides label when showLabel is false', () => {
    render(<ProgressBar current={5} total={10} showLabel={false} />);
    expect(screen.queryByText(/5\/10/)).not.toBeInTheDocument();
  });
});
