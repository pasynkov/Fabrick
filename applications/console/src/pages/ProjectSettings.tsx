import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { ApiKeyStatusDisplay } from '../components/ApiKeyStatusDisplay';

export default function ProjectSettings() {
  const { orgSlug, projectSlug } = useParams<{ orgSlug: string; projectSlug: string }>();
  const navigate = useNavigate();
  const [orgId, setOrgId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [name, setName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [autoSynthesisEnabled, setAutoSynthesisEnabled] = useState(false);
  const [apiKeyHash, setApiKeyHash] = useState<string | undefined>(undefined);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    api.orgs.list().then((orgs) => {
      const org = orgs.find((o) => o.slug === orgSlug);
      if (!org) return;
      if (org.role !== 'admin') {
        navigate(`/orgs/${orgSlug}/projects/${projectSlug}`);
        return;
      }
      setOrgId(org.id);
      return api.projects.list(org.id).then((projects) => {
        const p = projects.find((pr) => pr.slug === projectSlug);
        if (!p) return;
        setProjectId(p.id);
        setName(p.name);
        setAutoSynthesisEnabled(p.autoSynthesisEnabled ?? false);
        return api.projects.apiKey.status(p.id).then((status) => {
          setHasApiKey(status.hasProjectApiKey);
          setApiKeyHash(status.keyHashes.project);
        });
      });
    }).finally(() => setInitializing(false));
  }, [orgSlug, projectSlug, navigate]);

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
      const payload: { name: string; autoSynthesisEnabled: boolean; anthropicApiKey?: string | null } = {
        name: name.trim(),
        autoSynthesisEnabled,
      };
      if (trimmedKey !== '') {
        payload.anthropicApiKey = trimmedKey;
      }
      const updated = await api.projects.update(orgId, projectId, payload);
      const newStatus = await api.projects.apiKey.status(projectId);
      setHasApiKey(newStatus.hasProjectApiKey);
      setApiKeyHash(newStatus.keyHashes.project);
      setApiKey('');
      navigate(`/orgs/${orgSlug}/projects/${updated.slug}`);
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
          <Link to={`/orgs/${orgSlug}/projects/${projectSlug}`} className="hover:underline">{projectSlug}</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-900 font-medium">Settings</span>
        </nav>
      </header>
      <main className="max-w-md mx-auto py-10 px-4">
        <h2 className="text-xl font-semibold mb-6 text-gray-900">Project Settings</h2>
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
            <p className="text-xs text-gray-400 mt-1">Leave empty to keep existing key or use organization-level key</p>
          </div>
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={autoSynthesisEnabled}
                onChange={(e) => setAutoSynthesisEnabled(e.target.checked)}
                className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
              />
              <span className="text-sm font-medium text-gray-700">Run synthesis automatically on context update</span>
            </label>
            <p className="text-xs text-gray-400 mt-1 ml-7">When enabled, synthesis runs automatically after CLI push operations</p>
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
              to={`/orgs/${orgSlug}/projects/${projectSlug}`}
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
