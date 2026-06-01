import { useEffect, useState } from 'react';
import { api } from '../api';
import { ApiKeyForm } from './ApiKeyForm';
import { ApiKeyStatusDisplay } from './ApiKeyStatusDisplay';
import { Card } from './ui/Card';

interface ApiKeySectionProps {
  orgId: string;
  isAdmin: boolean;
}

interface OrgApiKeyStatus {
  hasApiKey: boolean;
  source: 'organization';
  keyHash?: string;
}

export function ApiKeySection({ orgId, isAdmin }: ApiKeySectionProps) {
  const [status, setStatus] = useState<OrgApiKeyStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return; }
    api.orgs.apiKey.status(orgId)
      .then(setStatus)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orgId, isAdmin]);

  async function handleSave(apiKey: string | null) {
    await api.orgs.update(orgId, { anthropicApiKey: apiKey });
    const updated = await api.orgs.apiKey.status(orgId);
    setStatus(updated);
  }

  if (!isAdmin) return null;
  if (loading) return <p className="text-xs text-text-muted">Loading...</p>;

  return (
    <Card className="p-3 space-y-2">
      <div className="flex items-center justify-between">
        <ApiKeyStatusDisplay
          hasApiKey={status?.hasApiKey ?? false}
          keyHash={status?.keyHash}
        />
      </div>
      <ApiKeyForm onSave={handleSave} hasExistingKey={status?.hasApiKey ?? false} />
    </Card>
  );
}
