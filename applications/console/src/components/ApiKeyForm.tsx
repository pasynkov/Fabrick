import { useState } from 'react';

interface ApiKeyFormProps {
  onSave: (apiKey: string | null) => Promise<void>;
  hasExistingKey: boolean;
}

export function ApiKeyForm({ onSave, hasExistingKey }: ApiKeyFormProps) {
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!apiKey.trim()) return;
    setSaving(true);
    setError('');
    try {
      await onSave(apiKey.trim());
      setApiKey('');
      setShowForm(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save API key');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Remove this API key?')) return;
    setSaving(true);
    setError('');
    try {
      await onSave(null);
    } catch (err: any) {
      setError(err.message || 'Failed to remove API key');
    } finally {
      setSaving(false);
    }
  }

  if (!showForm) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowForm(true)}
          className="text-sm text-purple-600 hover:underline"
        >
          {hasExistingKey ? 'Update API key' : 'Set API key'}
        </button>
        {hasExistingKey && (
          <button
            onClick={handleDelete}
            disabled={saving}
            className="text-sm text-red-500 hover:underline disabled:opacity-50"
          >
            Remove
          </button>
        )}
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-ant-..."
          className="border border-gray-300 rounded px-3 py-1.5 text-sm flex-1 font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
          autoFocus
        />
        <button
          type="submit"
          disabled={saving || !apiKey.trim()}
          className="bg-purple-600 text-white rounded px-3 py-1.5 text-sm hover:bg-purple-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => { setShowForm(false); setApiKey(''); setError(''); }}
          className="text-sm text-gray-500 hover:underline"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </form>
  );
}
