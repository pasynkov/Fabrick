import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PromptsList from './PromptsList';
import * as apiModule from '../api';

vi.mock('../api', async (importOriginal) => {
  const original = await importOriginal<typeof apiModule>();
  return {
    ...original,
    api: {
      ...original.api,
      admin: {
        ...original.api.admin,
        prompts: {
          list: vi.fn(),
        },
      },
    },
  };
});

const mockList = vi.mocked(apiModule.api.admin.prompts.list);

function renderComponent() {
  return render(
    <MemoryRouter>
      <PromptsList />
    </MemoryRouter>,
  );
}

describe('PromptsList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state while fetch is in flight', () => {
    mockList.mockReturnValue(new Promise(() => {}));
    renderComponent();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders table rows after successful fetch', async () => {
    mockList.mockResolvedValue([
      {
        id: 'id-1',
        name: 'search',
        agent: 'claude',
        revision: 3,
        updatedAt: '2024-01-01T00:00:00.000Z',
        createdBy: 'user-uuid-1',
      },
      {
        id: 'id-2',
        name: 'synthesis',
        agent: 'claude',
        revision: 1,
        updatedAt: '2024-01-02T00:00:00.000Z',
        createdBy: 'user-uuid-2',
      },
    ]);
    renderComponent();
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());

    expect(screen.getByText('search')).toBeInTheDocument();
    expect(screen.getByText('synthesis')).toBeInTheDocument();
    // Links point to correct path
    const link = screen.getByRole('link', { name: 'search' });
    expect(link).toHaveAttribute('href', '/prompts/search/claude');
  });

  it('shows empty state message when list is empty', async () => {
    mockList.mockResolvedValue([]);
    renderComponent();
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());
    expect(screen.getByText('No prompts found.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows error message when fetch fails', async () => {
    mockList.mockRejectedValue(new Error('Network error'));
    renderComponent();
    await waitFor(() => expect(screen.getByText('Network error')).toBeInTheDocument());
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
