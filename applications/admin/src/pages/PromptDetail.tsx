import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type AdminPromptHistoryItem, type AdminPromptRevision } from '../api';

type Tab = 'edit' | 'history';

function validateFilesJson(text: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e: unknown) {
    return e instanceof Error ? `Parse error: ${e.message}` : 'Invalid JSON';
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return 'Must be a JSON object';
  }
  const obj = parsed as Record<string, unknown>;
  if (Object.keys(obj).length === 0) {
    return 'At least one file is required';
  }
  for (const [, value] of Object.entries(obj)) {
    if (typeof value !== 'string') {
      return 'All values must be strings';
    }
  }
  return '';
}

export default function PromptDetail() {
  const { name, agent } = useParams<{ name: string; agent: string }>();
  const [activeTab, setActiveTab] = useState<Tab>('edit');

  // Edit tab state
  const [row, setRow] = useState<AdminPromptRevision | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [detailError, setDetailError] = useState('');
  const [filesText, setFilesText] = useState('');
  const [note, setNote] = useState('');
  const [validationError, setValidationError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // History tab state
  const [history, setHistory] = useState<AdminPromptHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [selectedRevision, setSelectedRevision] = useState<AdminPromptRevision | null>(null);
  const [loadingRevision, setLoadingRevision] = useState(false);

  function fetchLatest() {
    if (!name || !agent) return;
    setLoadingDetail(true);
    setDetailError('');
    api.admin.prompts.latest(name, agent)
      .then((data) => {
        setRow(data);
        const text = JSON.stringify(data.content.files, null, 2);
        setFilesText(text);
        setValidationError(validateFilesJson(text));
        setNote('');
      })
      .catch((e) => setDetailError(e.message))
      .finally(() => setLoadingDetail(false));
  }

  useEffect(() => {
    fetchLatest();
  }, [name, agent]);

  function handleFilesChange(text: string) {
    setFilesText(text);
    setValidationError(validateFilesJson(text));
    setSuccessMessage('');
    setSaveError('');
  }

  async function handleSave() {
    if (!name || !agent || validationError) return;
    setSaving(true);
    setSaveError('');
    setSuccessMessage('');
    try {
      const files = JSON.parse(filesText) as Record<string, string>;
      const result = await api.admin.prompts.create(name, agent, { files, note: note || undefined });
      setSuccessMessage(`Saved successfully as revision ${result.revision}`);
      fetchLatest();
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function handleTabChange(tab: Tab) {
    setActiveTab(tab);
    if (tab === 'history' && !historyLoaded) {
      loadHistory();
    }
  }

  function loadHistory() {
    if (!name || !agent) return;
    setLoadingHistory(true);
    setHistoryError('');
    api.admin.prompts.history(name, agent)
      .then((data) => {
        setHistory(data);
        setHistoryLoaded(true);
      })
      .catch((e) => setHistoryError(e.message))
      .finally(() => setLoadingHistory(false));
  }

  function handleRevisionClick(revision: number) {
    if (!name || !agent) return;
    setLoadingRevision(true);
    setSelectedRevision(null);
    api.admin.prompts.revision(name, agent, revision)
      .then(setSelectedRevision)
      .catch(() => {})
      .finally(() => setLoadingRevision(false));
  }

  const tabClass = (tab: Tab) =>
    `px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
      activeTab === tab
        ? 'border-purple-600 text-purple-600'
        : 'border-transparent text-gray-500 hover:text-gray-700'
    }`;

  if (loadingDetail) return <div className="p-6 text-gray-400">Loading...</div>;
  if (detailError) return <div className="p-6 text-red-500">{detailError}</div>;
  if (!row) return null;

  return (
    <div className="p-6">
      <Link to="/prompts" className="text-purple-600 hover:underline text-sm mb-4 block">&larr; Back to Prompts</Link>
      <h2 className="text-lg font-semibold mb-1">{row.name} / {row.agent}</h2>
      <p className="text-sm text-gray-500 mb-4">Current revision: {row.revision}</p>

      <div className="flex border-b border-gray-200 mb-4">
        <button className={tabClass('edit')} onClick={() => handleTabChange('edit')}>Edit</button>
        <button className={tabClass('history')} onClick={() => handleTabChange('history')}>History</button>
      </div>

      {activeTab === 'edit' && (
        <div className="max-w-2xl">
          <label className="block text-sm font-medium text-gray-700 mb-1">Content (files JSON)</label>
          <textarea
            className="w-full h-64 font-mono text-sm border border-gray-300 rounded p-2 focus:outline-none focus:ring-1 focus:ring-purple-500"
            value={filesText}
            onChange={(e) => handleFilesChange(e.target.value)}
          />
          {validationError && (
            <p className="text-red-500 text-sm mt-1">{validationError}</p>
          )}

          <label className="block text-sm font-medium text-gray-700 mt-3 mb-1">Note (optional)</label>
          <input
            type="text"
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Describe the change"
          />

          {saveError && <p className="text-red-500 text-sm mt-2">{saveError}</p>}
          {successMessage && <p className="text-green-600 text-sm mt-2">{successMessage}</p>}

          <button
            className="mt-3 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded disabled:opacity-40 disabled:cursor-not-allowed hover:bg-purple-700"
            onClick={handleSave}
            disabled={!!validationError || saving}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      )}

      {activeTab === 'history' && (
        <div>
          {loadingHistory && <div className="text-gray-400 text-sm">Loading history...</div>}
          {historyError && <div className="text-red-500 text-sm">{historyError}</div>}
          {!loadingHistory && !historyError && history.length === 0 && (
            <p className="text-sm text-gray-400">No history found.</p>
          )}
          {history.length > 0 && (
            <div className="flex gap-6">
              <div className="flex-shrink-0">
                <table className="text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="p-2 border border-gray-200">Revision</th>
                      <th className="p-2 border border-gray-200">Created At</th>
                      <th className="p-2 border border-gray-200">Created By</th>
                      <th className="p-2 border border-gray-200">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr
                        key={h.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => handleRevisionClick(h.revision)}
                      >
                        <td className="p-2 border border-gray-200">{h.revision}</td>
                        <td className="p-2 border border-gray-200">{new Date(h.createdAt).toLocaleString()}</td>
                        <td className="p-2 border border-gray-200 font-mono text-xs">{h.createdBy}</td>
                        <td className="p-2 border border-gray-200">{h.note ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex-1">
                {loadingRevision && <div className="text-gray-400 text-sm">Loading revision...</div>}
                {selectedRevision && !loadingRevision && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Revision {selectedRevision.revision}</p>
                    <pre className="bg-gray-50 border border-gray-200 rounded p-3 text-xs font-mono overflow-auto max-h-96">
                      {JSON.stringify(selectedRevision.content.files, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
