import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PromptDetail from './PromptDetail';
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
          latest: vi.fn(),
          history: vi.fn(),
          revision: vi.fn(),
          create: vi.fn(),
        },
      },
    },
  };
});

const mockLatest = vi.mocked(apiModule.api.admin.prompts.latest);
const mockHistory = vi.mocked(apiModule.api.admin.prompts.history);
const mockRevision = vi.mocked(apiModule.api.admin.prompts.revision);
const mockCreate = vi.mocked(apiModule.api.admin.prompts.create);

const baseRow: apiModule.AdminPromptRevision = {
  id: 'row-id-1',
  name: 'search',
  agent: 'claude',
  revision: 1,
  content: { files: { 'prompt.md': 'hello world' } },
  note: null,
  createdBy: 'user-1',
  createdAt: '2024-01-01T00:00:00.000Z',
};

function renderComponent(name = 'search', agent = 'claude') {
  return render(
    <MemoryRouter initialEntries={[`/prompts/${name}/${agent}`]}>
      <Routes>
        <Route path="/prompts/:name/:agent" element={<PromptDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PromptDetail - Edit tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function getFilesTextarea() {
    // The textarea is the first textbox (textarea element)
    return screen.getAllByRole('textbox')[0] as HTMLTextAreaElement;
  }

  it('pre-populates textarea with pretty-printed JSON on mount', async () => {
    mockLatest.mockResolvedValue(baseRow);
    renderComponent();
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());

    const textarea = getFilesTextarea();
    expect(textarea).toHaveValue(JSON.stringify(baseRow.content.files, null, 2));
  });

  it('disables Save when textarea is invalid JSON', async () => {
    mockLatest.mockResolvedValue(baseRow);
    renderComponent();
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());

    const textarea = getFilesTextarea();
    fireEvent.change(textarea, { target: { value: '{ invalid json' } });

    const saveBtn = screen.getByRole('button', { name: /save/i });
    expect(saveBtn).toBeDisabled();
    expect(screen.getByText(/parse error/i)).toBeInTheDocument();
  });

  it('disables Save for empty object', async () => {
    mockLatest.mockResolvedValue(baseRow);
    renderComponent();
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());

    const textarea = getFilesTextarea();
    fireEvent.change(textarea, { target: { value: '{}' } });

    const saveBtn = screen.getByRole('button', { name: /save/i });
    expect(saveBtn).toBeDisabled();
    expect(screen.getByText(/at least one file/i)).toBeInTheDocument();
  });

  it('disables Save when a value is not a string', async () => {
    mockLatest.mockResolvedValue(baseRow);
    renderComponent();
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());

    const textarea = getFilesTextarea();
    fireEvent.change(textarea, { target: { value: '{ "SKILL.md": 42 }' } });

    const saveBtn = screen.getByRole('button', { name: /save/i });
    expect(saveBtn).toBeDisabled();
    expect(screen.getByText(/all values must be strings/i)).toBeInTheDocument();
  });

  it('enables Save for a valid object', async () => {
    mockLatest.mockResolvedValue(baseRow);
    renderComponent();
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());

    const textarea = getFilesTextarea();
    fireEvent.change(textarea, { target: { value: '{ "prompt.md": "hello" }' } });

    const saveBtn = screen.getByRole('button', { name: /save/i });
    expect(saveBtn).not.toBeDisabled();
    expect(screen.queryByText(/parse error/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/at least one file/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/all values must be strings/i)).not.toBeInTheDocument();
  });

  it('calls create with correct body, refetches on success, and shows success message', async () => {
    const updatedRow: apiModule.AdminPromptRevision = {
      ...baseRow,
      revision: 2,
      content: { files: { 'prompt.md': 'updated' } },
    };
    mockLatest.mockResolvedValueOnce(baseRow).mockResolvedValueOnce(updatedRow);
    mockCreate.mockResolvedValue({ id: 'new-id', revision: 2 });

    renderComponent();
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());

    const textarea = getFilesTextarea();
    fireEvent.change(textarea, { target: { value: '{ "prompt.md": "updated" }' } });

    const noteInput = screen.getByPlaceholderText(/describe the change/i);
    fireEvent.change(noteInput, { target: { value: 'my note' } });

    const saveBtn = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveBtn);

    await waitFor(() =>
      expect(screen.getByText(/saved successfully as revision 2/i)).toBeInTheDocument(),
    );

    expect(mockCreate).toHaveBeenCalledWith('search', 'claude', {
      files: { 'prompt.md': 'updated' },
      note: 'my note',
    });
    // Verify refetch happened
    expect(mockLatest).toHaveBeenCalledTimes(2);
  });

  it('surfaces backend error message on save failure', async () => {
    mockLatest.mockResolvedValue(baseRow);
    mockCreate.mockRejectedValue(new Error('Bad request from server'));

    renderComponent();
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());

    const saveBtn = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveBtn);

    await waitFor(() =>
      expect(screen.getByText('Bad request from server')).toBeInTheDocument(),
    );
    // Should NOT have refetched
    expect(mockLatest).toHaveBeenCalledTimes(1);
  });
});

describe('PromptDetail - History tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads and renders history list newest first when History tab is clicked', async () => {
    mockLatest.mockResolvedValue(baseRow);
    mockHistory.mockResolvedValue([
      { id: 'h3', name: 'search', agent: 'claude', revision: 3, note: 'third', createdBy: 'u1', createdAt: '2024-01-03T00:00:00.000Z' },
      { id: 'h2', name: 'search', agent: 'claude', revision: 2, note: 'second', createdBy: 'u1', createdAt: '2024-01-02T00:00:00.000Z' },
      { id: 'h1', name: 'search', agent: 'claude', revision: 1, note: null, createdBy: 'u1', createdAt: '2024-01-01T00:00:00.000Z' },
    ]);

    renderComponent();
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /history/i }));

    await waitFor(() => expect(screen.getByText('3')).toBeInTheDocument());
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('third')).toBeInTheDocument();
  });

  it('renders selected revision content read-only when a row is clicked', async () => {
    mockLatest.mockResolvedValue(baseRow);
    mockHistory.mockResolvedValue([
      { id: 'h2', name: 'search', agent: 'claude', revision: 2, note: 'v2', createdBy: 'u1', createdAt: '2024-01-02T00:00:00.000Z' },
    ]);
    const revisionRow: apiModule.AdminPromptRevision = {
      ...baseRow,
      revision: 2,
      content: { files: { 'prompt.md': 'older content' } },
    };
    mockRevision.mockResolvedValue(revisionRow);

    renderComponent();
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /history/i }));
    await waitFor(() => expect(screen.getByText('v2')).toBeInTheDocument());

    fireEvent.click(screen.getByText('v2'));

    await waitFor(() =>
      expect(screen.getByText(/older content/)).toBeInTheDocument(),
    );

    // No Save button in history tab
    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
  });

  it('has no Save button or editing controls in History tab', async () => {
    mockLatest.mockResolvedValue(baseRow);
    mockHistory.mockResolvedValue([]);

    renderComponent();
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /history/i }));
    await waitFor(() => expect(mockHistory).toHaveBeenCalled());

    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});
