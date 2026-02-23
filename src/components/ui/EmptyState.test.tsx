import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(
      <EmptyState
        icon={<span data-testid="icon">icon</span>}
        title="No items"
        description="You have no items yet"
      />
    );
    expect(screen.getByText('No items')).toBeInTheDocument();
    expect(screen.getByText('You have no items yet')).toBeInTheDocument();
  });

  it('renders icon', () => {
    render(
      <EmptyState
        icon={<span data-testid="icon">icon</span>}
        title="Title"
        description="Desc"
      />
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('renders action when provided', () => {
    render(
      <EmptyState
        icon={<span>icon</span>}
        title="Title"
        description="Desc"
        action={<button>Add item</button>}
      />
    );
    expect(screen.getByText('Add item')).toBeInTheDocument();
  });

  it('does not render action when not provided', () => {
    render(
      <EmptyState
        icon={<span>icon</span>}
        title="Title"
        description="Desc"
      />
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
