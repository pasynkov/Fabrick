import { useEffect, useState } from 'react';
import { api } from '../api';
import { ApiKeyForm } from './ApiKeyForm';
import { ApiKeyStatusDisplay } from './ApiKeyStatusDisplay';

interface ProjectKeyResolutionChainProps {
  orgId: string;
  projectId: string;
  isAdmin: boolean;
}

interface ProjectApiKeyStatus {
  hasProjectApiKey: boolean;
  hasOrgApiKey: boolean;
  effectiveSource: 'project' | 'organization' | 'none';
  keyHashes: {
    project?: string;
    organization?: string;
  };
}

export function ProjectKeyResolutionChain({ orgId, projectId, isAdmin }: ProjectKeyResolutionChainProps) {
  const [status, setStatus] = useState<ProjectApiKeyStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.projects.apiKey.status(projectId)
      .then(setStatus)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  async function handleSave(apiKey: string | null) {
    await api.projects.update(orgId, projectId, { anthropicApiKey: apiKey });
    const updated = await api.projects.apiKey.status(projectId);
    setStatus(updated);
  }

  if (loading) return <p className="text-xs text-gray-400">Loading...</p>;
  if (!status) return null;

  const effectiveSource = status.effectiveSource;
  const noKey = effectiveSource === 'none';

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-500">Effective API key:</span>
        {noKey ? (
          <span className="text-xs text-red-500">No API key configured</span>
        ) : (
          <span className="text-xs text-green-600 font-medium">
            Using {effectiveSource}-level key
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="bg-gray-50 rounded p-2">
          <p className="font-medium text-gray-700 mb-1">Project key</p>
          <ApiKeyStatusDisplay
            hasApiKey={status.hasProjectApiKey}
            keyHash={status.keyHashes.project}
            source="project"
          />
        </div>
        <div className="bg-gray-50 rounded p-2">
          <p className="font-medium text-gray-700 mb-1">Organization key (fallback)</p>
          <ApiKeyStatusDisplay
            hasApiKey={status.hasOrgApiKey}
            keyHash={status.keyHashes.organization}
            source="organization"
          />
        </div>
      </div>

      {isAdmin && (
        <ApiKeyForm onSave={handleSave} hasExistingKey={status.hasProjectApiKey} />
      )}
    </div>
  );
}
