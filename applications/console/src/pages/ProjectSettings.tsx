import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { ApiKeyStatusDisplay } from '../components/ApiKeyStatusDisplay';
import { AppLayout } from '../components/ui/AppLayout';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

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
        return Promise.all([
          api.projects.getSettings(p.id),
          api.projects.apiKey.status(p.id),
        ]).then(([settings, keyStatus]) => {
          setName(settings.name);
          setAutoSynthesisEnabled(settings.autoSynthesisEnabled);
          setHasApiKey(keyStatus.hasProjectApiKey);
          setApiKeyHash(keyStatus.keyHashes.project);
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
      if (trimmedKey) {
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

  if (initializing) return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <p className="text-text-muted">Loading...</p>
    </div>
  );

  return (
    <AppLayout>
      <div className="mb-6">
        <nav className="text-sm text-text-muted">
          <Link to="/" className="hover:text-text-primary transition-colors">Orgs</Link>
          <span className="mx-2">/</span>
          <Link to={`/orgs/${orgSlug}`} className="hover:text-text-primary transition-colors">{orgSlug}</Link>
          <span className="mx-2">/</span>
          <Link to={`/orgs/${orgSlug}/projects/${projectSlug}`} className="hover:text-text-primary transition-colors">{projectSlug}</Link>
          <span className="mx-2">/</span>
          <span className="text-text-primary font-medium">Settings</span>
        </nav>
      </div>

      <div className="max-w-md">
        <h2 className="text-xl font-semibold mb-6 text-text-primary">Project Settings</h2>
        {error && <p className="text-danger text-sm mb-4">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Name</label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={128}
              required
            />
            <p className="text-xs text-text-muted mt-1">{name.length}/128</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Anthropic API Key</label>
            <div className="mb-1">
              <ApiKeyStatusDisplay hasApiKey={hasApiKey} keyHash={apiKeyHash} />
            </div>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={hasApiKey ? 'Enter new key to replace current' : 'sk-ant-...'}
            />
            <p className="text-xs text-text-muted mt-1">Leave empty to keep existing key or use organization-level key</p>
          </div>
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={autoSynthesisEnabled}
                onChange={(e) => setAutoSynthesisEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-border"
              />
              <span className="text-sm font-medium text-text-primary">Run synthesis automatically on context update</span>
            </label>
            <p className="text-xs text-text-muted mt-1 ml-7">When enabled, synthesis runs automatically after CLI push operations</p>
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save'}
            </Button>
            <Link
              to={`/orgs/${orgSlug}/projects/${projectSlug}`}
              className="inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent-indigo/50 border border-border bg-surface-1/50 text-text-primary hover:bg-surface-2 px-4 py-2 text-sm"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
