import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { ApiKeyStatusDisplay } from '../components/ApiKeyStatusDisplay';
import { AppLayout } from '../components/ui/AppLayout';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

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
          <span className="text-text-primary font-medium">Settings</span>
        </nav>
      </div>

      <div className="max-w-md">
        <h2 className="text-xl font-semibold mb-6 text-text-primary">Organization Settings</h2>
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
            <p className="text-xs text-text-muted mt-1">Leave empty to keep existing key</p>
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save'}
            </Button>
            <Button as={Link} to={`/orgs/${orgSlug}`} variant="secondary">
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
