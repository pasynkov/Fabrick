import { useState } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';

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
          className="text-sm text-accent-indigo hover:text-accent-indigo-dim transition-colors"
        >
          {hasExistingKey ? 'Update API key' : 'Set API key'}
        </button>
        {hasExistingKey && (
          <button
            onClick={handleDelete}
            disabled={saving}
            className="text-sm text-danger hover:opacity-80 transition-opacity disabled:opacity-50"
          >
            Remove
          </button>
        )}
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-ant-..."
          className="font-mono"
          autoFocus
        />
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={saving || !apiKey.trim()}
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
        <button
          type="button"
          onClick={() => { setShowForm(false); setApiKey(''); setError(''); }}
          className="text-sm text-text-muted hover:text-text-primary transition-colors"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </form>
  );
}
