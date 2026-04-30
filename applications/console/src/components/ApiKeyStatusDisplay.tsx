interface ApiKeyStatusProps {
  hasApiKey: boolean;
  keyHash?: string;
  source?: 'organization' | 'project';
}

export function ApiKeyStatusDisplay({ hasApiKey, keyHash, source }: ApiKeyStatusProps) {
  if (!hasApiKey) {
    return (
      <span className="text-xs text-gray-400 italic">No API key configured</span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center gap-1 text-xs text-green-600">
        <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
        API key configured
      </span>
      {keyHash && (
        <span className="text-xs text-gray-400 font-mono">...{keyHash.slice(-8)}</span>
      )}
      {source && (
        <span className="text-xs text-gray-400">({source})</span>
      )}
    </div>
  );
}
