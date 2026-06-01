import { useEffect, useState } from 'react';
import { api } from '../api';

interface AuditLog {
  id: string;
  action: string;
  level: string;
  userId: string;
  keyHash: string;
  details: string | null;
  ipAddress: string | null;
  timestamp: string;
}

interface ApiKeyAuditLogsProps {
  type: 'org' | 'project';
  resourceId: string;
}

export function ApiKeyAuditLogs({ type, resourceId }: ApiKeyAuditLogsProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const fetch = type === 'org'
      ? api.orgs.apiKey.auditLogs(resourceId)
      : api.projects.apiKey.auditLogs(resourceId);
    fetch
      .then(({ logs, total }) => { setLogs(logs); setTotal(total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, type, resourceId]);

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-text-muted hover:text-text-primary transition-colors"
      >
        {open ? 'Hide' : 'Show'} audit logs ({total})
      </button>

      {open && (
        <div className="mt-2">
          {loading ? (
            <p className="text-xs text-text-muted">Loading...</p>
          ) : logs.length === 0 ? (
            <p className="text-xs text-text-muted">No audit logs yet.</p>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-text-muted border-b border-border">
                  <th className="text-left py-1 pr-3">Time</th>
                  <th className="text-left py-1 pr-3">Action</th>
                  <th className="text-left py-1 pr-3">User</th>
                  <th className="text-left py-1">Key</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-border">
                    <td className="py-1 pr-3 text-text-muted">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-1 pr-3">
                      <span className={`font-medium ${
                        log.action === 'delete' ? 'text-danger' :
                        log.action === 'validation_failed' ? 'text-yellow-500' :
                        'text-text-primary'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="py-1 pr-3 text-text-muted font-mono truncate max-w-xs">
                      {log.userId}
                    </td>
                    <td className="py-1 text-text-muted font-mono">...{log.keyHash}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
