import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { ApiKeyStatusDisplay } from '../components/ApiKeyStatusDisplay';

export default function OrgSettings() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const navigate = useNavigate();
  const [orgId, setOrgId] = useState('');
  const [name, setName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiKeyHash, setApiKeyHash] = useState<string | undefined>(undefined);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    api.orgs.list().then((orgs) => {
      const found = orgs.find((o) => o.slug === orgSlug);
      if (!found) return;
      if (found.role !== 'admin') {
        navigate(`/orgs/${orgSlug}`);
        return;
      }
      setOrgId(found.id);
      setName(found.name);
      return api.orgs.apiKey.status(found.id).then((status) => {
        setHasApiKey(status.hasApiKey);
        setApiKeyHash(status.keyHash);
      });
    }).finally(() => setInitializing(false));
  }, [orgSlug, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Name must not be empty'); return; }
    if (name.length > 128) { setError('Name must not exceed 128 characters'); return; }
    const trimmedKey = apiKey.trim();
    if (trimmedKey && !trimmedKey.startsWith('sk-ant-')) {
      setError('API key must start with sk-ant-');
      return;
    }
    setLoading(true);
    try {
      const payload: { name: string; anthropicApiKey?: string | null } = {
        name: name.trim(),
      };
      if (trimmedKey) {
        payload.anthropicApiKey = trimmedKey;
      }
      const updated = await api.orgs.update(orgId, payload);
      const newStatus = await api.orgs.apiKey.status(orgId);
      setHasApiKey(newStatus.hasApiKey);
      setApiKeyHash(newStatus.keyHash);
      setApiKey('');
      navigate(`/orgs/${updated.slug}`);
    } catch (err: any) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  }

  if (initializing) return <div className="p-8 text-gray-400">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <nav className="text-sm text-gray-500">
          <Link to="/" className="hover:underline">Orgs</Link>
          <span className="mx-2">/</span>
          <Link to={`/orgs/${orgSlug}`} className="hover:underline">{orgSlug}</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-900 font-medium">Settings</span>
        </nav>
      </header>
      <main className="max-w-md mx-auto py-10 px-4">
        <h2 className="text-xl font-semibold mb-6 text-gray-900">Organization Settings</h2>
        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={128}
              required
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <p className="text-xs text-gray-400 mt-1">{name.length}/128</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Anthropic API Key</label>
            <div className="mb-1">
              <ApiKeyStatusDisplay hasApiKey={hasApiKey} keyHash={apiKeyHash} />
            </div>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={hasApiKey ? 'Enter new key to replace current' : 'sk-ant-...'}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <p className="text-xs text-gray-400 mt-1">Leave empty to keep existing key</p>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="bg-purple-600 text-white rounded px-4 py-2 text-sm hover:bg-purple-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
            <Link
              to={`/orgs/${orgSlug}`}
              className="border border-gray-300 rounded px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}
